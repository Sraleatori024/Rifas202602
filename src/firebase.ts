import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBrTOti9UT1QitgoJChdKxEtLrJ0I_vuzo",
  authDomain: "rifas-2026-c4026.firebaseapp.com",
  projectId: "rifas-2026-c4026",
  storageBucket: "rifas-2026-c4026.firebasestorage.app",
  messagingSenderId: "1002445201482",
  appId: "1:1002445201482:web:b2685da1150758021446b3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
