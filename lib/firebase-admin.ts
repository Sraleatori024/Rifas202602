import admin from 'firebase-admin';

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!admin.apps.length && privateKey && clientEmail && projectId) {
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
}

export const db = admin.firestore();
export const auth = admin.auth();
export { admin };
