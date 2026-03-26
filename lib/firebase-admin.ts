import admin from 'firebase-admin';

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID;

let db: admin.firestore.Firestore | undefined;
let auth: admin.auth.Auth | undefined;

if (!admin.apps.length) {
  if (privateKey && clientEmail && projectId) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("Firebase Admin inicializado com sucesso.");
    } catch (error) {
      console.error("Erro ao inicializar Firebase Admin:", error);
    }
  } else {
    console.warn("Firebase Admin não inicializado: Credenciais ausentes (FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID).");
  }
}

if (admin.apps.length) {
  db = admin.firestore();
  auth = admin.auth();
}

// Use a getter or handle the case where it's not initialized
export const getDb = () => {
  if (!db) {
    throw new Error("Firebase Admin não inicializado. Verifique as variáveis de ambiente.");
  }
  return db;
};

export const getAuth = () => {
  if (!auth) {
    throw new Error("Firebase Admin não inicializado. Verifique as variáveis de ambiente.");
  }
  return auth;
};

export { admin };
export { db, auth }; 
