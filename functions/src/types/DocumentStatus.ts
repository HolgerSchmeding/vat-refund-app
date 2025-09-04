/**
 * Document Status Enum
 * Central definition of all possible document states in the VAT refund processing pipeline
 *
 * This enum replaces magic strings throughout the codebase to ensure type safety
 * and consistency across frontend and backend.
 */

export enum DocumentStatus {
  // Initial upload states
  UPLOADED = "uploaded",
  PROCESSING = "processing",

  // Document AI processing states
  DOCUMENT_AI_SUCCESS = "document_ai_success",
  DOCUMENT_AI_ERROR = "document_ai_error",

  // Validation states
  AWAITING_VALIDATION = "awaiting_validation",
  VALIDATING = "validating",
  VALIDATED = "validated",
  VALIDATION_ERROR = "validation_error",

  // Business logic states
  READY_FOR_SUBMISSION = "ready_for_submission",
  NO_REFUNDABLE_ITEMS = "no_refundable_items",

  // Submission states
  SUBMITTING = "submitting",
  SUBMITTED = "submitted",
  SUBMISSION_ERROR = "submission_error",

  // Address correction states
  ADDRESS_CORRECTION_REQUESTED = "address_correction_requested",
  ADDRESS_CORRECTED = "address_corrected",

  // Final states
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",

  // Error states
  PROCESSING_ERROR = "processing_error",
  SYSTEM_ERROR = "system_error"
}

/**
 * Status transition rules
 * Defines which status transitions are valid
 */
export const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.UPLOADED]: [
    DocumentStatus.PROCESSING,
    DocumentStatus.PROCESSING_ERROR,
  ],

  [DocumentStatus.PROCESSING]: [
    DocumentStatus.DOCUMENT_AI_SUCCESS,
    DocumentStatus.DOCUMENT_AI_ERROR,
    DocumentStatus.PROCESSING_ERROR,
  ],

  [DocumentStatus.DOCUMENT_AI_SUCCESS]: [
    DocumentStatus.AWAITING_VALIDATION,
    DocumentStatus.VALIDATING,
  ],

  [DocumentStatus.DOCUMENT_AI_ERROR]: [
    DocumentStatus.PROCESSING, // Retry
    DocumentStatus.SYSTEM_ERROR,
  ],

  [DocumentStatus.AWAITING_VALIDATION]: [
    DocumentStatus.VALIDATING,
  ],

  [DocumentStatus.VALIDATING]: [
    DocumentStatus.VALIDATED,
    DocumentStatus.VALIDATION_ERROR,
  ],

  [DocumentStatus.VALIDATED]: [
    DocumentStatus.READY_FOR_SUBMISSION,
    DocumentStatus.NO_REFUNDABLE_ITEMS,
  ],

  [DocumentStatus.VALIDATION_ERROR]: [
    DocumentStatus.ADDRESS_CORRECTION_REQUESTED,
    DocumentStatus.VALIDATING, // Retry
    DocumentStatus.SYSTEM_ERROR,
  ],

  [DocumentStatus.READY_FOR_SUBMISSION]: [
    DocumentStatus.SUBMITTING,
  ],

  [DocumentStatus.NO_REFUNDABLE_ITEMS]: [
    DocumentStatus.COMPLETED,
  ],

  [DocumentStatus.SUBMITTING]: [
    DocumentStatus.SUBMITTED,
    DocumentStatus.SUBMISSION_ERROR,
  ],

  [DocumentStatus.SUBMITTED]: [
    DocumentStatus.APPROVED,
    DocumentStatus.REJECTED,
  ],

  [DocumentStatus.SUBMISSION_ERROR]: [
    DocumentStatus.SUBMITTING, // Retry
    DocumentStatus.SYSTEM_ERROR,
  ],

  [DocumentStatus.ADDRESS_CORRECTION_REQUESTED]: [
    DocumentStatus.ADDRESS_CORRECTED,
    DocumentStatus.VALIDATION_ERROR, // If correction fails
  ],

  [DocumentStatus.ADDRESS_CORRECTED]: [
    DocumentStatus.VALIDATING,
  ],

  [DocumentStatus.APPROVED]: [
    DocumentStatus.COMPLETED,
  ],

  [DocumentStatus.REJECTED]: [
    DocumentStatus.COMPLETED,
  ],

  [DocumentStatus.COMPLETED]: [], // Final state

  [DocumentStatus.PROCESSING_ERROR]: [
    DocumentStatus.PROCESSING, // Retry
    DocumentStatus.SYSTEM_ERROR,
  ],

  [DocumentStatus.SYSTEM_ERROR]: [], // Final error state
};

