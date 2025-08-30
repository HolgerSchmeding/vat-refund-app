import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import type { GenerateSubmissionXmlResponse } from '../types';
import { 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Loader,
  Euro,
  Calendar
} from 'lucide-react';
import './SubmissionGenerator.css';

interface SubmissionGeneratorProps {
  documentsReadyCount: number;
  expectedRefund: number;
}

function SubmissionGenerator({ 
  documentsReadyCount, 
  expectedRefund 
}: SubmissionGeneratorProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('Q4/2025');
  const [selectedCountry, setSelectedCountry] = useState('DE');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateSubmissionXmlResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const generatePeriodOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];
    
    // Generate options for current year and next year
    for (let year = currentYear; year <= currentYear + 1; year++) {
      for (let quarter = 1; quarter <= 4; quarter++) {
        options.push(`Q${quarter}/${year}`);
      }
    }
    
    return options;
  };

  const handleGenerateSubmission = async () => {
    if (documentsReadyCount === 0) {
      setError('No documents ready for submission. Please ensure you have processed documents first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const generateXml = httpsCallable(functions, 'generateSubmissionXml');
      const response = await generateXml({
        submissionPeriod: selectedPeriod,
        countryCode: selectedCountry,
        // tenantId will be automatically determined from the user's context
      });

      const data = response.data as GenerateSubmissionXmlResponse;
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Unknown error occurred while generating submission');
      }
    } catch (err: any) {
      console.error('Error generating submission:', err);
      setError(err.message || 'Failed to generate submission. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadXML = () => {
    if (result?.xmlStoragePath) {
      // In a real implementation, you would generate a download URL from Firebase Storage
      console.log('Downloading XML from:', result.xmlStoragePath);
      alert('XML download functionality would be implemented here using Firebase Storage URLs');
    }
  };

  return (
    <div className="submission-generator">
      <div className="generator-card">
        <div className="card-header">
          <div className="header-icon">
            <FileText size={24} />
          </div>
          <div className="header-content">
            <h3>Generate VAT Submission</h3>
            <p>Create XML file for German tax authorities</p>
          </div>
        </div>

        {/* Status Summary */}
        <div className="status-summary">
          <div className="summary-item">
            <div className="summary-icon">
              <FileText size={20} />
            </div>
            <div className="summary-content">
              <span className="summary-label">Ready Documents</span>
              <span className="summary-value">{documentsReadyCount}</span>
            </div>
          </div>
          
          <div className="summary-item">
            <div className="summary-icon">
              <Euro size={20} />
            </div>
            <div className="summary-content">
              <span className="summary-label">Expected Refund</span>
              <span className="summary-value">{formatCurrency(expectedRefund)}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="generator-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="period">
                <Calendar size={16} />
                Submission Period
              </label>
              <select
                id="period"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                disabled={isGenerating}
              >
                {generatePeriodOptions().map(period => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="country">Country</label>
              <select
                id="country"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                disabled={isGenerating}
              >
                <option value="DE">Germany (DE)</option>
                {/* Add more countries as they become supported */}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateSubmission}
            disabled={isGenerating || documentsReadyCount === 0}
            className="generate-button"
          >
            {isGenerating ? (
              <>
                <Loader className="button-icon spinning" size={20} />
                Generating XML...
              </>
            ) : (
              <>
                <Download size={20} />
                Generate {selectedPeriod} Submission
              </>
            )}
          </button>

          {documentsReadyCount === 0 && (
            <p className="warning-text">
              <AlertCircle size={16} />
              No documents are ready for submission yet. Upload and validate documents first.
            </p>
          )}
        </div>

        {/* Results */}
        {error && (
          <div className="result-message error">
            <AlertCircle size={20} />
            <div>
              <h4>Generation Failed</h4>
              <p>{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="result-message success">
            <CheckCircle size={20} />
            <div className="result-content">
              <h4>Submission Generated Successfully!</h4>
              <div className="result-details">
                <p><strong>Submission ID:</strong> {result.submissionId}</p>
                <p><strong>Documents Processed:</strong> {result.documentCount}</p>
                <p><strong>Total Refund Amount:</strong> {formatCurrency(result.totalRefundAmount || 0)}</p>
              </div>
              <button 
                onClick={handleDownloadXML}
                className="download-button"
              >
                <Download size={16} />
                Download XML File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubmissionGenerator;
