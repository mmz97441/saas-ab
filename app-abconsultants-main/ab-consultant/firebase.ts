
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Helper to properly get env vars in various environments (Vite, etc.)
const getEnv = (key: string) => {
  // Check import.meta.env (Vite standard)
  if (import.meta && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  // Check process.env (Compatibility / DefinePlugin)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return "";
};

// Configuration via Variables d'Environnement (VITE_...)
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Vérification de sécurité pour le développement
if (!firebaseConfig.apiKey) {
  console.warn("Firebase Config Warning: API Key might be missing. Check .env file.");
}

// Initialisation de l'application (Modular)
const app = initializeApp(firebaseConfig);

// Export des services pour utilisation dans l'app (Instances Modular)
export const auth = getAuth(app);
export const db = getFirestore(app);
