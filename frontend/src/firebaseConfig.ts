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
  authDomain: "eu-vat-refund-app-2025.firebaseapp.com",
  projectId: "eu-vat-refund-app-2025",
  storageBucket: "eu-vat-refund-app-2025.appspot.com",
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

// Connect to emulators in development
if (import.meta.env.DEV) {
  try {
    // Connect to emulators (only in development)
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
    connectStorageEmulator(storage, 'localhost', 9199);
    
    console.log('🔧 Connected to Firebase emulators');
  } catch (error) {
    // Emulators might already be connected, this is normal on hot reload
    console.warn('⚠️ Emulators connection warning (likely already connected)');
  }
}

export default app;
