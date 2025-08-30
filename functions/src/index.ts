import {onObjectFinalized} from "firebase-functions/v2/storage";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {DocumentProcessorServiceClient} from "@google-cloud/documentai";
import {initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import {getFirestore} from "firebase-admin/firestore";
import {create} from "xmlbuilder2";

// Initialize Firebase Admin SDK
initializeApp();

// --- Configuration ---
// IMPORTANT: Replace with your actual project details
const GcpProject = "eu-vat-refund-app-2025";
const GcpLocation = "eu"; // e.g., 'eu' or 'us'
// The ID of your Document AI Invoice Parser
const ProcessorId = "b334b6308b8afcb6";

// Initialize the Document AI client
const clientOptions = {
  apiEndpoint: "eu-documentai.googleapis.com",
};
const docAiClient = new DocumentProcessorServiceClient(clientOptions);

// --- Helper Functions ---

/**
 * Parse a line item text to extract structured data
 */
function parseLineItem(text: string) {
  // Basic parsing logic - in production, this would be more sophisticated
  const result = {
    description: text,
    netAmount: 0,
    vatRate: 0,
    vatAmount: 0,
    totalAmount: 0
  };

  // Extract amounts using regex patterns
  const amountPattern = /€(\d+\.?\d*)/g;
  const amounts = [...text.matchAll(amountPattern)].map(match => 
    parseFloat(match[1])
  );

  // Extract VAT rate
  const vatRatePattern = /(\d+)%\s*VAT/i;
  const vatMatch = text.match(vatRatePattern);
  if (vatMatch) {
    result.vatRate = parseInt(vatMatch[1]);
  }

  // Simple heuristic: if we have amounts, assume first is net, calculate VAT
  if (amounts.length > 0) {
    result.netAmount = amounts[0];
    if (result.vatRate > 0) {
      result.vatAmount = result.netAmount * (result.vatRate / 100);
      result.totalAmount = result.netAmount + result.vatAmount;
    }
  }

  // Extract description (everything before the first amount)
  const firstAmountIndex = text.indexOf("€");
  if (firstAmountIndex > 0) {
    result.description = text.substring(0, firstAmountIndex).trim();
  }

  return result;
}

/**
 * Check if a line item description is refundable based on EU VAT rules
 */
function isRefundableItem(description: string): {
  isRefundable: boolean;
  euSubCode: string | null;
  reason: string;
} {
  const desc = description.toLowerCase();

  // Non-refundable items
  if (desc.includes("alcohol") || desc.includes("wine") || desc.includes("beer")) {
    return {
      isRefundable: false,
      euSubCode: null,
      reason: "Alcohol products are not eligible for VAT refund"
    };
  }

  if (desc.includes("entertainment") || desc.includes("gift")) {
    return {
      isRefundable: false,
      euSubCode: null,
      reason: "Entertainment and gifts are not eligible for VAT refund"
    };
  }

  // Refundable items with EU sub-codes
  if (desc.includes("hotel") || desc.includes("accommodation")) {
    return {
      isRefundable: true,
      euSubCode: "55.10.10", // Hotel accommodation
      reason: "Business accommodation is refundable"
    };
  }

  if (desc.includes("meal") || desc.includes("restaurant") || desc.includes("food")) {
    return {
      isRefundable: true,
      euSubCode: "56.10.11", // Restaurant services
      reason: "Business meals are refundable"
    };
  }

  if (desc.includes("fuel") || desc.includes("petrol") || desc.includes("gas")) {
    return {
      isRefundable: true,
      euSubCode: "47.30.20", // Fuel
      reason: "Business fuel is refundable"
    };
  }

  if (desc.includes("conference") || desc.includes("training") || desc.includes("seminar")) {
    return {
      isRefundable: true,
      euSubCode: "85.59.12", // Business training
      reason: "Business training and conferences are refundable"
    };
  }

  // Default: assume business expense is refundable
  return {
    isRefundable: true,
    euSubCode: "77.11.00", // General business services
    reason: "General business expense - refundable"
  };
}

export const onInvoiceUpload = onObjectFinalized({cpu: 1}, async (event) => {
  const fileBucket = event.data.bucket;
  const filePath = event.data.name;
  const contentType = event.data.contentType;

  // 1. Validate the file type
  const validTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!contentType || !validTypes.includes(contentType)) {
    logger.warn(`Invalid file type: ${contentType}. Halting execution.`);
    return;
  }
  logger.info(
    `Valid invoice uploaded: ${filePath}. Starting processing.`
  );

  // 2. Fetch file content from Storage
  logger.info("Downloading file from storage for processing");

  try {
    const storage = getStorage();
    const bucket = storage.bucket(fileBucket);
    const file = bucket.file(filePath);

    // Download the file content as a buffer
    const [fileBuffer] = await file.download();
    logger.info(
      `Downloaded file: ${filePath}, size: ${fileBuffer.length} bytes`
    );

    // 3. Call Google Document AI with raw document content
    const name =
      `projects/${GcpProject}/locations/${GcpLocation}/` +
      `processors/${ProcessorId}`;

    let document: any;
    
    // Check if running in emulator environment for testing
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true" || 
                      process.env.FIRESTORE_EMULATOR_HOST;
    
    if (isEmulator) {
      logger.info("Running in emulator - using mock Document AI response");
      // Mock Document AI response for testing
      document = {
        entities: [
          {
            type: "invoice_id",
            mentionText: "INV-2025-001"
          },
          {
            type: "invoice_date", 
            mentionText: "2025-08-11"
          },
          {
            type: "supplier_name",
            mentionText: "Test Company Ltd"
          },
          {
            type: "total_amount",
            mentionText: "€1,210.00"
          },
          {
            type: "net_amount",
            mentionText: "€1,000.00"
          },
          {
            type: "vat_amount",
            mentionText: "€210.00"
          },
          {
            type: "currency",
            mentionText: "EUR"
          },
          // Mock line items for testing
          {
            type: "line_item",
            mentionText: "Hotel accommodation - 2 nights @ €400.00 + 21% VAT"
          },
          {
            type: "line_item",
            mentionText: "Business meals - €150.00 + 21% VAT"
          },
          {
            type: "line_item",
            mentionText: "Alcohol - Wine bottle - €50.00 + 21% VAT"
          }
        ]
      };
    } else {
      logger.info("Calling Document AI for processing");
      const [result] = await docAiClient.processDocument({
        name: name,
        rawDocument: {
          content: fileBuffer,
          mimeType: contentType,
        },
      });
      document = result.document;
    }
    if (!document || !document.entities) {
      logger.error("Document AI did not return any entities.", {filePath});
      return;
    }

    logger.info(
      "Successfully processed document with Document AI. " +
      `Found ${document.entities.length} entities.`
    );

    // Log all detected entities
    logger.info("--- Detected Entities ---");
    for (const entity of document.entities) {
      logger.info(`Type: ${entity.type}, Text: ${entity.mentionText}`);
    }
    logger.info("-----------------------");

    // 4. Map entities to key fields and save to Firestore
    const extractedData: Record<string, any> = {};
    const lineItems: any[] = [];

    // Map key fields from entities (using discovered entity types)
    for (const entity of document.entities) {
      const entityType = entity.type;
      const entityText = entity.mentionText;

      if (!entityType || !entityText) continue;

      switch (entityType) {
      case "invoice_id":
        extractedData.invoiceId = entityText;
        break;
      case "invoice_date":
        extractedData.invoiceDate = entityText;
        break;
      case "total_amount":
        extractedData.totalAmount = entityText;
        break;
      case "currency":
        extractedData.currency = entityText;
        break;
      case "supplier_name":
        extractedData.supplierName = entityText;
        break;
      case "net_amount":
        extractedData.netAmount = entityText;
        break;
      case "vat_amount":
        extractedData.vatAmount = entityText;
        break;
      case "line_item":
        // Parse line item text and store as structured data
        const lineItem = parseLineItem(entityText);
        lineItems.push({
          originalText: entityText,
          description: lineItem.description,
          netAmount: lineItem.netAmount,
          vatRate: lineItem.vatRate,
          vatAmount: lineItem.vatAmount,
          totalAmount: lineItem.totalAmount,
          // Will be populated by validation function
          isRefundable: null,
          refundableVatAmount: null,
          euSubCode: null,
          validationNotes: null
        });
        break;
      default:
        // Store other entities in a general object
        if (!extractedData.otherFields) {
          extractedData.otherFields = {};
        }
        extractedData.otherFields[entityType] = entityText;
      }
    }

    // Add line items to extracted data
    extractedData.lineItems = lineItems;

    // 5. Save to Firestore
    const firestore = getFirestore();
    const documentsCollection = firestore.collection("documents");

    const documentData = {
      // Mapped key fields
      ...extractedData,

      // Complete raw entities for future reference
      rawEntities: document.entities,

      // Upload metadata
      tenantId: "default", // TODO: Extract from user context
      uploadedBy: "system", // TODO: Extract from authenticated user
      originalFileName: filePath,
      storagePath: `gs://${fileBucket}/${filePath}`,

      // Status and timestamps
      status: "pending_validation",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await documentsCollection.add(documentData);

    logger.info(
      "Successfully saved invoice data to Firestore. " +
      `Document ID: ${docRef.id}`
    );

    logger.info(
      `Extracted key fields: ${JSON.stringify(extractedData, null, 2)}`
    );
  } catch (error) {
    logger.error("Error calling Document AI:", error, {filePath});
  }
});

// --- Part 2: validateDocument Function ---

export const validateDocument = onDocumentCreated(
  "documents/{documentId}",
  async (event) => {
    const documentId = event.params.documentId;
    const documentData = event.data?.data();

    if (!documentData) {
      logger.error("No document data found", {documentId});
      return;
    }

    logger.info(`Starting validation for document ${documentId}`);

    try {
      const firestore = getFirestore();
      const docRef = firestore.collection("documents").doc(documentId);

      // Get line items from the document
      const lineItems = documentData.lineItems || [];

      if (lineItems.length === 0) {
        logger.warn("No line items found for validation", {documentId});
        await docRef.update({
          status: "validation_error",
          validationError: "No line items found",
          updatedAt: new Date()
        });
        return;
      }

      logger.info(`Validating ${lineItems.length} line items`);

      let totalRefundableVat = 0;
      const validatedLineItems = [];

      // Validate each line item
      for (let i = 0; i < lineItems.length; i++) {
        const lineItem = lineItems[i];
        const validation = isRefundableItem(lineItem.description || "");

        const validatedItem = {
          ...lineItem,
          isRefundable: validation.isRefundable,
          euSubCode: validation.euSubCode,
          validationNotes: validation.reason
        };

        // Calculate refundable VAT amount
        if (validation.isRefundable && lineItem.vatAmount) {
          validatedItem.refundableVatAmount = lineItem.vatAmount;
          totalRefundableVat += lineItem.vatAmount;
        } else {
          validatedItem.refundableVatAmount = 0;
        }

        validatedLineItems.push(validatedItem);

        logger.info(
          `Line item ${i + 1}: ${lineItem.description} - ` +
          `${validation.isRefundable ? "REFUNDABLE" : "NOT REFUNDABLE"} ` +
          `(${validation.reason})`
        );
      }

      // Determine final status
      const hasRefundableItems = validatedLineItems.some(item => item.isRefundable);
      const finalStatus = hasRefundableItems ? "ready_for_submission" : "validation_error";

      // Update the document with validation results
      await docRef.update({
        lineItems: validatedLineItems,
        totalRefundableVatAmount: totalRefundableVat,
        status: finalStatus,
        validationCompletedAt: new Date(),
        updatedAt: new Date(),
        ...(finalStatus === "validation_error" && {
          validationError: "No refundable items found"
        })
      });

      logger.info(
        `Validation completed for document ${documentId}. ` +
        `Status: ${finalStatus}, ` +
        `Total refundable VAT: €${totalRefundableVat.toFixed(2)}`
      );

    } catch (error) {
      logger.error("Error during document validation:", error, {documentId});

      // Update document with error status
      try {
        const firestore = getFirestore();
        await firestore.collection("documents").doc(documentId).update({
          status: "validation_error",
          validationError: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date()
        });
      } catch (updateError) {
        logger.error("Failed to update document with error status:", updateError);
      }
    }
  }
);

/**
 * Cloud Function to generate XML submission for German tax authorities
 * This is a callable function that can be triggered from the frontend
 */
export const generateSubmissionXml = onCall(
  {region: "europe-west1"},
  async (request) => {
    try {
      const {submissionPeriod, countryCode, tenantId} = request.data;

      // Validate input parameters
      if (!submissionPeriod || !countryCode) {
        throw new Error("Missing required parameters: submissionPeriod and countryCode");
      }

      if (countryCode !== "DE") {
        throw new Error("Currently only German (DE) submissions are supported");
      }

      logger.info(`Generating XML submission for period ${submissionPeriod}, country ${countryCode}`);

      const firestore = getFirestore();
      const storage = getStorage();

      // Build query for ready-for-submission documents
      let query = firestore.collection("documents")
        .where("status", "==", "ready_for_submission")
        .where("country", "==", countryCode);

      // Add tenant filter if provided (for multi-tenant support)
      if (tenantId) {
        query = query.where("tenantId", "==", tenantId);
      }

      // Execute query
      const querySnapshot = await query.get();

      if (querySnapshot.empty) {
        throw new Error(`No ready-for-submission documents found for period ${submissionPeriod} and country ${countryCode}`);
      }

      // Filter documents by period and aggregate data by EU sub-code
      const euSubCodeAggregates = new Map<string, {
        subCode: string;
        totalNetAmount: number;
        totalVatAmount: number;
        totalRefundableVatAmount: number;
        documentCount: number;
      }>();

      let totalRefundAmount = 0;
      let matchingDocuments = 0;
      const documentIds: string[] = [];

      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        const docId = doc.id;

        // Filter by period (you may need to adjust this logic based on how period is stored)
        // For now, assuming period is part of document metadata or can be derived from dates
        const createdAt = docData.createdAt?.toDate();
        if (!createdAt || !isDocumentInPeriod(createdAt, submissionPeriod)) {
          return; // Skip this document
        }

        matchingDocuments++;
        documentIds.push(docId);

        // Process line items
        const lineItems = docData.lineItems || [];
        lineItems.forEach((item: any) => {
          if (item.isRefundable && item.euSubCode && item.refundableVatAmount > 0) {
            const subCode = item.euSubCode;
            
            if (!euSubCodeAggregates.has(subCode)) {
              euSubCodeAggregates.set(subCode, {
                subCode,
                totalNetAmount: 0,
                totalVatAmount: 0,
                totalRefundableVatAmount: 0,
                documentCount: 0
              });
            }

            const aggregate = euSubCodeAggregates.get(subCode)!;
            aggregate.totalNetAmount += item.netAmount || 0;
            aggregate.totalVatAmount += item.vatAmount || 0;
            aggregate.totalRefundableVatAmount += item.refundableVatAmount || 0;
            aggregate.documentCount++;

            totalRefundAmount += item.refundableVatAmount || 0;
          }
        });
      });

      if (matchingDocuments === 0) {
        throw new Error(`No documents found for the specified period ${submissionPeriod}`);
      }

      if (totalRefundAmount === 0) {
        throw new Error("No refundable VAT amounts found in the selected documents");
      }

      // Generate XML according to German UStVEU schema
      const xmlContent = generateGermanVatXml(
        Array.from(euSubCodeAggregates.values()),
        submissionPeriod,
        totalRefundAmount,
        tenantId || "default-tenant"
      );

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `VAT-Submission-${countryCode}-${submissionPeriod}-${timestamp}.xml`;
      const storagePath = `submissions/${fileName}`;

      // Upload XML to Cloud Storage
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);
      
      await file.save(xmlContent, {
        metadata: {
          contentType: "application/xml",
          metadata: {
            submissionPeriod,
            countryCode,
            tenantId: tenantId || "default-tenant",
            documentCount: matchingDocuments.toString(),
            totalRefundAmount: totalRefundAmount.toString(),
            generatedAt: new Date().toISOString()
          }
        }
      });

      // Create submission record in Firestore
      const submissionData = {
        tenantId: tenantId || "default-tenant",
        country: countryCode,
        period: submissionPeriod,
        status: "generated",
        totalRefundAmount,
        xmlStoragePath: storagePath,
        documentCount: matchingDocuments,
        documentIds,
        createdAt: new Date()
      };

      const submissionRef = await firestore.collection("submissions").add(submissionData);
      const submissionId = submissionRef.id;

      // Update processed documents with submission reference
      const batch = firestore.batch();
      documentIds.forEach((docId) => {
        const docRef = firestore.collection("documents").doc(docId);
        batch.update(docRef, {
          status: "in_submission",
          submissionId,
          updatedAt: new Date()
        });
      });
      await batch.commit();

      logger.info(
        `XML submission generated successfully. ` +
        `Submission ID: ${submissionId}, ` +
        `Documents processed: ${matchingDocuments}, ` +
        `Total refund amount: €${totalRefundAmount.toFixed(2)}`
      );

      return {
        success: true,
        xmlStoragePath: storagePath,
        submissionId,
        totalRefundAmount,
        documentCount: matchingDocuments
      };

    } catch (error) {
      logger.error("Error generating XML submission:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
);

/**
 * Helper function to check if a document falls within the specified period
 */
function isDocumentInPeriod(documentDate: Date, period: string): boolean {
  // Parse period like "Q4/2025" or "2025-Q4"
  const year = parseInt(period.match(/\d{4}/)?.[0] || "0");
  const quarterMatch = period.match(/Q([1-4])/);
  
  if (!year || !quarterMatch) {
    // Fallback: assume current year if period format is unclear
    return true;
  }

  const quarter = parseInt(quarterMatch[1]);
  const docYear = documentDate.getFullYear();
  const docMonth = documentDate.getMonth() + 1; // 1-based month
  
  // Determine quarter from month
  const docQuarter = Math.ceil(docMonth / 3);
  
  return docYear === year && docQuarter === quarter;
}

/**
 * Generate German VAT XML according to UStVEU schema
 */
function generateGermanVatXml(
  aggregates: Array<{
    subCode: string;
    totalNetAmount: number;
    totalVatAmount: number;
    totalRefundableVatAmount: number;
    documentCount: number;
  }>,
  period: string,
  totalRefundAmount: number,
  tenantId: string
): string {
  // Create XML document with German UStVEU structure
  const xml = create({version: "1.0", encoding: "UTF-8"})
    .ele("UStVEU")
    .att("version", "2024")
    .att("xmlns", "http://www.elster.de/elsterxml/schema/v11")
    .att("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");

  // Header information
  const header = xml.ele("Header");
  header.ele("Testmerker").txt("N"); // N = Production, J = Test
  header.ele("Hersteller").txt("VAT-Refund-App");
  header.ele("DatenArt").txt("UStVEU");
  header.ele("Verfahren").txt("UStVEU");
  header.ele("Zeitraum").txt(period);

  // Applicant data (this would normally come from tenant information)
  const applicant = xml.ele("Antragsteller");
  applicant.ele("TenantId").txt(tenantId);
  applicant.ele("Period").txt(period);
  applicant.ele("Country").txt("DE");

  // VAT details grouped by EU sub-codes
  const vatDetails = xml.ele("UmsatzsteuerDetails");
  
  aggregates.forEach((aggregate) => {
    const item = vatDetails.ele("Position");
    item.ele("EUSubCode").txt(aggregate.subCode);
    item.ele("NettoSumme").txt(aggregate.totalNetAmount.toFixed(2));
    item.ele("UmsatzsteuerSumme").txt(aggregate.totalVatAmount.toFixed(2));
    item.ele("ErstattungsberechtigterBetrag").txt(aggregate.totalRefundableVatAmount.toFixed(2));
    item.ele("AnzahlBelege").txt(aggregate.documentCount.toString());
  });

  // Summary
  const summary = xml.ele("Zusammenfassung");
  summary.ele("GesamtErstattungsbetrag").txt(totalRefundAmount.toFixed(2));
  summary.ele("AnzahlPositionen").txt(aggregates.length.toString());
  summary.ele("Erstellungsdatum").txt(new Date().toISOString());

  return xml.end({prettyPrint: true});
}
