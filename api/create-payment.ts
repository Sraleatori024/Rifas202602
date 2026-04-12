import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

const normalizePhone = (phone: string) => {
  let clean = String(phone || "").replace(/\D/g, "");
  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55 para busca consistente
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    clean = clean.substring(2);
  }
  return clean;
};
const normalizeCPF = (cpf: string) => {
  const clean = cpf ? String(cpf).replace(/\D/g, "") : "";
  return clean.length === 11 ? clean : "00000000000";
};

async function generateToken() {
  const clientId = process.env.PIX_API_CLIENT_ID || process.env.SYNC_CLIENT_ID;
  const clientSecret = process.env.PIX_API_CLIENT_SECRET || process.env.SYNC_CLIENT_SECRET;
  const apiUrl = process.env.PIX_API_URL || "https://api.syncpayments.com.br";

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
      console.error("Erro ao gerar token SyncPayments:", data.message || String(data));
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
  if (!token) throw new Error("Token de autorização ausente");
  if (!payload.amount || payload.amount <= 0) throw new Error("Valor da transação deve ser positivo");
  if (!payload.webhook_url) throw new Error("URL de Webhook não configurada no ambiente");

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

    if (!raffleId || (!requestedNumbers?.length && !packageId) || !buyer || !buyer.whatsapp || !buyer.name) {
      return res.status(400).json({ 
        success: false, 
        code: "DADOS_INCOMPLETOS",
        message: "Dados incompletos (Nome, WhatsApp e Números/Pacote são obrigatórios)" 
      });
    }

    const normalizedPhoneVal = normalizePhone(buyer.whatsapp);
    if (normalizedPhoneVal.length < 10 || normalizedPhoneVal.length > 11) {
      return res.status(400).json({
        success: false,
        code: "TELEFONE_INVALIDO",
        message: "Número de telefone inválido. Use o formato (DDD) 99999-9999"
      });
    }

    const normalizedCPFVal = normalizeCPF(buyer.cpf);
    if (buyer.cpf && normalizedCPFVal.length !== 11) {
      return res.status(400).json({
        success: false,
        code: "CPF_INVALIDO",
        message: "CPF inválido. Deve conter 11 dígitos."
      });
    }

    // 1. Fetch Raffle Data (Single Read)
    const raffleRef = db.collection("raffles").doc(raffleId);
    const raffleSnap = await raffleRef.get();
    
    if (!raffleSnap.exists) {
      return res.status(404).json({ success: false, message: "Rifa não encontrada." });
    }

    const raffleData = raffleSnap.data()!;
    let totalAmount = 0;
    let finalNumbers: number[] = [];
    let quantityNeeded = 0;

    // 2. Identify Numbers and Calculate Price
    if (packageId) {
      const pkg = (raffleData.packages || []).find((p: any) => p.id === packageId);
      if (!pkg) {
        return res.status(400).json({ success: false, message: "Pacote não encontrado." });
      }
      quantityNeeded = pkg.quantity;
      totalAmount = pkg.price;

      // Find available numbers (Fast query)
      const availableSnap = await raffleRef.collection("numbers")
        .where("status", "==", "disponivel")
        .limit(quantityNeeded)
        .get();

      if (availableSnap.size < quantityNeeded) {
        return res.status(400).json({ success: false, message: "Não há números disponíveis suficientes para este pacote." });
      }
      finalNumbers = availableSnap.docs.map(d => d.data().number);
    } else {
      const unitPrice = raffleData.price || 0;
      quantityNeeded = requestedNumbers.length;
      totalAmount = quantityNeeded * unitPrice;
      finalNumbers = requestedNumbers;

      // Quick check for sold numbers (Parallel queries)
      const chunks = [];
      for (let i = 0; i < requestedNumbers.length; i += 30) {
        chunks.push(requestedNumbers.slice(i, i + 30));
      }

      const checkResults = await Promise.all(chunks.map(chunk => 
        raffleRef.collection("numbers")
          .where("number", "in", chunk)
          .where("status", "in", ["pago", "confirmed"])
          .limit(1)
          .get()
      ));

      for (const snap of checkResults) {
        if (!snap.empty) {
          return res.status(400).json({ 
            success: false, 
            message: `O número ${snap.docs[0].data().number} já foi vendido.` 
          });
        }
      }
    }

    if (totalAmount <= 0) {
      return res.status(400).json({ success: false, message: "O valor total da compra deve ser maior que zero." });
    }

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
    const identifier = `compra_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
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
      syncPayResult = await createCashIn(accessToken, payload);
    } catch (apiError: any) {
      return res.status(500).json({
        success: false,
        code: "PIX_GERACAO_ERRO",
        message: "Erro ao gerar cobrança PIX",
        details: apiError.message
      });
    }

    const { pix_code } = syncPayResult;

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
