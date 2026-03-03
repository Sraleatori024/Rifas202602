import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

dotenv.config();

// Initialize Firebase Admin
try {
  if (!getApps().length) {
    initializeApp({
      projectId: "rifas-2026-c4026",
    });
    console.log("Firebase Admin initialized successfully");
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

let db: any;

async function startServer() {
  try {
    db = getFirestore();
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

  // Create Payment (SyncPay PIX)
  app.post("/api/create-payment", async (req, res) => {
    const { raffleId, numbers, buyer } = req.body;
    
    if (!raffleId || !numbers || !buyer) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const secretKey = process.env.SYNCPAY_SECRET_KEY;
    if (!secretKey) {
      console.error("SYNCPAY_SECRET_KEY not found in environment variables");
      return res.status(500).json({ error: "Configuração de pagamento ausente no servidor." });
    }

    try {
      const raffleRef = db.collection("raffles").doc(raffleId);
      const raffleSnap = await raffleRef.get();
      
      if (!raffleSnap.exists) {
        return res.status(404).json({ error: "Rifa não encontrada." });
      }

      const raffleData = raffleSnap.data();
      const unitPrice = raffleData.price || 0;
      const totalAmount = numbers.length * unitPrice;

      // 1. Create a pending payment record in Firestore
      const paymentRef = db.collection("payments").doc();
      const externalId = paymentRef.id;

      // 2. Call SyncPay API (Real Integration)
      // Note: Using a standard PIX gateway pattern
      const syncPayResponse = await fetch("https://api.syncpay.com.br/v1/pix", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: totalAmount,
          description: `Rifa: ${raffleData.name} - ${numbers.length} números`,
          external_id: externalId,
          webhook_url: `${process.env.APP_URL}/api/webhook-syncpay`,
          customer: {
            name: buyer.name,
            email: buyer.email || "cliente@exemplo.com", // Fallback if email not provided
            document: buyer.document || "000.000.000-00" // Fallback
          }
        })
      });

      const syncPayData = await syncPayResponse.json();

      if (!syncPayResponse.ok) {
        console.error("SyncPay API Error:", syncPayData);
        return res.status(500).json({ error: "Erro ao gerar PIX na SyncPay." });
      }

      // 3. Save pending payment info
      await paymentRef.set({
        raffleId,
        numbers,
        buyer,
        amount: totalAmount,
        status: "pending",
        syncpay_id: syncPayData.id,
        pix_qrcode: syncPayData.pix_qrcode, // Base64 or URL
        pix_copy_paste: syncPayData.pix_copy_paste,
        created_at: FieldValue.serverTimestamp()
      });

      // 4. Return PIX data to frontend
      res.json({ 
        success: true, 
        pix_qrcode: syncPayData.pix_qrcode,
        pix_copy_paste: syncPayData.pix_copy_paste,
        payment_id: externalId
      });

    } catch (error: any) {
      console.error("Erro ao criar pagamento:", error);
      res.status(500).json({ error: "Erro interno ao processar pagamento." });
    }
  });

  // Webhook SyncPay
  app.post("/api/webhook-syncpay", async (req, res) => {
    const { status, external_id } = req.body;

    console.log(`Webhook received: Payment ${external_id} status is ${status}`);

    if (status !== "paid") {
      return res.json({ received: true });
    }

    try {
      const paymentRef = db.collection("payments").doc(external_id);
      const paymentSnap = await paymentRef.get();

      if (!paymentSnap.exists || paymentSnap.data().status === "paid") {
        return res.json({ received: true });
      }

      const { raffleId, numbers, buyer, amount } = paymentSnap.data();

      const batch = db.batch();
      const raffleRef = db.collection("raffles").doc(raffleId);
      const numbersRef = raffleRef.collection("numbers");

      // Update numbers to 'sold'
      const selectedNumbersSnap = await numbersRef.where("number", "in", numbers).get();
      for (const doc of selectedNumbersSnap.docs) {
        batch.update(doc.ref, {
          status: 'sold',
          buyer_name: buyer.name,
          buyer_whatsapp: buyer.whatsapp,
          buyer_instagram: buyer.instagram || null,
          updated_at: FieldValue.serverTimestamp()
        });
      }

      // Update raffle stats
      batch.update(raffleRef, {
        sold_count: FieldValue.increment(numbers.length),
        revenue: FieldValue.increment(amount),
        updated_at: FieldValue.serverTimestamp()
      });

      // Mark payment as paid
      batch.update(paymentRef, {
        status: "paid",
        paid_at: FieldValue.serverTimestamp()
      });

      await batch.commit();
      console.log(`Payment ${external_id} processed successfully.`);
      res.json({ success: true });

    } catch (error) {
      console.error("Webhook Error:", error);
      res.status(500).json({ error: "Erro ao processar webhook." });
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
