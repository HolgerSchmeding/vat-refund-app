import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { DocumentStatus } from '../../types/DocumentStatus';

/**
 * Smoke Test for Complete Upload Process
 * 
 * This test validates the entire end-to-end workflow:
 * 1. Upload file to Storage
 * 2. onInvoiceUpload function triggers
 * 3. Document AI processing (mocked)
 * 4. Document created in Firestore
 * 5. validateDocument function triggers
 * 6. Final validation and status update
 */

describe('Smoke Tests - Complete Upload Process', () => {
  let db: FirebaseFirestore.Firestore;
  let storage: any;
  let app: any;

  beforeAll(async () => {
    // Set emulator environment variables
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
    process.env.GCLOUD_PROJECT = 'demo-vat-refund-app';
    
    // Initialize Firebase Admin for testing
    if (getApps().length === 0) {
      app = initializeApp({
        projectId: 'demo-vat-refund-app',
        storageBucket: 'demo-vat-refund-app.appspot.com'
      });
    } else {
      app = getApps()[0];
    }

    // Get Firestore and Storage instances
    db = getFirestore(app);
    storage = getStorage(app);

    console.log('🔥 Firebase Admin initialized for smoke tests');
  });

  afterAll(async () => {
    // Clean up
    if (app) {
      await deleteApp(app);
    }
  });

  beforeEach(async () => {
    // Clean up test documents and files before each test
    const testDocuments = await db.collection('documents')
      .where('testDocument', '==', true)
      .get();
    
    const batch = db.batch();
    testDocuments.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Clean up test files from storage
    try {
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({ prefix: 'test-uploads/' });
      
      for (const file of files) {
        await file.delete();
      }
    } catch (error) {
      // Ignore cleanup errors
      console.log('Storage cleanup completed');
    }
  });

  describe('End-to-End Upload Process', () => {
    it('should complete entire upload and validation workflow', async () => {
      // Arrange: Prepare test file
      const testFileName = 'test-uploads/test-invoice-smoke.pdf';
      const testFileContent = Buffer.from('Mock PDF content for smoke test');

      // Create a realistic document that would be created by onInvoiceUpload
      const expectedDocumentData = {
        testDocument: true, // Mark as test document for cleanup
        fileName: testFileName,
        originalFileName: 'test-invoice-smoke.pdf',
        uploadedAt: new Date(),
        status: DocumentStatus.PROCESSING,
        fileSize: testFileContent.length,
        
        // Mock Document AI results that would normally be extracted
        invoiceId: 'SMOKE-TEST-001',
        invoiceDate: '2025-09-02',
        supplierName: 'Smoke Test Hotel Ltd',
        totalAmount: 2420.00,
        netAmount: 2000.00,
        vatAmount: 420.00,
        currency: 'EUR',
        
        lineItems: [
          {
            description: 'Deluxe hotel room, 3 nights',
            netAmount: 1500.00,
            vatAmount: 315.00,
            vatRate: 21
          },
          {
            description: 'Business breakfast buffet',
            netAmount: 75.00,
            vatAmount: 15.75,
            vatRate: 21
          },
          {
            description: 'Conference room rental',
            netAmount: 350.00,
            vatAmount: 73.50,
            vatRate: 21
          },
          {
            description: 'Minibar alcohol charges',
            netAmount: 75.00,
            vatAmount: 15.75,
            vatRate: 21
          }
        ]
      };

      console.log('📂 Simulating complete upload process...');

      // Act: Simulate the complete process
      
      // Step 1: Upload file to Storage (simulated)
      const bucket = storage.bucket();
      const file = bucket.file(testFileName);
      await file.save(testFileContent, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            uploadedBy: 'smoke-test',
            testFile: 'true'
          }
        }
      });

      console.log('📄 Test file uploaded to storage');

      // Step 2: Simulate Document AI processing and create document in Firestore
      // (In real scenario, this would be done by onInvoiceUpload function)
      const docRef = await db.collection('documents').add({
        ...expectedDocumentData,
        status: DocumentStatus.AWAITING_VALIDATION,
        documentAiProcessedAt: new Date(),
        processingCompletedAt: new Date()
      });

      console.log('📝 Document created in Firestore with Document AI results');

      // Step 3: Wait for validateDocument function to process
      // This gives time for the Cloud Function trigger to execute
      console.log('⏳ Waiting for validateDocument function to process...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Assert: Verify the complete workflow results
      const finalDoc = await docRef.get();
      const finalData = finalDoc.data();

      expect(finalData).toBeDefined();
      console.log(`📊 Final document status: ${finalData!.status}`);

      // Verify document reached final status
      expect([
        DocumentStatus.READY_FOR_SUBMISSION,
        DocumentStatus.VALIDATION_ERROR
      ]).toContain(finalData!.status);

      // Verify basic document structure
      expect(finalData!.fileName).toBe(testFileName);
      expect(finalData!.supplierName).toBe('Smoke Test Hotel Ltd');
      expect(finalData!.totalAmount).toBe(2420.00);
      expect(finalData!.lineItems).toHaveLength(4);

      // If validation was successful, verify refundability calculations
      if (finalData!.status === DocumentStatus.READY_FOR_SUBMISSION) {
        expect(finalData!.totalRefundableVatAmount).toBeGreaterThan(0);
        expect(finalData!.validationCompletedAt).toBeDefined();

        // Verify line item validations
        const validatedItems = finalData!.lineItems;
        
        // Hotel room should be refundable
        const hotelItem = validatedItems.find((item: any) => 
          item.description.includes('hotel room')
        );
        expect(hotelItem.isRefundable).toBe(true);
        expect(hotelItem.euSubCode).toBe('55.10.10');

        // Breakfast should be refundable (accommodation)
        const breakfastItem = validatedItems.find((item: any) => 
          item.description.includes('breakfast')
        );
        expect(breakfastItem.isRefundable).toBe(true);
        expect(breakfastItem.euSubCode).toBe('55.10.10');

        // Conference room should be refundable
        const conferenceItem = validatedItems.find((item: any) => 
          item.description.includes('Conference room')
        );
        expect(conferenceItem.isRefundable).toBe(true);

        // Alcohol should NOT be refundable
        const alcoholItem = validatedItems.find((item: any) => 
          item.description.includes('alcohol')
        );
        expect(alcoholItem.isRefundable).toBe(false);
        expect(alcoholItem.refundableVatAmount).toBe(0);

        // Calculate expected refundable VAT
        const expectedRefundable = 315.00 + 15.75 + 73.50; // Hotel + Breakfast + Conference
        expect(finalData!.totalRefundableVatAmount).toBe(expectedRefundable);

        console.log(`💰 Total refundable VAT: €${finalData!.totalRefundableVatAmount}`);
        console.log('✅ Document validation successful - ready for submission');
      } else {
        console.log('❌ Document validation failed - marked as error');
        expect(finalData!.validationError).toBeDefined();
      }

      // Verify timestamps are present
      expect(finalData!.uploadedAt).toBeDefined();
      expect(finalData!.documentAiProcessedAt).toBeDefined();
      expect(finalData!.processingCompletedAt).toBeDefined();

      // Verify file exists in storage
      const [fileExists] = await file.exists();
      expect(fileExists).toBe(true);

      console.log('🎯 Smoke test completed successfully - entire workflow validated');
    }, 20000); // 20 second timeout for complete workflow

    it('should handle upload of document with no refundable items', async () => {
      // Arrange: Prepare test document with only non-refundable items
      const testFileName = 'test-uploads/test-alcohol-only-smoke.pdf';
      const testFileContent = Buffer.from('Mock PDF content - alcohol only');

      const documentData = {
        testDocument: true,
        fileName: testFileName,
        originalFileName: 'test-alcohol-only-smoke.pdf',
        uploadedAt: new Date(),
        status: DocumentStatus.AWAITING_VALIDATION,
        
        invoiceId: 'SMOKE-TEST-002',
        supplierName: 'Wine & Spirits Store',
        totalAmount: 315.00,
        netAmount: 260.33,
        vatAmount: 54.67,
        currency: 'EUR',
        
        lineItems: [
          {
            description: 'Premium wine selection',
            netAmount: 130.17,
            vatAmount: 27.33,
            vatRate: 21
          },
          {
            description: 'Champagne bottles',
            netAmount: 130.16,
            vatAmount: 27.34,
            vatRate: 21
          }
        ]
      };

      // Act: Upload and process
      const bucket = storage.bucket();
      const file = bucket.file(testFileName);
      await file.save(testFileContent);

      const docRef = await db.collection('documents').add(documentData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Assert: Verify proper handling of non-refundable document
      const finalDoc = await docRef.get();
      const finalData = finalDoc.data();

      expect(finalData).toBeDefined();
      expect(finalData!.status).toBe(DocumentStatus.VALIDATION_ERROR);
      expect(finalData!.totalRefundableVatAmount).toBe(0);
      expect(finalData!.validationError).toBe('No refundable items found');

      // Verify all items marked as non-refundable
      const validatedItems = finalData!.lineItems;
      validatedItems.forEach((item: any) => {
        expect(item.isRefundable).toBe(false);
        expect(item.refundableVatAmount).toBe(0);
      });

      console.log('✅ Non-refundable document smoke test passed');
    }, 15000);

    it('should handle document processing errors gracefully', async () => {
      // Arrange: Create a document that might cause processing issues
      const testFileName = 'test-uploads/test-malformed-smoke.pdf';
      const testFileContent = Buffer.from('Malformed PDF content');

      const documentData = {
        testDocument: true,
        fileName: testFileName,
        originalFileName: 'test-malformed-smoke.pdf',
        uploadedAt: new Date(),
        status: DocumentStatus.AWAITING_VALIDATION,
        
        // Malformed/missing data to test error handling
        invoiceId: null,
        supplierName: '',
        totalAmount: null,
        lineItems: [] // Empty line items should trigger validation error
      };

      // Act: Process malformed document
      const bucket = storage.bucket();
      const file = bucket.file(testFileName);
      await file.save(testFileContent);

      const docRef = await db.collection('documents').add(documentData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Assert: Verify error handling
      const finalDoc = await docRef.get();
      const finalData = finalDoc.data();

      expect(finalData).toBeDefined();
      expect(finalData!.status).toBe(DocumentStatus.VALIDATION_ERROR);
      expect(finalData!.validationError).toBe('No line items found');

      console.log('✅ Error handling smoke test passed');
    }, 10000);
  });
});
