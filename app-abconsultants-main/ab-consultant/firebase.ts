
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

// Config web Firebase publique (apiKey/authDomain/etc. ne sont PAS des secrets :
// ils identifient le projet, la sécurité vient des règles Firestore + Auth).
// On la garde en REPLI pour que tout build ait une config valide même si les
// VITE_FIREBASE_* ne sont pas injectées (ex : build CI GitHub Actions).
// → évite la page blanche "auth/invalid-api-key" sur app-ab-consultant.web.app.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBhh58vbDKjg9qdSAZPAa6Sc0uOml1rdhM',
  authDomain: 'app-ab-consultant.firebaseapp.com',
  projectId: 'app-ab-consultant',
  storageBucket: 'app-ab-consultant.firebasestorage.app',
  messagingSenderId: '1024002919552',
  appId: '1:1024002919552:web:e922145a299ba2fb35aa65',
};

// Les variables d'environnement (VITE_...) restent prioritaires si présentes.
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || DEFAULT_FIREBASE_CONFIG.appId,
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
