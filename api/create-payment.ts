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

const cleanupExpiredReservations = async (db: any, raffleId: string) => {
  try {
    const now = new Date();
    const numbersRef = db.collection("raffles").doc(raffleId).collection("numbers");
    const expiredSnaps = await numbersRef
      .where("status", "==", "reserved")
      .where("expires_at", "<", now)
      .get();
      
    if (!expiredSnaps.empty) {
      console.log(`[CLEANUP] Encontrados ${expiredSnaps.size} números com reserva expirada na rifa ${raffleId}. Liberando...`);
      const batch = db.batch();
      expiredSnaps.docs.forEach((doc: any) => {
        batch.set(doc.ref, {
          status: "available",
          expires_at: null,
          buyer_name: null,
          buyer_phone: null,
          purchase_id: null
        }, { merge: true });
      });
      await batch.commit();
    }
  } catch (err: any) {
    console.error("[CLEANUP Erro]:", err.message);
  }
};

const generateUniqueAvailableNumbersOnServer = async (db: any, raffleId: string, quantity: number, totalNumbers: number) => {
  const numbersRef = db.collection("raffles").doc(raffleId).collection("numbers");
  
  // Tenta encontrar números disponíveis
  const availableSnap = await numbersRef
    .where("status", "==", "available")
    .limit(quantity * 3 + 100)
    .get();
    
  let availableNumbers: number[] = [];
  availableSnap.forEach((doc: any) => {
    availableNumbers.push(Number(doc.data().number));
  });
  
  // Se não houver o suficiente, busca reservas expiradas
  if (availableNumbers.length < quantity) {
    const now = new Date();
    const expiredSnap = await numbersRef
      .where("status", "==", "reserved")
      .where("expires_at", "<", now)
      .limit(quantity * 3)
      .get();
      
    expiredSnap.forEach((doc: any) => {
      availableNumbers.push(Number(doc.data().number));
    });
  }
  
  if (availableNumbers.length < quantity) {
    throw new Error("Não há números disponíveis suficientes na rifa.");
  }
  
  const shuffled = availableNumbers.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, quantity);
};

const generateUniqueNumbers = async (raffleId: string, quantity: number, maxNumbers: number) => {
  const generated = new Set<number>();
  
  while (generated.size < quantity) {
    const num = Math.floor(Math.random() * maxNumbers);
    generated.add(num);
  }
  return Array.from(generated);
};

