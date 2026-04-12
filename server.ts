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
  return ["paid", "pago"].includes(status.toLowerCase());
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

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- API ROUTES ---

  // Create Payment (SyncPay PIX)
  app.post("/api/create-payment", async (req, res) => {
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

    try {
      const db = getDb();
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

      const identifier = `compra_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 4. API_PAGAMENTO_ERRO
      let accessToken;
      try {
        accessToken = await generateToken();
      } catch (authError: any) {
        return res.status(401).json({ 
          success: false, 
          code: "API_PAGAMENTO_ERRO",
          message: "Erro de autenticação na API de pagamentos", 
          details: authError.message 
        });
      }

      // 3. Criar Pagamento na SyncPayments
      const rawAppUrl = process.env.APP_URL;
      const appUrl = rawAppUrl ? (rawAppUrl.endsWith("/") ? rawAppUrl.slice(0, -1) : rawAppUrl) : "";
      const payload = {
        amount: Number(totalAmount.toFixed(2)),
        description: `Compra de rifa: ${raffleData.name || "Sorteio"}`,
        webhook_url: `${appUrl}/api/webhook-syncpay`,
        external_id: identifier,
        client: {
          name: buyer.name,
          cpf: normalizedCPFVal,
          email: buyer.email || "cliente@exemplo.com",
          phone: normalizePhone(buyer.whatsapp)
        }
      };

      let syncPayResult;
      try {
        syncPayResult = await createCashIn(accessToken, payload);
      } catch (apiError: any) {
        return res.status(500).json({
          success: false,
          code: "PIX_GERACAO_ERRO",
          message: apiError.message || "Erro ao gerar PIX na SyncPayments"
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

      const qrCodeBase64 = await QRCode.toDataURL(pix_code);

      const responseData = {
        success: true,
        pix_code: pix_code,
        qr_code: qrCodeBase64,
        identifier: identifier,
        numbers: finalNumbers,
        valor: totalAmount,
        cpf: normalizedCPFVal || buyer.cpf || ""
      };

      const compraRef = getDb().collection("compras").doc(identifier);
      await compraRef.set({
        nome: buyer.name,
        telefone: normalizePhone(buyer.whatsapp),
        cpf: responseData.cpf,
        pix_code: pix_code,
        identifier: identifier,
        status: "criada",
        numero: finalNumbers,
        rifaId: raffleId,
        valor: totalAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json(responseData);

    } catch (error: any) {
      console.error("Erro ao criar pagamento:", error.message || String(error));
      res.status(500).json({ 
        success: false, 
        code: "ERRO_INTERNO",
        message: "Erro interno ao processar pagamento", 
        details: error.message 
      });
    }
  });

  // Webhook SyncPay
  app.post("/api/webhook-syncpay", async (req, res) => {
    console.log("Webhook completo:", req.body);
    const data = req.body;
    const status = data?.status || data?.data?.status || data?.payment?.status;
    const external_id = data?.external_id || data?.data?.external_id || data?.payment?.external_id;
    const id = data?.id || data?.data?.id || data?.payment?.id;
    const paymentId = external_id || id;
    const normalizedStatus = String(status || "").toLowerCase().trim();
    const isSuccess = ["paid", "approved", "completed", "sucesso", "pago"].includes(normalizedStatus);

    if (!isSuccess) {
      console.log(`[Webhook] Status ignorado: ${status}`);
      return res.json({ received: true, message: `Status ${status} ignorado` });
    }

    if (!paymentId) {
      console.error("[Webhook Error] Identificador de pagamento ausente (external_id ou id)");
      return res.status(400).json({ error: "payment identifier missing" });
    }

    try {
      let paymentSnap = null;
      let paymentRef = null;

      // 1. Tenta buscar pelo external_id como ID do documento (que é como salvamos no create-payment)
      if (external_id) {
        const ref = getDb().collection("compras").doc(String(external_id));
        const snap = await ref.get();
        if (snap.exists) {
          paymentSnap = snap;
          paymentRef = ref;
        }
      }

      // 2. Tenta buscar pelo id (SyncPay ID) como ID do documento (caso tenha sido salvo assim)
      if (!paymentSnap && id) {
        const ref = getDb().collection("compras").doc(String(id));
        const snap = await ref.get();
        if (snap.exists) {
          paymentSnap = snap;
          paymentRef = ref;
        }
      }

      // 3. Tenta buscar pelo campo 'identifier'
      if (!paymentSnap && paymentId) {
        const q = await getDb().collection("compras").where("identifier", "==", String(paymentId)).limit(1).get();
        if (!q.empty) {
          paymentSnap = q.docs[0];
          paymentRef = paymentSnap.ref;
        }
      }

      if (!paymentSnap || !paymentSnap.exists) {
        console.error(`[Webhook Error] Compra ${paymentId} não encontrada no banco de dados.`);
        return res.status(404).json({ error: "Compra não encontrada" });
      }

      const purchaseData = paymentSnap.data();
      if (isPago(purchaseData.status)) {
        return res.json({ 
          success: true, 
          message: "Pagamento já confirmado! Boa sorte 🍀" 
        });
      }

      const { rifaId, numero, nome, telefone, valor } = purchaseData;
      const batch = getDb().batch();
      const raffleRef = getDb().collection("raffles").doc(rifaId);
      const numbersRef = raffleRef.collection("numbers");

      const numbersToConfirm = Array.isArray(numero) ? numero : [numero];
      
      for (const num of numbersToConfirm) {
        const numDocRef = numbersRef.doc(num.toString());
        batch.set(numDocRef, {
          number: Number(num),
          status: 'paid',
          userName: nome,
          userId: telefone,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      batch.update(raffleRef, {
        sold_count: admin.firestore.FieldValue.increment(numbersToConfirm.length),
        revenue: admin.firestore.FieldValue.increment(Number(valor || 0)),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.update(paymentRef!, {
        status: "paid",
        paid_at: admin.firestore.FieldValue.serverTimestamp()
      });

      const userPhone = normalizePhone(telefone);
      if (userPhone) {
        const userRef = getDb().collection("users").doc(userPhone);
        batch.set(userRef, {
          name: nome,
          whatsapp: userPhone,
          purchases: admin.firestore.FieldValue.arrayUnion({
            rifaId,
            numero: numbersToConfirm,
            paid_at: new Date().toISOString()
          })
        }, { merge: true });
      }

      await batch.commit();
      res.json({ success: true, message: "Pagamento confirmado! Boa sorte 🍀" });

    } catch (error: any) {
      console.error("[Webhook Error]:", error.message || String(error));
      res.status(500).json({ error: "Erro ao processar webhook.", details: error.message });
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
