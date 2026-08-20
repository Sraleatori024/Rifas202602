import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import { getDb, admin } from "./lib/firebase-admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3) Corrigir telefone para remover () e espaços e normalizar prefixo 55 e zeros iniciais
const normalizePhone = (phone: string | number | undefined | null) => {
  let clean = String(phone || "").replace(/\D/g, "");
  // Se começar com 0 e tiver 11 ou 12 dígitos, remove o zero inicial (ex: 011999999999 -> 11999999999)
  if (clean.startsWith("0") && (clean.length === 11 || clean.length === 12)) {
    clean = clean.substring(1);
  }
  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55 para busca consistente
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    clean = clean.substring(2);
  }
  return clean;
};

// Normalização de nomes para comparação precisa e insensível a acentuação/caixa
const normalizeName = (name: string | undefined | null): string => {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos / diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove caracteres especiais
    .replace(/\s+/g, " ") // Colapsa múltiplos espaços
    .trim();
};

const areNamesMatching = (name1: string | undefined | null, name2: string | undefined | null): boolean => {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return true;
  return n1 === n2;
};

// 4) Validar CPF com 11 números
const normalizeCPF = (cpf: string) => {
  const clean = String(cpf || "").replace(/\D/g, "");
  return clean;
};

const isPago = (status: string | undefined): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return ["paid", "pago", "completed", "approved", "sucesso"].includes(s);
};

const safeStringify = (obj: any, indent: number = 2): string => {
  if (obj === undefined) return 'undefined';
  if (obj === null) return 'null';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  try {
    const seen = new WeakSet();
    const cleanObject = (item: any, depth = 0): any => {
      if (depth > 6) return '[Max Depth]';
      if (item === null || typeof item !== 'object') {
        if (typeof item === 'bigint') return item.toString();
        if (typeof item === 'function') return '[Function]';
        if (typeof item === 'symbol') return item.toString();
        return item;
      }
      if (seen.has(item)) return '[Circular]';
      seen.add(item);

      if (Array.isArray(item)) {
        return item.map(el => cleanObject(el, depth + 1));
      }

      const result: Record<string, any> = {};
      for (const key of Object.keys(item)) {
        try {
          result[key] = cleanObject(item[key], depth + 1);
        } catch {
          result[key] = '[Unserializable]';
        }
      }
      return result;
    };

    return JSON.stringify(cleanObject(obj), null, indent);
  } catch (e) {
    try {
      return String(obj);
    } catch {
      return "[Erro ao serializar objeto]";
    }
  }
};

// 1) Criar função para gerar token automaticamente
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
      headers: { "Content-Type": "application/json" },
      body: safeStringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const data = await response.json();
    
    if (!response.ok || !data.access_token) {
      console.error("Erro ao gerar token:", data.message || String(data));
      throw new Error(data.message || "Falha na autenticação");
    }

    return data.access_token;
  } catch (error: any) {
    console.error("Erro crítico no Token:", error.message);
    throw error;
  }
}

// 2) Usar esse token para criar o PIX
async function createCashIn(token: string, payload: any) {
  const apiUrl = process.env.PIX_API_URL || "https://api.syncpayments.com.br";
  
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
    
    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Erro na API SyncPayments");
    }

    const data = result.data || result;
    
    // Extrai possíveis campos de QR Code retornados pela SyncPay
    const rawQr = data.qr_code || data.qrcode || data.qrCode || data.paymentCodeBase64 || data.pix_base64 || data.qr_code_base64 || data.pix_url || "";
    const pixCode = data.pix_code || data.pix_qrcode || data.pixCode || data.emv || (typeof data.qrcode === 'string' && data.qrcode.startsWith("000201") ? data.qrcode : "") || "";

    return {
      pix_code: pixCode || (typeof rawQr === 'string' && rawQr.startsWith("000201") ? rawQr : ""),
      qr_code: rawQr,
      identifier: data.identifier || data.id || ""
    };
  } catch (error: any) {
    console.error("Erro no Cash-In:", error.message);
    throw error;
  }
}

// --- HELPER FUNCTIONS ---

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
    const num = Math.floor(Math.random() * maxNumbers) + 1;
    generated.add(num);
  }
  return Array.from(generated);
};

