import {Timestamp} from "firebase-admin/firestore";

/**
 * Address interface used in Tenant
 */
export interface Address {
  street: string;
  city: string;
  zipCode: string;
  country: string;
}

/**
 * Error details interface used in Document
 */
export interface ErrorDetails {
  code: number;
  message: string;
}

/**
 * Line Item - Individual items from invoices/receipts
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
 * Tenant (Mandant) - Information about our customers
 */
export interface Tenant {
  companyName: string;
  vatId: string;
  address: Address;
  subscriptionStatus: "active" | "trial" | "inactive";
  createdAt: Timestamp;
}

/**
 * User - Individual users of the tenants
 */
export interface User {
  tenantId: string; // foreign key to tenants
  email: string;
  role: "admin" | "editor" | "viewer";
  firstName: string;
  lastName: string;
}

/**
 * Document (Beleg) - Core object representing a receipt
 */
export interface Document {
  tenantId: string;
  uploadedBy: string; // foreign key to users
  status: "uploading" | "pending_validation" | "validation_error" |
    "ready_for_submission" | "in_submission" | "submitted" | "in_correction_address";
  originalFileName: string;
  storagePath: string;
  country?: string; // Country code where the expense occurred (e.g., "DE")
  createdAt: Timestamp;
  updatedAt: Timestamp;
  errorDetails?: ErrorDetails; // optional
  extractedData: Record<string, unknown>;
  lineItems?: LineItem[]; // array of line items
  totalRefundableVatAmount?: number; // calculated after validation
  validationCompletedAt?: Timestamp; // when validation was completed
  validatedData?: Record<string, unknown>; // optional
  submissionId?: string; // foreign key to submissions, optional
  validationError?: string; // Error message if validation failed
}

/**
 * ValidationRule - Business logic per country
 */
export interface ValidationRule {
  countryName: string;
  requiredFields: string[]; // array of field names
  excludedExpenseCodes: string[];
  expenseCodeMapping: Record<string, string>;
}

/**
 * Submission (Antrag) - Represents a collected application
 */
export interface Submission {
  tenantId: string;
  country: string; // e.g., "DE"
  period: string; // e.g., "Q3/2025"
  status: "generated" | "submitted_to_authority" | "accepted" |
    "rejected" | "refunded";
  totalRefundAmount: number;
  xmlStoragePath: string;
  documentCount: number;
  documentIds?: string[]; // Array of document IDs included in this submission
  createdAt: Timestamp;
}

/**
 * Parameters for generateSubmissionXml function
 */
export interface GenerateSubmissionXmlParams {
  submissionPeriod: string; // e.g., "Q4/2025"
  countryCode: string; // e.g., "DE"
  tenantId?: string; // Optional tenant ID for multi-tenant support
}

/**
 * Response from generateSubmissionXml function
 */
export interface GenerateSubmissionXmlResponse {
  success: boolean;
  xmlStoragePath?: string;
  submissionId?: string;
  totalRefundAmount?: number;
  documentCount?: number;
  error?: string;
}

/**
 * Aggregated data by EU sub-code for XML generation
 */
export interface EuSubCodeAggregate {
  subCode: string;
  totalNetAmount: number;
  totalVatAmount: number;
  totalRefundableVatAmount: number;
  documentCount: number;
}
