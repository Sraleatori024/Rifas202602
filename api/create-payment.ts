import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

const normalizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");
const normalizeCPF = (cpf: string) => {
  const clean = cpf ? String(cpf).replace(/\D/g, "") : "";
  return clean.length === 11 ? clean : "00000000000";
};

async function generateToken() {
  const clientId = process.env.PIX_API_CLIENT_ID || process.env.SYNC_CLIENT_ID;
  const clientSecret = process.env.PIX_API_CLIENT_SECRET || process.env.SYNC_CLIENT_SECRET;
  const apiUrl = process.env.PIX_API_URL || "https://api.syncpayments.com.br";

  console.log("API URL:", apiUrl);
  console.log("API CLIENT_ID definido:", !!clientId);
  console.log("API CLIENT_SECRET definido:", !!clientSecret);

  if (!clientId || !clientSecret) {
    throw new Error("Configuração de API SyncPayments (PIX_API_CLIENT_ID ou PIX_API_CLIENT_SECRET) ausente.");
  }

  try {
    const response = await fetch(`${apiUrl}/api/partner/v1/auth-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const data = await response.json();
    
    if (!response.ok || !data.access_token) {
      console.error("Erro ao gerar token SyncPayments:", data);
      throw new Error(data.message || `Falha na autenticação SyncPayments: ${response.status}`);
    }

    return data.access_token;
  } catch (error: any) {
    console.error("Erro crítico na geração de token:", error.message);
    throw error;
  }
}

async function createCashIn(token: string, payload: any) {
  const apiUrl = process.env.PIX_API_URL || "https://api.syncpayments.com.br";
  // Validações robustas antes do envio
  if (!token) throw new Error("Token de autorização ausente");
  if (!payload.amount || payload.amount <= 0) throw new Error("Valor da transação deve ser positivo");
  if (!payload.webhook_url) throw new Error("URL de Webhook não configurada no ambiente");

    // Log simplificado para evitar erros de estrutura circular
    console.log("Iniciando Cash-In SyncPayments...");
    console.log("Payload Enviado (ID):", payload.external_id);

    try {
      const response = await fetch(`${apiUrl}/api/partner/v1/cash-in`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      console.log("Resposta SyncPayments recebida.");

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Erro retornado pela API SyncPayments");
    }

    // Extração de dados com fallback seguro
    const data = result.data || result;
    return {
      pix_code: data.pix_code || data.pix_qrcode || data.qrcode || "",
      paymentCodeBase64: data.paymentCodeBase64 || data.pix_base64 || "",
      identifier: data.identifier || data.id || ""
    };
  } catch (error: any) {
    console.error("Falha na integração SyncPayments:", error.message);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log(`[API] create-payment: Recebendo requisição para rifa ${req.body?.raffleId} do WhatsApp ${req.body?.buyer?.whatsapp}`);

  try {
    const db = getDb();
    if (!req.body) {
      return res.status(400).json({ error: "Body vazio." });
    }

    const { raffleId, numbers: requestedNumbers, buyer, packageId } = req.body;

    // 1. DADOS_INCOMPLETOS
    if (!raffleId || (!requestedNumbers?.length && !packageId) || !buyer || !buyer.whatsapp || !buyer.name) {
      return res.status(400).json({ 
        success: false, 
        code: "DADOS_INCOMPLETOS",
        message: "Dados incompletos (Nome, WhatsApp e Números/Pacote são obrigatórios)" 
      });
    }

    // 2. TELEFONE_INVALIDO
    const normalizedPhone = normalizePhone(buyer.whatsapp);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      return res.status(400).json({
        success: false,
        code: "TELEFONE_INVALIDO",
        message: "Número de telefone inválido. Use o formato (DDD) 99999-9999"
      });
    }

    // 3. CPF_INVALIDO (Se enviado, deve ter 11 dígitos)
    const normalizedCPF = normalizeCPF(buyer.cpf);
    if (buyer.cpf && normalizedCPF.length !== 11) {
      return res.status(400).json({
        success: false,
        code: "CPF_INVALIDO",
        message: "CPF inválido. Deve conter 11 dígitos."
      });
    }

    // 1. Handle User (Simple System)
    const userRef = db.collection("users").doc(normalizePhone(buyer.whatsapp));
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      await userRef.set({
        name: buyer.name || "Cliente",
        whatsapp: normalizePhone(buyer.whatsapp),
        instagram: buyer.instagram || "",
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const raffleRef = db.collection("raffles").doc(raffleId);
    const numbersRef = raffleRef.collection("numbers");

    // Generate a unique identifier for this purchase
    const identifier = `compra_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Use a transaction to check and reserve numbers atomically
    const result = await db.runTransaction(async (transaction) => {
      const raffleSnap = await transaction.get(raffleRef);
      if (!raffleSnap.exists) {
        throw new Error("Rifa não encontrada.");
      }

      const raffleData = raffleSnap.data()!;
      let totalAmount = 0;
      let finalNumbers: number[] = [];
      let quantityNeeded = 0;

      if (packageId) {
        const pkg = (raffleData.packages || []).find((p: any) => p.id === packageId);
        if (!pkg) {
          throw new Error("Pacote não encontrado.");
        }
        quantityNeeded = pkg.quantity;
        if (requestedNumbers?.length && requestedNumbers.length !== pkg.quantity) {
          throw new Error("Quantidade de números não corresponde ao pacote.");
        }
        totalAmount = pkg.price;
      } else {
        const unitPrice = raffleData.price || 0;
        quantityNeeded = requestedNumbers.length;
        totalAmount = quantityNeeded * unitPrice;
      }

      const snapshotsToUpdate: admin.firestore.QueryDocumentSnapshot[] = [];

      if (requestedNumbers?.length) {
        // Check specific numbers requested by client
        const numbersChunks = [];
        for (let i = 0; i < requestedNumbers.length; i += 30) {
          numbersChunks.push(requestedNumbers.slice(i, i + 30));
        }

        for (const chunk of numbersChunks) {
          const selectedNumbersSnap = await transaction.get(
            numbersRef.where("number", "in", chunk)
          );

            selectedNumbersSnap.forEach((doc) => {
              const data = doc.data();
              if (data.status === "pago" || data.status === "confirmed") {
                throw new Error(`O número ${data.number} já foi comprado.`);
              }
              snapshotsToUpdate.push(doc as admin.firestore.QueryDocumentSnapshot);
              finalNumbers.push(data.number);
            });
        }

        if (finalNumbers.length !== requestedNumbers.length) {
          throw new Error("Alguns números solicitados não foram encontrados.");
        }
      } else {
        // Automatic selection for package
        const availableSnap = await transaction.get(
          numbersRef.where("status", "!=", "pago").limit(quantityNeeded)
        );

        if (availableSnap.size < quantityNeeded) {
          throw new Error("Não há números disponíveis suficientes para este pacote.");
        }

        availableSnap.forEach((doc) => {
          snapshotsToUpdate.push(doc as admin.firestore.QueryDocumentSnapshot);
          finalNumbers.push(doc.data().number);
        });
      }

      // Vincular informações do comprador aos números (sem alterar o status para manter como livre até o pagamento)
      for (const docSnap of snapshotsToUpdate) {
        transaction.update(docSnap.ref, {
          buyer_name: buyer.name,
          buyer_whatsapp: normalizePhone(buyer.whatsapp)
        });
      }

      if (totalAmount <= 0) {
        throw new Error("O valor total da compra deve ser maior que zero.");
      }

      return { totalAmount, raffleData, finalNumbers };
    });

    const { totalAmount, raffleData, finalNumbers } = result;

    // 3. Get Auth Token from SyncPayments
    let accessToken;
    try {
      accessToken = await generateToken();
    } catch (authError: any) {
      return res.status(401).json({ 
        success: false,
        code: "API_PAGAMENTO_ERRO",
        message: "Erro ao autenticar na SyncPayments", 
        details: authError.message 
      });
    }

    // 4. Create Cash-In using the token
    const rawAppUrl = process.env.APP_URL;
    if (!rawAppUrl) {
      return res.status(500).json({
        success: false,
        code: "APP_URL_NAO_CONFIGURADA",
        message: "A URL da aplicação não está configurada no ambiente."
      });
    }
    const appUrl = rawAppUrl.endsWith("/") ? rawAppUrl.slice(0, -1) : rawAppUrl;
    const payload = {
      amount: Number(totalAmount),
      description: `Pagamento Rifa: ${raffleData.name || "Sorteio"}`,
      webhook_url: `${appUrl}/api/webhook-syncpay`,
      external_id: identifier,
      client: {
        name: buyer.name || "Cliente",
        phone: normalizePhone(buyer.whatsapp),
        email: buyer.email || "cliente@exemplo.com",
        cpf: normalizeCPF(buyer.cpf)
      }
    };

    let syncPayResult;
    try {
      console.log("CPF enviado:", payload.client.cpf);
      console.log("Webhook URL:", payload.webhook_url);
      syncPayResult = await createCashIn(accessToken, payload);
    } catch (apiError: any) {
      return res.status(500).json({
        success: false,
        code: "PIX_GERACAO_ERRO",
        message: "Erro ao gerar cobrança PIX",
        details: apiError.message
      });
    }

    const { pix_code, paymentCodeBase64 } = syncPayResult;

    if (!pix_code) {
      return res.status(500).json({
        success: false,
        code: "PIX_GERACAO_ERRO",
        message: "Código PIX não retornado pela API"
      });
    }

    // 5. Save compra to Firebase
    const compraRef = db.collection("compras").doc(identifier);
    await compraRef.set({
      nome: buyer.name || "Cliente",
      telefone: normalizePhone(buyer.whatsapp),
      cpf: payload.client.cpf,
      pix_code: pix_code,
      identifier: identifier,
      status: "criada",
      numero: finalNumbers,
      rifaId: raffleId,
      valor: totalAmount,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ 
      success: true, 
      pix_code: pix_code,
      identifier: identifier,
      numbers: finalNumbers,
      valor: totalAmount,
      cpf: payload.client.cpf
    });

  } catch (error: any) {
    console.error("Error in create-payment:", error.message || error);
    
    if (error.code === 8 || error.message?.includes('Quota exceeded')) {
      return res.status(429).json({
        success: false,
        code: "QUOTA_EXCEEDED",
        message: "Limite de transações do banco de dados atingido para hoje. Por favor, tente novamente mais tarde.",
        details: error.message
      });
    }

    return res.status(500).json({ 
      success: false,
      code: "ERRO_INTERNO",
      message: "Erro interno ao processar pagamento.", 
      details: error.message 
    });
  }
}

