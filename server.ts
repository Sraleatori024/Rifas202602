import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import QRCode from "qrcode";
import { db, admin } from "./lib/firebase-admin.js";

// 3) Corrigir telefone para remover () e espaços
const normalizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");

// 4) Validar CPF com 11 números
const normalizeCPF = (cpf: string) => {
  const clean = String(cpf || "").replace(/\D/g, "");
  return clean.length === 11 ? clean : null;
};

// 1) Criar função para gerar token automaticamente
async function generateToken() {
  const clientId = process.env.SYNC_CLIENT_ID || "89210cff-1a37-4cd0-825d-45fecd8e77bb";
  const clientSecret = process.env.SYNC_CLIENT_SECRET || "dadc1b2c-86ee-4256-845a-d1511de315bb";

  console.log("Gerando token de acesso SyncPayments...");
  
  try {
    const response = await fetch("https://api.syncpayments.com.br/api/partner/v1/auth-token", {
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
  console.log("Iniciando Cash-In SyncPayments...");
  
  try {
    const response = await fetch("https://api.syncpayments.com.br/api/partner/v1/cash-in", {
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
      pix_code: data.pix_code || "",
      identifier: data.identifier || ""
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
    const { raffleId, numbers, buyer } = req.body;
    
    // Validação básica de entrada
    if (!raffleId || !numbers || !buyer || !buyer.whatsapp || !buyer.name) {
      return res.status(400).json({ 
        success: false, 
        message: "Dados incompletos (Nome e WhatsApp são obrigatórios)" 
      });
    }

    const normalizedCPF = normalizeCPF(buyer.cpf);
    if (!normalizedCPF) {
      return res.status(400).json({ 
        success: false, 
        message: "CPF inválido. Deve conter 11 dígitos." 
      });
    }

    try {
      // 1. Buscar dados da rifa para calcular valor
      const raffleRef = db.collection("raffles").doc(raffleId);
      const raffleSnap = await raffleRef.get();
      
      if (!raffleSnap.exists) {
        return res.status(404).json({ success: false, message: "Rifa não encontrada." });
      }

      const raffleData = raffleSnap.data()!;
      const unitPrice = raffleData.price || 0;
      const totalAmount = numbers.length * unitPrice;

      // 2. Gerar Token SyncPayments
      let accessToken;
      try {
        accessToken = await generateToken();
      } catch (authError: any) {
        return res.status(401).json({ 
          success: false, 
          message: "Erro de autenticação na API de pagamentos", 
          details: authError.message 
        });
      }

      // 3. Criar Pagamento na SyncPayments
      const payload = {
        amount: Number(totalAmount.toFixed(2)),
        description: `Compra de rifa: ${raffleData.name || "Sorteio"}`,
        webhook_url: `${process.env.APP_URL}/api/webhook-syncpay`,
        client: {
          name: buyer.name,
          cpf: normalizedCPF,
          email: buyer.email || "cliente@exemplo.com",
          phone: normalizePhone(buyer.whatsapp)
        },
        // Opcional: split se necessário
        split: [
          {
            percentage: 10,
            user_id: "9f3c5b3a-41bc-4322-90e6-a87a98eefeca"
          }
        ]
      };

      let syncPayResult;
      try {
        syncPayResult = await createCashIn(accessToken, payload);
      } catch (apiError: any) {
        // 9) Caso a API retorne erro, retornar no JSON para o frontend
        return res.status(500).json({
          success: false,
          message: apiError.message || "Erro ao gerar PIX na SyncPayments"
        });
      }

      const { pix_code, identifier } = syncPayResult;

      if (!pix_code) {
        throw new Error("Código PIX não retornado pela API");
      }

      // 6) Gerar QR Code automaticamente usando a biblioteca qrcode
      const qrCodeBase64 = await QRCode.toDataURL(pix_code);

      // 5) Retornar para o frontend: pix_code, qr_code (base64), identifier
      const responseData = {
        success: true,
        pix_code: pix_code,
        qr_code: qrCodeBase64,
        identifier: identifier
      };

      // Salvar registro do pedido no Firestore
      const compraRef = db.collection("compras").doc(identifier);
      await compraRef.set({
        nome: buyer.name,
        telefone: normalizePhone(buyer.whatsapp),
        cpf: normalizedCPF || buyer.cpf || "",
        pix_code: pix_code,
        identifier: identifier,
        status: "pending",
        numero: numbers,
        rifaId: raffleId,
        valor: totalAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json(responseData);

    } catch (error: any) {
      console.error("Erro ao criar pagamento:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro interno ao processar pagamento", 
        details: error.message 
      });
    }
  });

  // Webhook SyncPay
  app.post("/api/webhook-syncpay", async (req, res) => {
    const { status, external_id } = req.body;

    console.log(`Webhook received: Payment ${external_id} status is ${status}`);

    if (status !== "paid") {
      return res.json({ received: true });
    }

    if (!external_id) {
      console.error("Webhook Error: external_id missing");
      return res.status(400).json({ error: "external_id missing" });
    }

    try {
      const paymentRef = db.collection("compras").doc(external_id);
      const paymentSnap = await paymentRef.get();

      if (!paymentSnap.exists) {
        console.error(`Webhook Error: Compra ${external_id} not found in database.`);
        return res.status(404).json({ error: "Compra não encontrada" });
      }

      if (paymentSnap.data().status === "paid") {
        console.log(`Webhook: Compra ${external_id} already processed.`);
        return res.json({ received: true });
      }

      const { rifaId, numero, nome, telefone, valor } = paymentSnap.data();

      const batch = db.batch();
      const raffleRef = db.collection("raffles").doc(rifaId);
      const numbersRef = raffleRef.collection("numbers");

      // Update numbers to 'sold'
      const numbersChunks = [];
      for (let i = 0; i < numero.length; i += 30) {
        numbersChunks.push(numero.slice(i, i + 30));
      }

      for (const chunk of numbersChunks) {
        const selectedNumbersSnap = await numbersRef.where("number", "in", chunk).get();
        for (const doc of selectedNumbersSnap.docs) {
          batch.update(doc.ref, {
            status: 'sold',
            buyer_name: nome,
            buyer_whatsapp: telefone,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // Update raffle stats
      batch.update(raffleRef, {
        sold_count: admin.firestore.FieldValue.increment(numero.length),
        revenue: admin.firestore.FieldValue.increment(valor),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Mark payment as paid
      batch.update(paymentRef, {
        status: "paid",
        paid_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Associate numbers with user
      const userRef = db.collection("users").doc(telefone);
      batch.set(userRef, {
        name: nome,
        whatsapp: telefone,
        purchases: admin.firestore.FieldValue.arrayUnion({
          rifaId,
          numero,
          paid_at: new Date().toISOString()
        })
      }, { merge: true });

      await batch.commit();
      console.log(`Payment ${external_id} processed successfully. Numbers: ${numero.join(', ')}`);
      res.json({ success: true });

    } catch (error: any) {
      console.error("Webhook Error:", error);
      res.status(500).json({ error: "Erro ao processar webhook.", details: error.message });
    }
  });

  // Consultar Números
  app.post("/api/consultar-numeros", async (req, res) => {
    const { whatsapp } = req.body;
    if (!whatsapp) return res.status(400).json({ success: false, message: "WhatsApp é obrigatório" });

    try {
      const phone = normalizePhone(whatsapp);
      const snapshot = await db.collection("compras")
        .where("telefone", "==", phone)
        .get();

      if (snapshot.empty) {
        return res.json({ success: false, message: "Nenhuma compra encontrada" });
      }

      let allNumbers: number[] = [];
      let name = "";

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.numero && Array.isArray(data.numero)) {
          allNumbers = [...allNumbers, ...data.numero];
        }
        if (!name && data.nome) name = data.nome;
      });

      // Remover duplicatas se houver
      allNumbers = [...new Set(allNumbers)].sort((a, b) => a - b);

      res.json({
        success: true,
        numbers: allNumbers,
        name: name
      });
    } catch (error) {
      console.error("Consult Error:", error);
      res.status(500).json({ success: false, message: "Erro ao consultar números." });
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
