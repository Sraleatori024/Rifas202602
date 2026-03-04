import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

import { generateToken, createCashIn } from "./lib/syncpayments";

dotenv.config();

// Initialize Firebase Admin is now handled in lib/firebase-admin.ts

async function startServer() {
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
    
    if (!raffleId || !numbers || !buyer || !buyer.whatsapp || !buyer.name) {
      return res.status(400).json({ error: "Dados incompletos (Nome e WhatsApp são obrigatórios)" });
    }

    try {
      // 1. Handle User (Simple System)
      const userRef = db.collection("users").doc(buyer.whatsapp);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        await userRef.set({
          name: buyer.name,
          whatsapp: buyer.whatsapp,
          instagram: buyer.instagram || "",
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const raffleRef = db.collection("raffles").doc(raffleId);
      const raffleSnap = await raffleRef.get();
      
      if (!raffleSnap.exists) {
        return res.status(404).json({ error: "Rifa não encontrada." });
      }

      const raffleData = raffleSnap.data();
      const unitPrice = raffleData.price || 0;
      const totalAmount = numbers.length * unitPrice;

      // 2. Create a pending payment record
      const paymentRef = db.collection("payments").doc();
      const externalId = paymentRef.id;

      // 3. Get Auth Token from SyncPayments
      let accessToken;
      try {
        accessToken = await generateToken();
      } catch (authError: any) {
        console.error("SyncPayments Auth Error:", authError.message);
        return res.status(401).json({ 
          error: "Erro ao autenticar na SyncPayments", 
          details: authError.message 
        });
      }

      // 4. Create Cash-In using the token
      const cashInData = {
        amount: totalAmount,
        description: `Rifa: ${raffleData.name} - ${numbers.length} números`,
        webhook_url: `${process.env.APP_URL}/api/webhook-syncpay`,
        client: {
          name: buyer.name,
          cpf: buyer.document || buyer.cpf || "000.000.000-00",
          email: buyer.email || "cliente@exemplo.com",
          phone: buyer.whatsapp
        },
        split: [],
        external_id: externalId 
      };

      let syncPayData;
      try {
        syncPayData = await createCashIn(accessToken, cashInData);
      } catch (apiError: any) {
        console.error("SyncPayments API Error:", apiError.details || apiError.message);
        return res.status(apiError.status || 500).json({
          error: "Erro ao gerar cobrança na SyncPayments",
          details: apiError.details || apiError.message
        });
      }

      // 5. Save pending payment info
      await paymentRef.set({
        raffleId,
        numbers,
        buyer,
        amount: totalAmount,
        status: "pending",
        syncpay_id: syncPayData.id,
        pix_qrcode: syncPayData.pix_qrcode,
        pix_copy_paste: syncPayData.pix_copy_paste,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // 6. Return PIX data to frontend
      res.json({ 
        success: true, 
        pix_qrcode: syncPayData.pix_qrcode,
        pix_copy_paste: syncPayData.pix_copy_paste,
        payment_id: externalId
      });

    } catch (error: any) {
      console.error("Erro ao criar pagamento:", error);
      res.status(500).json({ error: "Erro interno ao processar pagamento.", details: error.message });
    }
  });

  // Webhook SyncPay
  app.post("/api/webhook-syncpay", async (req, res) => {
    const { status, external_id } = req.body;

    console.log(`Webhook received: Payment ${external_id} status is ${status}`);

    if (status !== "paid") {
      return res.json({ received: true });
    }

    if (!external_id) {
      console.error("Webhook Error: external_id missing");
      return res.status(400).json({ error: "external_id missing" });
    }

    try {
      const paymentRef = db.collection("payments").doc(external_id);
      const paymentSnap = await paymentRef.get();

      if (!paymentSnap.exists) {
        console.error(`Webhook Error: Payment ${external_id} not found in database.`);
        return res.status(404).json({ error: "Pagamento não encontrado" });
      }

      if (paymentSnap.data().status === "paid") {
        console.log(`Webhook: Payment ${external_id} already processed.`);
        return res.json({ received: true });
      }

      const { raffleId, numbers, buyer, amount } = paymentSnap.data();

      const batch = db.batch();
      const raffleRef = db.collection("raffles").doc(raffleId);
      const numbersRef = raffleRef.collection("numbers");

      // Update numbers to 'sold'
      // Note: Firestore 'in' query limit is 30. If numbers > 30, we need to handle it.
      // For simplicity in this demo, we assume numbers.length <= 30 or we process in chunks.
      const numbersChunks = [];
      for (let i = 0; i < numbers.length; i += 30) {
        numbersChunks.push(numbers.slice(i, i + 30));
      }

      for (const chunk of numbersChunks) {
        const selectedNumbersSnap = await numbersRef.where("number", "in", chunk).get();
        for (const doc of selectedNumbersSnap.docs) {
          batch.update(doc.ref, {
            status: 'sold',
            buyer_name: buyer.name,
            buyer_whatsapp: buyer.whatsapp,
            buyer_instagram: buyer.instagram || null,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // Update raffle stats
      batch.update(raffleRef, {
        sold_count: admin.firestore.FieldValue.increment(numbers.length),
        revenue: admin.firestore.FieldValue.increment(amount),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Mark payment as paid
      batch.update(paymentRef, {
        status: "paid",
        paid_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Associate numbers with user
      const userRef = db.collection("users").doc(buyer.whatsapp);
      batch.set(userRef, {
        purchases: admin.firestore.FieldValue.arrayUnion({
          raffleId,
          numbers,
          paid_at: new Date().toISOString()
        })
      }, { merge: true });

      await batch.commit();
      console.log(`Payment ${external_id} processed successfully. Numbers: ${numbers.join(', ')}`);
      res.json({ success: true });

    } catch (error: any) {
      console.error("Webhook Error:", error);
      res.status(500).json({ error: "Erro ao processar webhook.", details: error.message });
    }
  });

  // Consultar Números
  app.post("/api/consultar-numeros", async (req, res) => {
    const { whatsapp } = req.body;
    if (!whatsapp) return res.status(400).json({ error: "WhatsApp é obrigatório" });

    try {
      const userRef = db.collection("users").doc(whatsapp);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const userData = userSnap.data()!;
      const purchases = userData.purchases || [];
      const enrichedPurchases = await Promise.all(purchases.map(async (p: any) => {
        const raffleSnap = await db.collection("raffles").doc(p.raffleId).get();
        return {
          ...p,
          raffleName: raffleSnap.exists ? raffleSnap.data()?.name : "Rifa Excluída"
        };
      }));

      res.json({
        success: true,
        name: userData.name,
        whatsapp: userData.whatsapp,
        instagram: userData.instagram,
        purchases: enrichedPurchases
      });
    } catch (error) {
      console.error("Consult Error:", error);
      res.status(500).json({ error: "Erro ao consultar números." });
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
