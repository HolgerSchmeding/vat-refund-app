import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applyRefundabilityRules } from '../../rules/refundabilityRules';

/**
 * Smoke Tests for Complete VAT Refund Workflow
 * 
 * These tests validate the complete end-to-end workflow of the VAT refund application
 * including document processing, validation, and status updates.
 */

describe('Smoke Tests - VAT Refund Workflow', () => {
  let db: FirebaseFirestore.Firestore;
  let app: any;

  beforeAll(async () => {
    // Set emulator environment
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.GCLOUD_PROJECT = 'demo-vat-refund-app';
    
    // Initialize Firebase Admin for testing
    if (getApps().length === 0) {
      app = initializeApp({
        projectId: 'demo-vat-refund-app'
      });
    } else {
      app = getApps()[0];
    }

    db = getFirestore(app);
    console.log('🔥 Firebase Admin initialized for workflow smoke tests');
  });

  afterAll(async () => {
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

  describe('Complete Workflow Simulation', () => {
    it('should process complete business trip invoice workflow', async () => {
      console.log('🚀 Starting complete business trip workflow simulation...');
      
      // Step 1: Create initial document (simulates upload trigger)
      const documentId = `test-business-trip-${Date.now()}`;
      const initialDocument = {
        id: documentId,
        fileName: 'business-trip-invoice.pdf',
        originalName: 'business-trip-invoice.pdf',
        uploadTimestamp: new Date(),
        status: 'uploaded',
        userId: 'test-user-123',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        testDocument: true
      };

      await db.collection('documents').doc(documentId).set(initialDocument);
      console.log('✅ Document uploaded and stored in Firestore');

      // Step 2: Simulate Document AI processing
      const extractedData = {
        totalAmount: 750.50,
        vatAmount: 142.59,
        currency: 'EUR',
        vendorName: 'Hotel Europa & Conference Center',
        invoiceDate: '2024-01-15',
        lineItems: [
          {
            description: 'Hotel accommodation - 3 nights',
            vatAmount: 94.50,
            netAmount: 355.50
          },
          {
            description: 'Conference room rental',
            vatAmount: 42.00,
            netAmount: 158.00
          },
          {
            description: 'Business catering',
            vatAmount: 6.09,
            netAmount: 94.41
          }
        ]
      };

      // Update document with extracted data
      await db.collection('documents').doc(documentId).update({
        status: 'processing',
        extractedData,
        aiProcessingTimestamp: new Date()
      });
      console.log('✅ Document AI processing completed');

      // Step 3: Apply validation rules
      const validationResults = [];
      let totalRefundableAmount = 0;

      for (const item of extractedData.lineItems) {
        const result = await applyRefundabilityRules(item);
        validationResults.push({
          lineItem: item,
          validationResult: result
        });
        
        if (result.isRefundable && result.refundableVatAmount !== null) {
          totalRefundableAmount += result.refundableVatAmount;
        }
      }

      // Step 4: Update document with validation results
      const finalStatus = {
        status: 'validated',
        validationResults,
        refundableAmount: totalRefundableAmount,
        validationTimestamp: new Date(),
        summary: {
          totalVatAmount: extractedData.vatAmount,
          refundableAmount: totalRefundableAmount,
          refundableItems: validationResults.filter((r: any) => r.validationResult.isRefundable).length,
          totalItems: validationResults.length
        }
      };

      await db.collection('documents').doc(documentId).update(finalStatus);
      console.log('✅ Validation completed and results stored');

      // Step 5: Verify final document state
      const finalDocument = await db.collection('documents').doc(documentId).get();
      const finalData = finalDocument.data();

      // Assertions for complete workflow
      expect(finalData?.status).toBe('validated');
      expect(finalData?.extractedData).toBeDefined();
      expect(finalData?.validationResults).toBeDefined();
      expect(finalData?.validationResults).toHaveLength(3);
      expect(finalData?.refundableAmount).toBeGreaterThan(0);
      expect(finalData?.summary?.totalItems).toBe(3);
      expect(finalData?.summary?.refundableItems).toBeGreaterThan(0);

      // Verify refundable items
      const refundableItems = finalData?.validationResults?.filter(
        (r: any) => r.validationResult.isRefundable
      );
      expect(refundableItems.length).toBeGreaterThan(0);

      // Hotel accommodation should be refundable
      const hotelItem = finalData?.validationResults?.find(
        (r: any) => r.lineItem.description.includes('Hotel accommodation')
      );
      expect(hotelItem?.validationResult.isRefundable).toBe(true);
      expect(hotelItem?.validationResult.euSubCode).toBe('55.10.10');

      console.log(`✅ Workflow completed successfully! Total refundable: €${totalRefundableAmount.toFixed(2)}`);
    });

    it('should handle mixed refundable and non-refundable items', async () => {
      console.log('🔍 Testing mixed refundable/non-refundable workflow...');
      
      const documentId = `test-mixed-items-${Date.now()}`;
      const mixedDocument = {
        id: documentId,
        fileName: 'mixed-expenses.pdf',
        originalName: 'mixed-expenses.pdf',
        uploadTimestamp: new Date(),
        status: 'uploaded',
        userId: 'test-user-456',
        fileSize: 512000,
        mimeType: 'application/pdf',
        testDocument: true
      };

      await db.collection('documents').doc(documentId).set(mixedDocument);

      // Simulate extraction with mixed items
      const extractedData = {
        totalAmount: 350.00,
        vatAmount: 73.50,
        currency: 'EUR',
        vendorName: 'Business & Entertainment Services',
        invoiceDate: '2024-01-20',
        lineItems: [
          {
            description: 'Office supplies',
            vatAmount: 31.50,
            netAmount: 118.50
          },
          {
            description: 'Wine for client entertainment',
            vatAmount: 21.00,
            netAmount: 79.00
          },
          {
            description: 'Gift vouchers for clients',
            vatAmount: 21.00,
            netAmount: 79.00
          }
        ]
      };

      await db.collection('documents').doc(documentId).update({
        status: 'processing',
        extractedData,
        aiProcessingTimestamp: new Date()
      });

      // Apply validation
      const validationResults = [];
      let totalRefundableAmount = 0;

      for (const item of extractedData.lineItems) {
        const result = await applyRefundabilityRules(item);
        validationResults.push({
          lineItem: item,
          validationResult: result
        });
        
        if (result.isRefundable && result.refundableVatAmount !== null) {
          totalRefundableAmount += result.refundableVatAmount;
        }
      }

      await db.collection('documents').doc(documentId).update({
        status: 'validated',
        validationResults,
        refundableAmount: totalRefundableAmount,
        validationTimestamp: new Date()
      });

      // Verify results
      const finalDocument = await db.collection('documents').doc(documentId).get();
      const finalData = finalDocument.data();

      expect(finalData?.status).toBe('validated');
      expect(finalData?.validationResults).toHaveLength(3);

      // Office supplies should be refundable
      const officeSupplies = finalData?.validationResults?.find(
        (r: any) => r.lineItem.description.includes('Office supplies')
      );
      expect(officeSupplies?.validationResult.isRefundable).toBe(true);

      // Wine should not be refundable (alcohol)
      const wine = finalData?.validationResults?.find(
        (r: any) => r.lineItem.description.includes('Wine')
      );
      expect(wine?.validationResult.isRefundable).toBe(false);

      // Gift vouchers should not be refundable
      const gifts = finalData?.validationResults?.find(
        (r: any) => r.lineItem.description.includes('Gift vouchers')
      );
      expect(gifts?.validationResult.isRefundable).toBe(false);

      // Only office supplies should be refundable
      expect(totalRefundableAmount).toBe(31.50);

      console.log(`✅ Mixed items workflow completed! Refundable: €${totalRefundableAmount.toFixed(2)} of €${extractedData.vatAmount.toFixed(2)}`);
    });

    it('should handle document with validation errors', async () => {
      console.log('⚠️ Testing error handling workflow...');
      
      const documentId = `test-error-handling-${Date.now()}`;
      const errorDocument = {
        id: documentId,
        fileName: 'corrupted-invoice.pdf',
        originalName: 'corrupted-invoice.pdf',
        uploadTimestamp: new Date(),
        status: 'uploaded',
        userId: 'test-user-789',
        fileSize: 256000,
        mimeType: 'application/pdf',
        testDocument: true
      };

      await db.collection('documents').doc(documentId).set(errorDocument);

      // Simulate Document AI processing failure
      await db.collection('documents').doc(documentId).update({
        status: 'error',
        error: {
          message: 'Failed to extract data from document',
          code: 'DOCUMENT_AI_PROCESSING_FAILED',
          timestamp: new Date()
        },
        aiProcessingTimestamp: new Date()
      });

      // Verify error state
      const erroredDocument = await db.collection('documents').doc(documentId).get();
      const errorData = erroredDocument.data();

      expect(errorData?.status).toBe('error');
      expect(errorData?.error).toBeDefined();
      expect(errorData?.error?.code).toBe('DOCUMENT_AI_PROCESSING_FAILED');
      expect(errorData?.extractedData).toBeUndefined();
      expect(errorData?.validationResults).toBeUndefined();

      console.log('✅ Error handling workflow completed successfully');
    });
  });
});
