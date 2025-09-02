import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useDocuments, useSubmissions, useDashboardMetrics } from '../hooks/useFirestore';
import { DocumentStatus } from '../types/DocumentStatus';
import { 
  LogOut, 
  FileText, 
  Clock, 
  CheckCircle, 
  Euro, 
  Download,
  RefreshCw
} from 'lucide-react';
import DocumentList from '../components/DocumentList';
import SubmissionGenerator from '../components/SubmissionGenerator';
import InvoiceUploader from '../components/InvoiceUploader';
import FirstUploadWizard from '../components/FirstUploadWizard';
import './Dashboard.css';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { documents, loading: documentsLoading } = useDocuments();
  const { submissions, loading: submissionsLoading } = useSubmissions();
  const metrics = useDashboardMetrics();
  const [activeTab, setActiveTab] = useState<'documents' | 'submissions'>('documents');
  const [showFirstUploadWizard, setShowFirstUploadWizard] = useState(false);

  // Check if user is new (no documents and no dismissed wizard)
  const isNewUser = !documentsLoading && documents.length === 0 && 
    !localStorage.getItem(`wizard-dismissed-${user?.uid}`);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleWizardClose = () => {
    setShowFirstUploadWizard(false);
    if (user?.uid) {
      localStorage.setItem(`wizard-dismissed-${user.uid}`, 'true');
    }
  };

  const handleSampleDataLoad = () => {
    // Force refresh of documents
    window.location.reload();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case DocumentStatus.READY_FOR_SUBMISSION:
        return 'success';
      case DocumentStatus.AWAITING_VALIDATION:
      case DocumentStatus.UPLOADING:
        return 'warning';
      case DocumentStatus.VALIDATION_ERROR:
        return 'error';
      case DocumentStatus.SUBMITTING:
      case DocumentStatus.SUBMITTED:
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>VAT Refund Dashboard</h1>
            <p>Welcome back, {user?.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="logout-button"
            title="Sign out"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Key Metrics */}
        <section className="metrics-section">
          <h2>Overview</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon">
                <FileText size={24} />
              </div>
              <div className="metric-content">
                <h3>Total Documents</h3>
                <p className="metric-value">{metrics.totalDocuments}</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon warning">
                <Clock size={24} />
              </div>
              <div className="metric-content">
                <h3>Awaiting Validation</h3>
                <p className="metric-value">{metrics.documentsAwaitingValidation}</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon success">
                <CheckCircle size={24} />
              </div>
              <div className="metric-content">
                <h3>Ready for Submission</h3>
                <p className="metric-value">{metrics.documentsReadyForSubmission}</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon euro">
                <Euro size={24} />
              </div>
              <div className="metric-content">
                <h3>Expected Refund</h3>
                <p className="metric-value">{formatCurrency(metrics.totalExpectedRefund)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="content-section">
          <div className="tabs">
            <button
              className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveTab('documents')}
            >
              Documents
              {documentsLoading && <RefreshCw className="loading-icon" size={16} />}
            </button>
            <button
              className={`tab-button ${activeTab === 'submissions' ? 'active' : ''}`}
              onClick={() => setActiveTab('submissions')}
            >
              Submissions
              {submissionsLoading && <RefreshCw className="loading-icon" size={16} />}
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'documents' && (
              <div className="documents-tab">
                <div className="section-header">
                  <h3>Your Documents</h3>
                  <p>Track the status of your uploaded invoices and receipts</p>
                </div>
                
                {/* Invoice Upload Section */}
                <InvoiceUploader />
                
                {documentsLoading ? (
                  <div className="loading-state">
                    <RefreshCw className="loading-icon" size={24} />
                    <p>Loading documents...</p>
                  </div>
                ) : documents.length === 0 ? (
                  isNewUser ? (
                    <FirstUploadWizard 
                      onClose={handleWizardClose}
                      onSampleDataLoad={handleSampleDataLoad}
                    />
                  ) : (
                    <div className="empty-state">
                      <FileText size={48} />
                      <h3>No documents yet</h3>
                      <p>Upload your first invoice or receipt to get started</p>
                      <button 
                        className="primary-button"
                        onClick={() => setShowFirstUploadWizard(true)}
                        style={{ marginTop: '1rem' }}
                      >
                        Show Getting Started Guide
                      </button>
                    </div>
                  )
                ) : (
                  <DocumentList documents={documents} />
                )}

                {/* Show wizard overlay if triggered manually */}
                {showFirstUploadWizard && (
                  <FirstUploadWizard 
                    onClose={handleWizardClose}
                    onSampleDataLoad={handleSampleDataLoad}
                  />
                )}
              </div>
            )}

            {activeTab === 'submissions' && (
              <div className="submissions-tab">
                <div className="section-header">
                  <h3>VAT Submissions</h3>
                  <p>Generate and manage your VAT refund submissions</p>
                </div>

                {/* Submission Generator */}
                <SubmissionGenerator 
                  documentsReadyCount={metrics.documentsReadyForSubmission}
                  expectedRefund={metrics.totalExpectedRefund}
                />

                {/* Previous Submissions */}
                <div className="submissions-list">
                  <h4>Previous Submissions</h4>
                  {submissionsLoading ? (
                    <div className="loading-state">
                      <RefreshCw className="loading-icon" size={24} />
                      <p>Loading submissions...</p>
                    </div>
                  ) : submissions.length === 0 ? (
                    <div className="empty-state">
                      <Download size={48} />
                      <h3>No submissions yet</h3>
                      <p>Generate your first VAT submission above</p>
                    </div>
                  ) : (
                    <div className="submissions-grid">
                      {submissions.map((submission) => (
                        <div key={submission.id} className="submission-card">
                          <div className="submission-header">
                            <h5>{submission.period} - {submission.country}</h5>
                            <span className={`status-badge ${getStatusColor(submission.status)}`}>
                              {submission.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="submission-details">
                            <p><strong>Refund Amount:</strong> {formatCurrency(submission.totalRefundAmount)}</p>
                            <p><strong>Documents:</strong> {submission.documentCount}</p>
                            <p><strong>Created:</strong> {submission.createdAt.toDate().toLocaleDateString()}</p>
                          </div>
                          <div className="submission-actions">
                            <button className="secondary-button">
                              <Download size={16} />
                              Download XML
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
