import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, admin } from '../lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, external_id, id } = req.body;
  const paymentId = external_id || id;

  if (status !== "paid") {
    return res.json({ received: true });
  }

  if (!paymentId) {
    console.error("Webhook Error: payment identifier missing (external_id or id)");
    return res.status(400).json({ error: "payment identifier missing" });
  }

  try {
    const paymentRef = db.collection("compras").doc(paymentId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      console.error(`Webhook Error: Compra ${paymentId} not found in database.`);
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    if (paymentSnap.data()?.status === "paid") {
      return res.json({ 
        success: true, 
        message: "Pagamento já confirmado! Boa sorte 🍀" 
      });
    }

    const { rifaId, numero, nome, telefone, valor } = paymentSnap.data()!;

    const batch = db.batch();
    const raffleRef = db.collection("raffles").doc(rifaId);
    const numbersRef = raffleRef.collection("numbers");

    // Handle large number of numbers by chunking
    const numbersChunks = [];
    for (let i = 0; i < numero.length; i += 30) {
      numbersChunks.push(numero.slice(i, i + 30));
    }

    for (const chunk of numbersChunks) {
      const selectedNumbersSnap = await numbersRef.where("number", "in", chunk).get();
      for (const docSnap of selectedNumbersSnap.docs) {
        batch.update(docSnap.ref, {
          status: 'confirmed',
          buyer_name: nome,
          buyer_whatsapp: telefone,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    batch.update(raffleRef, {
      sold_count: admin.firestore.FieldValue.increment(numero.length),
      revenue: admin.firestore.FieldValue.increment(valor),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    batch.update(paymentRef, {
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
    res.json({ 
      success: true, 
      message: "Pagamento confirmado! Boa sorte 🍀" 
    });

  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Erro ao processar webhook." });
  }
}
