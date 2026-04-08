import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, external_id, id } = req.body;
  const paymentId = external_id || id;

  const normalizedStatus = String(status || "").toLowerCase();
  // SyncPay can send 'paid', 'approved', or 'completed' for successful payments
  const isSuccess = ["paid", "approved", "completed", "sucesso", "pago"].includes(normalizedStatus);

  if (!isSuccess) {
    console.log(`[Webhook] Status ignorado: ${status}`);
    return res.json({ received: true, message: `Status ${status} ignorado` });
  }

  if (!paymentId) {
    console.error("Webhook Error: payment identifier missing (external_id or id)");
    return res.status(400).json({ error: "payment identifier missing" });
  }

  try {
    const db = getDb();
    console.log(`Webhook: Processando pagamento ${paymentId} com status ${status}`);
    const paymentRef = db.collection("compras").doc(paymentId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      console.error(`Webhook Error: Compra ${paymentId} not found in database.`);
      // Tentar buscar por external_id se o ID do documento for diferente
      const querySnapshot = await db.collection("compras").where("identifier", "==", paymentId).get();
      if (querySnapshot.empty) {
        return res.status(404).json({ error: "Compra não encontrada" });
      }
      // Se encontrou pela query, usar o primeiro documento
      const doc = querySnapshot.docs[0];
      console.log(`Webhook: Compra encontrada via query identifier: ${doc.id}`);
      // Continuar com o documento encontrado
      await processPayment(doc, res);
      return;
    }

    await processPayment(paymentSnap, res);
  } catch (error) {
    console.error("Webhook Error:", error);
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
