const { DocumentStatus } = require('./lib/types/DocumentStatus');
const { StatusTransitionGuard } = require('./lib/guards/StatusTransitionGuard');

console.log('🧪 Starting Live Status Transition Tests...\n');

const context = {
  userId: 'test-user-live',
  tenantId: 'test-tenant-live', 
  documentId: 'test-doc-123',
  timestamp: new Date(),
  metadata: {
    userRole: 'user',
    fileSize: 1024000,
    extractedData: { vatNumber: 'DE123456789' },
    vatNumber: 'DE123456789',
    invoiceDate: '2024-12-01',
    totalAmount: 150.00
  }
};

console.log('✅ Test 1: Valid Transition (UPLOADED -> PROCESSING)');
try {
  const test1 = StatusTransitionGuard.validateTransition(
    DocumentStatus.UPLOADED,
    DocumentStatus.PROCESSING,
    context
  );
  console.log('Result:', test1.isValid ? 'PASSED ✓' : 'FAILED ✗');
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n❌ Test 2: Invalid Transition (UPLOADED -> APPROVED)');
try {
  const test2 = StatusTransitionGuard.validateTransition(
    DocumentStatus.UPLOADED,
    DocumentStatus.APPROVED,
    context
  );
  console.log('Result:', test2.isValid ? 'FAILED ✗' : 'PASSED ✓ (correctly blocked)');
  if (!test2.isValid) console.log('Blocked reason:', test2.errorMessage);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n🎉 Basic Live Tests Completed! 🎉');
