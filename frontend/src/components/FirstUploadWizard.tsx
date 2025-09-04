import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  ArrowRight, 
  Sparkles,
  Eye,
  Zap,
  Shield,
  X
} from 'lucide-react';
// Firestore imports only retained if fallback client insert is needed
// (currently we avoid direct writes because security rules block non 'uploaded' status on create)
import { getAuth } from 'firebase/auth';
import InvoiceUploader from './InvoiceUploader';
import './FirstUploadWizard.css';

interface FirstUploadWizardProps {
  onClose: () => void;
  onSampleDataLoad: () => void;
}

type WizardStep = 'welcome' | 'upload' | 'processing' | 'success';

const FirstUploadWizard: React.FC<FirstUploadWizardProps> = ({ 
  onClose, 
  onSampleDataLoad 
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [processingAnimation, setProcessingAnimation] = useState(0);
  const [isLoadingSampleData, setIsLoadingSampleData] = useState(false);
  // Fallback falls parent state nicht korrekt aktualisiert -> interne Sichtbarkeit steuern
  const [visible, setVisible] = useState(true);

  // Animation for processing step
  useEffect(() => {
    if (currentStep === 'processing') {
      const interval = setInterval(() => {
        setProcessingAnimation(prev => (prev + 1) % 3);
      }, 800);
      
      // Simulate processing time and move to success
      const timeout = setTimeout(() => {
        setCurrentStep('success');
      }, 4000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [currentStep]);

  const handleStartUpload = () => {
    setCurrentStep('upload');
  };

  const handleUploadComplete = () => {
    setCurrentStep('processing');
  };

  const safeClose = () => {
    try {
      onClose?.();
    } catch (e) {
      console.warn('[Wizard] onClose threw error:', e);
    }
    setVisible(false);
  };

  const handleFinish = () => {
    // Kein Hard-Reload mehr – Dashboard Listener sollten aktualisieren
    safeClose();
  };

  const handleLoadSampleData = async () => {
    if (isLoadingSampleData) return;
    setIsLoadingSampleData(true);
    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        console.log('[SampleData] Kein User – normale Anmeldung erforderlich');
        alert('Bitte melden Sie sich zuerst an, um Beispieldaten zu laden.');
        setIsLoadingSampleData(false);
        return;
      }

      console.log('[SampleData] Erstelle lokale Beispieldaten für User:', auth.currentUser.uid);
      console.log('[SampleData] User ist anonym:', auth.currentUser.isAnonymous);
      
      // Create sample documents directly in Firestore
      const sampleDocuments = [
        {
          originalFileName: "hotel-booking-berlin.pdf",
          status: "READY_FOR_SUBMISSION",
          extractedData: {
            supplierName: "Hotel Adlon Kempinski Berlin",
            invoiceDate: "2024-08-15",
            totalAmount: 189.00,
            currency: "EUR",
            vatRate: 19,
            vatAmount: 30.21
          },
          totalRefundableVatAmount: 30.21,
          isSampleData: true,
          createdAt: new Date(),
          userId: auth.currentUser.uid
        },
        {
          originalFileName: "conference-registration.pdf", 
          status: "AWAITING_VALIDATION",
          extractedData: {
            supplierName: "TechConf Europe GmbH",
            invoiceDate: "2024-08-20",
            totalAmount: 595.00,
            currency: "EUR",
            vatRate: 19,
            vatAmount: 95.13
          },
          totalRefundableVatAmount: 95.13,
          isSampleData: true,
          createdAt: new Date(),
          userId: auth.currentUser.uid
        }
      ];

      // Add documents to Firestore
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      console.log('[SampleData] Beginne mit dem Erstellen der Dokumente...');
      
      for (const [index, doc] of sampleDocuments.entries()) {
        try {
          console.log(`[SampleData] Erstelle Dokument ${index + 1}:`, doc.originalFileName);
          const docRef = await addDoc(collection(db, 'documents'), doc);
          console.log(`[SampleData] Dokument ${index + 1} erstellt mit ID:`, docRef.id);
        } catch (docError) {
          console.error(`[SampleData] Fehler bei Dokument ${index + 1}:`, docError);
          throw docError;
        }
      }
      
      console.log('[SampleData] Alle Beispieldaten erfolgreich erstellt!');
      alert('Beispieldaten erfolgreich geladen! Das Dashboard wird in 2 Sekunden aktualisiert.');
      
      // Kurz warten und dann Dashboard aktualisieren
      setTimeout(() => {
        onSampleDataLoad();
        onClose();
      }, 2000);
      
    } catch (e: any) {
      console.error('Fehler beim Laden der Beispieldaten:', e);
      alert('Fehler beim Laden der Beispieldaten: ' + (e?.message || e));
    } finally {
      setIsLoadingSampleData(false);
    }
  };

  const getProcessingSteps = () => [
    { 
      id: 'receive', 
      label: 'Empfangen', 
      icon: <Upload size={16} />,
      active: processingAnimation >= 0 
    },
    { 
      id: 'analyze', 
      label: 'KI analysiert', 
      icon: <Zap size={16} />,
      active: processingAnimation >= 1 
    },
    { 
      id: 'verify', 
      label: 'Geprüft', 
      icon: <Shield size={16} />,
      active: processingAnimation >= 2 
    }
  ];

  if (!visible) return null;

  return (
    <div className="first-upload-wizard-overlay" onClick={safeClose}>
      <div className="first-upload-wizard" onClick={(e) => e.stopPropagation()}>
        <button 
          className="wizard-close-button"
      onClick={safeClose}
          aria-label="Close wizard"
        >
          <X size={20} />
        </button>
        {/* Welcome Step */}
        {currentStep === 'welcome' && (
          <div className="wizard-step welcome-step">
            <div className="wizard-header">
              <div className="welcome-icon">
                <Sparkles size={48} />
              </div>
              <h2>Willkommen bei VAT Refund!</h2>
              <p className="welcome-subtitle">
                Holen Sie sich Ihre Mehrwertsteuer zurück – einfach, sicher und automatisiert.
              </p>
            </div>

            <div className="wizard-content">
              <div className="feature-highlights">
                <div className="feature-item">
                  <div className="feature-icon">
                    <FileText size={24} />
                  </div>
                  <div className="feature-text">
                    <h4>Dokumente hochladen</h4>
                    <p>PDF, JPG oder PNG Rechnungen einfach per Drag & Drop</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <Zap size={24} />
                  </div>
                  <div className="feature-text">
                    <h4>KI-gestützte Analyse</h4>
                    <p>Automatische Extraktion aller relevanten VAT-Daten</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon">
                    <CheckCircle size={24} />
                  </div>
                  <div className="feature-text">
                    <h4>Sichere Übermittlung</h4>
                    <p>Direkte Weiterleitung an EU-VAT-Systeme</p>
                  </div>
                </div>
              </div>

              <div className="wizard-actions">
                <button 
                  className="primary-button large"
                  onClick={handleStartUpload}
                >
                  <Upload size={20} />
                  Erste Rechnung hochladen
                  <ArrowRight size={16} />
                </button>

                <div className="alternative-action">
                  <p>Oder möchten Sie erst einen Blick auf die Funktionen werfen?</p>
                  <button 
                    className="secondary-button"
                    onClick={handleLoadSampleData}
                    disabled={isLoadingSampleData}
                    data-testid="load-sample-data"
                  >
                    <Eye size={16} />
                    {isLoadingSampleData ? 'Erstelle Beispieldaten...' : 'Dashboard mit Beispieldaten erkunden'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Step */}
        {currentStep === 'upload' && (
          <div className="wizard-step upload-step">
            <div className="wizard-header">
              <h3>Laden Sie Ihre erste Rechnung hoch</h3>
              <p>Unterstützte Formate: PDF, JPG, PNG (max. 10MB)</p>
            </div>

            <div className="wizard-content">
              <InvoiceUploader onUploadComplete={handleUploadComplete} />
              
              <div className="upload-help">
                <div className="help-item">
                  <CheckCircle size={16} />
                  <span>Die Datei wird automatisch analysiert</span>
                </div>
                <div className="help-item">
                  <CheckCircle size={16} />
                  <span>Alle VAT-relevanten Daten werden extrahiert</span>
                </div>
                <div className="help-item">
                  <CheckCircle size={16} />
                  <span>Sie können den Fortschritt live verfolgen</span>
                </div>
              </div>

              <div className="wizard-actions">
                <button 
                  className="secondary-button"
                  onClick={() => setCurrentStep('welcome')}
                >
                  Zurück
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {currentStep === 'processing' && (
          <div className="wizard-step processing-step">
            <div className="wizard-header">
              <h3>Dokument wird verarbeitet...</h3>
              <p>Unsere KI analysiert Ihre Rechnung in Echtzeit</p>
            </div>

            <div className="wizard-content">
              <div className="processing-visualization">
                <div className="processing-steps">
                  {getProcessingSteps().map((step, index) => (
                    <div 
                      key={step.id}
                      className={`processing-step ${step.active ? 'active' : ''}`}
                    >
                      <div className="step-icon">
                        {step.icon}
                      </div>
                      <div className="step-label">{step.label}</div>
                      {index < getProcessingSteps().length - 1 && (
                        <div className={`step-connector ${step.active ? 'active' : ''}`} />
                      )}
                    </div>
                  ))}
                </div>

                <div className="processing-details">
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value">
                      {processingAnimation === 0 && "Dokument wird empfangen..."}
                      {processingAnimation === 1 && "KI extrahiert VAT-Daten..."}
                      {processingAnimation === 2 && "Validierung läuft..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Step */}
        {currentStep === 'success' && (
          <div className="wizard-step success-step">
            <div className="wizard-header">
              <div className="success-icon">
                <CheckCircle size={48} />
              </div>
              <h2>Perfekt! Ihr erstes Dokument ist bereit</h2>
              <p className="success-subtitle">
                Die Rechnung wurde erfolgreich verarbeitet und erscheint jetzt in Ihrem Dashboard.
              </p>
            </div>

            <div className="wizard-content">
              <div className="success-highlights">
                <div className="highlight-item">
                  <CheckCircle size={20} />
                  <span>Alle VAT-Daten wurden automatisch extrahiert</span>
                </div>
                <div className="highlight-item">
                  <CheckCircle size={20} />
                  <span>Dokument ist bereit für die VAT-Rückerstattung</span>
                </div>
                <div className="highlight-item">
                  <CheckCircle size={20} />
                  <span>Sie können weitere Dokumente hochladen</span>
                </div>
              </div>

              <div className="next-steps">
                <h4>Nächste Schritte:</h4>
                <ul>
                  <li>Laden Sie weitere Rechnungen hoch</li>
                  <li>Überprüfen Sie die extrahierten Daten</li>
                  <li>Erstellen Sie Ihre erste VAT-Submission</li>
                </ul>
              </div>

              <div className="wizard-actions">
                <button 
                  className="primary-button large"
                  onClick={handleFinish}
                >
                  <ArrowRight size={16} />
                  Zum Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirstUploadWizard;