/**
 * Status categories for UI grouping
 */
export enum StatusCategory {
  PROCESSING = "processing",
  VALIDATION = "validation",
  SUBMISSION = "submission",
  CORRECTION = "correction",
  FINAL = "final",
  ERROR = "error"
}

/**
 * Map status to category
 */
export const STATUS_CATEGORIES: Record<DocumentStatus, StatusCategory> = {
  [DocumentStatus.UPLOADED]: StatusCategory.PROCESSING,
  [DocumentStatus.PROCESSING]: StatusCategory.PROCESSING,
  [DocumentStatus.DOCUMENT_AI_SUCCESS]: StatusCategory.PROCESSING,
  [DocumentStatus.DOCUMENT_AI_ERROR]: StatusCategory.ERROR,

  [DocumentStatus.AWAITING_VALIDATION]: StatusCategory.VALIDATION,
  [DocumentStatus.VALIDATING]: StatusCategory.VALIDATION,
  [DocumentStatus.VALIDATED]: StatusCategory.VALIDATION,
  [DocumentStatus.VALIDATION_ERROR]: StatusCategory.ERROR,

  [DocumentStatus.READY_FOR_SUBMISSION]: StatusCategory.SUBMISSION,
  [DocumentStatus.NO_REFUNDABLE_ITEMS]: StatusCategory.FINAL,
  [DocumentStatus.SUBMITTING]: StatusCategory.SUBMISSION,
  [DocumentStatus.SUBMITTED]: StatusCategory.SUBMISSION,
  [DocumentStatus.SUBMISSION_ERROR]: StatusCategory.ERROR,

  [DocumentStatus.ADDRESS_CORRECTION_REQUESTED]: StatusCategory.CORRECTION,
  [DocumentStatus.ADDRESS_CORRECTED]: StatusCategory.CORRECTION,

  [DocumentStatus.APPROVED]: StatusCategory.FINAL,
  [DocumentStatus.REJECTED]: StatusCategory.FINAL,
  [DocumentStatus.COMPLETED]: StatusCategory.FINAL,

  [DocumentStatus.PROCESSING_ERROR]: StatusCategory.ERROR,
  [DocumentStatus.SYSTEM_ERROR]: StatusCategory.ERROR,
};

/**
 * User-friendly status labels for UI display
 */
export const STATUS_LABELS: Record<DocumentStatus, string> = {
  [DocumentStatus.UPLOADED]: "Uploaded",
  [DocumentStatus.PROCESSING]: "Processing...",
  [DocumentStatus.DOCUMENT_AI_SUCCESS]: "Document AI Success",
  [DocumentStatus.DOCUMENT_AI_ERROR]: "Document AI Error",

  [DocumentStatus.AWAITING_VALIDATION]: "Awaiting Validation",
  [DocumentStatus.VALIDATING]: "Validating...",
  [DocumentStatus.VALIDATED]: "Validated",
  [DocumentStatus.VALIDATION_ERROR]: "Validation Error",

  [DocumentStatus.READY_FOR_SUBMISSION]: "Ready for Submission",
  [DocumentStatus.NO_REFUNDABLE_ITEMS]: "No Refundable Items",
  [DocumentStatus.SUBMITTING]: "Submitting...",
  [DocumentStatus.SUBMITTED]: "Submitted",
  [DocumentStatus.SUBMISSION_ERROR]: "Submission Error",

  [DocumentStatus.ADDRESS_CORRECTION_REQUESTED]: "Address Correction Requested",
  [DocumentStatus.ADDRESS_CORRECTED]: "Address Corrected",

  [DocumentStatus.APPROVED]: "Approved",
  [DocumentStatus.REJECTED]: "Rejected",
  [DocumentStatus.COMPLETED]: "Completed",

  [DocumentStatus.PROCESSING_ERROR]: "Processing Error",
  [DocumentStatus.SYSTEM_ERROR]: "System Error",
};