const safeStringify = (obj: any, indent: number = 2) => {
  try {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return '[Circular]';
        cache.add(value);
      }
      return value;
    }, indent);
  } catch (e) {
    return "[Erro ao serializar objeto]";
  }
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
      body: safeStringify({
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
        body: safeStringify(payload)
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

  console.log("==================================================");
  console.log("[API VERCEL] create-payment: Requisição recebida");
  console.log("HEADERS:", safeStringify(req.headers, 2));
  console.log("BODY TYPE:", typeof req.body);
  console.log("BODY KEYS:", Object.keys(req.body || {}));
  console.log("FULL BODY:", safeStringify(req.body, 2));

  try {
    const db = getDb();
    if (!req.body || Object.keys(req.body).length === 0) {
      console.warn("[API VERCEL] Body vazio ou inválido.");
      return res.status(400).json({ 
        error: "Body vazio ou inválido.",
        receivedHeaders: req.headers,
        receivedBody: req.body
      });
    }

    // Suporte tanto a estrutura aninhada quanto a plana
    const raffleId = req.body.rifaId || req.body.raffleId;
    const buyer = req.body.buyer || {
      name: req.body.nome || req.body.name,
      whatsapp: req.body.telefone || req.body.whatsapp || req.body.phone,
      cpf: req.body.cpf,
      instagram: req.body.instagram
    };
    
    const requestedNumbers = req.body.numero || req.body.numbers || [];
    const packageId = req.body.pacote || req.body.packageId;

    console.log(`[PAYMENT] Nova tentativa de compra: Rifa ${raffleId} | Cliente: ${buyer?.name}`);

    const buyerNameClean = String(buyer?.name || "").trim();
    if (!raffleId || (requestedNumbers.length === 0 && !packageId) || !buyer?.whatsapp || !buyerNameClean || buyerNameClean.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: "Nome Completo e WhatsApp (com DDD) são obrigatórios para realizar a compra." 
      });
    }

    const normalizedPhoneVal = normalizePhone(buyer.whatsapp);
    if (normalizedPhoneVal.length < 10 || normalizedPhoneVal.length > 11) {
      return res.status(400).json({
        success: false,
        code: "TELEFONE_INVALIDO",
        message: "WhatsApp inválido. Por favor, insira o DDD e o número completo, ex: (11) 99999-9999"
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
    let finalNumbers: number[] = Array.isArray(requestedNumbers) ? requestedNumbers.map(Number) : [];
    let quantityNeeded = 0;
    let bonusNumbers = 0;

    const raffleType = raffleData.type || 'manual';

    // Clean up expired reservations first to free up space
    await cleanupExpiredReservations(db, raffleId);

    // Determine the quantity and final numbers list
    if (finalNumbers.length > 0) {
      quantityNeeded = finalNumbers.length;
      if (packageId) {
        const pkg = (raffleData.packages || []).find((p: any) => p.id === packageId);
        if (pkg) {
          totalAmount = pkg.price;
        } else {
          totalAmount = quantityNeeded * (raffleData.price || 0);
        }
      } else {
        totalAmount = quantityNeeded * (raffleData.price || 0);
      }
    } else {
      // Fallback: Generate numbers on server if not provided (e.g. older flow or backend direct)
      if (packageId) {
        const pkg = (raffleData.packages || []).find((p: any) => p.id === packageId);
        if (!pkg) return res.status(400).json({ success: false, message: "Pacote não encontrado." });
        
        quantityNeeded = pkg.quantity;
        totalAmount = pkg.price;
      } else {
        return res.status(400).json({ success: false, message: "Selecione ao menos um número ou pacote." });
      }

      finalNumbers = await generateUniqueAvailableNumbersOnServer(db, raffleId, quantityNeeded, raffleData.total_numbers || 100);
    }

    // Apply promotions if any
    if (raffleData.promotion?.active) {
      const promo = raffleData.promotion;
      if (quantityNeeded >= (promo.min_purchase_quantity || 0)) {
        if (promo.type === 'discount') {
          totalAmount = totalAmount * (1 - (promo.value / 100));
        } else if (promo.type === 'bonus') {
          bonusNumbers = promo.value;
        }
      }
    }

    // Validate all selected numbers are actually available
    const numbersRef = raffleRef.collection("numbers");
    const unavailableNumbers: number[] = [];
    
    const checkPromises = finalNumbers.map(async (num) => {
      const doc = await numbersRef.doc(String(num)).get();
      if (doc.exists) {
        const data = doc.data()!;
        const status = data.status;
        if (status === 'paid' || status === 'confirmed' || status === 'pago') {
          return Number(num);
        } else if (status === 'reserved') {
          const expiresAt = data.expires_at?.toDate ? data.expires_at.toDate() : new Date(data.expires_at);
          if (expiresAt > new Date()) {
            return Number(num);
          }
        }
      }
      return null;
    });
    
    const checkResults = await Promise.all(checkPromises);
    checkResults.forEach(res => {
      if (res !== null) unavailableNumbers.push(res);
    });

    if (unavailableNumbers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Infelizmente, os seguintes números já foram reservados ou pagos por outro cliente: ${unavailableNumbers.join(", ")}. Por favor, altere sua seleção.`
      });
    }

    if (totalAmount <= 0) {
      totalAmount = 0.01;
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
      amount: Number(totalAmount.toFixed(2)),
      description: `Pagamento Rifa: ${raffleData.name || "Sorteio"}`,
      webhook_url: `${appUrl}/api/webhook-syncpay`,
      external_id: String(identifier),
      client: {
        name: buyerNameClean,
        phone: normalizePhone(buyer.whatsapp),
        email: buyer.email || "cliente@exemplo.com",
        cpf: normalizeCPF(buyer.cpf)
      }
    };

    console.log(`[API PIX] Criando cobrança para ${identifier}. Valor: ${totalAmount}`);
    console.log(`[API PIX] Payload external_id: ${payload.external_id}`);

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

    // Save purchase and reserve numbers atomically using a batch
    const batch = db.batch();
    const expiresAtDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes reservation

    // 1. Reserve each number in the raffle
    for (const num of finalNumbers) {
      batch.set(numbersRef.doc(String(num)), {
        number: Number(num),
        status: 'reserved',
        expires_at: expiresAtDate,
        buyer_name: buyerNameClean,
        buyer_phone: normalizePhone(buyer.whatsapp),
        purchase_id: identifier,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // 2. Save the pending purchase
    const compraRef = db.collection("compras").doc(identifier);
    batch.set(compraRef, {
      nome: buyerNameClean,
      telefone: normalizePhone(buyer.whatsapp),
      cpf: payload.client.cpf,
      pix_code: pix_code,
      identifier: identifier,
      status: "pending",
      numero: finalNumbers,
      quantity: quantityNeeded + bonusNumbers,
      rifaId: raffleId,
      valor: totalAmount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expires_at: expiresAtDate
    });

    await batch.commit();

    return res.json({ 
      success: true, 
      pix_code: pix_code,
      identifier: identifier,
      numbers: finalNumbers,
      valor: totalAmount,
      cpf: payload.client.cpf
    });

  } catch (error: any) {
    console.error("Error in create-payment:", error.message || String(error));
    
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
