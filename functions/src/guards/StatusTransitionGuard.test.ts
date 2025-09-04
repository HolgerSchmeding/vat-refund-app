import {describe, it, expect, beforeEach} from "vitest";
import {DocumentStatus} from "../types/DocumentStatus";
import {
  StatusTransitionGuard,
  TransitionContext,
} from "../guards/StatusTransitionGuard";

/**
 * Test Suite for Status Transition Guards
 * P2-Priority: Comprehensive validation testing
 */

describe("StatusTransitionGuard", () => {
  let context: TransitionContext;

  beforeEach(() => {
    context = {
      userId: "test-user-123",
      tenantId: "test-tenant-456",
      documentId: "test-doc-789",
      timestamp: new Date("2025-01-04T10:00:00Z"),
      metadata: {
        userRole: "user",
        fileSize: 1024000,
        extractedData: {vatNumber: "DE123456789"},
        validatedBy: "validator-123",
        vatNumber: "DE123456789",
        invoiceDate: "2024-12-01",
        totalAmount: 150.00,
      },
    };
  });

  describe("Basic Transition Validation", () => {
    it("should allow valid transitions", () => {
      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        context
      );

      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it("should reject invalid transitions", () => {
      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.APPROVED, // Invalid jump
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("Invalid transition");
    });

    it("should reject transitions from final states", () => {
      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.COMPLETED,
        DocumentStatus.PROCESSING,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("Invalid transition");
    });
  });

  describe("Business Logic Validation", () => {
    it("should require file size for processing", () => {
      const invalidContext = {
        ...context,
        metadata: {...context.metadata, fileSize: 0},
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        invalidContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("file appears to be empty");
    });

    it("should require extracted data for validation", () => {
      const invalidContext = {
        ...context,
        metadata: {...context.metadata, extractedData: undefined},
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.DOCUMENT_AI_SUCCESS,
        DocumentStatus.VALIDATING,
        invalidContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("no extracted data available");
    });

    it("should warn about low amounts", () => {
      const lowAmountContext = {
        ...context,
        metadata: {...context.metadata, totalAmount: 20.00},
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.VALIDATED,
        DocumentStatus.READY_FOR_SUBMISSION,
        lowAmountContext
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain("Total amount is below minimum refund threshold (€25)");
    });
  });

  describe("Permission Validation", () => {
    it("should require admin for admin-only transitions", () => {
      const userContext = {
        ...context,
        metadata: {...context.metadata, userRole: "user"},
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.SUBMITTED,
        DocumentStatus.APPROVED,
        userContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain("administrator privileges");
    });

    it("should allow admin transitions for admin users", () => {
      const adminContext = {
        ...context,
        metadata: {...context.metadata, userRole: "admin"},
      };

      const result = StatusTransitionGuard.validateTransition(
        DocumentStatus.SUBMITTED,
        DocumentStatus.APPROVED,
        adminContext
      );

      expect(result.isValid).toBe(true);
    });
  });
});
