import {getFirestore} from "firebase-admin/firestore";
import {DocumentStatus} from "./types/DocumentStatus";
import {StatusTransitionGuard, TransitionContext} from "./guards/StatusTransitionGuard";

/**
 * Live Test Script für Status Transition Guards
 * P2-Priority: Echte Dokumenten-Tests
 */

export async function createTestDocument(): Promise<string> {
  const db = getFirestore();

  // Erstelle ein Test-Dokument
  const testDoc = {
    fileName: "test-invoice-2025.pdf",
    status: DocumentStatus.UPLOADED,
    uploadedAt: new Date(),
    fileSize: 1024000, // 1MB
    contentType: "application/pdf",
    extractedData: {
      vatNumber: "DE123456789",
      invoiceDate: "2024-12-01",
      totalAmount: 150.00,
      supplierName: "Test Supplier GmbH",
      items: [
        {
          description: "Software License",
          amount: 127.73,
          vatAmount: 22.27,
          vatRate: 19,
        },
      ],
    },
    tenantId: "test-tenant-live",
    userId: "test-user-live",
  };

  const docRef = await db.collection("tenants")
    .doc("test-tenant-live")
    .collection("documents")
    .add(testDoc);

  console.log(`Test document created: ${docRef.id}`);
  return docRef.id;
}

export async function testStatusTransitions(documentId: string): Promise<void> {
  console.log("\n🧪 Starting Live Status Transition Tests...\n");

  const context: TransitionContext = {
    userId: "test-user-live",
    tenantId: "test-tenant-live",
    documentId,
    timestamp: new Date(),
    metadata: {
      userRole: "user",
      fileSize: 1024000,
      extractedData: {
        vatNumber: "DE123456789",
        invoiceDate: "2024-12-01",
        totalAmount: 150.00,
      },
    },
  };

  // Test 1: Valid Transition (UPLOADED -> PROCESSING)
  console.log("✅ Test 1: Valid Transition UPLOADED -> PROCESSING");
  const test1 = StatusTransitionGuard.validateTransition(
    DocumentStatus.UPLOADED,
    DocumentStatus.PROCESSING,
    context
  );
  console.log(`Result: ${test1.isValid ? "PASSED" : "FAILED"}`);
  if (!test1.isValid) console.log(`Error: ${test1.errorMessage}`);

  // Test 2: Invalid Transition (UPLOADED -> APPROVED)
  console.log("\n❌ Test 2: Invalid Transition UPLOADED -> APPROVED");
  const test2 = StatusTransitionGuard.validateTransition(
    DocumentStatus.UPLOADED,
    DocumentStatus.APPROVED,
    context
  );
  console.log(`Result: ${test2.isValid ? "FAILED (should be blocked)" : "PASSED (correctly blocked)"}`);
  if (!test2.isValid) console.log(`Blocked reason: ${test2.errorMessage}`);

  // Test 3: Business Logic Validation (low amount warning)
  console.log("\n⚠️ Test 3: Low Amount Warning");
  const lowAmountContext = {
    ...context,
    metadata: {...context.metadata, totalAmount: 20.00},
  };
  const test3 = StatusTransitionGuard.validateTransition(
    DocumentStatus.VALIDATED,
    DocumentStatus.READY_FOR_SUBMISSION,
    lowAmountContext
  );
  console.log(`Result: ${test3.isValid ? "PASSED" : "FAILED"}`);
  if (test3.warnings) {
    console.log(`Warnings: ${test3.warnings.join(", ")}`);
  }

  // Test 4: Permission Check (non-admin trying admin action)
  console.log("\n🔒 Test 4: Permission Check (User -> Admin Action)");
  const test4 = StatusTransitionGuard.validateTransition(
    DocumentStatus.SUBMITTED,
    DocumentStatus.APPROVED,
    context // userRole: 'user'
  );
  console.log(`Result: ${test4.isValid ? "FAILED (should be blocked)" : "PASSED (correctly blocked)"}`);
  if (!test4.isValid) console.log(`Blocked reason: ${test4.errorMessage}`);

  // Test 5: Admin Permission Check
  console.log("\n👑 Test 5: Admin Permission Check");
  const adminContext = {
    ...context,
    metadata: {...context.metadata, userRole: "admin"},
  };
  const test5 = StatusTransitionGuard.validateTransition(
    DocumentStatus.SUBMITTED,
    DocumentStatus.APPROVED,
    adminContext
  );
  console.log(`Result: ${test5.isValid ? "PASSED" : "FAILED"}`);

  // Test 6: Required Fields Validation
  console.log("\n📋 Test 6: Required Fields Validation");
  const incompleteContext = {
    ...context,
    metadata: {
      ...context.metadata,
      vatNumber: undefined, // Missing required field
    },
  };
  const test6 = StatusTransitionGuard.validateTransition(
    DocumentStatus.VALIDATED,
    DocumentStatus.READY_FOR_SUBMISSION,
    incompleteContext
  );
  console.log(`Result: ${test6.isValid ? "FAILED (should be blocked)" : "PASSED (correctly blocked)"}`);
  if (test6.requiredFields) {
    console.log(`Missing fields: ${test6.requiredFields.join(", ")}`);
  }

  console.log("\n🎉 Live Status Transition Tests completed!\n");
}

// Führe Tests aus wenn direkt aufgerufen
if (require.main === module) {
  (async () => {
    try {
      const docId = await createTestDocument();
      await testStatusTransitions(docId);
    } catch (error) {
      console.error("Test failed:", error);
    }
  })();
}
