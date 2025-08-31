/**
 * Document Status Types for Frontend
 * Shared types between frontend and backend for type safety
 */

// Document status constants (compatible with Vite/React frontend)
export const DocumentStatus = {
  // Initial upload states
  UPLOADING: "uploading", // Legacy status for file uploads  
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  
  // Document AI processing states  
  DOCUMENT_AI_SUCCESS: "document_ai_success",
  DOCUMENT_AI_ERROR: "document_ai_error",
  
  // Validation states
  AWAITING_VALIDATION: "awaiting_validation", 
  VALIDATING: "validating",
  VALIDATED: "validated",
  VALIDATION_ERROR: "validation_error",
  
  // Business logic states
  READY_FOR_SUBMISSION: "ready_for_submission",
  NO_REFUNDABLE_ITEMS: "no_refundable_items",
  
  // Submission states
  SUBMITTING: "submitting", 
  SUBMITTED: "submitted",
  SUBMISSION_ERROR: "submission_error",
  
  // Address correction states
  ADDRESS_CORRECTION_REQUESTED: "address_correction_requested",
  ADDRESS_CORRECTED: "address_corrected",
  
  // Final states
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed",
  
  // Error states
  PROCESSING_ERROR: "processing_error",
  SYSTEM_ERROR: "system_error"
} as const;

// Type for DocumentStatus values
export type DocumentStatusType = (typeof DocumentStatus)[keyof typeof DocumentStatus];

/**
 * Status categories for UI grouping
 */
export const StatusCategory = {
  PROCESSING: "processing",
  VALIDATION: "validation", 
  SUBMISSION: "submission",
  CORRECTION: "correction",
  FINAL: "final",
  ERROR: "error"
} as const;

// Type for StatusCategory values
export type StatusCategoryType = (typeof StatusCategory)[keyof typeof StatusCategory];

/**
 * User-friendly status labels for UI display
 */
export const STATUS_LABELS: Record<DocumentStatusType, string> = {
  [DocumentStatus.UPLOADING]: "Uploading...",
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
  [DocumentStatus.SYSTEM_ERROR]: "System Error"
};

/**
 * Status descriptions for detailed UI display
 */
export const STATUS_DESCRIPTIONS: Record<DocumentStatusType, string> = {
  [DocumentStatus.UPLOADING]: "File is being uploaded to the server",
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
  [DocumentStatus.SYSTEM_ERROR]: "A system error occurred - contact support"
};

/**
 * Status icon mappings for UI
 */
export const STATUS_ICONS: Record<DocumentStatusType, string> = {
  [DocumentStatus.UPLOADING]: "⬆️",
  [DocumentStatus.UPLOADED]: "📄",
  [DocumentStatus.PROCESSING]: "⚡",
  [DocumentStatus.DOCUMENT_AI_SUCCESS]: "🤖",
  [DocumentStatus.DOCUMENT_AI_ERROR]: "❌",
  
  [DocumentStatus.AWAITING_VALIDATION]: "⏳",
  [DocumentStatus.VALIDATING]: "🔍",
  [DocumentStatus.VALIDATED]: "✅",
  [DocumentStatus.VALIDATION_ERROR]: "⚠️",
  
  [DocumentStatus.READY_FOR_SUBMISSION]: "📤",
  [DocumentStatus.NO_REFUNDABLE_ITEMS]: "🚫",
  [DocumentStatus.SUBMITTING]: "📡",
  [DocumentStatus.SUBMITTED]: "📨",
  [DocumentStatus.SUBMISSION_ERROR]: "❌",
  
  [DocumentStatus.ADDRESS_CORRECTION_REQUESTED]: "📍",
  [DocumentStatus.ADDRESS_CORRECTED]: "✅",
  
  [DocumentStatus.APPROVED]: "✅",
  [DocumentStatus.REJECTED]: "❌",
  [DocumentStatus.COMPLETED]: "🎉",
  
  [DocumentStatus.PROCESSING_ERROR]: "❌",
  [DocumentStatus.SYSTEM_ERROR]: "🚨"
};

