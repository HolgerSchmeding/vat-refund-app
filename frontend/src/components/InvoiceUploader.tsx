import React, { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
// Frontend fallback (can be enabled if backend CF fails)
// import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage /*, db*/ } from '../firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { DocumentStatus } from '../types/DocumentStatus';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import './InvoiceUploader.css';

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

const InvoiceUploader: React.FC = () => {
  const { user } = useAuth();
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return 'Nur PDF, JPG und PNG Dateien sind erlaubt.';
    }
    if (file.size > maxFileSize) {
      return 'Datei ist zu groß. Maximum: 10MB.';
    }
    return null;
  };

  const generateFileId = () => Math.random().toString(36).substr(2, 9);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || !user) return;

    const newFiles: UploadFile[] = [];
    
    Array.from(files).forEach(file => {
      const error = validateFile(file);
      newFiles.push({
        file,
        id: generateFileId(),
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined
      });
    });

    setUploadFiles(prev => [...prev, ...newFiles]);

    // Start uploading valid files
    newFiles.forEach(uploadFile => {
      if (uploadFile.status === 'pending') {
        startUpload(uploadFile);
      }
    });
  };

  const startUpload = async (uploadFile: UploadFile) => {
    if (!user) return;

    try {
      console.log('Starting upload for user:', user.uid);
      
      // Update status to uploading
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { ...f, status: 'uploading' } : f)
      );

      // Create storage reference with tenant-specific path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${timestamp}_${uploadFile.file.name}`;
      const storageRef = ref(storage, `invoices/${user.uid}/${fileName}`);
      
      console.log('Upload path:', `invoices/${user.uid}/${fileName}`);

      // Start upload
      const uploadTask = uploadBytesResumable(storageRef, uploadFile.file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress updates
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadFiles(prev => 
            prev.map(f => f.id === uploadFile.id ? { ...f, progress } : f)
          );
        },
        (error) => {
          // Upload error
          console.error('Upload error:', error);
          let errorMessage = 'Upload fehlgeschlagen. Bitte versuchen Sie es erneut.';
          
          // Provide more specific error messages
          if (error.code === 'storage/unauthorized') {
            errorMessage = 'Berechtigung verweigert. Bitte melden Sie sich erneut an.';
          } else if (error.code === 'storage/canceled') {
            errorMessage = 'Upload wurde abgebrochen.';
          } else if (error.code === 'storage/invalid-format') {
            errorMessage = 'Ungültiges Dateiformat. Nur PDF, JPG und PNG sind erlaubt.';
          } else if (error.code === 'storage/quota-exceeded') {
            errorMessage = 'Speicher-Quota überschritten. Bitte kontaktieren Sie den Support.';
          } else if (error.message) {
            errorMessage = `Upload-Fehler: ${error.message}`;
          }
          
          setUploadFiles(prev => 
            prev.map(f => f.id === uploadFile.id ? { 
              ...f, 
              status: 'error', 
              error: errorMessage
            } : f)
          );
        },
        async () => {
          // Upload completed successfully
          console.log('Upload completed successfully!');
          try {
            // Verify user is still authenticated
            if (!user) {
              throw new Error('User authentication lost during upload');
            }
            
            // Wait a moment for the file to be fully available
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to get the download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('Download URL generated successfully:', downloadURL);
            console.log('Upload completed for user:', user.uid);
            
            // TODO: Temporarily disabled Firestore document creation to debug crash
            console.log('� Relying on Cloud Function for document creation.');
            // QUICK TOGGLE: Set enableFrontendFallback = true to also write a minimal Firestore doc immediately.
            const enableFrontendFallback = false;
            if (enableFrontendFallback) {
              console.log('⚠️ Frontend fallback enabled – creating minimal Firestore doc.');
              /*
              try {
                const docRef = await addDoc(collection(db, 'documents'), {
                  uploadedBy: user.uid,
                  tenantId: user.uid,
                  originalFileName: uploadFile.file.name,
                  storagePath: uploadTask.snapshot.ref.fullPath,
                  status: 'uploading',
                  extractedData: {},
                  totalRefundableVatAmount: 0,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                console.log('✅ Frontend fallback doc created:', docRef.id);
              } catch (fe) {
                console.error('❌ Frontend fallback Firestore write failed:', fe);
              }
              */
            }
            
            /*
            // Create Firestore document directly from frontend (optional)
            if (typeof addDoc === 'function' && db) {
              try {
                const docId = await createFirestoreDocument(uploadFile, downloadURL);
                if (docId) {
                  console.log('✅ Document created in Firestore with ID:', docId);
                  console.log('📄 Document should now appear in dashboard');
                } else {
                  console.warn('⚠️ Firestore document creation returned null');
                }
              } catch (firestoreError) {
                console.error('❌ Failed to create Firestore document:', firestoreError);
                console.log('📋 Upload successful, but document creation failed. Cloud Function will handle it.');
              }
            } else {
              console.log('📋 Firestore not available, relying on Cloud Function for document creation');
            }
            */
            
            setUploadFiles(prev => 
              prev.map(f => f.id === uploadFile.id ? { 
                ...f, 
                status: 'completed', 
                progress: 100 
              } : f)
            );

            // Remove completed upload after 5 seconds (increased from 3)
            setTimeout(() => {
              setUploadFiles(prev => prev.filter(f => f.id !== uploadFile.id));
              console.log('Upload removed from UI after 5 seconds');
            }, 5000);
          } catch (error) {
            console.error('Error getting download URL:', error);
            let errorMessage = 'Upload abgeschlossen, aber Download-URL konnte nicht abgerufen werden.';
            
            // Provide more specific error information
            if (error instanceof Error) {
              if (error.message.includes('permission') || error.message.includes('unauthorized')) {
                errorMessage = 'Datei hochgeladen, aber Berechtigungen fehlen. Bitte melden Sie sich erneut an.';
              } else if (error.message.includes('not-found')) {
                errorMessage = 'Datei hochgeladen, aber nicht gefunden. Bitte versuchen Sie es erneut.';
              } else if (error.message.includes('authentication')) {
                errorMessage = 'Datei hochgeladen, aber Authentifizierung verloren. Bitte melden Sie sich erneut an.';
              } else {
                errorMessage = `Upload abgeschlossen, aber Download-URL-Fehler: ${error.message}`;
              }
            }
            
            setUploadFiles(prev => 
              prev.map(f => f.id === uploadFile.id ? { 
                ...f, 
                status: 'error', 
                error: errorMessage
              } : f)
            );
          }
        }
      );
    } catch (error) {
      console.error('Error starting upload:', error);
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { 
          ...f, 
          status: 'error', 
          error: 'Fehler beim Starten des Uploads.' 
        } : f)
      );
    }
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value to allow uploading the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /*
  const createFirestoreDocument = async (uploadFile: UploadFile, downloadURL: string) => {
    if (!user) {
      console.error('No user available for Firestore document creation');
      return null;
    }

    try {
      console.log('Creating Firestore document for uploaded file...');
      
      // Create a document in Firestore with basic information
      const documentData = {
        // Basic file information
        originalFileName: uploadFile.file.name,
        fileSize: uploadFile.file.size,
        contentType: uploadFile.file.type,
        
        // Storage information
        storagePath: `invoices/${user.uid}/${uploadFile.file.name}`,
        downloadURL: downloadURL,
        
        // User and tenant information
        uploadedBy: user.uid,
        tenantId: user.uid,
        
        // Initial status
        status: DocumentStatus.AWAITING_VALIDATION,
        
        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date(),
        
        // Placeholder for extracted data (will be filled by Cloud Function later)
        invoiceId: null,
        invoiceDate: null,
        supplierName: null,
        totalAmount: null,
        currency: null,
        lineItems: [],
        
        // Processing status
        isProcessed: false,
        processingError: null
      };

      const docRef = await addDoc(collection(db, 'documents'), documentData);
      console.log('✅ Firestore document created with ID:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating Firestore document:', error);
      return null;
    }
  };
  */

  return (
    <div className="invoice-uploader">
      <div 
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <Upload className="upload-icon" size={48} />
        <h3>Rechnung hochladen</h3>
        <p>
          Klicken Sie hier oder ziehen Sie Dateien hierher
        </p>
        <span className="file-types">
          PDF, JPG, PNG (max. 10MB)
        </span>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Information message */}
      <div className="upload-info">
        <p>ℹ️ Nach erfolgreichem Upload werden Ihre Dokumente automatisch verarbeitet und erscheinen in der Dokumentenliste.</p>
      </div>

      {uploadFiles.length > 0 && (
        <div className="upload-progress">
          <h4>Upload-Status</h4>
          {uploadFiles.map((uploadFile) => (
            <div key={uploadFile.id} className="upload-item">
              <div className="file-info">
                <File className="file-icon" size={16} />
                <div className="file-details">
                  <span className="file-name">{uploadFile.file.name}</span>
                  <span className="file-size">{formatFileSize(uploadFile.file.size)}</span>
                </div>
              </div>

              <div className="upload-status">
                {uploadFile.status === 'uploading' && (
                  <>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                    <span className="progress-text">{Math.round(uploadFile.progress)}%</span>
                  </>
                )}

                {uploadFile.status === 'completed' && (
                  <div className="status-success">
                    <CheckCircle size={16} />
                    <span>Erfolgreich hochgeladen - wird verarbeitet...</span>
                  </div>
                )}

                {uploadFile.status === 'error' && (
                  <div className="status-error">
                    <AlertCircle size={16} />
                    <span>{uploadFile.error}</span>
                  </div>
                )}

                <button 
                  className="remove-button"
                  onClick={() => removeFile(uploadFile.id)}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceUploader;
