// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your Firebase configuration
// For development with emulators, these can be placeholder values
const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-vat-refund-app.firebaseapp.com",
  projectId: "demo-vat-refund-app",
  storageBucket: "demo-vat-refund-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:demo-app-id"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'europe-west1');
export const storage = getStorage(app);

// Connect to emulators in development or Docker
const isEmulatorMode = import.meta.env.DEV || 
                      import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ||
                      window.location.hostname === 'localhost' ||
                      // Check if running in Docker container
                      window.location.hostname.includes('172.') ||
                      window.location.hostname.includes('docker');

if (isEmulatorMode) {
  try {
    // For browser requests, always use localhost (host machine ports)
    // The Docker ports are mapped to localhost:port, so browser can reach them
    const authHost = 'localhost:9099';
    const firestoreHost = 'localhost';
    const firestorePort = 8080;
    const functionsHost = 'localhost';
    const functionsPort = 5001;
    const storageHost = 'localhost';
    const storagePort = 9199;

    // Connect to emulators
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    connectFirestoreEmulator(db, firestoreHost, firestorePort);
    connectFunctionsEmulator(functions, functionsHost, functionsPort);
    connectStorageEmulator(storage, storageHost, storagePort);
    
    console.log('🔧 Connected to Firebase emulators');
    console.log(`   Auth: ${authHost}`);
    console.log(`   Firestore: ${firestoreHost}:${firestorePort}`);
    console.log(`   Functions: ${functionsHost}:${functionsPort}`);
    console.log(`   Storage: ${storageHost}:${storagePort}`);
  } catch (error) {
    // Emulators might already be connected, this is normal on hot reload
    console.warn('⚠️ Emulators connection warning (likely already connected):', error);
  }
}

export default app;
