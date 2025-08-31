# AI-Powered Address Correction Workflow

This document describes the automated workflow that handles incorrect invoice addresses using AI-generated correction emails.

## Overview

When the `validateDocument` function detects an incorrect recipient address on an invoice, the system automatically:

1. **Detects the Issue**: The validation identifies incorrect recipient addresses
2. **Triggers AI Processing**: A Firestore trigger activates the correction workflow
3. **Generates Email**: Gemini AI creates a polite, professional correction request
4. **Sends Email**: The system sends the email to the supplier automatically
5. **Updates Status**: The document status changes to show correction is in progress

## Architecture

### Cloud Function: `requestAddressCorrection`

**Trigger**: Firestore `onDocumentUpdated` for `documents/{documentId}`

**Conditions**:
- Document status changes to `validation_error`
- Error details indicate an address validation issue
- Supplier email is available in the extracted data

### AI Integration

**Service**: Google Gemini via Vertex AI SDK
**Model**: `gemini-1.5-flash`
**Location**: `europe-west1`

**Prompt Engineering**:
- Context: Professional accounting assistant role
- Language Detection: German or English based on document content
- Input Data: Supplier name, invoice details, incorrect vs. correct address
- Output: JSON with subject and body for the correction email

### Email Service

**Provider**: SendGrid
**Configuration**: 
- API Key: `SENDGRID_API_KEY` environment variable
- From Address: `SENDGRID_FROM_EMAIL` environment variable
- Format: Both text and HTML versions

## Document Status Flow

```
validation_error (address issue)
        ↓
[AI generates email]
        ↓
[Email sent to supplier]
        ↓
in_correction_address
```

## Required Environment Variables

```bash
# SendGrid configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@your-company.com

# Google Cloud Project (automatically set by Firebase)
GOOGLE_CLOUD_PROJECT=eu-vat-refund-app-2025
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install @google-cloud/vertexai @sendgrid/mail
```

### 2. Configure SendGrid

1. Create a SendGrid account at https://sendgrid.com
2. Generate an API Key with email sending permissions
3. Set the environment variables:

```bash
firebase functions:config:set sendgrid.api_key="your_api_key_here"
firebase functions:config:set sendgrid.from_email="noreply@yourcompany.com"
```

For local development, create a `.env` file in the `functions` directory:

```
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourcompany.com
```

### 3. Enable Vertex AI

1. Enable the Vertex AI API in your Google Cloud Console
2. Ensure your project has the necessary permissions for Gemini

### 4. Deploy the Function

```bash
firebase deploy --only functions
```

## AI Email Generation

### German Example

**Input**:
- Supplier: "Tech Solutions GmbH"
- Invoice: "INV-2025-001" dated "15.08.2025"
- Incorrect Address: "Wrong Street 123, Berlin"
- Correct Address: "Correct Street 456, 10115 Berlin, Germany"

**Generated Email**:
```
Subject: Korrektur erforderlich - Rechnung INV-2025-001

Sehr geehrte Damen und Herren,

vielen Dank für Ihre Rechnung INV-2025-001 vom 15.08.2025.

Bei der Prüfung ist uns aufgefallen, dass die Rechnungsadresse nicht korrekt ist:
Wrong Street 123, Berlin

Unsere korrekte Firmenadresse lautet:
Correct Street 456, 10115 Berlin, Germany

Könnten Sie uns bitte eine korrigierte Rechnung mit der richtigen Adresse zusenden?

Vielen Dank für Ihr Verständnis.

Mit freundlichen Grüßen,
[Company Name]
```

### English Example

**Input**: Same data
**Generated Email**:
```
Subject: Address Correction Required - Invoice INV-2025-001

Dear Tech Solutions GmbH,

Thank you for your invoice INV-2025-001 dated 15.08.2025.

During our review, we noticed that the billing address is incorrect:
Wrong Street 123, Berlin

Our correct company address is:
Correct Street 456, 10115 Berlin, Germany

Could you please send us a corrected invoice with the proper address?

Thank you for your understanding.

Best regards,
[Company Name]
```

## Frontend Integration

### Status Display

The frontend automatically displays documents with `in_correction_address` status:

- **Icon**: Mail icon (📧) in orange color
- **Text**: "Correction Requested"
- **Color**: Orange (#ea580c) to indicate action pending

### Dashboard Metrics

The new status is included in dashboard calculations:
- Documents requiring attention
- Processing pipeline status
- Workflow completion rates

## Error Handling

### AI Generation Failures

If Gemini AI fails to generate the email:
- Falls back to a professional template
- Logs the error for monitoring
- Still sends the correction request

### Email Sending Failures

If SendGrid fails to send:
- Logs the error with full details
- Updates document with `correctionError` field
- Status remains `validation_error` for retry

### Missing Data

If required data is missing:
- Supplier email: Function exits gracefully
- Tenant info: Function exits with error log
- Address data: Uses available information

## Monitoring and Debugging

### Cloud Function Logs

Monitor the function execution:

```bash
firebase functions:log --only requestAddressCorrection
```

### Firestore Fields Added

The function adds these fields to documents:
- `correctionRequestedAt`: Timestamp when email was sent
- `correctionRequestedTo`: Email address where correction was sent
- `correctionError`: Error message if sending failed

### SendGrid Dashboard

Monitor email delivery, opens, and bounces in your SendGrid dashboard.

## Testing

### Local Testing

1. Start the Firebase emulators:
```bash
firebase emulators:start
```

2. Create a test document with validation error:
```javascript
// Update a document to trigger the function
await db.collection('documents').doc('test-doc').update({
  status: 'validation_error',
  errorDetails: {
    code: 400,
    message: 'Incorrect recipient address detected'
  },
  extractedData: {
    supplier_email: 'test@example.com',
    supplier_name: 'Test Supplier',
    invoice_number: 'INV-TEST-001',
    invoice_date: '2025-08-30'
  }
});
```

### Production Testing

1. Use a test email address for initial deployment
2. Monitor logs for successful execution
3. Verify emails are received and formatted correctly
4. Test with both German and English content

## Security Considerations

### Email Security

- SendGrid API key should be kept secure
- From email should be properly configured with SPF/DKIM
- Consider email rate limiting for high-volume scenarios

### Data Privacy

- Supplier emails are processed according to your privacy policy
- Generated emails contain only necessary business information
- No sensitive financial data is included in email content

### Access Control

- Function runs with Firebase Admin privileges
- Only processes documents owned by the authenticated tenant
- No cross-tenant data access possible

## Future Enhancements

### Planned Features

1. **Multi-language Support**: Extend beyond German/English
2. **Email Templates**: Customizable templates per tenant
3. **Retry Logic**: Automatic retry for failed email sends
4. **Supplier Responses**: Handle replies and track corrections
5. **Analytics**: Dashboard for correction request metrics

### Integration Opportunities

1. **CRM Integration**: Log correction requests in customer management systems
2. **Workflow Management**: Integration with approval workflows
3. **Document Versioning**: Track original vs. corrected documents
4. **Supplier Portal**: Allow suppliers to submit corrections directly

## Troubleshooting

### Common Issues

**Function not triggering**:
- Check Firestore security rules
- Verify document update includes status change
- Confirm error details contain address keywords

**AI generation fails**:
- Verify Vertex AI API is enabled
- Check project permissions for Gemini
- Review prompt formatting and limits

**Email not sending**:
- Verify SendGrid API key and permissions
- Check from email domain configuration
- Review SendGrid activity logs

**Status not updating**:
- Check Firestore write permissions
- Verify function completion in logs
- Confirm document path is correct

### Getting Help

For issues with this workflow:
1. Check Firebase Function logs
2. Review SendGrid delivery logs
3. Verify Vertex AI quota and permissions
4. Test with simplified data first

## Performance Considerations

### Function Execution

- **Cold Start**: ~2-3 seconds for initial requests
- **Warm Execution**: ~500ms for subsequent requests
- **AI Generation**: ~1-2 seconds per email
- **Email Sending**: ~200-500ms per email

### Cost Optimization

- **Vertex AI**: Pay per token for Gemini usage
- **SendGrid**: Pay per email sent
- **Cloud Functions**: Pay per execution and compute time
- **Firestore**: Pay per read/write operation

### Scaling Considerations

- Function automatically scales with document volume
- Consider batch processing for high-volume scenarios
- Monitor costs as usage increases
- Implement rate limiting if needed

This automated workflow significantly reduces manual intervention in address correction processes while maintaining professional communication standards with suppliers.
