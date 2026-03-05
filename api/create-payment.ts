import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, admin } from '../lib/firebase-admin';

async function generateToken() {
  const clientId = process.env.SYNC_CLIENT_ID;
  const clientSecret = process.env.SYNC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Configuração de API SyncPayments (SYNC_CLIENT_ID ou SYNC_CLIENT_SECRET) ausente.");
  }

  const response = await fetch("https://api.syncpayments.com.br/api/partner/v1/auth-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro ao gerar token SyncPayments:", errorText);
    throw new Error(`Falha na autenticação SyncPayments: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Resposta da SyncPayments não contém access_token.");
  }

  return data.access_token;
}

async function createCashIn(token: string, data: any) {
  if (!token) {
    throw new Error("Token de acesso é obrigatório para criar Cash-In.");
  }

  const response = await fetch("https://api.syncpayments.com.br/api/partner/v1/cash-in", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error("Erro ao criar Cash-In SyncPayments:", responseData);
    const error: any = new Error("Erro na API SyncPayments");
    error.status = response.status;
    error.details = responseData;
    throw error;
  }

  return responseData;
}

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
    const userRef = db.collection("users").doc(buyer.whatsapp);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      await userRef.set({
        name: buyer.name,
        whatsapp: buyer.whatsapp,
        instagram: buyer.instagram || "",
        created_at: admin.firestore.FieldValue.serverTimestamp()
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

    // 2. Create a pending payment record
    const paymentRef = db.collection("payments").doc();
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
    await paymentRef.set({
      raffleId,
      numbers,
      buyer,
      amount: totalAmount,
      status: "pending",
      syncpay_id: syncPayData.id,
      pix_qrcode: syncPayData.pix_qrcode,
      pix_copy_paste: syncPayData.pix_copy_paste,
      created_at: admin.firestore.FieldValue.serverTimestamp()
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

