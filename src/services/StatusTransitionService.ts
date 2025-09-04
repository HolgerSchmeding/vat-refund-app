import { useState, useCallback, useEffect } from 'react';

/**
 * Frontend interface for Status Transition Guards
 * P2-Priority: Client-side status validation
 */

export enum DocumentStatus {
  // Processing states
  UPLOADED = "uploaded",
  PROCESSING = "processing", 
  DOCUMENT_AI_SUCCESS = "document_ai_success",
  DOCUMENT_AI_ERROR = "document_ai_error",
  
  // Validation states
  AWAITING_VALIDATION = "awaiting_validation",
  VALIDATING = "validating",
  VALIDATED = "validated", 
  VALIDATION_ERROR = "validation_error",
  
  // Submission states
  READY_FOR_SUBMISSION = "ready_for_submission",
  NO_REFUNDABLE_ITEMS = "no_refundable_items",
  SUBMITTING = "submitting",
  SUBMITTED = "submitted",
  SUBMISSION_ERROR = "submission_error",
  
  // Correction states
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

export interface TransitionValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
  requiredFields?: string[];
}

export interface AllowedTransitionsResponse {
  currentStatus: DocumentStatus;
  allowedTransitions: DocumentStatus[];
}

export interface UpdateStatusRequest {
  documentId: string;
  newStatus: DocumentStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface UpdateStatusResponse {
  success: boolean;
  oldStatus?: DocumentStatus;
  newStatus?: DocumentStatus;
  warnings?: string[];
  error?: string;
}

/**
 * Client-side status transition service
 */
export class StatusTransitionService {
  private static baseUrl = '/api';

  /**
   * Get allowed transitions for a document
   */
  static async getAllowedTransitions(documentId: string): Promise<AllowedTransitionsResponse> {
    const response = await fetch(`${this.baseUrl}/documents/${documentId}/transitions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'X-Tenant-ID': this.getTenantId()
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get transitions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Validate a transition without executing it
   */
  static async validateTransition(
    documentId: string,
    newStatus: DocumentStatus,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<TransitionValidationResult> {
    const response = await fetch(`${this.baseUrl}/documents/validate-transition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'X-Tenant-ID': this.getTenantId()
      },
      body: JSON.stringify({
        documentId,
        newStatus,
        reason,
        metadata
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to validate transition: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute a status transition
   */
  static async updateStatus(
    documentId: string,
    newStatus: DocumentStatus,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<UpdateStatusResponse> {
    const response = await fetch(`${this.baseUrl}/documents/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'X-Tenant-ID': this.getTenantId()
      },
      body: JSON.stringify({
        documentId,
        newStatus,
        reason,
        metadata
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get Firebase auth token
   */
  private static async getAuthToken(): Promise<string> {
    // This would integrate with your Firebase auth
    const user = (window as any).firebase?.auth()?.currentUser;
    return user ? await user.getIdToken() : '';
  }

  /**
   * Get current tenant ID from context
   */
  private static getTenantId(): string {
    // This would get tenant ID from your app state/context
    return (window as any).currentTenantId || '';
  }
}

/**
 * React hook for status transitions
 */
export function useStatusTransitions(documentId: string) {
  const [allowedTransitions, setAllowedTransitions] = useState<DocumentStatus[]>([]);
  const [currentStatus, setCurrentStatus] = useState<DocumentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransitions = useCallback(async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await StatusTransitionService.getAllowedTransitions(documentId);
      setCurrentStatus(result.currentStatus);
      setAllowedTransitions(result.allowedTransitions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transitions');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  const validateTransition = useCallback(async (
    newStatus: DocumentStatus,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<TransitionValidationResult> => {
    return StatusTransitionService.validateTransition(documentId, newStatus, reason, metadata);
  }, [documentId]);

  const updateStatus = useCallback(async (
    newStatus: DocumentStatus,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<UpdateStatusResponse> => {
    const result = await StatusTransitionService.updateStatus(documentId, newStatus, reason, metadata);
    
    // Reload transitions after successful update
    if (result.success) {
      await loadTransitions();
    }
    
    return result;
  }, [documentId, loadTransitions]);

  useEffect(() => {
    loadTransitions();
  }, [loadTransitions]);

  return {
    currentStatus,
    allowedTransitions,
    loading,
    error,
    validateTransition,
    updateStatus,
    refreshTransitions: loadTransitions
  };
}
