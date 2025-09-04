import {onObjectFinalized} from "firebase-functions/v2/storage";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {FieldValue} from "firebase-admin/firestore";
import {create} from "xmlbuilder2";

// Import centralized configuration and client factories
import {validateConfig} from "./config/env";
import {getAdminStorage, getAdminFirestore, getDocAiClient, getConfig} from "./config/clients";

// Import structured logging
import {createLogger, LogHelpers} from "./utils/logger";

// Import typed status enums
import {DocumentStatus} from "./types/DocumentStatus";

// Import modular parsers and rules
import {
  parseDocumentAIEntities,
  type DocumentAIResponse,
} from "./parsers/documentParser";
import {applyRefundabilityRules} from "./rules/refundabilityRules";

// Import input validation
import {validateSubmissionInput, validateSubmissionPeriod, validateTenantAccess} from "./validators/submissionValidator";

// Import retry wrapper for resilience
import {retryDocumentAI} from "./utils/retryWrapper";
// import { retry } from "./utils/retry"; // Alternative simple retry utility

// Validate configuration on module load
try {
  validateConfig();
  logger.info("✅ Configuration validation passed");
} catch (error) {
  logger.error("❌ Configuration validation failed:", error);
  throw error;
}

export const onInvoiceUpload = onObjectFinalized(
  {
    cpu: 1,
    bucket: "vat-refund-app-2025.appspot.com",
  },
  async (event) => {
    // Create structured logger with correlation ID
    const logContext = LogHelpers.createStorageContext(event.data.name, event.data.bucket);
    const structuredLogger = createLogger("onInvoiceUpload", logContext);
    const timing = structuredLogger.startFunction({
      contentType: event.data.contentType,
      size: event.data.size,
    });

    try {
      structuredLogger.info("Invoice upload detected", {
        contentType: event.data.contentType,
        size: event.data.size,
      });

      const fileBucket = event.data.bucket;
      const filePath = event.data.name;
      const contentType = event.data.contentType;

      // Only process files in the invoices directory
      if (!filePath.startsWith("invoices/")) {
        structuredLogger.info("File outside invoices directory - ignoring", {reason: "not_in_invoices_dir"});
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      // 1. Validate the file type
      const validTypes = ["application/pdf", "image/jpeg", "image/png"];
      if (!contentType || !validTypes.includes(contentType)) {
        structuredLogger.warn("Invalid file type - halting execution", {
          contentType,
          validTypes,
          reason: "invalid_content_type",
        });
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      structuredLogger.step("File validation passed - starting processing");

      // 2. Fetch file content from Storage
      structuredLogger.step("Downloading file from storage");

      // Begin processing (download + Document AI)
      const storage = getAdminStorage();
      const bucket = storage.bucket(fileBucket);
      const file = bucket.file(filePath);

      // Download the file content as a buffer
      const [fileBuffer] = await file.download();
      structuredLogger.step("File downloaded successfully", {
        downloadedSize: fileBuffer.length,
      });

      // 3. Call Google Document AI with raw document content
      structuredLogger.step("Preparing Document AI request");
      const config = getConfig();
      const name =
        `projects/${config.gcpProject}/locations/${config.gcpLocation}/` +
        `processors/${config.processorId}`;

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
              mentionText: "INV-2025-001",
            },
            {
              type: "invoice_date",
              mentionText: "2025-08-11",
            },
            {
              type: "supplier_name",
              mentionText: "Test Company Ltd",
            },
            {
              type: "total_amount",
              mentionText: "€1,210.00",
            },
            {
              type: "net_amount",
              mentionText: "€1,000.00",
            },
            {
              type: "vat_amount",
              mentionText: "€210.00",
            },
            {
              type: "currency",
              mentionText: "EUR",
            },
            // Mock line items for testing
            {
              type: "line_item",
              mentionText: "Hotel accommodation - 2 nights @ €400.00 + 21% VAT",
            },
            {
              type: "line_item",
              mentionText: "Business meals - €150.00 + 21% VAT",
            },
            {
              type: "line_item",
              mentionText: "Alcohol - Wine bottle - €50.00 + 21% VAT",
            },
          ],
        };
      } else {
        logger.info("Calling Document AI for processing");
        const client = getDocAiClient();

        // Apply retry wrapper to Document AI call for resilience
        // Option 1: Advanced retry wrapper (currently used)
        const result = await retryDocumentAI(() =>
          client.processDocument({
            name: name,
            rawDocument: {
              content: fileBuffer,
              mimeType: contentType,
            },
          })
        ) as any[];

        // Option 2: Simple retry utility (alternative implementation)
        // import { retry } from "./utils/retry";
        // const [result] = await retry(() => client.processDocument({
        //   name: name,
        //   rawDocument: {
        //     content: fileBuffer,
        //     mimeType: contentType,
        //   },
        // }));

        document = result[0]?.document;
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

      // 4. Parse Document AI entities using modular parser
      const extractedData = parseDocumentAIEntities(document as DocumentAIResponse, filePath);

      // 5. Extract user ID from file path
      // File path format: invoices/{userId}/{fileName}
      const pathParts = filePath.split("/");
      let userId = "system"; // fallback
      let tenantId = "default"; // fallback

      console.log(`Path parts: ${JSON.stringify(pathParts)}`);
      logger.info(`Path parts: ${JSON.stringify(pathParts)}`);

      if (pathParts.length >= 2 && pathParts[0] === "invoices") {
        userId = pathParts[1]; // Extract user ID from path
        tenantId = userId; // Use user ID as tenant ID
        console.log(`✅ Extracted user ID from path: ${userId}`);
        logger.info(`✅ Extracted user ID from path: ${userId}`);
      } else {
        console.warn(`❌ Could not extract user ID from path: ${filePath}`);
        logger.warn(`❌ Could not extract user ID from path: ${filePath}`);
      }

      // 5. Save to Firestore
      const firestore = getAdminFirestore();
      const documentsCollection = firestore.collection("documents");

      const documentData = {
      // Mapped key fields (ensure extractedData shape matches frontend expectation)
        extractedData: {
          invoiceId: extractedData.invoiceId || null,
          invoiceDate: extractedData.invoiceDate || null,
          supplierName: extractedData.supplierName || null,
          vendorName: extractedData.supplierName || null, // Legacy field for frontend compatibility
          totalAmount: extractedData.totalAmount || null,
          currency: extractedData.currency || "EUR",
          lineItems: extractedData.lineItems || [],
          otherFields: extractedData.otherFields || {},
        },
        lineItems: extractedData.lineItems || [],
        rawEntities: document.entities,
        tenantId: tenantId,
        uploadedBy: userId,
        originalFileName: filePath.split("/").pop() || filePath,
        storagePath: filePath,
        status: DocumentStatus.AWAITING_VALIDATION,
        totalRefundableVatAmount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      } as any;

      const docRef = await documentsCollection.add(documentData);

      console.log(`✅ Successfully saved invoice data to Firestore. Document ID: ${docRef.id}`);
      console.log(`📄 Document data: ${JSON.stringify({...documentData, rawEntities: "[TRUNCATED]"}, null, 2)}`);
      logger.info(
        "✅ Successfully saved invoice data to Firestore. " +
      `Document ID: ${docRef.id}`
      );

      structuredLogger.step("Document processing completed successfully", {
        extractedFields: Object.keys(extractedData).length,
      });
      structuredLogger.endFunction(timing.startTime);
    } catch (error: any) {
      structuredLogger.failFunction(timing.startTime, error);
    }
  });

