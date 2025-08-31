/**
 * Central configuration management for the VAT Refund application.
 * All configuration values should be accessed through this module to ensure consistency
 * and prevent build drift issues with cached Docker layers.
 */

/**
 * Application configuration interface
 */
export interface AppConfig {
  // Google Cloud Platform
  gcpProject: string;
  gcpLocation: string;
  gcpRegion: string;
  
  // Document AI
  documentAiProcessorId: string;
  documentAiLocation: string;
  
  // Vertex AI
  vertexAiProject: string;
  vertexAiLocation: string;
  
  // SendGrid
  sendGridApiKey: string;
  
  // Firebase
  firebaseProject: string;
  
  // Environment
  environment: 'development' | 'staging' | 'production';
  isEmulator: boolean;
}

/**
 * Default configuration values
 * These serve as fallbacks and for local development
 */
const DEFAULT_CONFIG: AppConfig = {
  // GCP Configuration
  gcpProject: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "demo-vat-refund-app",
  gcpLocation: process.env.GCP_LOCATION || "eu",
  gcpRegion: process.env.GCP_REGION || "europe-west1",
  
  // Document AI
  documentAiProcessorId: process.env.DOCUMENT_AI_PROCESSOR_ID || "b334b6308b8afcb6",
  documentAiLocation: process.env.DOCUMENT_AI_LOCATION || "eu",
  
  // Vertex AI  
  vertexAiProject: process.env.VERTEX_AI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "demo-vat-refund-app",
  vertexAiLocation: process.env.VERTEX_AI_LOCATION || "europe-west1",
  
  // SendGrid
  sendGridApiKey: process.env.SENDGRID_API_KEY || "",
  
  // Firebase
  firebaseProject: process.env.FIREBASE_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "demo-vat-refund-app",
  
  // Environment Detection
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  isEmulator: process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development'
};

/**
 * Cached configuration instance
 */
let _cachedConfig: AppConfig | null = null;

/**
 * Get the application configuration
 * This function caches the configuration on first access to avoid repeated environment variable reads
 * 
 * @returns {AppConfig} The complete application configuration
 */
export function getAppConfig(): AppConfig {
  if (!_cachedConfig) {
    _cachedConfig = { ...DEFAULT_CONFIG };
    
    // Log configuration in development/emulator mode for debugging
    if (_cachedConfig.isEmulator) {
      console.log('🔧 App Configuration Loaded:', {
        gcpProject: _cachedConfig.gcpProject,
        gcpLocation: _cachedConfig.gcpLocation,
        environment: _cachedConfig.environment,
        isEmulator: _cachedConfig.isEmulator,
        // Don't log sensitive values like API keys
        sendGridConfigured: !!_cachedConfig.sendGridApiKey
      });
    }
  }
  
  return _cachedConfig;
}

/**
 * Validate that all required configuration is present
 * Throws an error if critical configuration is missing
 */
export function validateConfig(): void {
  const config = getAppConfig();
  
  const requiredFields: (keyof AppConfig)[] = [
    'gcpProject',
    'gcpLocation', 
    'documentAiProcessorId',
    'firebaseProject'
  ];
  
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    const value = config[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
  }
  
  // Warn about missing optional but important config
  if (!config.sendGridApiKey && !config.isEmulator) {
    console.warn('⚠️  SendGrid API key not configured - email functionality will be disabled');
  }
}

/**
 * Reset cached configuration (primarily for testing)
 */
export function resetConfigCache(): void {
  _cachedConfig = null;
}

/**
 * Get specific configuration sections for convenience
 */
export const ConfigSections = {
  gcp: () => {
    const config = getAppConfig();
    return {
      project: config.gcpProject,
      location: config.gcpLocation,
      region: config.gcpRegion
    };
  },
  
  documentAi: () => {
    const config = getAppConfig();
    return {
      project: config.gcpProject,
      location: config.documentAiLocation,
      processorId: config.documentAiProcessorId,
      apiEndpoint: `${config.documentAiLocation}-documentai.googleapis.com`
    };
  },
  
  vertexAi: () => {
    const config = getAppConfig();
    return {
      project: config.vertexAiProject,
      location: config.vertexAiLocation
    };
  },
  
  firebase: () => {
    const config = getAppConfig();
    return {
      project: config.firebaseProject
    };
  }
};
