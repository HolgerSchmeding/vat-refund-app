import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import {DocumentStatus} from "./types/DocumentStatus";

interface SampleDocument {
  originalFileName: string;
  extractedData: {
    supplierName: string;
    invoiceDate: string;
    totalAmount: number;
    currency: string;
    vatRate: number;
    vatAmount: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      vatRate: number;
      vatAmount: number;
    }>;
  };
  status: string;
  totalRefundableVatAmount: number;
  validationError?: string;
}

const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    originalFileName: "hotel-booking-berlin.pdf",
    extractedData: {
      supplierName: "Hotel Adlon Kempinski Berlin",
      invoiceDate: "2024-08-15",
      totalAmount: 189.00,
      currency: "EUR",
      vatRate: 19,
      vatAmount: 30.21,
      lineItems: [
        {
          description: "Übernachtung Superior Zimmer (2 Nächte)",
          quantity: 2,
          unitPrice: 79.50,
          totalPrice: 159.00,
          vatRate: 19,
          vatAmount: 25.41,
        },
        {
          description: "Frühstück",
          quantity: 2,
          unitPrice: 15.00,
          totalPrice: 30.00,
          vatRate: 19,
          vatAmount: 4.80,
        },
      ],
    },
    status: DocumentStatus.READY_FOR_SUBMISSION,
    totalRefundableVatAmount: 30.21,
  },
  {
    originalFileName: "conference-registration.pdf",
    extractedData: {
      supplierName: "TechConf Europe GmbH",
      invoiceDate: "2024-08-20",
      totalAmount: 595.00,
      currency: "EUR",
      vatRate: 19,
      vatAmount: 95.13,
      lineItems: [
        {
          description: "Konferenz-Ticket Early Bird",
          quantity: 1,
          unitPrice: 500.00,
          totalPrice: 500.00,
          vatRate: 19,
          vatAmount: 80.13,
        },
        {
          description: "Workshop-Teilnahme: AI in Business",
          quantity: 1,
          unitPrice: 95.00,
          totalPrice: 95.00,
          vatRate: 19,
          vatAmount: 15.00,
        },
      ],
    },
    status: DocumentStatus.READY_FOR_SUBMISSION,
    totalRefundableVatAmount: 95.13,
  },
  {
    originalFileName: "office-supplies-munich.pdf",
    extractedData: {
      supplierName: "BüroMax München",
      invoiceDate: "2024-08-25",
      totalAmount: 127.49,
      currency: "EUR",
      vatRate: 19,
      vatAmount: 20.37,
      lineItems: [
        {
          description: "Bürostuhl ergonomisch",
          quantity: 1,
          unitPrice: 89.00,
          totalPrice: 89.00,
          vatRate: 19,
          vatAmount: 14.24,
        },
        {
          description: "Laptop-Stand verstellbar",
          quantity: 1,
          unitPrice: 38.49,
          totalPrice: 38.49,
          vatRate: 19,
          vatAmount: 6.13,
        },
      ],
    },
    status: DocumentStatus.AWAITING_VALIDATION,
    totalRefundableVatAmount: 20.37,
  },
  {
    originalFileName: "catering-invoice-error.pdf",
    extractedData: {
      supplierName: "Gourmet Catering Solutions",
      invoiceDate: "2024-08-28",
      totalAmount: 245.80,
      currency: "EUR",
      vatRate: 19,
      vatAmount: 39.29,
      lineItems: [
        {
          description: "Business Lunch für 8 Personen",
          quantity: 8,
          unitPrice: 25.90,
          totalPrice: 207.20,
          vatRate: 19,
          vatAmount: 33.14,
        },
        {
          description: "Getränkepaket",
          quantity: 1,
          unitPrice: 38.60,
          totalPrice: 38.60,
          vatRate: 19,
          vatAmount: 6.15,
        },
      ],
    },
    status: DocumentStatus.VALIDATION_ERROR,
    totalRefundableVatAmount: 0,
    validationError: "VAT-Nummer des Anbieters konnte nicht verifiziert werden. Bitte prüfen Sie die Rechnungsdetails.",
  },
];

export const createSampleDocuments = onCall(
  {
    cors: true,
    region: "europe-west1",
  },
  async (request) => {
    try {
      logger.info("Creating sample documents request received", {
        uid: request.auth?.uid,
        token: request.auth?.token,
      });

      // Check authentication
      if (!request.auth) {
        logger.warn("Unauthenticated request to create sample documents");
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const userId = request.auth.uid;

      // Verify user exists
      try {
        await getAuth().getUser(userId);
      } catch (error) {
        logger.error("User verification failed", {userId, error});
        throw new HttpsError("not-found", "User not found");
      }

      const db = getFirestore();
      const now = Timestamp.now();

      // Check if user already has sample documents
      const existingDocs = await db
        .collection("documents")
        .where("uploadedBy", "==", userId)
        .where("isSampleData", "==", true)
        .limit(1)
        .get();

      if (!existingDocs.empty) {
        logger.info("Sample documents already exist for user", {userId});
        throw new HttpsError("already-exists", "Sample documents already created for this user");
      }

      const batch = db.batch();
      const documentIds: string[] = [];

      // Create sample documents
      for (const sampleDoc of SAMPLE_DOCUMENTS) {
        const docRef = db.collection("documents").doc();
        documentIds.push(docRef.id);

        const documentData = {
          // Meta data
          uploadedBy: userId,
          tenantId: userId,
          originalFileName: sampleDoc.originalFileName,
          storagePath: `sample-data/${sampleDoc.originalFileName}`,
          status: sampleDoc.status,

          // Sample data markers
          isSampleData: true,
          sampleDataNote: "Dies ist ein Beispieldokument zur Demonstration der Funktionalität.",

          // Extracted data
          extractedData: sampleDoc.extractedData,
          totalRefundableVatAmount: sampleDoc.totalRefundableVatAmount,

          // Validation
          validationError: sampleDoc.validationError || null,
          isProcessed: true,

          // Timestamps
          createdAt: now,
          updatedAt: now,

          // File info (simulated)
          fileSize: Math.floor(Math.random() * 1000000) + 100000, // 100KB - 1.1MB
          fileType: "application/pdf",
          downloadUrl: null, // Sample documents don't have real files
        };

        batch.set(docRef, documentData);
      }

      // Execute batch write
      await batch.commit();

      logger.info("Sample documents created successfully", {
        userId,
        documentCount: SAMPLE_DOCUMENTS.length,
        documentIds,
      });

      return {
        success: true,
        message: "Sample documents created successfully",
        documentCount: SAMPLE_DOCUMENTS.length,
        documentIds,
      };
    } catch (error) {
      logger.error("Error creating sample documents", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        uid: request.auth?.uid,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to create sample documents");
    }
  }
);
