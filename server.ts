import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import * as admin from "firebase-admin";

dotenv.config();

// Initialize Firebase Admin
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: "rifas-2026-c4026",
    });
    console.log("Firebase Admin initialized successfully");
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

let db: admin.firestore.Firestore;

async function startServer() {
  try {
    db = admin.firestore();
  } catch (e) {
    console.error("Failed to initialize Firestore:", e);
  }

  const app = express();
  app.use(express.json());

  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- API ROUTES ---

  // Payment Simulation (Sync Pay)
  app.post("/api/create-payment", async (req, res) => {
    const { raffleId, numbers, buyer } = req.body;
    
    if (!raffleId || !numbers || !buyer) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const syncPayKey = process.env.SYNC_PAY_KEY;
    // In a real scenario, we'd call Sync Pay API here
    // const response = await fetch('https://api.syncpay.com/v1/payments', { ... });
    
    // For this demo, we'll simulate a successful payment and update Firestore
    try {
      const batch = db.batch();
      const raffleRef = db.collection("raffles").doc(raffleId);
      const numbersRef = raffleRef.collection("numbers");

      // Check if numbers are still available
      const selectedNumbersSnap = await numbersRef.where("number", "in", numbers).get();
      
      for (const doc of selectedNumbersSnap.docs) {
        if (doc.data().status !== 'available') {
          return res.status(400).json({ error: `Número ${doc.data().number} já não está disponível.` });
        }
        batch.update(doc.ref, {
          status: 'sold',
          buyer_name: buyer.name,
          buyer_whatsapp: buyer.whatsapp,
          buyer_instagram: buyer.instagram || null,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();
      res.json({ success: true, message: "Pagamento confirmado e números reservados!" });
    } catch (error: any) {
      console.error("Erro ao processar pagamento:", error);
      res.status(500).json({ error: "Erro ao processar pagamento no servidor" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
