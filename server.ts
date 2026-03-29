import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import { getDb, admin } from "./lib/firebase-admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3) Corrigir telefone para remover () e espaços
const normalizePhone = (phone: string) => {
  const clean = String(phone || "").replace(/\D/g, "");
  return clean;
};

// 4) Validar CPF com 11 números
const normalizeCPF = (cpf: string) => {
  const clean = String(cpf || "").replace(/\D/g, "");
  return clean;
};

// 1) Criar função para gerar token automaticamente
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

  console.log("Gerando token de acesso SyncPayments...");
  
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
      console.error("Erro ao gerar token:", data);
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
  console.log("Iniciando Cash-In SyncPayments...");
  
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
    
    // 8) Tratar erros corretamente e mostrar no console
    console.log("SYNC RESPONSE:", result);

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Erro na API SyncPayments");
    }

    // A API retorna pix_code no corpo principal ou dentro de data
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
    
    // 1. DADOS_INCOMPLETOS
    // Allow empty numbers if packageId is present
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

    try {
      const db = getDb();
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
              if (data.status !== "available") {
                throw new Error(`O número ${data.number} já foi reservado ou comprado.`);
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
            numbersRef.where("status", "==", "available").limit(quantityNeeded)
          );

          if (availableSnap.size < quantityNeeded) {
            throw new Error("Não há números disponíveis suficientes para este pacote.");
          }

          availableSnap.forEach((doc) => {
            snapshotsToUpdate.push(doc as admin.firestore.QueryDocumentSnapshot);
            finalNumbers.push(doc.data().number);
          });
        }

        // Reserve numbers (mark as pending)
        for (const docSnap of snapshotsToUpdate) {
          transaction.update(docSnap.ref, {
            status: "pending",
            reserved_at: admin.firestore.FieldValue.serverTimestamp(),
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
    const rawAppUrl = process.env.APP_URL || "https://ais-dev-qe6hjdlzyao7gwzeoa7fvv-101643794289.us-east1.run.app";
    const appUrl = rawAppUrl.endsWith("/") ? rawAppUrl.slice(0, -1) : rawAppUrl;
    const payload = {
      amount: Number(totalAmount.toFixed(2)),
      description: `Compra de rifa: ${raffleData.name || "Sorteio"}`,
      webhook_url: `${appUrl}/api/webhook-syncpay`,
      external_id: identifier,
      client: {
          name: buyer.name,
          cpf: normalizedCPF,
          email: buyer.email || "cliente@exemplo.com",
          phone: normalizePhone(buyer.whatsapp)
        }
      };

      // 5. PIX_GERACAO_ERRO
      let syncPayResult;
      try {
        console.log("Enviando payload para SyncPayments:", JSON.stringify(payload, null, 2));
        syncPayResult = await createCashIn(accessToken, payload);
        console.log("Resultado SyncPayments:", syncPayResult);
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

      // 6) Gerar QR Code automaticamente usando a biblioteca qrcode
      const qrCodeBase64 = await QRCode.toDataURL(pix_code);

      // 5) Retornar para o frontend: pix_code, qr_code (base64), identifier, numbers, valor, cpf
      const responseData = {
        success: true,
        pix_code: pix_code,
        qr_code: qrCodeBase64,
        identifier: identifier,
        numbers: finalNumbers,
        valor: totalAmount,
        cpf: normalizedCPF || buyer.cpf || ""
      };

      // Salvar registro do pedido no Firestore
      const compraRef = getDb().collection("compras").doc(identifier);
      await compraRef.set({
        nome: buyer.name,
        telefone: normalizePhone(buyer.whatsapp),
        cpf: responseData.cpf,
        pix_code: pix_code,
        identifier: identifier,
        status: "pending",
        numero: finalNumbers,
        rifaId: raffleId,
        valor: totalAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json(responseData);

    } catch (error: any) {
      console.error("Erro ao criar pagamento:", error);
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
    const { status, external_id, id } = req.body;
    const normalizedStatus = status?.toLowerCase();
    const paymentId = external_id || id;

    console.log(`[Webhook] Recebido: status=${status}, id=${id}, external_id=${external_id}`);
    console.log("Full Webhook Body:", JSON.stringify(req.body, null, 2));

    if (normalizedStatus !== "paid" && normalizedStatus !== "approved") {
      console.log(`[Webhook] Status ignorado: ${status}`);
      return res.json({ received: true });
    }

    if (!paymentId) {
      console.error("[Webhook Error] Identificador de pagamento ausente (external_id ou id)");
      return res.status(400).json({ error: "payment identifier missing" });
    }

    try {
      let paymentSnap = null;
      let paymentRef = null;

      // 1. Tenta buscar pelo ID do documento (caso o ID da SyncPay coincida ou tenha sido usado como ID do doc)
      if (id) {
        const ref = getDb().collection("compras").doc(String(id));
        const snap = await ref.get();
        if (snap.exists) {
          paymentSnap = snap;
          paymentRef = ref;
        }
      }

      // 2. Se não encontrou, busca pelo campo 'identifier' (que é o nosso external_id)
      if (!paymentSnap && external_id) {
        const q = await getDb().collection("compras").where("identifier", "==", String(external_id)).limit(1).get();
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
      if (purchaseData.status === "paid") {
        console.log(`[Webhook] Compra ${paymentId} já processada.`);
        return res.json({ 
          success: true, 
          message: "Pagamento já confirmado! Boa sorte 🍀" 
        });
      }

      console.log(`[Webhook] Processando pagamento para compra: ${paymentSnap.id}`);
      
      const { rifaId, numero, nome, telefone, valor } = purchaseData;
      const batch = getDb().batch();
      const raffleRef = getDb().collection("raffles").doc(rifaId);
      const numbersRef = raffleRef.collection("numbers");

      // Update numbers to 'confirmed'
      const numbersToConfirm = Array.isArray(numero) ? numero : [numero];
      const numbersChunks = [];
      for (let i = 0; i < numbersToConfirm.length; i += 30) {
        numbersChunks.push(numbersToConfirm.slice(i, i + 30));
      }

      for (const chunk of numbersChunks) {
        const selectedNumbersSnap = await numbersRef.where("number", "in", chunk).get();
        for (const doc of selectedNumbersSnap.docs) {
          batch.update(doc.ref, {
            status: 'confirmed',
            buyer_name: nome,
            buyer_whatsapp: telefone,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // Update raffle stats
      batch.update(raffleRef, {
        sold_count: admin.firestore.FieldValue.increment(numbersToConfirm.length),
        revenue: admin.firestore.FieldValue.increment(Number(valor || 0)),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Mark payment as paid
      batch.update(paymentRef!, {
        status: "paid",
        paid_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Associate numbers with user
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
      console.log(`[Webhook] Pagamento ${paymentId} processado com sucesso. Números: ${numbersToConfirm.join(', ')}`);
      
      res.json({ 
        success: true, 
        message: "Pagamento confirmado! Boa sorte 🍀" 
      });

    } catch (error: any) {
      console.error("[Webhook Error]:", error);
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

      let query: admin.firestore.Query = getDb().collection("compras");

      if (phone && cleanCpf) {
        query = query.where(admin.firestore.Filter.or(
          admin.firestore.Filter.where("telefone", "==", phone),
          admin.firestore.Filter.where("cpf", "==", cleanCpf)
        ));
      } else if (phone) {
        query = query.where("telefone", "==", phone);
      } else if (cleanCpf) {
        query = query.where("cpf", "==", cleanCpf);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        return res.json({ success: false, message: "Nenhuma compra encontrada" });
      }

      let confirmedNumbers: number[] = [];
      let pendingNumbers: number[] = [];
      let name = "";

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.numero && Array.isArray(data.numero)) {
          if (data.status === "paid") {
            confirmedNumbers = [...confirmedNumbers, ...data.numero];
          } else {
            pendingNumbers = [...pendingNumbers, ...data.numero];
          }
        }
        if (!name && data.nome) name = data.nome;
      });

      // Remover duplicatas e ordenar
      confirmedNumbers = [...new Set(confirmedNumbers)].sort((a, b) => a - b);
      pendingNumbers = [...new Set(pendingNumbers)].sort((a, b) => a - b);

      res.json({
        success: true,
        confirmed: confirmedNumbers,
        pending: pendingNumbers,
        name: name
      });
    } catch (error: any) {
      console.error("Erro ao consultar números:", error);
      res.status(500).json({ success: false, message: "Erro ao consultar números", details: error.message });
    }
  });

  // Vite middleware for development
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
