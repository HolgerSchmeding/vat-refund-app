#!/usr/bin/env node

/**
 * 🚀 Produktions-Deployment Validator
 * Prüft alle kritischen Umgebungsvariablen vor dem Deployment
 * Verhindert Deployment mit Placeholder-Werten
 */

const fs = require('fs');
const path = require('path');

const PRODUCTION_ENV_PATH = path.join(__dirname, '..', '.env.production');
const VALIDATION_ERRORS = [];
const VALIDATION_WARNINGS = [];

// Kritische Frontend-Variablen die NICHT leer oder Placeholder sein dürfen
const CRITICAL_FRONTEND_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID', 
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

// Bekannte Placeholder-Werte die ein Deployment blockieren
const PLACEHOLDER_VALUES = [
  'your-api-key',
  'your-project-id',
  'your-messaging-sender-id', 
  'your-app-id',
  'YOUR_REAL_API_KEY_FROM_FIREBASE_CONSOLE',
  'YOUR_REAL_MESSAGING_SENDER_ID',
  'YOUR_REAL_APP_ID_FROM_FIREBASE_CONSOLE'
];

function loadEnvFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const env = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return env;
  } catch (error) {
    VALIDATION_ERRORS.push(`❌ Kann .env.production nicht lesen: ${error.message}`);
    return {};
  }
}

function validateEnvironmentVariables() {
  console.log('🔍 Produktions-Deployment Validierung...\n');
  
  // .env.production laden
  const env = loadEnvFile(PRODUCTION_ENV_PATH);
  
  if (Object.keys(env).length === 0) {
    VALIDATION_ERRORS.push('❌ .env.production ist leer oder nicht lesbar');
    return;
  }
  
  // Kritische Variablen prüfen
  CRITICAL_FRONTEND_VARS.forEach(varName => {
    const value = env[varName];
    
    if (!value) {
      VALIDATION_ERRORS.push(`❌ ${varName} ist nicht gesetzt`);
    } else if (PLACEHOLDER_VALUES.some(placeholder => value.includes(placeholder))) {
      VALIDATION_ERRORS.push(`❌ ${varName} enthält noch Placeholder-Werte: ${value}`);
    } else if (value.length < 10) {
      VALIDATION_WARNINGS.push(`⚠️  ${varName} scheint sehr kurz zu sein: ${value}`);
    } else {
      console.log(`✅ ${varName}: OK`);
    }
  });
  
  // Firebase Project ID spezielle Validierung
  const projectId = env['VITE_FIREBASE_PROJECT_ID'];
  if (projectId && projectId.includes('demo')) {
    VALIDATION_WARNINGS.push(`⚠️  Project ID "${projectId}" enthält "demo" - ist das für Produktion korrekt?`);
  }
}

function validateFirebaseConfig() {
  console.log('\n🔥 Firebase Konfiguration validieren...');
  
  try {
    const { execSync } = require('child_process');
    
    // Prüfe ob Firebase CLI verfügbar ist
    execSync('firebase --version', { stdio: 'ignore' });
    
    // Prüfe Functions Config (falls möglich)
    try {
      const configOutput = execSync('firebase functions:config:get --project eu-vat-refund-app-prod', { 
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      
      const config = JSON.parse(configOutput);
      
      if (!config.sendgrid || !config.sendgrid.api_key) {
        VALIDATION_WARNINGS.push('⚠️  SendGrid API Key nicht in Functions Config gefunden');
      } else {
        console.log('✅ SendGrid API Key: Konfiguriert');
      }
      
    } catch (configError) {
      VALIDATION_WARNINGS.push('⚠️  Kann Firebase Functions Config nicht abrufen (möglicherweise noch nicht deployt)');
    }
    
  } catch (firebaseError) {
    VALIDATION_WARNINGS.push('⚠️  Firebase CLI nicht verfügbar für Config-Validierung');
  }
}

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDIERUNGSERGEBNISSE');
  console.log('='.repeat(60));
  
  if (VALIDATION_ERRORS.length === 0 && VALIDATION_WARNINGS.length === 0) {
    console.log('🎉 ALLE VALIDIERUNGEN BESTANDEN!');
    console.log('✅ Deployment kann fortgesetzt werden.\n');
    process.exit(0);
  }
  
  if (VALIDATION_ERRORS.length > 0) {
    console.log('\n🚨 KRITISCHE FEHLER (DEPLOYMENT BLOCKIERT):');
    VALIDATION_ERRORS.forEach(error => console.log(error));
  }
  
  if (VALIDATION_WARNINGS.length > 0) {
    console.log('\n⚠️  WARNUNGEN:');
    VALIDATION_WARNINGS.forEach(warning => console.log(warning));
  }
  
  if (VALIDATION_ERRORS.length > 0) {
    console.log('\n❌ DEPLOYMENT GESTOPPT!');
    console.log('Beheben Sie alle kritischen Fehler vor dem Deployment.\n');
    console.log('Anleitung: Siehe PRODUCTION_SETUP.md');
    process.exit(1);
  } else {
    console.log('\n✅ Deployment kann fortgesetzt werden (mit Warnungen).\n');
    process.exit(0);
  }
}

// Hauptvalidierung ausführen
console.log('🚀 VAT Refund App - Produktions-Deployment Validator');
console.log('='.repeat(60));

validateEnvironmentVariables();
validateFirebaseConfig();
printResults();
