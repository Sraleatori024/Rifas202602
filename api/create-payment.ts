import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../lib/firebase.js';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { raffleId, numbers, buyer } = req.body;

  if (!raffleId || !numbers || !buyer || !buyer.whatsapp || !buyer.name) {
    return res.status(400).json({ error: "Dados incompletos (Nome e WhatsApp são obrigatórios)" });
  }

  const clientId = process.env.SYNC_CLIENT_ID;
  const clientSecret = process.env.SYNC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Configuração de pagamento (SyncPayments) ausente no servidor." });
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
    const authResponse = await fetch(
      "https://api.syncpayments.com.br/api/partner/v1/auth-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );

    if (!authResponse.ok) {
      throw new Error("Erro ao autenticar na SyncPayments");
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // 4. Create PIX using the token
    // Note: Using the SyncPayments PIX endpoint
    const syncPayResponse = await fetch("https://api.syncpayments.com.br/api/partner/v1/pix", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: totalAmount,
        description: `Rifa: ${raffleData.name} - ${numbers.length} números`,
        external_id: externalId,
        webhook_url: `${process.env.APP_URL}/api/webhook-syncpay`,
        customer: {
          name: buyer.name,
          email: buyer.email || "cliente@exemplo.com",
          document: buyer.document || "000.000.000-00"
        }
      })
    });

    const syncPayData: any = await syncPayResponse.json();

    if (!syncPayResponse.ok) {
      console.error("SyncPay Error:", syncPayData);
      return res.status(500).json({ error: "Erro ao gerar PIX na SyncPayments." });
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

  } catch (error) {
    console.error("Error in create-payment:", error);
    res.status(500).json({ error: "Erro interno ao processar pagamento." });
  }
}
