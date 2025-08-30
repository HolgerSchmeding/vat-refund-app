import type { Document } from '../types';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader
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
      case 'uploading':
        return <Loader className="status-icon uploading" size={16} />;
      case 'pending_validation':
        return <Clock className="status-icon pending" size={16} />;
      case 'validation_error':
        return <XCircle className="status-icon error" size={16} />;
      case 'ready_for_submission':
        return <CheckCircle className="status-icon success" size={16} />;
      case 'in_submission':
        return <AlertTriangle className="status-icon warning" size={16} />;
      case 'submitted':
        return <CheckCircle className="status-icon submitted" size={16} />;
      default:
        return <FileText className="status-icon" size={16} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'Uploading';
      case 'pending_validation':
        return 'Pending Validation';
      case 'validation_error':
        return 'Validation Error';
      case 'ready_for_submission':
        return 'Ready for Submission';
      case 'in_submission':
        return 'In Submission';
      case 'submitted':
        return 'Submitted';
      default:
        return status;
    }
  };

  const getVendorName = (extractedData: Record<string, unknown>) => {
    // Try to extract vendor name from various possible fields
    return (extractedData.vendorName || 
            extractedData.supplierName || 
            extractedData.merchantName || 
            'Unknown Vendor') as string;
  };

  const getTotalAmount = (extractedData: Record<string, unknown>) => {
    return (extractedData.totalAmount || 0) as number;
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
          {documents.map((document) => (
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
                  {getVendorName(document.extractedData)}
                </span>
              </div>
              
              <div className="col-date">
                <span className="date">
                  {formatDate(document.createdAt)}
                </span>
              </div>
              
              <div className="col-amount">
                <span className="amount">
                  {formatCurrency(getTotalAmount(document.extractedData))}
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
          ))}
        </div>
      </div>
    </div>
  );
}

export default DocumentList;
