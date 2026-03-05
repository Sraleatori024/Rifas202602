import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, admin } from '../lib/firebase-admin.js';

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

  try {
    if (!req.body) {
      return res.status(400).json({ error: "Body vazio." });
    }

    const { raffleId, numbers, buyer } = req.body;

    if (!raffleId || !numbers || !buyer) {
      return res.status(400).json({ error: "Dados da requisição inválidos." });
    }

    if (!buyer.whatsapp) {
      return res.status(400).json({ error: "WhatsApp do comprador inválido." });
    }

    // 1. Handle User (Simple System)
    const userRef = db.collection("users").doc(buyer.whatsapp);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      await userRef.set({
        name: buyer.name || "Cliente",
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
    // SyncPayments usually expects amount in cents (integer)
    const amountInCents = Math.round(totalAmount * 100);

    const cashInData = {
      amount: amountInCents,
      description: `Rifa: ${raffleData.name || "Rifa"} - ${numbers.length} números`,
      webhook_url: `${process.env.APP_URL}/api/webhook-syncpay`,
      client: {
        name: buyer.name || "Cliente",
        phone: buyer.whatsapp,
        email: buyer.email || "cliente@exemplo.com",
        cpf: (buyer.cpf || buyer.document || "000.000.000-00").replace(/\D/g, '')
      },
      external_id: externalId,
      payment_method: "pix" // Explicitly set payment method if required
    };

    let syncPayData;
    try {
      syncPayData = await createCashIn(accessToken, cashInData);
      console.log("SYNC FULL RESPONSE:", JSON.stringify(syncPayData, null, 2));
    } catch (apiError: any) {
      return res.status(apiError.status || 500).json({
        error: "Erro ao gerar cobrança na SyncPayments",
        details: apiError.details || apiError.message
      });
    }

    if (!syncPayData) {
      throw new Error("Falha ao gerar PIX: Resposta vazia da API.");
    }

    // Handle nested response structure if applicable (some versions return data: { ... })
    const pixData = syncPayData.data || syncPayData;
    const qrcode = pixData.pix_qrcode || pixData.qrcode || pixData.pix_code;
    const copyPaste = pixData.pix_copy_paste || pixData.pix_link || pixData.copy_paste;

    // 5. Save payment to Firebase
    await paymentRef.set({
      raffleId,
      numbers,
      buyer,
      amount: totalAmount,
      status: "pending",
      syncpay_id: pixData.id || syncPayData.id || null,
      pix_qrcode: qrcode || null,
      pix_copy_paste: copyPaste || null,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ 
      success: true, 
      pix_qrcode: qrcode,
      pix_copy_paste: copyPaste,
      payment_id: externalId
    });

  } catch (error: any) {
    console.error("Error in create-payment:", error);
    return res.status(500).json({ 
      error: "Erro interno ao processar pagamento.", 
      details: error.message 
    });
  }
}

