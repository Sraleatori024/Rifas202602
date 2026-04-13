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
      body: JSON.stringify({
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
      body: JSON.stringify(payload)
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

const generateUniqueNumbers = async (raffleId: string, quantity: number, maxNumbers: number) => {
  const db = getDb();
  const numbersRef = db.collection("raffles").doc(raffleId).collection("numbers");
  const generated = new Set<number>();
  
  while (generated.size < quantity) {
    const num = Math.floor(Math.random() * maxNumbers) + 1;
    if (!generated.has(num)) {
      const doc = await numbersRef.doc(String(num)).get();
      if (!doc.exists) {
        generated.add(num);
      }
    }
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
      console.log(`[API HEADERS]`, JSON.stringify(req.headers, null, 2));
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
    console.log("==================================================");
    console.log("EXPRESS BACKEND: /api/create-payment");
    console.log("BODY TYPE:", typeof req.body);
    console.log("BODY KEYS:", Object.keys(req.body || {}));
    console.log("FULL BODY:", JSON.stringify(req.body, null, 2));
    
    const raffleId = req.body.rifaId || req.body.raffleId;
    const buyer = req.body.buyer || {
      name: req.body.nome || req.body.name,
      whatsapp: req.body.telefone || req.body.whatsapp || req.body.phone,
      cpf: req.body.cpf,
      instagram: req.body.instagram
    };
    
    const requestedNumbers = req.body.numero || req.body.numbers;
    const pkgInfo = req.body.pacote || req.body.packageId;
    
    console.log("DADOS EXTRAÍDOS:", { raffleId, buyerName: buyer?.name, buyerPhone: buyer?.whatsapp, hasNumbers: !!requestedNumbers?.length, pkgInfo });

    // Validação básica
    if (!raffleId || (!requestedNumbers?.length && !pkgInfo) || !buyer || !buyer.whatsapp || !buyer.name) {
      console.warn("BACKEND: Dados incompletos detectados.");
      return res.status(400).json({ 
        success: false, 
        code: "DADOS_INCOMPLETOS",
        message: "Dados incompletos (Nome, WhatsApp e Números/Pacote são obrigatórios)" 
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
      let finalNumbers: number[] = [];
      let quantityNeeded = 0;
      let bonusNumbers = 0;

      // 1. Identificar Números ou Pacote e Calcular Preço
      if (pkgInfo) {
        if (typeof pkgInfo === 'string') {
          // Caso seja um ID de pacote (sistema atual)
          const pkg = (raffleData.packages || []).find((p: any) => p.id === pkgInfo);
          if (!pkg) return res.status(400).json({ success: false, message: "Pacote não encontrado." });
          quantityNeeded = pkg.quantity;
          totalAmount = pkg.price;
        } else if (typeof pkgInfo === 'object') {
          // Caso seja um objeto com quantidade e preço (novo requisito)
          quantityNeeded = pkgInfo.quantidade || pkgInfo.quantity || 0;
          totalAmount = pkgInfo.preco || pkgInfo.price || 0;
          
          if (quantityNeeded <= 0) {
            return res.status(400).json({ success: false, message: "Quantidade do pacote inválida." });
          }
        } else {
          return res.status(400).json({ success: false, message: "Formato de pacote inválido." });
        }
      } else if (requestedNumbers && Array.isArray(requestedNumbers)) {
        // Caso seja seleção manual de números
        if (raffleData.type === 'automatic') {
          return res.status(400).json({ success: false, message: "Esta rifa aceita apenas pacotes (números automáticos)." });
        }
        quantityNeeded = requestedNumbers.length;
        totalAmount = quantityNeeded * (raffleData.price || 0);
        finalNumbers = requestedNumbers;
      } else {
        return res.status(400).json({ success: false, message: "Nenhum número ou pacote selecionado." });
      }

      // 2. Apply Promotions
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

      // 3. Validate Numbers (Manual Only)
      if (raffleData.type === 'manual' && finalNumbers.length > 0) {
        const checkResults = await Promise.all(finalNumbers.map(n => 
          raffleRef.collection("numbers").doc(String(n)).get()
        ));
        for (const snap of checkResults) {
          if (snap.exists && isPago(snap.data()?.status)) {
            return res.status(400).json({ success: false, message: `O número ${snap.id} já foi vendido.` });
          }
        }
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

      await db.collection("compras").doc(identifier).set({
        nome: buyer.name,
        telefone: normalizePhone(buyer.whatsapp),
        cpf: normalizeCPF(buyer.cpf),
        pix_code: pix_code,
        identifier: identifier,
        status: "criada",
        numero: finalNumbers, // Empty for automatic, filled later
        quantity: quantityNeeded + bonusNumbers,
        rifaId: raffleId,
        valor: totalAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

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
      res.status(500).json({ success: false, message: "Erro ao processar pagamento" });
    }
  });

  // Webhook SyncPay
  app.post("/api/webhook-syncpay", async (req, res) => {
    const data = req.body;
    console.log("-----------------------------------------");
    console.log("[Webhook] Recebido em:", new Date().toISOString());
    console.log("[Webhook] Payload completo:", JSON.stringify(data, null, 2));

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
      roulette_spin: {
        eligible: rouletteEligible,
        spun: false
      }
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
      const cleanCpf = cpf ? normalizeCPF(cpf) : null;

      console.log(`[Consultar] Buscando por Telefone: ${phone}, CPF: ${cleanCpf}`);

      const db = getDb();
      let snapshots: admin.firestore.QuerySnapshot[] = [];

      if (phone && cleanCpf) {
        const q1 = db.collection("compras").where("telefone", "==", phone).get();
        const q2 = db.collection("compras").where("cpf", "==", cleanCpf).get();
        snapshots = await Promise.all([q1, q2]);
      } else if (phone) {
        // Busca pelo telefone normalizado e também tenta com prefixo 55 caso tenha sido salvo assim
        const q1 = db.collection("compras").where("telefone", "==", phone).get();
        const q2 = db.collection("compras").where("telefone", "==", "55" + phone).get();
        const q3 = db.collection("compras").where("telefone", "==", whatsapp).get(); // Tenta original também
        snapshots = await Promise.all([q1, q2, q3]);
      } else if (cleanCpf) {
        snapshots = [await db.collection("compras").where("cpf", "==", cleanCpf).get()];
      }

      console.log(`[Consultar] Snapshots encontrados: ${snapshots.length}, Total docs: ${snapshots.reduce((acc, s) => acc + s.size, 0)}`);

      if (snapshots.every(s => s.empty)) {
        return res.json({ success: false, message: "Nenhuma compra encontrada" });
      }

      let confirmedNumbersByRaffle: Record<string, { raffleName: string, numbers: number[], status: string }> = {};
      let name = "";
      const processedDocs = new Set<string>();

      for (const snapshot of snapshots) {
        for (const doc of snapshot.docs) {
          if (processedDocs.has(doc.id)) continue;
          processedDocs.add(doc.id);

          const data = doc.data();
          if (data.numero && Array.isArray(data.numero)) {
            const rifaId = data.rifaId;
            if (rifaId) {
              if (!confirmedNumbersByRaffle[rifaId]) {
                let raffleName = "Rifa";
                const rSnap = await db.collection("raffles").doc(rifaId).get();
                if (rSnap.exists) {
                  raffleName = rSnap.data()?.name || "Rifa";
                }
                confirmedNumbersByRaffle[rifaId] = {
                  raffleName,
                  numbers: [],
                  status: data.status || 'criada'
                };
              }
              
              // Adiciona os números e remove duplicatas
              const currentNumbers = confirmedNumbersByRaffle[rifaId].numbers;
              const newNumbers = data.numero.filter((n: number) => !currentNumbers.includes(n));
              confirmedNumbersByRaffle[rifaId].numbers = [...currentNumbers, ...newNumbers].sort((a, b) => a - b);
              
              // Se qualquer compra daquela rifa estiver paga, marca como paga
              if (isPago(data.status)) {
                confirmedNumbersByRaffle[rifaId].status = "paid";
              }
            }
          }
          if (!name && data.nome) name = data.nome;
        }
      }

      const paidPurchases = Object.values(confirmedNumbersByRaffle).filter(p => isPago(p.status));

      if (paidPurchases.length === 0) {
        return res.json({ success: false, message: "Nenhuma compra paga encontrada" });
      }

      res.json({
        success: true,
        purchases: paidPurchases,
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
