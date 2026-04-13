import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log("-----------------------------------------");
  console.log("[API Webhook] Recebido em:", new Date().toISOString());
  console.log("[API Webhook] Payload completo:", JSON.stringify(req.body, null, 2));

  const data = req.body;
  const status = data?.status || data?.data?.status || data?.payment?.status;
  const external_id = data?.external_id || data?.data?.external_id || data?.payment?.external_id;
  const gateway_id = data?.id || data?.data?.id || data?.payment?.id;

  console.log(`[API Webhook] Status extraído: ${status}`);
  console.log(`[API Webhook] External ID extraído: ${external_id}`);
  console.log(`[API Webhook] Gateway ID extraído: ${gateway_id}`);

  if (!external_id) {
    console.error("[API Webhook Erro] external_id não encontrado no payload.");
    return res.status(400).json({ error: "external_id missing" });
  }

  const normalizedStatus = String(status || "").toLowerCase().trim();
  const isSuccess = ["paid", "approved", "completed", "sucesso", "pago"].includes(normalizedStatus);

  if (!isSuccess) {
    console.log(`[API Webhook] Status '${status}' ignorado.`);
    return res.json({ received: true, message: `Status ${status} ignorado` });
  }

  try {
    const db = getDb();
    const paymentRef = db.collection("compras").doc(String(external_id));
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      console.error(`[API Webhook Erro] Compra ${external_id} não encontrada.`);
      const querySnapshot = await db.collection("compras").where("identifier", "==", String(external_id)).limit(1).get();
      
      if (querySnapshot.empty) {
        return res.status(404).json({ error: "Compra não encontrada" });
      }
      
      const doc = querySnapshot.docs[0];
      await processPayment(doc, res);
      return;
    }

    await processPayment(paymentSnap, res);
  } catch (error: any) {
    console.error("[API Webhook Erro Crítico]:", error.message || String(error));
    res.status(500).json({ error: "Erro ao processar webhook." });
  }
}

async function processPayment(docSnap: any, res: VercelResponse) {
  const db = getDb();
  const data = docSnap.data();
  const paymentId = docSnap.id;
  
  if (data?.status === "pago") {
    return res.json({ 
      success: true, 
      message: "Pagamento já confirmado! Boa sorte 🍀" 
    });
  }

  const { rifaId, numero, nome, telefone, valor } = data!;

  const batch = db.batch();
  const raffleRef = db.collection("raffles").doc(rifaId);
  const numbersRef = raffleRef.collection("numbers");

  console.log(`Webhook: Confirmando ${numero.length} números para a rifa ${rifaId}`);

  // Handle large number of numbers by chunking
  const numbersChunks = [];
  for (let i = 0; i < numero.length; i += 30) {
    numbersChunks.push(numero.slice(i, i + 30));
  }

  for (const chunk of numbersChunks) {
    const selectedNumbersSnap = await numbersRef.where("number", "in", chunk).get();
    for (const docSnap of selectedNumbersSnap.docs) {
      batch.update(docSnap.ref, {
        status: 'pago',
        buyer_name: nome,
        buyer_whatsapp: telefone,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  batch.update(raffleRef, {
    sold_count: admin.firestore.FieldValue.increment(numero.length),
    revenue: admin.firestore.FieldValue.increment(Number(valor || 0)),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  batch.update(docSnap.ref, {
    status: "paid",
    paid_at: admin.firestore.FieldValue.serverTimestamp()
  });

  // Associate numbers with user
  const userRef = db.collection("users").doc(telefone);
  batch.set(userRef, {
    name: nome,
    whatsapp: telefone,
    purchases: admin.firestore.FieldValue.arrayUnion({
      rifaId,
      numero,
      paid_at: new Date().toISOString()
    })
  }, { merge: true });

  await batch.commit();
  console.log(`Webhook: Pagamento ${paymentId} processado com sucesso.`);
  res.json({ 
    success: true, 
    message: "Pagamento confirmado! Boa sorte 🍀" 
  });
}
