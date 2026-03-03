import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_firebase';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, external_id } = req.body;
  const db = getDb();

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
    for (const doc of selectedNumbersSnap.docs) {
      batch.update(doc.ref, {
        status: 'sold',
        buyer_name: buyer.name,
        buyer_whatsapp: buyer.whatsapp,
        buyer_instagram: buyer.instagram || null,
        updated_at: FieldValue.serverTimestamp()
      });
    }

    batch.update(raffleRef, {
      sold_count: FieldValue.increment(numbers.length),
      revenue: FieldValue.increment(amount),
      updated_at: FieldValue.serverTimestamp()
    });

    batch.update(paymentRef, {
      status: "paid",
      paid_at: FieldValue.serverTimestamp()
    });

    // Associate numbers with user
    const userRef = db.collection("users").doc(buyer.whatsapp);
    batch.set(userRef, {
      purchases: FieldValue.arrayUnion({
        raffleId,
        numbers,
        paid_at: new Date().toISOString()
      })
    }, { merge: true });

    await batch.commit();
    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: "Erro ao processar webhook." });
  }
}