const calculateRouletteResult = (prizes: any[]) => {
  const totalChance = prizes.reduce((acc, p) => acc + (p.chance || 0), 0);
  let random = Math.random() * totalChance;
  
  for (const prize of prizes) {
    if (random < (prize.chance || 0)) {
      return prize;
    }
    random -= (prize.chance || 0);
  }
  return prizes[0];
};

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Global logger for debugging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API REQUEST] ${req.method} ${req.url}`);
      console.log(`[API HEADERS]`, safeStringify(req.headers, 2));
    }
    next();
  });

  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- API ROUTES ---

  // Create Payment (SyncPay PIX)
  app.post("/api/create-payment", async (req, res) => {
    const raffleId = req.body.rifaId || req.body.raffleId;
    const buyer = req.body.buyer || {
      name: req.body.nome || req.body.name,
      whatsapp: req.body.telefone || req.body.whatsapp || req.body.phone,
      cpf: req.body.cpf,
      instagram: req.body.instagram
    };
    
    const requestedNumbers = req.body.numero || req.body.numbers || [];
    const pkgInfo = req.body.pacote || req.body.packageId;
    
    console.log(`[PAYMENT] Nova tentativa de compra: Rifa ${raffleId} | Cliente: ${buyer?.name}`);

    const buyerNameClean = String(buyer?.name || "").trim();
    const buyerPhoneClean = normalizePhone(buyer?.whatsapp || "");

    if (!raffleId || (requestedNumbers.length === 0 && !pkgInfo) || !buyerPhoneClean || !buyerNameClean || buyerNameClean.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: "Nome Completo e WhatsApp (com DDD) são obrigatórios para realizar a compra." 
      });
    }

    if (buyerPhoneClean.length < 10 || buyerPhoneClean.length > 11) {
      return res.status(400).json({
        success: false,
        code: "TELEFONE_INVALIDO",
        message: "WhatsApp inválido. Por favor, insira o DDD e o número completo, ex: (11) 99999-9999"
      });
    }

    // VERIFICAÇÃO DE CONFLITO: Telefone já associado a outro nome cadastrado
    try {
      const db = getDb();
      let existingRegisteredName: string | null = null;

      // 1. Busca na coleção users pelo telefone normalizado
      const userSnap = await db.collection("users").doc(buyerPhoneClean).get();
      if (userSnap.exists && userSnap.data()?.name) {
        const uName = String(userSnap.data()!.name).trim();
        if (uName.length > 0) {
          existingRegisteredName = uName;
        }
      }

      // 2. Se não encontrou no users, verifica compras anteriores pelo mesmo telefone
      if (!existingRegisteredName) {
        const prevPurchasesSnap = await db.collection("compras")
          .where("telefone", "==", buyerPhoneClean)
          .limit(5)
          .get();

        if (!prevPurchasesSnap.empty) {
          for (const pDoc of prevPurchasesSnap.docs) {
            const pData = pDoc.data();
            if (pData?.nome && String(pData.nome).trim().length > 0) {
              existingRegisteredName = String(pData.nome).trim();
              break;
            }
          }
        }
      }

      // 3. Se existir um nome registrado anteriormente para este WhatsApp, valida se é a mesma pessoa
      if (existingRegisteredName) {
        const matches = areNamesMatching(existingRegisteredName, buyerNameClean);
        if (!matches) {
          console.warn(`[PAYMENT CONFLITO] WhatsApp ${buyerPhoneClean} já está associado a outro cadastro. Bloqueando compra.`);
          return res.status(400).json({
            success: false,
            code: "PHONE_NAME_MISMATCH",
            message: "Este WhatsApp já está associado a outro cadastro. Verifique o número informado ou utilize o WhatsApp correto."
          });
        }
      }
    } catch (checkErr: any) {
      console.error("[PAYMENT] Erro ao validar telefone existente:", checkErr.message || String(checkErr));
    }

    try {
      const db = getDb();
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

      // Determine the quantity and final numbers list
      if (finalNumbers.length > 0) {
        quantityNeeded = finalNumbers.length;
        if (pkgInfo) {
          let pkg;
          if (typeof pkgInfo === 'string') {
            pkg = (raffleData.packages || []).find((p: any) => p.id === pkgInfo);
          } else if (typeof pkgInfo === 'object') {
            pkg = { quantity: pkgInfo.quantidade || pkgInfo.quantity, price: pkgInfo.preco || pkgInfo.price };
          }
          if (pkg) {
            totalAmount = pkg.price;
          } else {
            totalAmount = quantityNeeded * (raffleData.price || 0);
          }
        } else {
          totalAmount = quantityNeeded * (raffleData.price || 0);
        }
      } else {
        // Fallback: Generate numbers in memory using raffle's occupied_numbers
        if (pkgInfo) {
          let pkg;
          if (typeof pkgInfo === 'string') {
            pkg = (raffleData.packages || []).find((p: any) => p.id === pkgInfo);
          } else if (typeof pkgInfo === 'object') {
            pkg = { quantity: pkgInfo.quantidade || pkgInfo.quantity, price: pkgInfo.preco || pkgInfo.price };
          }
          if (!pkg) return res.status(400).json({ success: false, message: "Pacote não encontrado." });
          
          quantityNeeded = pkg.quantity;
          totalAmount = pkg.price;
        } else {
          return res.status(400).json({ success: false, message: "Selecione ao menos um número ou pacote." });
        }

        const totalNums = raffleData.total_numbers || 100;
        const occupiedList = Array.isArray(raffleData.occupied_numbers) ? raffleData.occupied_numbers.map(Number) : [];
        const occupiedSet = new Set(occupiedList);
        const availablePool: number[] = [];
        for (let i = 0; i < totalNums; i++) {
          if (!occupiedSet.has(i)) availablePool.push(i);
        }

        if (availablePool.length < quantityNeeded) {
          return res.status(400).json({ success: false, message: "Não há números disponíveis suficientes na rifa." });
        }

        const shuffled = availablePool.sort(() => 0.5 - Math.random());
        finalNumbers = shuffled.slice(0, quantityNeeded);
      }

      // Check promotions
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

      // Validate numbers against paid_numbers and active reserved_numbers in memory (0 extra reads)
      const nowMs = Date.now();
      const paidNumbers: number[] = Array.isArray(raffleData.paid_numbers) 
        ? raffleData.paid_numbers.map(Number) 
        : [];
      const validReservations = Array.isArray(raffleData.reserved_numbers)
        ? raffleData.reserved_numbers.filter((r: any) => Number(r.expires_at) > nowMs)
        : [];
      const reservedNumbers: number[] = validReservations.flatMap((r: any) => 
        Array.isArray(r.numbers) ? r.numbers.map(Number) : []
      );

      const paidSet = new Set(paidNumbers);
      const reservedSet = new Set(reservedNumbers);

      const unavailablePaid = finalNumbers.filter(n => paidSet.has(n));
      const unavailableReserved = finalNumbers.filter(n => reservedSet.has(n));

      if (unavailablePaid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Infelizmente, os seguintes números já foram pagos por outro cliente: ${unavailablePaid.join(", ")}. Por favor, altere sua seleção.`
        });
      }

      if (unavailableReserved.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Infelizmente, os seguintes números estão temporariamente reservados em processo de pagamento: ${unavailableReserved.join(", ")}. Por favor, escolha outros números.`
        });
      }

      if (totalAmount <= 0) totalAmount = 0.01; // Minimum PIX

      const identifier = `compra_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const accessToken = await generateToken();
      
      const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const requestBaseUrl = host ? `${proto}://${host}` : undefined;
      const rawAppUrl = (process.env.APP_URL && !process.env.APP_URL.includes("MY_APP_URL")) 
        ? process.env.APP_URL 
        : requestBaseUrl;
      const appUrl = rawAppUrl ? (rawAppUrl.endsWith("/") ? rawAppUrl.slice(0, -1) : rawAppUrl) : "";
      
      const payload = {
        amount: Number(totalAmount.toFixed(2)),
        description: `Rifa: ${raffleData.name}`,
        webhook_url: `${appUrl}/api/webhook-syncpay`,
        external_id: String(identifier),
        client: {
          name: buyer.name,
          cpf: normalizeCPF(buyer.cpf),
          email: buyer.email || "cliente@exemplo.com",
          phone: normalizePhone(buyer.whatsapp)
        }
      };

      console.log(`[API PIX server.ts] Criando cobrança para ${identifier}. Valor: ${totalAmount}`);
      console.log(`[API PIX server.ts] Webhook URL configurada: ${payload.webhook_url}`);

      const syncPayResult = await createCashIn(accessToken, payload);
      const { pix_code } = syncPayResult;
      const gatewayId = String(syncPayResult.identifier || "");
      
      // Determina a imagem do QR Code
      let qrCodeImage = "";
      if (syncPayResult.qr_code && typeof syncPayResult.qr_code === 'string') {
        if (syncPayResult.qr_code.startsWith("data:image/") || syncPayResult.qr_code.startsWith("http://") || syncPayResult.qr_code.startsWith("https://")) {
          qrCodeImage = syncPayResult.qr_code;
        } else if (syncPayResult.qr_code.length > 100 && !syncPayResult.qr_code.startsWith("000201")) {
          // Base64 sem prefixo
          qrCodeImage = `data:image/png;base64,${syncPayResult.qr_code}`;
        }
      }
      
      // Se não veio imagem pronta da SyncPay, gera dinamicamente via biblioteca QRCode
      if (!qrCodeImage && pix_code) {
        qrCodeImage = await QRCode.toDataURL(pix_code, {
          width: 320,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
      }

      // Save purchase and reserve numbers atomically using a batch
      const batch = db.batch();
      const expiresAtTimestamp = Date.now() + 10 * 60 * 1000; // 10 minutes reservation
      const expiresAtDate = new Date(expiresAtTimestamp);

      const newReservation = {
        id: identifier,
        numbers: finalNumbers,
        expires_at: expiresAtTimestamp,
        buyer_name: buyerNameClean
      };

      const updatedReservations = [...validReservations, newReservation];

      // 1. Atualiza apenas as reservas temporárias no documento da rifa (NÃO adiciona em paid_numbers)
      batch.update(raffleRef, {
        reserved_numbers: updatedReservations,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // 2. Salva a compra com status rigorosamente "pending_payment"
      const compraRef = db.collection("compras").doc(identifier);
      batch.set(compraRef, {
        nome: buyerNameClean,
        telefone: buyerPhoneClean,
        cpf: normalizeCPF(buyer.cpf),
        pix_code: pix_code,
        identifier: identifier,
        external_id: identifier,
        gateway_id: gatewayId,
        status: "pending_payment",
        numero: finalNumbers,
        quantity: quantityNeeded + bonusNumbers,
        rifaId: raffleId,
        valor: totalAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expires_at: expiresAtDate
      });

      await batch.commit();

      res.json({
        success: true,
        pix_code,
        qr_code: qrCodeImage,
        identifier,
        numbers: finalNumbers,
        valor: totalAmount
      });

    } catch (error: any) {
      console.error("Erro ao criar pagamento:", error.message);
      res.status(500).json({ success: false, message: error.message || "Erro ao processar pagamento" });
    }
  });

  // Webhook SyncPay
  app.post("/api/webhook-syncpay", async (req, res) => {
    console.log("=========================================");
    console.log("[Webhook server.ts] Recebido em:", new Date().toISOString());
    console.log("[Webhook server.ts] Headers:", safeStringify(req.headers, 2));
    console.log("[Webhook server.ts] Query:", safeStringify(req.query, 2));
    console.log("[Webhook server.ts] Payload completo:", safeStringify(req.body, 2));

    const body = req.body || {};
    const query = req.query || {};
    const ids = new Set<string>();

    const addId = (val: any) => {
      if (val !== undefined && val !== null) {
        const s = String(val).trim();
        if (s.length > 0 && s !== "null" && s !== "undefined") {
          ids.add(s);
        }
      }
    };

    addId(body.external_id);
    addId(body.externalId);
    addId(body.external_reference);
    addId(body.externalReference);
    addId(body.identifier);
    addId(body.id);
    addId(body.transaction_id);
    addId(body.transactionId);
    addId(body.payment_id);
    addId(body.paymentId);
    addId(body.reference_id);
    addId(body.order_id);
    addId(body.custom_id);

    if (body.data && typeof body.data === 'object') {
      addId(body.data.external_id);
      addId(body.data.externalId);
      addId(body.data.external_reference);
      addId(body.data.identifier);
      addId(body.data.id);
      addId(body.data.transaction_id);
      addId(body.data.payment_id);
      addId(body.data.reference_id);
      addId(body.data.order_id);
    }

    if (body.payment && typeof body.payment === 'object') {
      addId(body.payment.external_id);
      addId(body.payment.identifier);
      addId(body.payment.id);
      addId(body.payment.transaction_id);
    }

    if (body.transaction && typeof body.transaction === 'object') {
      addId(body.transaction.external_id);
      addId(body.transaction.identifier);
      addId(body.transaction.id);
    }

    addId(query.external_id);
    addId(query.identifier);
    addId(query.id);

    const candidateIds = Array.from(ids);
    const pixCode = body?.pix_code || body?.data?.pix_code || body?.pix_qrcode || body?.qrcode;

    // Status extraction
    const statusValues: string[] = [];
    const addStatus = (v: any) => { if (v !== undefined && v !== null) statusValues.push(String(v)); };
    addStatus(body.status);
    addStatus(body.event);
    addStatus(body.action);
    addStatus(body.type);
    addStatus(body.data?.status);
    addStatus(body.data?.event);
    addStatus(body.payment?.status);
    addStatus(body.transaction?.status);

    const combinedStatus = statusValues.join(" ").toLowerCase();
    const paidKeywords = [
      "paid", "pago", "approved", "aprovado", "completed", "completo",
      "sucesso", "success", "confirmed", "confirmado", "settled",
      "received", "pix_received", "cashin_paid", "cash_in.paid",
      "payment.paid", "payment.approved", "transaction.paid"
    ];
    const cancelledKeywords = [
      "cancelled", "canceled", "cancelado", "expired", "expirado",
      "failed", "falhou", "rejected", "rejeitado", "refunded", "reembolsado"
    ];

    const isPaid = paidKeywords.some(kw => combinedStatus.includes(kw));
    const isCancelled = !isPaid && cancelledKeywords.some(kw => combinedStatus.includes(kw));

    console.log(`[Webhook] IDs identificados:`, candidateIds);
    console.log(`[Webhook] Status detectado: ${statusValues[0] || "unknown"} (isPaid: ${isPaid}, isCancelled: ${isCancelled})`);

    if (candidateIds.length === 0 && !pixCode) {
      console.error("[Webhook Erro] Nenhum identificador encontrado no payload.");
      return res.status(400).json({ error: "external_id/identifier missing" });
    }

    try {
      const db = getDb();
      let purchaseDoc: any = null;

      // Multi-tier search
      for (const id of candidateIds) {
        const directRef = db.collection("compras").doc(id);
        const directSnap = await directRef.get();
        if (directSnap.exists) {
          purchaseDoc = directSnap;
          console.log(`[Webhook] Compra encontrada diretamente pelo doc.id: ${id}`);
          break;
        }

        const queryId = await db.collection("compras").where("identifier", "==", id).limit(1).get();
        if (!queryId.empty) {
          purchaseDoc = queryId.docs[0];
          console.log(`[Webhook] Compra encontrada pelo campo identifier: ${id}`);
          break;
        }

        const queryExt = await db.collection("compras").where("external_id", "==", id).limit(1).get();
        if (!queryExt.empty) {
          purchaseDoc = queryExt.docs[0];
          console.log(`[Webhook] Compra encontrada pelo campo external_id: ${id}`);
          break;
        }

        const queryGateway = await db.collection("compras").where("gateway_id", "==", id).limit(1).get();
        if (!queryGateway.empty) {
          purchaseDoc = queryGateway.docs[0];
          console.log(`[Webhook] Compra encontrada pelo campo gateway_id: ${id}`);
          break;
        }
      }

      if (!purchaseDoc && pixCode) {
        const queryPix = await db.collection("compras").where("pix_code", "==", String(pixCode).trim()).limit(1).get();
        if (!queryPix.empty) {
          purchaseDoc = queryPix.docs[0];
          console.log(`[Webhook] Compra encontrada pelo campo pix_code.`);
        }
      }

      if (!purchaseDoc) {
        console.error(`[Webhook Erro] Compra NÃO encontrada no Firestore para os IDs: ${candidateIds.join(", ")}`);
        return res.status(404).json({ error: "Compra não encontrada", candidateIds });
      }

      // Handle Cancelled/Expired
      if (isCancelled) {
        console.log(`[Webhook] Cancelando/liberando reserva para compra ${purchaseDoc.id}`);
        const purchaseData = purchaseDoc.data();
        if (purchaseData.status === "paid" || purchaseData.status === "pago") {
          return res.status(200).json({ received: true, message: "Já estava pago anteriormente." });
        }

        const batch = db.batch();
        const raffleRef = db.collection("raffles").doc(purchaseData.rifaId);
        const raffleSnap = await raffleRef.get();
        if (raffleSnap.exists) {
          const raffleData = raffleSnap.data()!;
          const currentReservations = Array.isArray(raffleData.reserved_numbers) ? raffleData.reserved_numbers : [];
          const remainingReservations = currentReservations.filter((r: any) => 
            r.id !== purchaseDoc.id && 
            r.id !== purchaseData?.identifier && 
            r.id !== purchaseData?.external_id
          );
          batch.update(raffleRef, {
            reserved_numbers: remainingReservations,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        batch.update(purchaseDoc.ref, {
          status: "cancelled",
          cancelled_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        return res.status(200).json({ success: true, message: "Reserva cancelada e liberada." });
      }

      // If not paid, ignore
      if (!isPaid) {
        console.log(`[Webhook] Status '${statusValues[0]}' ignorado.`);
        return res.status(200).json({ received: true, message: `Status ${statusValues[0]} recebido e mantido pendente.` });
      }

      // Process payment
      await processWebhookPayment(purchaseDoc, res);

    } catch (error: any) {
      console.error("[Webhook Erro Crítico]:", error.message || String(error));
      res.status(500).json({ error: "Erro interno ao processar webhook" });
    }
  });

  async function processWebhookPayment(paymentSnap: any, res: any) {
    const purchaseData = paymentSnap.data();
    const paymentRef = paymentSnap.ref;
    const paymentId = paymentSnap.id;

    // IDEMPOTENCY CHECK
    if (purchaseData.status === "paid" || purchaseData.status === "pago") {
      console.log(`[Webhook Idempotência] Compra ${paymentId} já confirmada anteriormente. Resposta 200 OK.`);
      return res.status(200).json({ 
        success: true, 
        idempotent: true, 
        message: "Pagamento já confirmado! Boa sorte 🍀" 
      });
    }

    const { rifaId, numero, nome, telefone, valor, quantity } = purchaseData;
    const db = getDb();
    const raffleRef = db.collection("raffles").doc(rifaId);
    const raffleSnap = await raffleRef.get();
    
    if (!raffleSnap.exists) return res.status(404).json({ error: "Rifa não encontrada" });
    const raffleData = raffleSnap.data()!;

    let finalNumbers: number[] = Array.isArray(numero) ? numero.map(Number) : [];
    
    // Generate numbers for automatic raffle
    if (raffleData.type === 'automatic' && finalNumbers.length === 0) {
      finalNumbers = await generateUniqueNumbers(rifaId, Number(quantity) || 1, Number(raffleData.total_numbers) || 1000000);
    }

    console.log(`[Webhook] Confirmando ${finalNumbers.length} números como PAGOS na rifa ${rifaId} para ${nome}`);

    const batch = db.batch();
    const numbersRef = raffleRef.collection("numbers");

    for (let i = 0; i < finalNumbers.length; i += 30) {
      const chunk = finalNumbers.slice(i, i + 30);
      for (const num of chunk) {
        batch.set(numbersRef.doc(String(num)), {
          number: Number(num),
          status: 'paid',
          userName: nome || '',
          buyer_name: nome || '',
          userId: telefone || '',
          buyer_whatsapp: telefone || '',
          purchase_id: paymentId,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    // Roulette Eligibility
    let rouletteEligible = false;
    if (raffleData.roulette?.active && Number(valor || 0) >= Number(raffleData.roulette.min_purchase_value || 0)) {
      rouletteEligible = true;
    }

    // Remove the reservation from reserved_numbers and add to paid_numbers
    const currentReservations = Array.isArray(raffleData.reserved_numbers) ? raffleData.reserved_numbers : [];
    const remainingReservations = currentReservations.filter((r: any) => 
      r.id !== paymentId && 
      r.id !== purchaseData?.identifier && 
      r.id !== purchaseData?.external_id
    );

    const raffleUpdate: any = {
      reserved_numbers: remainingReservations,
      sold_count: admin.firestore.FieldValue.increment(finalNumbers.length),
      revenue: admin.firestore.FieldValue.increment(Number(valor || 0)),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    if (finalNumbers.length > 0) {
      raffleUpdate.paid_numbers = admin.firestore.FieldValue.arrayUnion(...finalNumbers);
      raffleUpdate.occupied_numbers = admin.firestore.FieldValue.arrayUnion(...finalNumbers);
    }

    batch.update(raffleRef, raffleUpdate);

    batch.update(paymentRef, {
      status: "paid",
      numero: finalNumbers,
      paid_at: admin.firestore.FieldValue.serverTimestamp(),
      webhook_processed_at: admin.firestore.FieldValue.serverTimestamp(),
      roulette_eligible: rouletteEligible,
      roulette_spun: false
    });

    const userPhone = normalizePhone(telefone);
    if (userPhone) {
      const userRef = db.collection("users").doc(userPhone);
      batch.set(userRef, {
        name: nome || '',
        whatsapp: userPhone,
        purchases: admin.firestore.FieldValue.arrayUnion({
          rifaId,
          numero: finalNumbers,
          purchaseId: paymentId,
          valor: Number(valor || 0),
          paid_at: new Date().toISOString()
        })
      }, { merge: true });
    }

    await batch.commit();
    console.log(`[Webhook Sucesso] Pagamento ${paymentId} confirmado e gravado no Firestore.`);

    return res.status(200).json({ 
      success: true, 
      message: "Pagamento confirmado com sucesso! Boa sorte 🍀",
      purchase_id: paymentId,
      numbers: finalNumbers
    });
  }

  // Spin Roulette
  app.post("/api/spin-roulette", async (req, res) => {
    const { purchaseId } = req.body;
    if (!purchaseId) return res.status(400).json({ success: false, message: "ID da compra obrigatório" });

    try {
      const db = getDb();
      const purchaseRef = db.collection("compras").doc(purchaseId);
      const purchaseSnap = await purchaseRef.get();

      if (!purchaseSnap.exists) return res.status(404).json({ success: false, message: "Compra não encontrada" });
      const purchaseData = purchaseSnap.data()!;

      if (!purchaseData.roulette_spin?.eligible || purchaseData.roulette_spin?.spun) {
        return res.status(400).json({ success: false, message: "Roleta não disponível ou já utilizada" });
      }

      const raffleRef = db.collection("raffles").doc(purchaseData.rifaId);
      const raffleSnap = await raffleRef.get();
      const raffleData = raffleSnap.data()!;

      if (!raffleData.roulette?.active) return res.status(400).json({ success: false, message: "Roleta desativada" });

      const result = calculateRouletteResult(raffleData.roulette.prizes);

      // Apply prize
      if (result.type === 'numeros') {
        const bonusNumbers = await generateUniqueNumbers(purchaseData.rifaId, result.value, raffleData.total_numbers);
        const batch = db.batch();
        const numbersRef = raffleRef.collection("numbers");
        
        for (const num of bonusNumbers) {
          batch.set(numbersRef.doc(String(num)), {
            number: Number(num),
            status: 'paid',
            userName: purchaseData.nome,
            userId: purchaseData.telefone,
            is_bonus: true,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        batch.update(purchaseRef, {
          numero: admin.firestore.FieldValue.arrayUnion(...bonusNumbers),
          "roulette_spin.spun": true,
          "roulette_spin.result": result,
          "roulette_spin.spun_at": admin.firestore.FieldValue.serverTimestamp()
        });
        
        batch.update(raffleRef, {
          sold_count: admin.firestore.FieldValue.increment(bonusNumbers.length)
        });
        
        await batch.commit();
      } else {
        // PIX Prize - Just record it (Admin will pay manually or integrate later)
        await purchaseRef.update({
          "roulette_spin.spun": true,
          "roulette_spin.result": result,
          "roulette_spin.spun_at": admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Consultar Números
  app.post("/api/consultar-numeros", async (req, res) => {
    const { whatsapp, cpf, nome, identifier, search } = req.body;
    
    const phone = whatsapp ? normalizePhone(whatsapp) : null;
    const rawPhone = whatsapp ? String(whatsapp).trim() : null;
    const cleanCpf = cpf ? normalizeCPF(cpf) : null;
    const rawCpf = cpf ? String(cpf).trim() : null;
    const rawSearch = String(search || "").trim();
    const searchName = String(nome || rawSearch || "").trim();
    const searchId = String(identifier || (rawSearch.includes("compra_") ? rawSearch : "")).trim();

    if (!phone && !cleanCpf && !searchName && !searchId) {
      return res.status(400).json({ 
        success: false, 
        code: "DADOS_INCOMPLETOS",
        message: "Informe WhatsApp, CPF, Nome ou Código da Compra." 
      });
    }

    try {
      console.log(`[Consultar] Buscando por Telefone: ${phone}, CPF: ${cleanCpf}, Nome/Search: ${searchName}, ID: ${searchId}`);

      const db = getDb();
      const queries: Promise<admin.firestore.QuerySnapshot>[] = [];
      const directDocPromises: Promise<admin.firestore.DocumentSnapshot>[] = [];

      // Direct doc lookup
      if (searchId) {
        directDocPromises.push(db.collection("compras").doc(searchId).get());
        if (!searchId.startsWith("compra_")) {
          directDocPromises.push(db.collection("compras").doc(`compra_${searchId}`).get());
        }
        queries.push(db.collection("compras").where("identifier", "==", searchId).get());
      }

      if (rawSearch && !searchId) {
        directDocPromises.push(db.collection("compras").doc(rawSearch).get());
        queries.push(db.collection("compras").where("identifier", "==", rawSearch).get());
      }

      if (phone) {
        queries.push(db.collection("compras").where("telefone", "==", phone).get());
        queries.push(db.collection("compras").where("telefone", "==", "55" + phone).get());
        if (rawPhone && rawPhone !== phone) {
          queries.push(db.collection("compras").where("telefone", "==", rawPhone).get());
        }
      }

      if (cleanCpf && cleanCpf !== "00000000000") {
        queries.push(db.collection("compras").where("cpf", "==", cleanCpf).get());
        if (rawCpf && rawCpf !== cleanCpf) {
          queries.push(db.collection("compras").where("cpf", "==", rawCpf).get());
        }
      }

      if (searchName && searchName.length >= 3) {
        queries.push(db.collection("compras").where("nome", "==", searchName).get());
        queries.push(
          db.collection("compras")
            .where("nome", ">=", searchName)
            .where("nome", "<=", searchName + "\uf8ff")
            .limit(20)
            .get()
        );
      }

      const [snapshots, directDocs] = await Promise.all([
        Promise.all(queries),
        Promise.all(directDocPromises)
      ]);

      const allDocSnaps: admin.firestore.DocumentSnapshot[] = [];
      for (const snap of directDocs) {
        if (snap.exists) allDocSnaps.push(snap);
      }
      for (const snapshot of snapshots) {
        for (const doc of snapshot.docs) {
          allDocSnaps.push(doc);
        }
      }

      if (allDocSnaps.length === 0) {
        return res.json({ success: false, message: "Nenhuma compra registrada para estes dados." });
      }

      let allPurchases: any[] = [];
      let name = "";
      const processedDocs = new Set<string>();
      const raffleNames: Record<string, string> = {};

      for (const doc of allDocSnaps) {
        if (processedDocs.has(doc.id)) continue;
        processedDocs.add(doc.id);

        const data = doc.data();
        if (data && data.numero && Array.isArray(data.numero)) {
          const rifaId = data.rifaId;
          if (rifaId && !raffleNames[rifaId]) {
            try {
              const rSnap = await db.collection("raffles").doc(rifaId).get();
              if (rSnap.exists) {
                raffleNames[rifaId] = rSnap.data()?.name || "Rifa";
              }
            } catch (e) {
              raffleNames[rifaId] = "Rifa";
            }
          }

          const isPaid = isPago(data.status);

          allPurchases.push({
            id: doc.id,
            raffleId: rifaId,
            raffleName: raffleNames[rifaId] || "Rifa Especial",
            numbers: data.numero,
            status: isPaid ? "paid" : "pending",
            rawStatus: data.status,
            valor: data.valor || 0,
            pix_code: data.pix_code || "",
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || new Date().toISOString()
          });
        }
        if (!name && data?.nome) name = data.nome;
      }

      // Ordena compras: pagas primeiro, e por data mais recente
      allPurchases.sort((a, b) => {
        if (a.status === 'paid' && b.status !== 'paid') return -1;
        if (a.status !== 'paid' && b.status === 'paid') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json({
        success: true,
        purchases: allPurchases,
        name: name
      });
    } catch (error: any) {
      console.error("Erro ao consultar números:", error.message || String(error));
      res.status(500).json({ success: false, message: "Erro ao consultar números", details: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
