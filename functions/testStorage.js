// Test Storage Rules direkt über Firebase Admin
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');

// Test-Setup (nicht für Production!)
if (!admin.apps.length) {
  admin.initializeApp();
}

async function testStorageAccess() {
  console.log('🧪 Testing Storage Access...\n');
  
  try {
    const bucket = getStorage().bucket();
    
    // Test: Liste Dateien im documents/test-user-123/ Ordner
    const [files] = await bucket.getFiles({
      prefix: 'documents/test-user-123/'
    });
    
    console.log('✅ Storage Zugriff erfolgreich!');
    console.log(`Gefundene Dateien: ${files.length}`);
    
    // Test: Erstelle Test-Datei
    const testFile = bucket.file('documents/test-user-123/doc-4/test-invoice.pdf');
    const testContent = 'Test PDF Content';
    
    await testFile.save(testContent, {
      metadata: {
        contentType: 'application/pdf'
      }
    });
    
    console.log('✅ Test-Datei erfolgreich erstellt!');
    
    // Test: Lese Test-Datei
    const [content] = await testFile.download();
    console.log('✅ Test-Datei erfolgreich gelesen!');
    console.log('Content:', content.toString());
    
    // Cleanup
    await testFile.delete();
    console.log('✅ Test-Datei gelöscht');
    
  } catch (error) {
    console.error('❌ Storage Test fehlgeschlagen:', error.message);
  }
}

testStorageAccess();
