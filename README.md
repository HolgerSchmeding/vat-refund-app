# VAT Refund Application

A comprehensive Firebase-based application for processing VAT refund claims with intelligent line-item validation using Google Document AI.

## 🏗️ Architecture

### Core Components
- **Firebase Cloud Functions v2** - Serverless backend processing
- **Google Document AI** - Invoice OCR and entity extraction
- **Firebase Firestore** - NoSQL database for document storage
- **Firebase Storage** - File storage for invoices/receipts
- **TypeScript** - Type-safe development

### Key Features
- ✅ **Line-Item Processing** - Individual validation of each expense item
- ✅ **EU VAT Compliance** - Official sub-code mapping and validation rules
- ✅ **Document AI Integration** - Automatic OCR and entity extraction
- ✅ **Smart Validation** - Business rules for refundable/non-refundable items
- ✅ **Audit Trail** - Complete tracking from upload to submission
- ✅ **Multi-tenant Support** - Designed for multiple business customers

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI
- Java 17+ (for emulators)
- Google Cloud Project with Document AI enabled

### Installation
```bash
# Clone and install dependencies
npm install
cd functions && npm install

# Start Firebase emulators
firebase emulators:start
```

### Configuration
1. Update `functions/src/index.ts` with your Document AI processor ID
2. Set your Google Cloud project ID in configuration
3. Configure regional endpoints as needed

## 📝 Data Flow

### 1. Invoice Upload (`onInvoiceUpload`)
```
📄 File Upload → 🔍 Document AI → 📊 Entity Extraction → 💾 Firestore
```

**Key Entities Extracted:**
- Invoice ID, Date, Supplier
- Line items with amounts and VAT rates
- Total amounts and currency

### 2. Line-Item Validation (`validateDocument`)
```
📋 Line Items → 🧠 Business Rules → ✅/❌ Validation → 💰 VAT Calculation
```

**Validation Rules:**
- ❌ **Non-refundable**: Alcohol, entertainment, gifts
- ✅ **Refundable**: Accommodation, business meals, fuel, training

**EU Sub-Codes:**
- `55.10.10` - Hotel accommodation
- `56.10.11` - Restaurant services  
- `47.30.20` - Fuel
- `85.59.12` - Business training
- `77.11.00` - General business services

## 🗄️ Database Schema

### Documents Collection
```typescript
{
  // Header information
  invoiceId: string;
  invoiceDate: string;
  supplierName: string;
  totalAmount: string;
  
  // Line items array
  lineItems: [{
    originalText: string;        // Raw OCR text
    description: string;         // Parsed description
    netAmount: number;          // Net amount
    vatRate: number;            // VAT percentage
    vatAmount: number;          // VAT amount
    isRefundable: boolean;      // Validation result
    refundableVatAmount: number; // Refundable VAT
    euSubCode: string;          // EU expense code
    validationNotes: string;    // Validation reason
  }];
  
  // Metadata
  status: "pending_validation" | "ready_for_submission" | "validation_error";
  totalRefundableVatAmount: number;
  tenantId: string;
  createdAt: Timestamp;
  validationCompletedAt: Timestamp;
}
```

## 🧪 Testing

### Local Development
```bash
# Start emulators
firebase emulators:start

# Test invoice upload and processing
node test-complete-workflow.js

# Test validation logic manually
node test-manual-validation.js
```

### Test Results Example
```
📋 Line Items Validation:
1. Hotel accommodation - €400 + €84 VAT → ✅ REFUNDABLE (EU: 55.10.10)
2. Business meals - €150 + €31.50 VAT → ✅ REFUNDABLE (EU: 56.10.11)  
3. Alcohol - €50 + €10.50 VAT → ❌ NOT REFUNDABLE

Total Refundable VAT: €115.50 (out of €126 total)
Status: ready_for_submission
```

## 📁 Project Structure
```
vat-refund-app/
├── functions/
│   ├── src/
│   │   ├── index.ts              # Main Cloud Functions
│   │   └── models/
│   │       └── types.ts          # TypeScript interfaces
│   ├── package.json
│   └── tsconfig.json
├── firebase.json                 # Firebase configuration
├── firestore.rules              # Firestore security rules
└── firestore.indexes.json       # Database indexes
```

## 🔧 Functions

### `onInvoiceUpload`
**Trigger**: Storage object finalized  
**Purpose**: Process uploaded invoices with Document AI  
**Output**: Structured document in Firestore with line items

### `validateDocument`
**Trigger**: Firestore document created  
**Purpose**: Validate each line item for VAT refund eligibility  
**Output**: Updated document with validation results and refundable amounts

## 🌍 EU VAT Compliance

### Validation Rules
The application implements EU-specific business rules:

1. **Non-refundable Categories**
   - Alcoholic beverages
   - Entertainment expenses
   - Personal gifts

2. **Refundable Categories**
   - Business accommodation
   - Business meals (with limits)
   - Business fuel
   - Professional training
   - Business equipment

### Official Sub-Codes
Each refundable expense is mapped to official EU sub-codes required for submissions.

## 🚀 Deployment

### Production
```bash
# Deploy to Firebase
firebase deploy

# Deploy specific functions
firebase deploy --only functions:onInvoiceUpload
firebase deploy --only functions:validateDocument
```

### Environment Variables
- `GCLOUD_PROJECT` - Google Cloud project ID
- `FIREBASE_CONFIG` - Firebase configuration JSON

## 📚 API Reference

### Document AI Configuration
- **Processor Type**: Invoice Parser
- **Region**: EU (configurable)
- **Input**: PDF, JPEG, PNG files
- **Output**: Structured entities with line items

### Firestore Collections
- **documents** - Main invoice documents
- **tenants** - Business customer information (future)
- **submissions** - VAT refund submissions (future)

## 🔐 Security

- Firestore security rules enforce tenant isolation
- File upload validation and size limits
- Function authentication and authorization
- Audit logging for all operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Status**: ✅ Core functionality implemented and tested  
**Next Steps**: Frontend React application, production deployment, advanced validation rules
