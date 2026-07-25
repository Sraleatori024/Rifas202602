import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import { getDb, admin } from "./lib/firebase-admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3) Corrigir telefone para remover () e espaços e normalizar prefixo 55
const normalizePhone = (phone: string) => {
  let clean = String(phone || "").replace(/\D/g, "");
  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55 para busca consistente
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    clean = clean.substring(2);
  }
  return clean;
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
    
    return {
      pix_code: data.pix_code || data.pix_qrcode || data.qrcode || "",
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

    if (!raffleId || (requestedNumbers.length === 0 && !pkgInfo) || !buyer?.whatsapp || !buyer?.name) {
      return res.status(400).json({ 
        success: false, 
        message: "Dados incompletos para processar o pagamento." 
      });
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

      // Clean up expired reservations first to free up space
      await cleanupExpiredReservations(db, raffleId);

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
        // Fallback: Generate numbers on server if not provided (e.g. older flow or backend direct)
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

        finalNumbers = await generateUniqueAvailableNumbersOnServer(db, raffleId, quantityNeeded, raffleData.total_numbers || 100);
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

      if (totalAmount <= 0) totalAmount = 0.01; // Minimum PIX

      const identifier = `compra_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const accessToken = await generateToken();
      
      const rawAppUrl = process.env.APP_URL;
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

      const syncPayResult = await createCashIn(accessToken, payload);
      const { pix_code } = syncPayResult;
      const qrCodeBase64 = await QRCode.toDataURL(pix_code);

      // Save purchase and reserve numbers atomically using a batch
      const batch = db.batch();
      const expiresAtDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes reservation

      // 1. Reserve each number in the raffle
      for (const num of finalNumbers) {
        batch.set(numbersRef.doc(String(num)), {
          number: Number(num),
          status: 'reserved',
          expires_at: expiresAtDate,
          buyer_name: buyer.name || "Cliente",
          buyer_phone: normalizePhone(buyer.whatsapp),
          purchase_id: identifier,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      // 2. Save the pending purchase
      const compraRef = db.collection("compras").doc(identifier);
      batch.set(compraRef, {
        nome: buyer.name || "Cliente",
        telefone: normalizePhone(buyer.whatsapp),
        cpf: normalizeCPF(buyer.cpf),
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

      res.json({
        success: true,
        pix_code,
        qr_code: qrCodeBase64,
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
    const data = req.body;
    console.log("-----------------------------------------");
    console.log("[Webhook] Recebido em:", new Date().toISOString());
    console.log("[Webhook] Payload completo:", safeStringify(data, 2));

    // Extração flexível de dados (SyncPay pode enviar no root ou dentro de 'data')
    const status = data?.status || data?.data?.status || data?.payment?.status;
    const external_id = data?.external_id || data?.data?.external_id || data?.payment?.external_id;
    const gateway_id = data?.id || data?.data?.id || data?.payment?.id;

    console.log(`[Webhook] Status extraído: ${status}`);
    console.log(`[Webhook] External ID extraído: ${external_id}`);
    console.log(`[Webhook] Gateway ID extraído: ${gateway_id}`);

    if (!external_id) {
      console.error("[Webhook Erro] external_id não encontrado no payload. Não é possível localizar a compra.");
      return res.status(400).json({ error: "external_id missing" });
    }

    const normalizedStatus = String(status || "").toLowerCase().trim();
    const isSuccess = isPago(normalizedStatus);

    if (!isSuccess) {
      console.log(`[Webhook] Status '${status}' não é de sucesso. Ignorando.`);
      return res.json({ received: true, message: `Status ${status} ignorado` });
    }

    try {
      const db = getDb();
      const paymentRef = db.collection("compras").doc(String(external_id));
      const paymentSnap = await paymentRef.get();

      if (!paymentSnap.exists) {
        console.error(`[Webhook Erro] Compra ${external_id} NÃO encontrada no Firestore.`);
        // Tenta buscar pelo campo identifier caso o ID do documento seja diferente
        const querySnap = await db.collection("compras").where("identifier", "==", String(external_id)).limit(1).get();
        
        if (querySnap.empty) {
          console.error(`[Webhook Erro] Falha total ao localizar compra ${external_id} por ID ou campo identifier.`);
          return res.status(404).json({ error: "Compra não encontrada" });
        }
        
        console.log(`[Webhook] Compra encontrada via query identifier.`);
        const doc = querySnap.docs[0];
        await processWebhookPayment(doc, res);
      } else {
        console.log(`[Webhook] Compra ${external_id} encontrada com sucesso.`);
        await processWebhookPayment(paymentSnap, res);
      }
    } catch (error: any) {
      console.error("[Webhook Erro Crítico]:", error.message || String(error));
      res.status(500).json({ error: "Erro interno ao processar webhook" });
    }
  });

  async function processWebhookPayment(paymentSnap: any, res: any) {
    const purchaseData = paymentSnap.data();
    const paymentRef = paymentSnap.ref;

    if (purchaseData.status === "paid" || purchaseData.status === "pago") {
      return res.json({ success: true, message: "Já processado" });
    }

    const { rifaId, numero, nome, telefone, valor, quantity } = purchaseData;
    const db = getDb();
    const raffleRef = db.collection("raffles").doc(rifaId);
    const raffleSnap = await raffleRef.get();
    
    if (!raffleSnap.exists) return res.status(404).json({ error: "Rifa não encontrada" });
    const raffleData = raffleSnap.data()!;

    let finalNumbers = Array.isArray(numero) ? numero : [];
    
    // Generate numbers for automatic raffle
    if (raffleData.type === 'automatic' && finalNumbers.length === 0) {
      finalNumbers = await generateUniqueNumbers(rifaId, quantity || 1, raffleData.total_numbers || 1000000);
    }

    const batch = db.batch();
    const numbersRef = raffleRef.collection("numbers");

    for (const num of finalNumbers) {
      batch.set(numbersRef.doc(String(num)), {
        number: Number(num),
        status: 'paid',
        userName: nome,
        userId: telefone,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Roulette Eligibility
    let rouletteEligible = false;
    if (raffleData.roulette?.active && valor >= (raffleData.roulette.min_purchase_value || 0)) {
      rouletteEligible = true;
    }

    batch.update(raffleRef, {
      sold_count: admin.firestore.FieldValue.increment(finalNumbers.length),
      revenue: admin.firestore.FieldValue.increment(Number(valor || 0)),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    batch.update(paymentRef, {
      status: "paid",
      numero: finalNumbers,
      paid_at: admin.firestore.FieldValue.serverTimestamp(),
      roulette_eligible: rouletteEligible,
      roulette_spun: false
    });

    const userPhone = normalizePhone(telefone);
    if (userPhone) {
      const userRef = db.collection("users").doc(userPhone);
      batch.set(userRef, {
        name: nome,
        whatsapp: userPhone,
        purchases: admin.firestore.FieldValue.arrayUnion({
          rifaId,
          numero: finalNumbers,
          paid_at: new Date().toISOString()
        })
      }, { merge: true });
    }

    await batch.commit();
    res.json({ success: true, message: "Pagamento confirmado!" });
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
    const { whatsapp, cpf } = req.body;
    if (!whatsapp && !cpf) {
      return res.status(400).json({ 
        success: false, 
        code: "DADOS_INCOMPLETOS",
        message: "WhatsApp ou CPF é obrigatório" 
      });
    }

    try {
      const phone = whatsapp ? normalizePhone(whatsapp) : null;
      const rawPhone = whatsapp ? String(whatsapp).trim() : null;
      const cleanCpf = cpf ? normalizeCPF(cpf) : null;
      const rawCpf = cpf ? String(cpf).trim() : null;

      console.log(`[Consultar] Buscando por Telefone: ${phone}, CPF: ${cleanCpf}`);

      const db = getDb();
      const queries: Promise<admin.firestore.QuerySnapshot>[] = [];

      if (phone) {
        queries.push(db.collection("compras").where("telefone", "==", phone).get());
        queries.push(db.collection("compras").where("telefone", "==", "55" + phone).get());
        if (rawPhone && rawPhone !== phone) {
          queries.push(db.collection("compras").where("telefone", "==", rawPhone).get());
        }
      }

      if (cleanCpf) {
        queries.push(db.collection("compras").where("cpf", "==", cleanCpf).get());
        if (rawCpf && rawCpf !== cleanCpf) {
          queries.push(db.collection("compras").where("cpf", "==", rawCpf).get());
        }
      }

      const snapshots = await Promise.all(queries);

      if (snapshots.every(s => s.empty)) {
        return res.json({ success: false, message: "Nenhuma compra encontrada para estes dados." });
      }

      let allPurchases: any[] = [];
      let name = "";
      const processedDocs = new Set<string>();
      const raffleNames: Record<string, string> = {};

      for (const snapshot of snapshots) {
        for (const doc of snapshot.docs) {
          if (processedDocs.has(doc.id)) continue;
          processedDocs.add(doc.id);

          const data = doc.data();
          if (data.numero && Array.isArray(data.numero)) {
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
          if (!name && data.nome) name = data.nome;
        }
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