// --- Part 2: validateDocument Function ---

export const validateDocument = onDocumentCreated(
  "documents/{documentId}",
  async (event) => {
    // Create structured logger with correlation ID
    const logContext = LogHelpers.createFirestoreContext("documents", event.params.documentId);
    const structuredLogger = createLogger("validateDocument", logContext);
    const timing = structuredLogger.startFunction();

    try {
      const documentId = event.params.documentId;
      const documentData = event.data?.data();

      if (!documentData) {
        structuredLogger.error("No document data found");
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      structuredLogger.step("Starting validation for document");

      const firestore = getAdminFirestore();
      const docRef = firestore.collection("documents").doc(documentId);

      // Get line items from the document
      const lineItems = documentData.lineItems || [];

      if (lineItems.length === 0) {
        structuredLogger.warn("No line items found for validation");
        await docRef.update({
          status: DocumentStatus.VALIDATION_ERROR,
          validationError: "No line items found",
          updatedAt: new Date(),
        });
        return;
      }

      logger.info(`Validating ${lineItems.length} line items`);

      let totalRefundableVat = 0;
      const validatedLineItems = [];

      // Validate each line item using refundability rules
      for (let i = 0; i < lineItems.length; i++) {
        const lineItem = lineItems[i];
        const refundabilityResult = applyRefundabilityRules({
          description: lineItem.description || "",
          vatAmount: lineItem.vatAmount || 0,
          netAmount: lineItem.netAmount || 0,
        });

        const validatedItem = {
          ...lineItem,
          isRefundable: refundabilityResult.isRefundable,
          euSubCode: refundabilityResult.euSubCode,
          validationNotes: refundabilityResult.validationNotes,
          refundableVatAmount: refundabilityResult.refundableVatAmount,
        };

        // Calculate total refundable VAT
        if (refundabilityResult.refundableVatAmount) {
          totalRefundableVat += refundabilityResult.refundableVatAmount;
        }

        validatedLineItems.push(validatedItem);

        logger.info(
          `Line item ${i + 1}: ${lineItem.description} - ` +
          `${refundabilityResult.isRefundable ? "REFUNDABLE" : "NOT REFUNDABLE"} ` +
          `(${refundabilityResult.validationNotes})`
        );
      }

      // Determine final status
      const hasRefundableItems = validatedLineItems.some((item) => item.isRefundable);
      const finalStatus = hasRefundableItems ? DocumentStatus.READY_FOR_SUBMISSION : DocumentStatus.VALIDATION_ERROR;

      // Update the document with validation results
      await docRef.update({
        lineItems: validatedLineItems,
        totalRefundableVatAmount: totalRefundableVat,
        status: finalStatus,
        validationCompletedAt: new Date(),
        updatedAt: new Date(),
        ...(finalStatus === DocumentStatus.VALIDATION_ERROR && {
          validationError: "No refundable items found",
        }),
      });

      structuredLogger.step("Validation completed", {
        status: finalStatus,
        totalRefundableVat,
        refundableItemsCount: validatedLineItems.filter((item) => item.isRefundable).length,
      });
      structuredLogger.endFunction(timing.startTime);
    } catch (error) {
      structuredLogger.failFunction(timing.startTime, error as Error);

      // Update document with error status
      try {
        const firestore = getAdminFirestore();
        await firestore.collection("documents").doc(event.params.documentId).update({
          status: DocumentStatus.VALIDATION_ERROR,
          validationError: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        });
      } catch (updateError) {
        structuredLogger.error("Failed to update document with error status", updateError as Error);
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
    // Create structured logger with correlation ID
    const structuredLogger = createLogger("generateSubmissionXml", {
      userId: request.auth?.uid,
      submissionPeriod: request.data?.submissionPeriod,
      countryCode: request.data?.countryCode,
    });
    const timing = structuredLogger.startFunction();

    try {
      // 1. Validate input data first - this is our first line of defense
      structuredLogger.step("Validating input parameters");
      const validatedData = validateSubmissionInput(request.data);
      const {submissionPeriod, countryCode, tenantId} = validatedData;

      // 2. Additional business validation
      validateSubmissionPeriod(submissionPeriod);

      // 3. Validate tenant access (use user's tenant if none provided)
      const userTenantId = request.auth?.uid || "anonymous";
      const effectiveTenantId = tenantId || userTenantId;
      validateTenantAccess(tenantId, userTenantId);

      structuredLogger.step("Input validation completed successfully", {
        submissionPeriod,
        countryCode,
        tenantId: effectiveTenantId,
      });

      const firestore = getAdminFirestore();
      const storage = getAdminStorage();

      // Build query for ready-for-submission documents
      let query = firestore.collection("documents")
        .where("status", "==", DocumentStatus.READY_FOR_SUBMISSION)
        .where("country", "==", countryCode);

      // Add tenant filter if provided (for multi-tenant support)
      if (effectiveTenantId) {
        query = query.where("tenantId", "==", effectiveTenantId);
      }

      // Execute query
      const querySnapshot = await query.get();

      if (querySnapshot.empty) {
        throw new Error(`No ready-for-submission documents found for period ${submissionPeriod} and country ${countryCode}`);
      }

      // Check country support
      if (countryCode !== "DE") {
        structuredLogger.warn("Non-German submission requested", {countryCode});
        throw new Error(`XML generation for country ${countryCode} is not yet implemented. Currently only DE (Germany) is supported.`);
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
                documentCount: 0,
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
            generatedAt: new Date().toISOString(),
          },
        },
      });

      // Create submission record in Firestore
      const submissionData = {
        tenantId: effectiveTenantId,
        country: countryCode,
        period: submissionPeriod,
        status: DocumentStatus.SUBMITTED,
        totalRefundAmount,
        xmlStoragePath: storagePath,
        documentCount: matchingDocuments,
        documentIds,
        createdAt: new Date(),
      };

      const submissionRef = await firestore.collection("submissions").add(submissionData);
      const submissionId = submissionRef.id;

      // Update processed documents with submission reference
      const batch = firestore.batch();
      documentIds.forEach((docId) => {
        const docRef = firestore.collection("documents").doc(docId);
        batch.update(docRef, {
          status: DocumentStatus.SUBMITTING,
          submissionId,
          updatedAt: new Date(),
        });
      });
      await batch.commit();

      structuredLogger.step("XML submission generated successfully", {
        submissionId,
        documentsProcessed: matchingDocuments,
        totalRefundAmount,
        storagePath,
      });

      structuredLogger.endFunction(timing.startTime);

      return {
        success: true,
        xmlStoragePath: storagePath,
        submissionId,
        totalRefundAmount,
        documentCount: matchingDocuments,
      };
    } catch (error) {
      structuredLogger.failFunction(timing.startTime, error as Error);

      // Enhanced error handling with validation-specific responses
      if (error instanceof Error) {
        const errorMessage = error.message;

        // Check if it's a validation error
        if (errorMessage.includes("Invalid submission input:")) {
          return {
            success: false,
            error: errorMessage,
            errorType: "VALIDATION_ERROR",
          };
        }

        // Check if it's a business logic error
        if (errorMessage.includes("not yet implemented") ||
            errorMessage.includes("No ready-for-submission documents")) {
          return {
            success: false,
            error: errorMessage,
            errorType: "BUSINESS_LOGIC_ERROR",
          };
        }
      }

      // Generic error response
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        errorType: "SYSTEM_ERROR",
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

// Export the new address correction function
export {requestAddressCorrection} from "./requestAddressCorrection";

// Export the sample documents creation function
export {createSampleDocuments} from "./createSampleDocuments";

// P3-Priority: Export Real-Time Notification functions
export {sendNotificationOnStatusChange} from "./triggers/sendNotificationOnStatusChange";
export {getNotifications, markNotificationAsRead, getUnreadCount} from "./api/notifications";
