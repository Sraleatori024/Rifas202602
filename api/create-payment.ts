import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/firebase.js';
import { generateToken, createCashIn } from '../lib/syncpayments.js';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { raffleId, numbers, buyer } = req.body;

  if (!raffleId || !numbers || !buyer || !buyer.whatsapp || !buyer.name) {
    return res.status(400).json({ error: "Dados incompletos (Nome e WhatsApp são obrigatórios)" });
  }

  try {
    // 1. Handle User (Simple System)
    const userRef = doc(db, "users", buyer.whatsapp);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        name: buyer.name,
        whatsapp: buyer.whatsapp,
        instagram: buyer.instagram || "",
        created_at: serverTimestamp()
      });
    }

    const raffleRef = doc(db, "raffles", raffleId);
    const raffleSnap = await getDoc(raffleRef);
    
    if (!raffleSnap.exists()) {
      return res.status(404).json({ error: "Rifa não encontrada." });
    }

    const raffleData = raffleSnap.data()!;
    const unitPrice = raffleData.price || 0;
    const totalAmount = numbers.length * unitPrice;

    // 2. Create a pending payment record
    const paymentRef = doc(collection(db, "payments"));
    const externalId = paymentRef.id;

    // 3. Get Auth Token from SyncPayments
    let accessToken;
    try {
      accessToken = await generateToken();
    } catch (authError: any) {
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
      split: [], // Added split field as requested in structure
      external_id: externalId 
    };

    let syncPayData;
    try {
      syncPayData = await createCashIn(accessToken, cashInData);
    } catch (apiError: any) {
      return res.status(apiError.status || 500).json({
        error: "Erro ao gerar cobrança na SyncPayments",
        details: apiError.details || apiError.message
      });
    }

    // 5. Save payment to Firebase
    await setDoc(paymentRef, {
      raffleId,
      numbers,
      buyer,
      amount: totalAmount,
      status: "pending",
      syncpay_id: syncPayData.id,
      pix_qrcode: syncPayData.pix_qrcode,
      pix_copy_paste: syncPayData.pix_copy_paste,
      created_at: serverTimestamp()
    });

    res.json({ 
      success: true, 
      pix_qrcode: syncPayData.pix_qrcode,
      pix_copy_paste: syncPayData.pix_copy_paste,
      payment_id: externalId
    });

  } catch (error: any) {
    console.error("Error in create-payment:", error);
    res.status(500).json({ error: "Erro interno ao processar pagamento.", details: error.message });
  }
}

