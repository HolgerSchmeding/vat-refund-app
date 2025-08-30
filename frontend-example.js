/**
 * Frontend JavaScript example for calling the generateSubmissionXml Cloud Function
 * This shows how to integrate the function into your web application
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp } from 'firebase/app';

// Your Firebase config
const firebaseConfig = {
  // ... your config
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// If using emulators for development
if (process.env.NODE_ENV === 'development') {
  const functions = getFunctions();
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

/**
 * Generate XML submission for German tax authorities
 */
export async function generateVatSubmissionXml(submissionPeriod, countryCode, tenantId) {
  try {
    // Show loading state
    console.log('Generating VAT submission XML...');

    // Call the Cloud Function
    const generateXml = httpsCallable(functions, 'generateSubmissionXml');
    const result = await generateXml({
      submissionPeriod: submissionPeriod, // e.g., "Q4/2025"
      countryCode: countryCode,           // e.g., "DE"
      tenantId: tenantId                  // Optional tenant ID
    });

    const data = result.data;

    if (data.success) {
      console.log('XML submission generated successfully!');
      console.log('Submission ID:', data.submissionId);
      console.log('XML Storage Path:', data.xmlStoragePath);
      console.log('Total Refund Amount:', data.totalRefundAmount);
      console.log('Documents Processed:', data.documentCount);

      // You can now:
      // 1. Show success message to user
      // 2. Redirect to submission details page
      // 3. Download the XML file
      // 4. Update UI to reflect document status changes

      return {
        success: true,
        submissionId: data.submissionId,
        xmlStoragePath: data.xmlStoragePath,
        totalRefundAmount: data.totalRefundAmount,
        documentCount: data.documentCount
      };
    } else {
      throw new Error(data.error || 'Unknown error occurred');
    }

  } catch (error) {
    console.error('Error generating XML submission:', error);
    
    // Show error message to user
    alert(`Error generating submission: ${error.message}`);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Example usage in a React component
 */
export function SubmissionPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [submissions, setSubmissions] = useState([]);

  const handleGenerateSubmission = async () => {
    setIsGenerating(true);
    
    try {
      const result = await generateVatSubmissionXml('Q4/2025', 'DE', 'your-tenant-id');
      
      if (result.success) {
        // Refresh submissions list
        await loadSubmissions();
        
        // Show success message
        alert(`Submission generated successfully! Total refund: €${result.totalRefundAmount}`);
      }
    } catch (error) {
      console.error('Failed to generate submission:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="submission-page">
      <h1>VAT Submission Generator</h1>
      
      <div className="submission-form">
        <h2>Generate New Submission</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          handleGenerateSubmission();
        }}>
          <div>
            <label>Period:</label>
            <select name="period" required>
              <option value="Q1/2025">Q1 2025</option>
              <option value="Q2/2025">Q2 2025</option>
              <option value="Q3/2025">Q3 2025</option>
              <option value="Q4/2025">Q4 2025</option>
            </select>
          </div>
          
          <div>
            <label>Country:</label>
            <select name="country" required>
              <option value="DE">Germany (DE)</option>
              {/* Add other countries as supported */}
            </select>
          </div>
          
          <button 
            type="submit" 
            disabled={isGenerating}
            className="generate-btn"
          >
            {isGenerating ? 'Generating...' : 'Generate XML Submission'}
          </button>
        </form>
      </div>

      <div className="submissions-list">
        <h2>Previous Submissions</h2>
        {/* List of previous submissions */}
      </div>
    </div>
  );
}

/**
 * Example of downloading the generated XML file
 */
export async function downloadSubmissionXml(xmlStoragePath) {
  try {
    // Get download URL from Firebase Storage
    const storage = getStorage();
    const fileRef = ref(storage, xmlStoragePath);
    const downloadUrl = await getDownloadURL(fileRef);
    
    // Create download link
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = xmlStoragePath.split('/').pop(); // Extract filename
    link.click();
    
  } catch (error) {
    console.error('Error downloading XML file:', error);
    alert('Failed to download XML file');
  }
}