/**
 * Status descriptions for detailed UI display
 */
export const STATUS_DESCRIPTIONS: Record<DocumentStatus, string> = {
  [DocumentStatus.UPLOADED]: "Document has been uploaded and is queued for processing",
  [DocumentStatus.PROCESSING]: "Document is being processed by the system",
  [DocumentStatus.DOCUMENT_AI_SUCCESS]: "Document has been successfully processed by Document AI",
  [DocumentStatus.DOCUMENT_AI_ERROR]: "Document AI processing failed",

  [DocumentStatus.AWAITING_VALIDATION]: "Document is waiting to be validated",
  [DocumentStatus.VALIDATING]: "Document data is being validated for EU VAT compliance",
  [DocumentStatus.VALIDATED]: "Document has passed validation checks",
  [DocumentStatus.VALIDATION_ERROR]: "Document failed validation - manual review required",

  [DocumentStatus.READY_FOR_SUBMISSION]: "Document is ready to be submitted to tax authorities",
  [DocumentStatus.NO_REFUNDABLE_ITEMS]: "No VAT-refundable items found in this document",
  [DocumentStatus.SUBMITTING]: "Document is being submitted to tax authorities",
  [DocumentStatus.SUBMITTED]: "Document has been submitted and is awaiting approval",
  [DocumentStatus.SUBMISSION_ERROR]: "Submission to tax authorities failed",

  [DocumentStatus.ADDRESS_CORRECTION_REQUESTED]: "Address correction has been requested from supplier",
  [DocumentStatus.ADDRESS_CORRECTED]: "Supplier has provided address correction",

  [DocumentStatus.APPROVED]: "VAT refund has been approved by tax authorities",
  [DocumentStatus.REJECTED]: "VAT refund has been rejected by tax authorities",
  [DocumentStatus.COMPLETED]: "Processing is complete",

  [DocumentStatus.PROCESSING_ERROR]: "An error occurred during document processing",
  [DocumentStatus.SYSTEM_ERROR]: "A system error occurred - contact support",
};

/**
 * Utility functions for status management
 */
export class DocumentStatusUtils {
  /**
   * Check if a status transition is valid
   */
  static isValidTransition(from: DocumentStatus, to: DocumentStatus): boolean {
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Get all possible next statuses for a given status
   */
  static getPossibleNextStatuses(current: DocumentStatus): DocumentStatus[] {
    return STATUS_TRANSITIONS[current] || [];
  }

  /**
   * Check if a status is a final state (no further transitions possible)
   */
  static isFinalStatus(status: DocumentStatus): boolean {
    return STATUS_TRANSITIONS[status]?.length === 0;
  }

  /**
   * Check if a status is an error state
   */
  static isErrorStatus(status: DocumentStatus): boolean {
    return STATUS_CATEGORIES[status] === StatusCategory.ERROR;
  }

  /**
   * Check if a status indicates processing is in progress
   */
  static isProcessingStatus(status: DocumentStatus): boolean {
    return [
      DocumentStatus.PROCESSING,
      DocumentStatus.VALIDATING,
      DocumentStatus.SUBMITTING,
    ].includes(status);
  }

  /**
   * Get user-friendly label for status
   */
  static getLabel(status: DocumentStatus): string {
    return STATUS_LABELS[status] || status;
  }

  /**
   * Get detailed description for status
   */
  static getDescription(status: DocumentStatus): string {
    return STATUS_DESCRIPTIONS[status] || "";
  }

  /**
   * Get status category
   */
  static getCategory(status: DocumentStatus): StatusCategory {
    return STATUS_CATEGORIES[status];
  }
}

// Export all enum values as array for convenience
export const ALL_DOCUMENT_STATUSES = Object.values(DocumentStatus);
export const ALL_STATUS_CATEGORIES = Object.values(StatusCategory);
