# 🔐 GitHub Repository Secrets Setup Guide

This document explains how to configure the required GitHub Secrets for the CI/CD pipeline.

## Required Secrets

Navigate to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

### 🔥 Firebase Secrets

#### `FIREBASE_TOKEN`
```bash
# Generate Firebase CI token
firebase login:ci
# Copy the generated token
```

#### `FIREBASE_SERVICE_ACCOUNT_PROD`
```json
{
  "type": "service_account",
  "project_id": "eu-vat-refund-app-prod",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@eu-vat-refund-app-prod.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40eu-vat-refund-app-prod.iam.gserviceaccount.com"
}
```

### 📧 SendGrid Secrets

#### `SENDGRID_API_KEY`
```
SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### `SENDGRID_FROM_EMAIL`
```
noreply@your-domain.com
```

### 🇪🇺 EU VAT API Secrets

#### `EU_VAT_SUBMISSION_ENDPOINT`
```
https://api.eu-vat-refund.europa.eu/v1/submissions
```

#### `EU_VAT_API_KEY`
```
your-eu-vat-api-key-here
```

## 🛠️ Setup Steps

### 1. Create Production Firebase Project

```bash
# Login to Firebase
firebase login

# Create new project
firebase projects:create eu-vat-refund-app-prod

# Initialize project in your directory
firebase use --add eu-vat-refund-app-prod
firebase use eu-vat-refund-app-prod
```

### 2. Configure Firebase Services

```bash
# Enable Authentication
firebase auth:import --project eu-vat-refund-app-prod

# Enable Firestore
firebase firestore:deploy --project eu-vat-refund-app-prod

# Enable Storage
firebase storage:deploy --project eu-vat-refund-app-prod

# Enable Hosting
firebase hosting:channel:deploy preview --project eu-vat-refund-app-prod
```

### 3. Generate Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your production project (`eu-vat-refund-app-prod`)
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Copy the entire JSON content to `FIREBASE_SERVICE_ACCOUNT_PROD` secret

### 4. Configure Firebase CLI Token

```bash
# Generate token for CI/CD
firebase login:ci

# Add token to GitHub secrets as FIREBASE_TOKEN
```

### 5. Set Function Environment Variables

```bash
# Set SendGrid configuration
firebase functions:config:set \
  sendgrid.api_key="YOUR_SENDGRID_API_KEY" \
  sendgrid.from_email="noreply@your-domain.com" \
  --project eu-vat-refund-app-prod

# Set EU VAT API configuration
firebase functions:config:set \
  eu_vat.submission_endpoint="https://api.eu-vat-refund.europa.eu/v1/submissions" \
  eu_vat.api_key="YOUR_EU_VAT_API_KEY" \
  --project eu-vat-refund-app-prod
```

## ✅ Verification

After setting up all secrets, verify the configuration:

```bash
# Check if all secrets are set
gh secret list

# Test the pipeline with a dummy commit
git commit --allow-empty -m "🚀 Test CI/CD pipeline"
git push origin main
```

## 🔒 Security Best Practices

1. **Principle of Least Privilege**: Service accounts should only have the minimum required permissions
2. **Secret Rotation**: Regularly rotate API keys and service account keys
3. **Environment Separation**: Never use production secrets in development
4. **Audit Logs**: Monitor secret usage through GitHub's audit logs
5. **Branch Protection**: Ensure only authorized users can push to main branch

## 🚨 Troubleshooting

### Common Issues

1. **Authentication Failed**: Check service account JSON format
2. **Permission Denied**: Verify service account has required Firebase roles
3. **API Key Invalid**: Ensure SendGrid/EU VAT API keys are active
4. **Environment Variables**: Check function config with `firebase functions:config:get`

### Debug Commands

```bash
# Check Firebase project status
firebase projects:list

# Verify function configuration
firebase functions:config:get --project eu-vat-refund-app-prod

# Test authentication
firebase auth:export test.json --project eu-vat-refund-app-prod
```
