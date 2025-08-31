import { Timestamp } from 'firebase/firestore';
import type { DocumentStatusType } from './DocumentStatus';

/**
 * Address interface
 */
export interface Address {
  street: string;
  city: string;
  zipCode: string;
  country: string;
}

/**
 * Error details interface
 */
export interface ErrorDetails {
  code: number;
  message: string;
}

/**
 * Line Item from invoices/receipts
 */
export interface LineItem {
  originalText: string;
  description: string;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  isRefundable: boolean | null;
  refundableVatAmount: number | null;
  euSubCode: string | null;
  validationNotes: string | null;
}

/**
 * Document status type
 */
export type DocumentStatus = DocumentStatusType;

/**
 * Document representing a receipt/invoice
 */
export interface Document {
  id: string; // Firestore document ID
  tenantId: string;
  uploadedBy: string;
  status: DocumentStatus;
  originalFileName: string;
  storagePath: string;
  country?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  errorDetails?: ErrorDetails;
  extractedData: Record<string, unknown>;
  lineItems?: LineItem[];
  totalRefundableVatAmount?: number;
  validationCompletedAt?: Timestamp;
  validatedData?: Record<string, unknown>;
  submissionId?: string;
  validationError?: string;
}

/**
 * Submission status type
 */
export type SubmissionStatus = 
  | "generated" 
  | "submitted_to_authority" 
  | "accepted" 
  | "rejected" 
  | "refunded";

/**
 * Submission representing a VAT refund application
 */
export interface Submission {
  id: string; // Firestore document ID
  tenantId: string;
  country: string;
  period: string;
  status: SubmissionStatus;
  totalRefundAmount: number;
  xmlStoragePath: string;
  documentCount: number;
  documentIds?: string[];
  createdAt: Timestamp;
}

/**
 * User interface
 */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  firstName: string;
  lastName: string;
}

/**
 * Dashboard metrics interface
 */
export interface DashboardMetrics {
  totalDocuments: number;
  documentsAwaitingValidation: number;
  documentsReadyForSubmission: number;
  totalExpectedRefund: number;
  totalSubmissions: number;
}

/**
 * Generation submission XML parameters
 */
export interface GenerateSubmissionXmlParams {
  submissionPeriod: string;
  countryCode: string;
  tenantId?: string;
}

/**
 * Generate submission XML response
 */
export interface GenerateSubmissionXmlResponse {
  success: boolean;
  xmlStoragePath?: string;
  submissionId?: string;
  totalRefundAmount?: number;
  documentCount?: number;
  error?: string;
}
