import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBrTOti9UT1QitgoJChdKxEtLrJ0I_vuzo",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "rifas-2026-c4026.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "rifas-2026-c4026",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "rifas-2026-c4026.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1002445201482",
  appId: process.env.FIREBASE_APP_ID || "1:1002445201482:web:b2685da1150758021446b3",
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
