import { describe, it, expect, beforeEach } from '@jest/globals';
import { DocumentStatus } from '../src/types/DocumentStatus';
import { 
  StatusTransitionGuard, 
  TransitionContext, 
  TransitionValidationResult 
} from '../src/guards/StatusTransitionGuard';

/**
 * Test Suite for Status Transition Guards
 * P2-Priority: Comprehensive validation testing
 */

describe('StatusTransitionGuard', () => {
  let context: TransitionContext;

  beforeEach(() => {
    context = {
      userId: 'test-user-123',
      tenantId: 'test-tenant-456', 
      documentId: 'test-doc-789',
      timestamp: new Date('2025-01-04T10:00:00Z'),
      metadata: {
        userRole: 'user',
        fileSize: 1024000,
        extractedData: { vatNumber: 'DE123456789' },
        validatedBy: 'validator-123',
        vatNumber: 'DE123456789',
        invoiceDate: '2024-12-01',
        totalAmount: 150.00
      }
    };
  });

  describe('Basic Transition Validation', () => {
    it('should allow valid transitions', () => {
      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        context
      );

      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should reject invalid transitions', () => {
      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.APPROVED, // Invalid jump
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Invalid transition');
    });

    it('should reject transitions from final states', () => {
      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.COMPLETED,
        DocumentStatus.PROCESSING,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Invalid transition');
    });
  });

  describe('Business Logic Validation', () => {
    it('should require file size for processing', () => {
      const invalidContext = {
        ...context,
        metadata: { ...context.metadata, fileSize: 0 }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        invalidContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('file appears to be empty');
    });

    it('should require extracted data for validation', () => {
      const invalidContext = {
        ...context,
        metadata: { ...context.metadata, extractedData: undefined }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.DOCUMENT_AI_SUCCESS,
        DocumentStatus.VALIDATING,
        invalidContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('no extracted data available');
    });

    it('should require validation data for submission', () => {
      const invalidContext = {
        ...context,
        metadata: { ...context.metadata, vatNumber: undefined }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.VALIDATED,
        DocumentStatus.READY_FOR_SUBMISSION,
        invalidContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('missing required data');
      expect(result.requiredFields).toContain('vatNumber');
    });

    it('should warn about low amounts', () => {
      const lowAmountContext = {
        ...context,
        metadata: { ...context.metadata, totalAmount: 20.00 }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.VALIDATED,
        DocumentStatus.READY_FOR_SUBMISSION,
        lowAmountContext
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('below minimum refund threshold');
    });

    it('should require validation by user for submission', () => {
      const invalidContext = {
        ...context,
        metadata: { ...context.metadata, validatedBy: undefined }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.READY_FOR_SUBMISSION,
        DocumentStatus.SUBMITTING,
        invalidContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('must be validated by a user');
    });

    it('should require reason for error recovery', () => {
      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.PROCESSING_ERROR,
        DocumentStatus.PROCESSING,
        { ...context, reason: undefined }
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('requires a reason');
    });

    it('should require reason for rejection', () => {
      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.SUBMITTED,
        DocumentStatus.REJECTED,
        { ...context, reason: undefined }
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('requires a detailed reason');
    });
  });

  describe('Temporal Constraints', () => {
    it('should prevent rapid transitions', () => {
      const rapidContext = {
        ...context,
        metadata: { 
          ...context.metadata, 
          lastTransition: context.timestamp.getTime() - 500 // 500ms ago
        }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.PROCESSING,
        DocumentStatus.DOCUMENT_AI_SUCCESS,
        rapidContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('too frequent status changes');
    });

    it('should allow error states despite rapid transitions', () => {
      const rapidContext = {
        ...context,
        metadata: { 
          ...context.metadata, 
          lastTransition: context.timestamp.getTime() - 500
        }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.PROCESSING,
        DocumentStatus.PROCESSING_ERROR,
        rapidContext
      );

      expect(result.isValid).toBe(true);
    });

    it('should prevent weekend submissions', () => {
      const weekendContext = {
        ...context,
        timestamp: new Date('2025-01-05T10:00:00Z') // Sunday
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.READY_FOR_SUBMISSION,
        DocumentStatus.SUBMITTING,
        weekendContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('not processed on weekends');
    });

    it('should handle processing timeouts', () => {
      const timeoutContext = {
        ...context,
        metadata: {
          ...context.metadata,
          processingStarted: new Date(context.timestamp.getTime() - 15 * 60 * 1000) // 15 minutes ago
        }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.PROCESSING,
        DocumentStatus.DOCUMENT_AI_SUCCESS,
        timeoutContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('timeout exceeded');
    });
  });

  describe('Permission Validation', () => {
    it('should require admin for admin-only transitions', () => {
      const userContext = {
        ...context,
        metadata: { ...context.metadata, userRole: 'user' }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.SUBMITTED,
        DocumentStatus.APPROVED,
        userContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('administrator privileges');
    });

    it('should allow admin transitions for admin users', () => {
      const adminContext = {
        ...context,
        metadata: { ...context.metadata, userRole: 'admin' }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.SUBMITTED,
        DocumentStatus.APPROVED,
        adminContext
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject readonly user transitions', () => {
      const readonlyContext = {
        ...context,
        metadata: { ...context.metadata, userRole: 'readonly' }
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        readonlyContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Read-only users cannot modify');
    });

    it('should require tenant ID', () => {
      const noTenantContext = { ...context, tenantId: '' };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        noTenantContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Tenant ID required');
    });
  });

  describe('Allowed Next Statuses', () => {
    it('should return filtered allowed statuses based on context', () => {
      const allowedStatuses = StatusTransitionGuard.getAllowedNextStatuses(
        DocumentStatus.UPLOADED,
        context
      );

      expect(allowedStatuses).toContain(DocumentStatus.PROCESSING);
      expect(allowedStatuses).not.toContain(DocumentStatus.APPROVED);
    });

    it('should exclude admin-only statuses for regular users', () => {
      const userContext = {
        ...context,
        metadata: { ...context.metadata, userRole: 'user' }
      };

      const allowedStatuses = StatusTransitionGuard.getAllowedNextStatuses(
        DocumentStatus.SUBMITTED,
        userContext
      );

      expect(allowedStatuses).not.toContain(DocumentStatus.APPROVED);
      expect(allowedStatuses).not.toContain(DocumentStatus.REJECTED);
    });

    it('should include admin-only statuses for admin users', () => {
      const adminContext = {
        ...context,
        metadata: { ...context.metadata, userRole: 'admin' }
      };

      const allowedStatuses = StatusTransitionGuard.getAllowedNextStatuses(
        DocumentStatus.SUBMITTED,
        adminContext
      );

      expect(allowedStatuses).toContain(DocumentStatus.APPROVED);
      expect(allowedStatuses).toContain(DocumentStatus.REJECTED);
    });
  });

  describe('Pre-validation', () => {
    it('should handle partial context in pre-validation', () => {
      const partialContext = {
        documentId: 'test-doc',
        userId: 'test-user'
      };

      const result = StatusTransitionGuard.preValidateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        partialContext
      );

      expect(result.isValid).toBe(false); // Should fail due to missing tenantId
    });
  });
});

describe('Performance Tests', () => {
  it('should validate transitions efficiently', () => {
    const context: TransitionContext = {
      userId: 'test-user',
      tenantId: 'test-tenant',
      documentId: 'test-doc',
      timestamp: new Date(),
      metadata: {}
    };

    const start = Date.now();
    
    // Run 1000 validations
    for (let i = 0; i < 1000; i++) {
      StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        context
      );
    }
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });
});
