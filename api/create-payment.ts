import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_firebase';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { raffleId, numbers, buyer } = req.body;
  const db = getDb();

  if (!raffleId || !numbers || !buyer || !buyer.whatsapp || !buyer.name) {
    return res.status(400).json({ error: "Dados incompletos (Nome e WhatsApp são obrigatórios)" });
  }

  const secretKey = process.env.SYNCPAY_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: "Configuração de pagamento ausente no servidor." });
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
        created_at: FieldValue.serverTimestamp()
      });
    }

    const raffleRef = db.collection("raffles").doc(raffleId);
    const raffleSnap = await raffleRef.get();
    
    if (!raffleSnap.exists) {
      return res.status(404).json({ error: "Rifa não encontrada." });
    }

    const raffleData = raffleSnap.data()!;
    const unitPrice = raffleData.price || 0;
    const totalAmount = numbers.length * unitPrice;

    const paymentRef = db.collection("payments").doc();
    const externalId = paymentRef.id;

    const syncPayResponse = await fetch("https://api.syncpay.com.br/v1/pix", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
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
      return res.status(500).json({ error: "Erro ao gerar PIX na SyncPay." });
    }

    await paymentRef.set({
      raffleId,
      numbers,
      buyer,
      amount: totalAmount,
      status: "pending",
      syncpay_id: syncPayData.id,
      pix_qrcode: syncPayData.pix_qrcode,
      pix_copy_paste: syncPayData.pix_copy_paste,
      created_at: FieldValue.serverTimestamp()
    });

    res.json({ 
      success: true, 
      pix_qrcode: syncPayData.pix_qrcode,
      pix_copy_paste: syncPayData.pix_copy_paste,
      payment_id: externalId
    });

  } catch (error) {
    res.status(500).json({ error: "Erro interno ao processar pagamento." });
  }
}
