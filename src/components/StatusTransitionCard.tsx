import React, { useState, useCallback, useEffect } from 'react';

/**
 * Document Status Types (Frontend Mirror)
 * P2-Priority: Type-safe status transitions
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

interface StatusTransitionCardProps {
  documentId: string;
  currentStatus: DocumentStatus;
  onStatusUpdate?: (newStatus: DocumentStatus) => void;
}

/**
 * React component for secure status transitions
 * P2-Priority: Frontend status transition guards
 */
export const StatusTransitionCard: React.FC<StatusTransitionCardProps> = ({
  documentId,
  currentStatus,
  onStatusUpdate
}) => {
  const [allowedTransitions, setAllowedTransitions] = useState<DocumentStatus[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load allowed transitions
  const loadTransitions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/transitions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'X-Tenant-ID': localStorage.getItem('tenantId') || ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllowedTransitions(data.allowedTransitions);
      } else {
        setError('Failed to load allowed transitions');
      }
    } catch (err) {
      setError('Network error loading transitions');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Validate transition
  const validateTransition = useCallback(async (newStatus: DocumentStatus) => {
    if (!newStatus) return;

    try {
      const response = await fetch('/api/documents/validate-transition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'X-Tenant-ID': localStorage.getItem('tenantId') || ''
        },
        body: JSON.stringify({
          documentId,
          newStatus,
          reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        setValidationResult(result);
      }
    } catch (err) {
      console.error('Validation error:', err);
    }
  }, [documentId, reason]);

  // Execute transition
  const executeTransition = useCallback(async () => {
    if (!selectedStatus) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/documents/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'X-Tenant-ID': localStorage.getItem('tenantId') || ''
        },
        body: JSON.stringify({
          documentId,
          newStatus: selectedStatus,
          reason
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onStatusUpdate?.(selectedStatus);
          setSelectedStatus(null);
          setReason('');
          setValidationResult(null);
          await loadTransitions();
        } else {
          setError(result.error || 'Failed to update status');
        }
      } else {
        setError('Failed to update status');
      }
    } catch (err) {
      setError('Network error updating status');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, documentId, reason, onStatusUpdate, loadTransitions]);

  // Load transitions on mount
  useEffect(() => {
    loadTransitions();
  }, [loadTransitions]);

  // Validate when selection changes
  useEffect(() => {
    if (selectedStatus) {
      validateTransition(selectedStatus);
    } else {
      setValidationResult(null);
    }
  }, [selectedStatus, validateTransition]);

  const getStatusColor = (status: DocumentStatus): string => {
    if (status.includes('error')) return 'text-red-600';
    if (status.includes('processing') || status.includes('validating') || status.includes('submitting')) {
      return 'text-blue-600';
    }
    if (status === DocumentStatus.COMPLETED || status === DocumentStatus.APPROVED) {
      return 'text-green-600';
    }
    if (status === DocumentStatus.REJECTED) return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusLabel = (status: DocumentStatus): string => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading && allowedTransitions.length === 0) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse">Loading transitions...</div>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg bg-white shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Status Transitions</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Current Status:</span>
          <span className={`font-medium ${getStatusColor(currentStatus)}`}>
            {getStatusLabel(currentStatus)}
          </span>
        </div>
      </div>

      {allowedTransitions.length === 0 ? (
        <div className="text-sm text-gray-500 italic">
          No status transitions available for current state.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select New Status
            </label>
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value as DocumentStatus)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a status...</option>
              {allowedTransitions.map(status => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Input */}
          {selectedStatus && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Transition
                {validationResult?.requiredFields?.includes('reason') && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for status change..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className="space-y-2">
              {!validationResult.isValid && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <div className="text-red-600 text-sm">
                      ⚠️ {validationResult.errorMessage}
                    </div>
                  </div>
                  {validationResult.requiredFields?.length > 0 && (
                    <div className="mt-2 text-sm text-red-600">
                      Required fields: {validationResult.requiredFields.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {validationResult.warnings?.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  {validationResult.warnings.map((warning: string, index: number) => (
                    <div key={index} className="text-yellow-700 text-sm">
                      ⚠️ {warning}
                    </div>
                  ))}
                </div>
              )}

              {validationResult.isValid && !validationResult.warnings?.length && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-green-700 text-sm">
                    ✅ Transition is valid and can be executed
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-600 text-sm">
                ❌ {error}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={executeTransition}
              disabled={!selectedStatus || !validationResult?.isValid || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
            <button
              onClick={() => {
                setSelectedStatus(null);
                setReason('');
                setValidationResult(null);
                setError(null);
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
