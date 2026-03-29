import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

let firebaseConfig: any = {};
try {
  const configPath = join(process.cwd(), 'firebase-applet-config.json');
  firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (e) {
  console.warn("Aviso: Não foi possível carregar firebase-applet-config.json");
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;

let db: admin.firestore.Firestore | undefined;
let auth: admin.auth.Auth | undefined;

if (!admin.apps.length) {
  console.log("Iniciando inicialização do Firebase Admin...");
  try {
    if (privateKey && clientEmail && projectId) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("Firebase Admin inicializado com credenciais explícitas.");
    } else if (projectId) {
      // Tenta inicializar sem credenciais explícitas (útil em ambientes Google Cloud)
      admin.initializeApp({
        projectId: projectId
      });
      console.log(`Firebase Admin inicializado com configuração padrão para o projeto: ${projectId}`);
    } else {
      console.error("Erro: Project ID não encontrado. Firebase Admin não pôde ser inicializado.");
    }
  } catch (error) {
    console.error("Erro ao inicializar Firebase Admin:", error);
  }
}

if (admin.apps.length) {
  db = admin.firestore();
  auth = admin.auth();
  console.log("Instâncias de Firestore e Auth obtidas com sucesso.");
} else {
  console.error("Erro: admin.apps.length é 0 após tentativa de inicialização.");
}

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
 