/**
 * Status color mappings for UI
 */
export const STATUS_COLORS: Record<DocumentStatusType, string> = {
  [DocumentStatus.UPLOADING]: "#3b82f6",
  [DocumentStatus.UPLOADED]: "#6366f1",
  [DocumentStatus.PROCESSING]: "#f59e0b",
  [DocumentStatus.DOCUMENT_AI_SUCCESS]: "#10b981",
  [DocumentStatus.DOCUMENT_AI_ERROR]: "#ef4444",
  
  [DocumentStatus.AWAITING_VALIDATION]: "#6b7280",
  [DocumentStatus.VALIDATING]: "#f59e0b",
  [DocumentStatus.VALIDATED]: "#10b981",
  [DocumentStatus.VALIDATION_ERROR]: "#ef4444",
  
  [DocumentStatus.READY_FOR_SUBMISSION]: "#3b82f6",
  [DocumentStatus.NO_REFUNDABLE_ITEMS]: "#6b7280",
  [DocumentStatus.SUBMITTING]: "#f59e0b",
  [DocumentStatus.SUBMITTED]: "#8b5cf6",
  [DocumentStatus.SUBMISSION_ERROR]: "#ef4444",
  
  [DocumentStatus.ADDRESS_CORRECTION_REQUESTED]: "#f59e0b",
  [DocumentStatus.ADDRESS_CORRECTED]: "#10b981",
  
  [DocumentStatus.APPROVED]: "#10b981",
  [DocumentStatus.REJECTED]: "#ef4444",
  [DocumentStatus.COMPLETED]: "#10b981",
  
  [DocumentStatus.PROCESSING_ERROR]: "#ef4444",
  [DocumentStatus.SYSTEM_ERROR]: "#dc2626"
};

/**
 * Map status to category
 */
export const STATUS_CATEGORIES: Record<DocumentStatusType, StatusCategoryType> = {
  [DocumentStatus.UPLOADING]: StatusCategory.PROCESSING,
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
  [DocumentStatus.SYSTEM_ERROR]: StatusCategory.ERROR
};

/**
 * Utility functions for status management in React components
 */
export class DocumentStatusUtils {
  /**
   * Get user-friendly label for status
   */
  static getLabel(status: DocumentStatusType): string {
    return STATUS_LABELS[status] || status;
  }
  
  /**
   * Get detailed description for status
   */
  static getDescription(status: DocumentStatusType): string {
    return STATUS_DESCRIPTIONS[status] || "";
  }
  
  /**
   * Get status icon
   */
  static getIcon(status: DocumentStatusType): string {
    return STATUS_ICONS[status] || "📄";
  }
  
  /**
   * Get status color
   */
  static getColor(status: DocumentStatusType): string {
    return STATUS_COLORS[status] || "#6b7280";
  }
  
  /**
   * Get status category
   */
  static getCategory(status: DocumentStatusType): StatusCategoryType {
    return STATUS_CATEGORIES[status];
  }
  
  /**
   * Check if a status is an error state
   */
  static isErrorStatus(status: DocumentStatusType): boolean {
    return STATUS_CATEGORIES[status] === StatusCategory.ERROR;
  }
  
  /**
   * Check if a status indicates processing is in progress
   */
  static isProcessingStatus(status: DocumentStatusType): boolean {
    const processingStatuses: DocumentStatusType[] = [
      DocumentStatus.PROCESSING,
      DocumentStatus.VALIDATING,
      DocumentStatus.SUBMITTING
    ];
    return processingStatuses.includes(status);
  }
  
  /**
   * Check if a status is a final state
   */
  static isFinalStatus(status: DocumentStatusType): boolean {
    return STATUS_CATEGORIES[status] === StatusCategory.FINAL;
  }
}
