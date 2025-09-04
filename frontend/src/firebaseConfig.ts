// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your Firebase configuration
// Production configuration for vat-refund-app-2025
const firebaseConfig = {
  apiKey: "AIzaSyBN_uC209PVSEsYNee9Y0gv4q-g5E2k6YQ",
  authDomain: "vat-refund-app-2025.firebaseapp.com",
  projectId: "vat-refund-app-2025",
  storageBucket: "vat-refund-app-2025.firebasestorage.app",
  messagingSenderId: "202816087172",
  appId: "1:202816087172:web:3d8946d91f2093c7ba8ed1"
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
