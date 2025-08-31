import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {Document, Tenant} from "./models/types";
import { getAdminFirestore, getVertexAI, getSendGrid } from "./config/clients";
import { createLogger, LogHelpers } from "./utils/logger";
import { DocumentStatus } from "./types/DocumentStatus";

/**
 * Cloud Function that triggers when a document is updated.
 * If the document has a validation error related to incorrect address,
 * it generates an AI-powered correction email and sends it to the supplier.
 */
export const requestAddressCorrection = onDocumentUpdated(
  "documents/{documentId}",
  async (event) => {
    // Create structured logger with correlation ID
    const logContext = LogHelpers.createFirestoreContext("documents", event.params.documentId);
    const structuredLogger = createLogger("requestAddressCorrection", logContext);
    const timing = structuredLogger.startFunction();

    try {
      const documentId = event.params.documentId;
      const beforeData = event.data?.before?.data() as Document | undefined;
      const afterData = event.data?.after?.data() as Document | undefined;

      // Check if this is the status change we're interested in
      if (!beforeData || !afterData) {
        structuredLogger.info("No before/after data available - skipping");
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      // Only proceed if status changed to validation_error
      if (afterData.status !== DocumentStatus.VALIDATION_ERROR || 
          beforeData.status === DocumentStatus.VALIDATION_ERROR) {
        structuredLogger.info("Not a new validation error - skipping", {
          beforeStatus: beforeData.status,
          afterStatus: afterData.status
        });
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      // Check if the error is related to incorrect address
      if (!isAddressValidationError(afterData)) {
        structuredLogger.info("Not an address validation error - skipping");
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      structuredLogger.step("Processing address correction request");

      // Get tenant information for correct address
      const tenant = await getTenantInfo(afterData.tenantId);
      if (!tenant) {
        console.error("Tenant not found");
        return;
      }

      // Extract supplier information from the document
      const supplierInfo = extractSupplierInfo(afterData);
      if (!supplierInfo.email) {
        console.error("No supplier email found in document");
        return;
      }

      // Generate AI-powered correction email
      const emailContent = await generateCorrectionEmail({
        supplierName: supplierInfo.name,
        supplierEmail: supplierInfo.email,
        invoiceId: extractInvoiceId(afterData),
        invoiceDate: extractInvoiceDate(afterData),
        incorrectAddress: extractIncorrectAddress(afterData),
        correctAddress: tenant.address,
        companyName: tenant.companyName,
        language: detectLanguage(afterData),
      });

      // Send the correction email
      await sendCorrectionEmail({
        to: supplierInfo.email,
        subject: emailContent.subject,
        body: emailContent.body,
        companyName: tenant.companyName,
      });

      // Update document status to indicate correction has been requested
      const db = getAdminFirestore();
      await db.collection("documents").doc(documentId).update({
        status: "in_correction_address",
        updatedAt: new Date(),
        correctionRequestedAt: new Date(),
        correctionRequestedTo: supplierInfo.email,
      });

      console.log(`Address correction email sent successfully for document ${documentId}`);
      structuredLogger.step("Address correction completed successfully");
      structuredLogger.endFunction(timing.startTime);

    } catch (error) {
      structuredLogger.failFunction(timing.startTime, error as Error);
      
      // Update document with error information
      const db = getAdminFirestore();
      await db.collection("documents").doc(event.params.documentId).update({
        correctionError: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      });
    }
  }
);

/**
 * Check if the validation error is related to incorrect address
 */
function isAddressValidationError(document: Document): boolean {
  if (!document.errorDetails && !document.validationError) {
    return false;
  }

  const errorMessage = document.errorDetails?.message || document.validationError || "";
  const addressKeywords = [
    "address", "adresse", "recipient", "empfänger", 
    "billing", "rechnung", "incorrect", "falsch"
  ];

  return addressKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Get tenant information from Firestore
 */
async function getTenantInfo(tenantId: string): Promise<Tenant | null> {
  try {
    const db = getAdminFirestore();
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    if (!tenantDoc.exists) {
      return null;
    }
    return tenantDoc.data() as Tenant;
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return null;
  }
}

/**
 * Extract supplier information from document
 */
function extractSupplierInfo(document: Document): {name: string; email: string} {
  const extractedData = document.extractedData as any;
  
  return {
    name: extractedData?.supplier_name || 
          extractedData?.vendor_name || 
          extractedData?.company_name || 
          "Sehr geehrte Damen und Herren",
    email: extractedData?.supplier_email || 
           extractedData?.vendor_email || 
           extractedData?.contact_email || "",
  };
}

/**
 * Extract invoice ID from document
 */
function extractInvoiceId(document: Document): string {
  const extractedData = document.extractedData as any;
  return extractedData?.invoice_number || 
         extractedData?.invoice_id || 
         extractedData?.document_number || 
         "N/A";
}

/**
 * Extract invoice date from document
 */
function extractInvoiceDate(document: Document): string {
  const extractedData = document.extractedData as any;
  const date = extractedData?.invoice_date || 
               extractedData?.document_date || 
               extractedData?.date;
  
  if (date) {
    try {
      return new Date(date).toLocaleDateString("de-DE");
    } catch {
      return date.toString();
    }
  }
  return "N/A";
}

/**
 * Extract incorrect address from document
 */
function extractIncorrectAddress(document: Document): string {
  const extractedData = document.extractedData as any;
  const address = extractedData?.recipient_address || 
                  extractedData?.billing_address || 
                  extractedData?.address || "";
  
  if (typeof address === "object") {
    return Object.values(address).join(", ");
  }
  return address.toString();
}

/**
 * Detect language from document content (simple heuristic)
 */
function detectLanguage(document: Document): "de" | "en" {
  const extractedData = document.extractedData as any;
  const text = JSON.stringify(extractedData).toLowerCase();
  
  // Simple German detection based on common words
  const germanWords = ["rechnung", "umsatzsteuer", "mwst", "betrag", "datum", "firma"];
  const germanMatches = germanWords.filter(word => text.includes(word)).length;
  
  return germanMatches > 1 ? "de" : "en";
}

/**
 * Generate AI-powered correction email using Gemini
 */
async function generateCorrectionEmail(params: {
  supplierName: string;
  supplierEmail: string;
  invoiceId: string;
  invoiceDate: string;
  incorrectAddress: string;
  correctAddress: any;
  companyName: string;
  language: "de" | "en";
}): Promise<{subject: string; body: string}> {
  const vertexAI = getVertexAI();
  const model = vertexAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const correctAddressString = `${params.correctAddress.street}, ${params.correctAddress.zipCode} ${params.correctAddress.city}, ${params.correctAddress.country}`;

  const prompt = params.language === "de" ? 
    `Sie sind ein höflicher Buchhaltungsassistent für die Firma ${params.companyName}.

Erstellen Sie eine professionelle E-Mail an den Lieferanten ${params.supplierName} mit folgenden Informationen:
- Rechnungsnummer: ${params.invoiceId}
- Rechnungsdatum: ${params.invoiceDate}
- Falsche Adresse auf der Rechnung: ${params.incorrectAddress}
- Korrekte Firmenadresse: ${correctAddressString}

Die E-Mail soll:
1. Höflich und professionell sein
2. Das Problem mit der falschen Adresse erklären
3. Um eine korrigierte Rechnung mit der richtigen Adresse bitten
4. Dankbar und freundlich sein

Antworten Sie im JSON-Format mit:
{
  "subject": "Betreff der E-Mail",
  "body": "Vollständiger E-Mail-Text"
}` :
    `You are a polite accounting assistant for ${params.companyName}.

Create a professional email to supplier ${params.supplierName} with the following information:
- Invoice number: ${params.invoiceId}
- Invoice date: ${params.invoiceDate}
- Incorrect address on invoice: ${params.incorrectAddress}
- Correct company address: ${correctAddressString}

The email should:
1. Be polite and professional
2. Explain the address issue
3. Request a corrected invoice with the proper address
4. Be grateful and friendly

Respond in JSON format with:
{
  "subject": "Email subject line",
  "body": "Complete email text"
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        subject: parsed.subject || "Invoice Address Correction Request",
        body: parsed.body || "Please provide a corrected invoice with the proper address.",
      };
    }
  } catch (error) {
    console.error("Error generating AI email:", error);
  }

  // Fallback template
  return params.language === "de" ? {
    subject: `Korrektur erforderlich - Rechnung ${params.invoiceId}`,
    body: `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Rechnung ${params.invoiceId} vom ${params.invoiceDate}.

Bei der Prüfung ist uns aufgefallen, dass die Rechnungsadresse nicht korrekt ist:
${params.incorrectAddress}

Unsere korrekte Firmenadresse lautet:
${correctAddressString}

Könnten Sie uns bitte eine korrigierte Rechnung mit der richtigen Adresse zusenden?

Vielen Dank für Ihr Verständnis.

Mit freundlichen Grüßen,
${params.companyName}`,
  } : {
    subject: `Address Correction Required - Invoice ${params.invoiceId}`,
    body: `Dear ${params.supplierName},

Thank you for your invoice ${params.invoiceId} dated ${params.invoiceDate}.

During our review, we noticed that the billing address is incorrect:
${params.incorrectAddress}

Our correct company address is:
${correctAddressString}

Could you please send us a corrected invoice with the proper address?

Thank you for your understanding.

Best regards,
${params.companyName}`,
  };
}

/**
 * Send correction email using SendGrid
 */
async function sendCorrectionEmail(params: {
  to: string;
  subject: string;
  body: string;
  companyName: string;
}): Promise<void> {
  const msg = {
    to: params.to,
    from: process.env.SENDGRID_FROM_EMAIL || `noreply@${params.companyName.toLowerCase().replace(/\s+/g, "")}.com`,
    subject: params.subject,
    text: params.body,
    html: params.body.replace(/\n/g, "<br>"),
  };

  const sgMail = getSendGrid();
  await sgMail.send(msg);
}
