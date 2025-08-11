const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with emulator settings
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";

admin.initializeApp({
  projectId: 'demo-eu-vat-refund-app-2025',
  storageBucket: 'demo-eu-vat-refund-app-2025.appspot.com'
});

async function uploadTestPDF() {
  try {
    const bucket = admin.storage().bucket();
    
    // Create a simple test invoice text file (since we don't have a real PDF)
    const testInvoiceContent = `INVOICE
Invoice Number: INV-2025-001
Date: 2025-01-08
Supplier: ACME Corporation Ltd
123 Business Street
London, UK

Net Amount: €850.00
VAT (20%): €170.00
Total Amount: €1,020.00
Currency: EUR

Payment Terms: 30 days`;
    
    // Write to a temporary file
    const tempFilePath = path.join(__dirname, 'temp-invoice.txt');
    fs.writeFileSync(tempFilePath, testInvoiceContent);
    
    console.log('Uploading test invoice file...');
    
    // Upload as PDF content type to test the function
    await bucket.upload(tempFilePath, {
      destination: 'test/my-test-invoice.pdf',
      metadata: {
        contentType: 'application/pdf',
      }
    });
    
    console.log('Test file uploaded to: test/my-test-invoice.pdf');
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    console.log('File should trigger the function automatically if emulators are running.');
    
  } catch (error) {
    console.error('Error uploading test file:', error);
  } finally {
    process.exit(0);
  }
}

uploadTestPDF();
