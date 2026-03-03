import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let app: App;
let db: Firestore;

export function getDb(): Firestore {
  if (!getApps().length) {
    app = initializeApp({
      projectId: "rifas-2026-c4026",
    });
  } else {
    app = getApps()[0];
  }
  
  if (!db) {
    db = getFirestore(app);
  }
  
  return db;
}
