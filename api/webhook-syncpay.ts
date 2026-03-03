import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/firebase';
import { doc, getDoc, writeBatch, collection, query, where, getDocs, increment, serverTimestamp, arrayUnion, setDoc } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status, external_id } = req.body;

  if (status !== "paid") {
    return res.json({ received: true });
  }

  try {
    const paymentRef = doc(db, "payments", external_id);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists() || paymentSnap.data()?.status === "paid") {
      return res.json({ received: true });
    }

    const { raffleId, numbers, buyer, amount } = paymentSnap.data()!;

    const batch = writeBatch(db);
    const raffleRef = doc(db, "raffles", raffleId);
    const numbersRef = collection(raffleRef, "numbers");

    const q = query(numbersRef, where("number", "in", numbers));
    const selectedNumbersSnap = await getDocs(q);
    
    for (const docSnap of selectedNumbersSnap.docs) {
      batch.update(docSnap.ref, {
        status: 'sold',
        buyer_name: buyer.name,
        buyer_whatsapp: buyer.whatsapp,
        buyer_instagram: buyer.instagram || null,
        updated_at: serverTimestamp()
      });
    }

    batch.update(raffleRef, {
      sold_count: increment(numbers.length),
      revenue: increment(amount),
      updated_at: serverTimestamp()
    });

    batch.update(paymentRef, {
      status: "paid",
      paid_at: serverTimestamp()
    });

    // Associate numbers with user
    const userRef = doc(db, "users", buyer.whatsapp);
    batch.set(userRef, {
      purchases: arrayUnion({
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
