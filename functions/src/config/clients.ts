/**
 * Lazy initialization factories for external clients.
 * Prevents emulator timeouts by avoiding heavy client initialization in global scope.
 */

import {App, initializeApp} from "firebase-admin/app";
import {getStorage, Storage} from "firebase-admin/storage";
import {getFirestore, Firestore} from "firebase-admin/firestore";
import {getAppConfig, ConfigSections} from "./env";

// Lazy imports for heavy Google Cloud SDKs - imported only when needed
// import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
// import { VertexAI } from "@google-cloud/vertexai";
// import sgMail from "@sendgrid/mail";

// Lazy singletons
let _adminApp: App | null = null;
let _docAiClient: any | null = null;
let _vertexAI: any | null = null;
let _sendGridInitialized = false;

/**
 * Get Firebase Admin App instance (lazy initialization)
 */
export function getAdminApp(): App {
  if (!_adminApp) {
    _adminApp = initializeApp();
  }
  return _adminApp;
}

/**
 * Get Firebase Storage instance (lazy initialization)
 */
export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}

/**
 * Get Firebase Firestore instance (lazy initialization)
 */
export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}

/**
 * Get Document AI client instance (lazy initialization)
 */
export function getDocAiClient(): any {
  if (!_docAiClient) {
    // Lazy import to avoid loading heavy SDK at module level
    const {DocumentProcessorServiceClient} = require("@google-cloud/documentai");

    const docAiConfig = ConfigSections.documentAi();
    const clientOptions = {
      apiEndpoint: docAiConfig.apiEndpoint,
    };
    _docAiClient = new DocumentProcessorServiceClient(clientOptions);
  }
  return _docAiClient;
}

/**
 * Get Vertex AI instance (lazy initialization)
 */
export function getVertexAI(): any {
  if (!_vertexAI) {
    // Lazy import to avoid loading heavy SDK at module level
    const {VertexAI} = require("@google-cloud/vertexai");

    const vertexConfig = ConfigSections.vertexAi();
    _vertexAI = new VertexAI({
      project: vertexConfig.project,
      location: vertexConfig.location,
    });
  }
  return _vertexAI;
}

/**
 * Initialize SendGrid (lazy initialization)
 * Returns the sgMail instance for chaining
 */
export function getSendGrid() {
  const config = getAppConfig();

  if (!_sendGridInitialized) {
    // Lazy import to avoid loading heavy SDK at module level
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(config.sendGridApiKey);
    _sendGridInitialized = true;
  }

  // Return fresh import each time since we don't cache the instance
  const sgMail = require("@sendgrid/mail");
  return sgMail;
}

/**
 * Get configuration values
 * @deprecated Use getAppConfig() from ./env instead for centralized configuration
 */
export function getConfig() {
  const config = getAppConfig();
  return {
    gcpProject: config.gcpProject,
    gcpLocation: config.gcpLocation,
    processorId: config.documentAiProcessorId,
  };
}
