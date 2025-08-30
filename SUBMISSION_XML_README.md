# Generate Submission XML Cloud Function

This document describes the `generateSubmissionXml` Cloud Function, which creates compliant XML files for German tax authorities (UStVEU format) based on processed VAT refund documents.

## Overview

The `generateSubmissionXml` function is a manually-triggered callable Cloud Function that:

1. Queries Firestore for documents with `ready_for_submission` status
2. Filters documents by submission period and country
3. Aggregates refundable VAT amounts by EU sub-codes
4. Generates compliant XML according to German UStVEU schema
5. Saves the XML file to Cloud Storage
6. Creates a submission record in Firestore
7. Updates processed documents to `in_submission` status

## Function Parameters

```typescript
interface GenerateSubmissionXmlParams {
  submissionPeriod: string; // e.g., "Q4/2025"
  countryCode: string;      // e.g., "DE" (currently only Germany supported)
  tenantId?: string;        // Optional tenant ID for multi-tenant support
}
```

## Function Response

```typescript
interface GenerateSubmissionXmlResponse {
  success: boolean;
  xmlStoragePath?: string;    // Path to generated XML in Cloud Storage
  submissionId?: string;      // ID of the submission record in Firestore
  totalRefundAmount?: number; // Total VAT amount eligible for refund
  documentCount?: number;     // Number of documents processed
  error?: string;            // Error message if success is false
}
```

## Prerequisites

### Document Structure
Documents must have the following structure to be processed:

```typescript
{
  status: "ready_for_submission",
  country: "DE",
  createdAt: Timestamp, // Used for period filtering
  lineItems: [
    {
      isRefundable: true,
      euSubCode: "55.10.10", // EU sub-code for expense type
      refundableVatAmount: 38.00,
      netAmount: 200.00,
      vatAmount: 38.00,
      // ... other fields
    }
  ],
  totalRefundableVatAmount: 38.00
}
```

### EU Sub-Codes
The function uses these EU sub-codes for German VAT submissions:

- `55.10.10` - Hotel accommodation
- `56.10.11` - Restaurant services
- `47.30.20` - Fuel
- `85.59.12` - Business training/conferences
- `77.11.00` - General business services (default)

## Usage Examples

### Frontend Integration

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const generateXml = httpsCallable(functions, 'generateSubmissionXml');

const result = await generateXml({
  submissionPeriod: 'Q4/2025',
  countryCode: 'DE',
  tenantId: 'your-tenant-id'
});

if (result.data.success) {
  console.log('Submission ID:', result.data.submissionId);
  console.log('XML Path:', result.data.xmlStoragePath);
  console.log('Total Refund:', result.data.totalRefundAmount);
} else {
  console.error('Error:', result.data.error);
}
```

### cURL Example (for testing)

```bash
curl -X POST \
  http://localhost:5001/eu-vat-refund-app-2025/europe-west1/generateSubmissionXml \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "submissionPeriod": "Q4/2025",
      "countryCode": "DE",
      "tenantId": "test-tenant-123"
    }
  }'
```

## Generated XML Structure

The function generates XML according to the German UStVEU schema:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<UStVEU version="2024" xmlns="http://www.elster.de/elsterxml/schema/v11">
  <Header>
    <Testmerker>N</Testmerker>
    <Hersteller>VAT-Refund-App</Hersteller>
    <DatenArt>UStVEU</DatenArt>
    <Verfahren>UStVEU</Verfahren>
    <Zeitraum>Q4/2025</Zeitraum>
  </Header>
  
  <Antragsteller>
    <TenantId>test-tenant-123</TenantId>
    <Period>Q4/2025</Period>
    <Country>DE</Country>
  </Antragsteller>
  
  <UmsatzsteuerDetails>
    <Position>
      <EUSubCode>55.10.10</EUSubCode>
      <NettoSumme>200.00</NettoSumme>
      <UmsatzsteuerSumme>38.00</UmsatzsteuerSumme>
      <ErstattungsberechtigterBetrag>38.00</ErstattungsberechtigterBetrag>
      <AnzahlBelege>1</AnzahlBelege>
    </Position>
    <!-- More positions... -->
  </UmsatzsteuerDetails>
  
  <Zusammenfassung>
    <GesamtErstattungsbetrag>64.60</GesamtErstattungsbetrag>
    <AnzahlPositionen>3</AnzahlPositionen>
    <Erstellungsdatum>2025-08-30T13:00:00.000Z</Erstellungsdatum>
  </Zusammenfassung>
</UStVEU>
```

## Testing

### 1. Local Testing with Emulators

```bash
# Start Firebase emulators
firebase emulators:start

# The function will be available at:
# http://localhost:5001/eu-vat-refund-app-2025/europe-west1/generateSubmissionXml
```

### 2. Test Data Setup

Use the provided `sample-test-data.json` to create test documents in Firestore:

```javascript
// Add sample documents to Firestore documents collection
const db = getFirestore();
const sampleDocs = require('./sample-test-data.json').sampleDocuments;

for (const doc of sampleDocs) {
  await db.collection('documents').add({
    ...doc,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
    validationCompletedAt: new Date(doc.validationCompletedAt)
  });
}
```

### 3. Expected Results

With the sample data, calling the function should:
- Process 3 documents
- Generate total refund amount of €64.60
- Create 3 EU sub-code positions
- Save XML to Cloud Storage
- Create submission record in Firestore
- Update document statuses to `in_submission`

## Error Handling

The function handles these error cases:

- **Missing parameters**: Returns error if `submissionPeriod` or `countryCode` not provided
- **Unsupported country**: Currently only "DE" is supported
- **No documents found**: Returns error if no documents match the criteria
- **No refundable amounts**: Returns error if total refund amount is 0
- **Storage errors**: Logs and returns error if XML upload fails
- **Firestore errors**: Logs and returns error if database operations fail

## Monitoring and Logging

The function includes comprehensive logging:

```typescript
// Success logs
logger.info(`XML submission generated successfully. 
  Submission ID: ${submissionId}, 
  Documents processed: ${matchingDocuments}, 
  Total refund amount: €${totalRefundAmount.toFixed(2)}`);

// Error logs
logger.error("Error generating XML submission:", error);
```

Monitor function execution in:
- Firebase Console > Functions
- Cloud Logging for detailed logs
- Cloud Storage for generated XML files
- Firestore for submission records

## Security Considerations

- Function requires authentication (callable function)
- Tenant isolation through `tenantId` parameter
- Validate user permissions in your frontend before calling
- Consider adding additional access controls based on user roles

## Future Enhancements

Potential improvements for this function:

1. **Multi-country support**: Add support for other EU countries
2. **Custom XML schemas**: Support different tax authority formats
3. **Batch processing**: Handle large numbers of documents efficiently
4. **Email notifications**: Send completion notifications to users
5. **Digital signatures**: Add XML signing capabilities
6. **Validation service**: Validate XML against official schemas
7. **Retry mechanism**: Add automatic retry for failed operations

## Dependencies

The function uses these npm packages:

```json
{
  "dependencies": {
    "firebase-admin": "^12.7.0",
    "firebase-functions": "^6.0.1",
    "xmlbuilder2": "^3.0.2"
  }
}
```

## Deployment

Deploy the function to production:

```bash
# Build the functions
npm run build

# Deploy to Firebase
firebase deploy --only functions:generateSubmissionXml
```

The function will be available at:
```
https://europe-west1-your-project-id.cloudfunctions.net/generateSubmissionXml
```
