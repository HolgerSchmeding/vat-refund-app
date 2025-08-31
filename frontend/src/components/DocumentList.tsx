import type { Document } from '../types';
import { DocumentStatus } from '../types/DocumentStatus';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader,
  Mail
} from 'lucide-react';
import './DocumentList.css';

interface DocumentListProps {
  documents: Document[];
}

function DocumentList({ documents }: DocumentListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (timestamp: any) => {
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('de-DE');
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case DocumentStatus.UPLOADING:
        return <Loader className="status-icon uploading" size={16} />;
      case DocumentStatus.AWAITING_VALIDATION:
        return <Clock className="status-icon pending" size={16} />;
      case DocumentStatus.VALIDATION_ERROR:
        return <XCircle className="status-icon error" size={16} />;
      case DocumentStatus.READY_FOR_SUBMISSION:
        return <CheckCircle className="status-icon success" size={16} />;
      case DocumentStatus.SUBMITTING:
        return <AlertTriangle className="status-icon warning" size={16} />;
      case DocumentStatus.SUBMITTED:
        return <CheckCircle className="status-icon submitted" size={16} />;
      case DocumentStatus.ADDRESS_CORRECTION_REQUESTED:
        return <Mail className="status-icon correction" size={16} />;
      default:
        return <FileText className="status-icon" size={16} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case DocumentStatus.UPLOADING:
        return 'Uploading';
      case DocumentStatus.AWAITING_VALIDATION:
        return 'Pending Validation';
      case DocumentStatus.VALIDATION_ERROR:
        return 'Validation Error';
      case DocumentStatus.READY_FOR_SUBMISSION:
        return 'Ready for Submission';
      case DocumentStatus.SUBMITTING:
        return 'In Submission';
      case DocumentStatus.SUBMITTED:
        return 'Submitted';
      case DocumentStatus.ADDRESS_CORRECTION_REQUESTED:
        return 'Correction Requested';
      default:
        return status;
    }
  };

  const getVendorName = (extractedData: Record<string, unknown> | undefined | null) => {
    if (!extractedData) return 'Unknown Vendor';
    // Try to extract vendor name from various possible fields
    return (extractedData.vendorName || 
            extractedData.supplierName || 
            extractedData.merchantName || 
            'Unknown Vendor') as string;
  };

  const getTotalAmount = (extractedData: Record<string, unknown> | undefined | null) => {
    if (!extractedData) return 0;
    const raw = extractedData.totalAmount as any;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/[€$£\s]/g, '').replace(/\./g, '').replace(/,/g, '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  return (
    <div className="document-list">
      <div className="document-table">
        <div className="table-header">
          <div className="col-filename">Document</div>
          <div className="col-vendor">Vendor</div>
          <div className="col-date">Date</div>
          <div className="col-amount">Total Amount</div>
          <div className="col-refund">Refundable VAT</div>
          <div className="col-status">Status</div>
        </div>
        
        <div className="table-body">
          {documents.map((document) => {
            // Defensive defaults
            const extracted = (document as any).extractedData || (document as any).extracted_data || null;
            const createdAt = (document as any).createdAt;
            return (
            <div key={document.id} className="table-row">
              <div className="col-filename">
                <div className="filename-cell">
                  <FileText size={16} className="file-icon" />
                  <span className="filename" title={document.originalFileName}>
                    {document.originalFileName}
                  </span>
                </div>
              </div>
              
              <div className="col-vendor">
                <span className="vendor-name">
                  {getVendorName(extracted)}
                </span>
              </div>
              
              <div className="col-date">
                <span className="date">
                  {formatDate(createdAt)}
                </span>
              </div>
              
              <div className="col-amount">
                <span className="amount">
                  {formatCurrency(getTotalAmount(extracted))}
                </span>
              </div>
              
              <div className="col-refund">
                <span className={`refund-amount ${document.totalRefundableVatAmount ? 'has-refund' : 'no-refund'}`}>
                  {document.totalRefundableVatAmount 
                    ? formatCurrency(document.totalRefundableVatAmount)
                    : '—'
                  }
                </span>
              </div>
              
              <div className="col-status">
                <div className="status-cell">
                  {getStatusIcon(document.status)}
                  <span className="status-text">
                    {getStatusText(document.status)}
                  </span>
                </div>
                {document.validationError && (
                  <div className="error-message" title={document.validationError}>
                    <XCircle size={12} />
                    <span>Error</span>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DocumentList;
