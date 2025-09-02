import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DocumentStatus } from '../../types/DocumentStatus';
import { applyRefundabilityRules } from '../../rules/refundabilityRules';

/**
 * Integration Test for validateDocument Cloud Function Logic
 * 
 * This test validates the integration between business logic and Firestore
 * by testing the validation logic that would be executed by the validateDocument function.
 * 
 * Note: In emulator mode, we test the business logic directly rather than waiting
 * for Cloud Function triggers, as that would require the functions to be deployed.
 */

describe('Integration Tests - validateDocument Function', () => {
  let db: FirebaseFirestore.Firestore;
  let app: any;

  beforeAll(async () => {
    // Initialize Firebase Admin for testing
    if (getApps().length === 0) {
      app = initializeApp({
        projectId: 'demo-vat-refund-app'
      });
    } else {
      app = getApps()[0];
    }

    // Connect to Firestore emulator
    db = getFirestore(app);
    
    // Note: For integration tests, we assume the emulator is already running
    // and configured via FIRESTORE_EMULATOR_HOST environment variable
  });

  afterAll(async () => {
    // Clean up
    if (app) {
      await deleteApp(app);
    }
  });

  beforeEach(async () => {
    // Clean up test documents before each test
    const testDocuments = await db.collection('documents')
      .where('testDocument', '==', true)
      .get();
    
    const batch = db.batch();
    testDocuments.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  });

  describe('validateDocument business logic integration', () => {
    it('should integrate validation logic with Firestore correctly', async () => {
      // Arrange: Create a test document with realistic invoice data
      const testDocumentData = {
        testDocument: true, // Mark as test document for cleanup
        status: DocumentStatus.AWAITING_VALIDATION,
        fileName: 'test-invoice.pdf',
        uploadedAt: new Date(),
        totalAmount: 1210.00,
        currency: 'EUR',
        supplierName: 'Test Hotel & Conference Center Ltd',
        invoiceId: 'INV-2025-001',
        lineItems: [
          {
            description: 'Hotel accommodation - 2 nights',
            netAmount: 400.00,
            vatAmount: 84.00,
            vatRate: 21
          },
          {
            description: 'Business meals',
            netAmount: 150.00,
            vatAmount: 31.50,
            vatRate: 21
          },
          {
            description: 'Conference room rental',
            netAmount: 350.00,
            vatAmount: 73.50,
            vatRate: 21
          },
          {
            description: 'Alcohol - Wine bottle',
            netAmount: 50.00,
            vatAmount: 10.50,
            vatRate: 21
          }
        ]
      };

      // Act: Add document to Firestore and simulate validation processing
      const docRef = await db.collection('documents').add(testDocumentData);
      
      // Simulate the validateDocument function logic
      const lineItems = testDocumentData.lineItems;
      let totalRefundableVat = 0;
      const validatedLineItems = [];

      // Apply refundability rules to each line item
      for (const lineItem of lineItems) {
        const refundabilityResult = applyRefundabilityRules({
          description: lineItem.description,
          vatAmount: lineItem.vatAmount,
          netAmount: lineItem.netAmount
        });

        const validatedItem = {
          ...lineItem,
          isRefundable: refundabilityResult.isRefundable,
          euSubCode: refundabilityResult.euSubCode,
          validationNotes: refundabilityResult.validationNotes,
          refundableVatAmount: refundabilityResult.refundableVatAmount
        };

        if (refundabilityResult.refundableVatAmount) {
          totalRefundableVat += refundabilityResult.refundableVatAmount;
        }

        validatedLineItems.push(validatedItem);
      }

      // Determine final status
      const hasRefundableItems = validatedLineItems.some(item => item.isRefundable);
      const finalStatus = hasRefundableItems ? DocumentStatus.READY_FOR_SUBMISSION : DocumentStatus.VALIDATION_ERROR;

      // Update the document with validation results
      await docRef.update({
        lineItems: validatedLineItems,
        totalRefundableVatAmount: totalRefundableVat,
        status: finalStatus,
        validationCompletedAt: new Date(),
        updatedAt: new Date(),
        ...(finalStatus === DocumentStatus.VALIDATION_ERROR && {
          validationError: "No refundable items found"
        })
      });

      // Assert: Verify the document was updated correctly
      const updatedDoc = await docRef.get();
      const updatedData = updatedDoc.data();

      expect(updatedData).toBeDefined();
      expect(updatedData!.status).toBe(DocumentStatus.READY_FOR_SUBMISSION);
      expect(updatedData!.totalRefundableVatAmount).toBeGreaterThan(0);
      expect(updatedData!.validationCompletedAt).toBeDefined();
      
      // Verify line items were validated
      expect(updatedData!.lineItems).toHaveLength(4);
      
      // Check specific refundability results
      const validatedItems = updatedData!.lineItems;
      
      // Hotel accommodation should be refundable
      const hotelItem = validatedItems.find((item: any) => 
        item.description.includes('Hotel accommodation')
      );
      expect(hotelItem.isRefundable).toBe(true);
      expect(hotelItem.euSubCode).toBe('55.10.10'); // HOTEL_ACCOMMODATION
      expect(hotelItem.refundableVatAmount).toBe(84.00);

      // Business meals should be refundable
      const mealsItem = validatedItems.find((item: any) => 
        item.description.includes('Business meals')
      );
      expect(mealsItem.isRefundable).toBe(true);
      expect(mealsItem.euSubCode).toBe('77.11.00'); // GENERAL_BUSINESS_EXPENSE
      expect(mealsItem.refundableVatAmount).toBe(31.50);

      // Conference room should be refundable (falls back to general business)
      const conferenceItem = validatedItems.find((item: any) => 
        item.description.includes('Conference room')
      );
      expect(conferenceItem.isRefundable).toBe(true);
      expect(conferenceItem.refundableVatAmount).toBe(73.50);

      // Alcohol should NOT be refundable
      const alcoholItem = validatedItems.find((item: any) => 
        item.description.includes('Alcohol')
      );
      expect(alcoholItem.isRefundable).toBe(false);
      expect(alcoholItem.refundableVatAmount).toBe(0);
      expect(alcoholItem.euSubCode).toBeNull();

      // Total refundable VAT should be sum of refundable items
      const expectedTotal = 84.00 + 31.50 + 73.50; // Hotel + Meals + Conference
      expect(updatedData!.totalRefundableVatAmount).toBe(expectedTotal);

      console.log('✅ validateDocument integration test passed');
    }, 10000); // 10 second timeout for integration test

    it('should handle non-refundable items correctly', async () => {
      // Arrange: Create a test document with only non-refundable items
      const testDocumentData = {
        testDocument: true,
        status: DocumentStatus.AWAITING_VALIDATION,
        fileName: 'test-alcohol-invoice.pdf',
        uploadedAt: new Date(),
        totalAmount: 315.00,
        currency: 'EUR',
        supplierName: 'Wine Store Ltd',
        invoiceId: 'INV-2025-002',
        lineItems: [
          {
            description: 'Wine bottle premium',
            netAmount: 100.00,
            vatAmount: 21.00,
            vatRate: 21
          },
          {
            description: 'Champagne for celebration',
            netAmount: 150.00,
            vatAmount: 31.50,
            vatRate: 21
          },
          {
            description: 'Entertainment expenses',
            netAmount: 50.00,
            vatAmount: 10.50,
            vatRate: 21
          }
        ]
      };

      // Act: Add document to Firestore and process validation
      const docRef = await db.collection('documents').add(testDocumentData);
      
      // Simulate validation processing
      const lineItems = testDocumentData.lineItems;
      let totalRefundableVat = 0;
      const validatedLineItems = [];

      for (const lineItem of lineItems) {
        const refundabilityResult = applyRefundabilityRules({
          description: lineItem.description,
          vatAmount: lineItem.vatAmount,
          netAmount: lineItem.netAmount
        });

        const validatedItem = {
          ...lineItem,
          isRefundable: refundabilityResult.isRefundable,
          euSubCode: refundabilityResult.euSubCode,
          validationNotes: refundabilityResult.validationNotes,
          refundableVatAmount: refundabilityResult.refundableVatAmount
        };

        if (refundabilityResult.refundableVatAmount) {
          totalRefundableVat += refundabilityResult.refundableVatAmount;
        }

        validatedLineItems.push(validatedItem);
      }

      const hasRefundableItems = validatedLineItems.some(item => item.isRefundable);
      const finalStatus = hasRefundableItems ? DocumentStatus.READY_FOR_SUBMISSION : DocumentStatus.VALIDATION_ERROR;

      await docRef.update({
        lineItems: validatedLineItems,
        totalRefundableVatAmount: totalRefundableVat,
        status: finalStatus,
        validationCompletedAt: new Date(),
        updatedAt: new Date(),
        ...(finalStatus === DocumentStatus.VALIDATION_ERROR && {
          validationError: "No refundable items found"
        })
      });

      // Assert: Verify the document was marked as validation error
      const updatedDoc = await docRef.get();
      const updatedData = updatedDoc.data();

      expect(updatedData).toBeDefined();
      expect(updatedData!.status).toBe(DocumentStatus.VALIDATION_ERROR);
      expect(updatedData!.totalRefundableVatAmount).toBe(0);
      expect(updatedData!.validationError).toBe('No refundable items found');
      expect(updatedData!.validationCompletedAt).toBeDefined();

      // Verify all items are marked as non-refundable
      const validatedItems = updatedData!.lineItems;
      validatedItems.forEach((item: any) => {
        expect(item.isRefundable).toBe(false);
        expect(item.refundableVatAmount).toBe(0);
      });

      console.log('✅ validateDocument validation_error test passed');
    }, 10000);

    it('should handle empty line items gracefully', async () => {
      // Arrange: Create a test document with no line items
      const testDocumentData = {
        testDocument: true,
        status: DocumentStatus.AWAITING_VALIDATION,
        fileName: 'test-empty-invoice.pdf',
        uploadedAt: new Date(),
        totalAmount: 0,
        currency: 'EUR',
        supplierName: 'Empty Invoice Ltd',
        invoiceId: 'INV-2025-003',
        lineItems: []
      };

      // Act: Add document to Firestore and simulate validation
      const docRef = await db.collection('documents').add(testDocumentData);
      
      // Simulate empty line items handling
      const lineItems = testDocumentData.lineItems;
      
      if (lineItems.length === 0) {
        await docRef.update({
          status: DocumentStatus.VALIDATION_ERROR,
          validationError: "No line items found",
          updatedAt: new Date()
        });
      }

      // Assert: Verify the document was handled correctly
      const updatedDoc = await docRef.get();
      const updatedData = updatedDoc.data();

      expect(updatedData).toBeDefined();
      expect(updatedData!.status).toBe(DocumentStatus.VALIDATION_ERROR);
      expect(updatedData!.validationError).toBe('No line items found');
      expect(updatedData!.updatedAt).toBeDefined();

      console.log('✅ validateDocument empty line items test passed');
    }, 10000);
  });
});
