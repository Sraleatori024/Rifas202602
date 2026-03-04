import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, admin } from '../lib/firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, external_id } = req.body;

  if (status !== "paid") {
    return res.json({ received: true });
  }

  try {
    const paymentRef = db.collection("payments").doc(external_id);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists || paymentSnap.data()?.status === "paid") {
      return res.json({ received: true });
    }

    const { raffleId, numbers, buyer, amount } = paymentSnap.data()!;

    const batch = db.batch();
    const raffleRef = db.collection("raffles").doc(raffleId);
    const numbersRef = raffleRef.collection("numbers");

    const selectedNumbersSnap = await numbersRef.where("number", "in", numbers).get();
    
    for (const docSnap of selectedNumbersSnap.docs) {
      batch.update(docSnap.ref, {
        status: 'sold',
        buyer_name: buyer.name,
        buyer_whatsapp: buyer.whatsapp,
        buyer_instagram: buyer.instagram || null,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    batch.update(raffleRef, {
      sold_count: admin.firestore.FieldValue.increment(numbers.length),
      revenue: admin.firestore.FieldValue.increment(amount),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

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
    res.json({ success: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Erro ao processar webhook." });
  }
}
