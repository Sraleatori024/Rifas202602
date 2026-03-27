import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, admin } from '../lib/firebase-admin.js';

const normalizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { whatsapp } = req.body;

  if (!whatsapp) {
    return res.status(400).json({ success: false, message: "WhatsApp é obrigatório" });
  }

  try {
    const phone = normalizePhone(whatsapp);
    const snapshot = await db.collection("compras")
      .where("telefone", "==", phone)
      .get();

    if (snapshot.empty) {
      return res.json({ success: false, message: "Nenhuma compra encontrada" });
    }

    let pendingNumbers: number[] = [];
    let confirmedNumbers: number[] = [];
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
    pendingNumbers = [...new Set(pendingNumbers)].sort((a, b) => a - b);
    confirmedNumbers = [...new Set(confirmedNumbers)].sort((a, b) => a - b);

    res.json({
      success: true,
      pending: pendingNumbers,
      confirmed: confirmedNumbers,
      name: name
    });

  } catch (error) {
    console.error("Consult Error:", error);
    res.status(500).json({ success: false, message: "Erro ao consultar números." });
  }
}
