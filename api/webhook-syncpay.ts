import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, admin } from '../lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, external_id } = req.body;

  if (status !== "paid") {
    return res.json({ received: true });
  }

  try {
    const paymentRef = db.collection("compras").doc(external_id);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists || paymentSnap.data()?.status === "paid") {
      return res.json({ received: true });
    }

    const { rifaId, numero, nome, telefone, valor } = paymentSnap.data()!;

    const batch = db.batch();
    const raffleRef = db.collection("raffles").doc(rifaId);
    const numbersRef = raffleRef.collection("numbers");

    const selectedNumbersSnap = await numbersRef.where("number", "in", numero).get();
    
    for (const docSnap of selectedNumbersSnap.docs) {
      batch.update(docSnap.ref, {
        status: 'confirmed',
        buyer_name: nome,
        buyer_whatsapp: telefone,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
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
    res.json({ success: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Erro ao processar webhook." });
  }
}
