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
    const snapshot = await db.collection("pedidos")
      .where("phone", "==", phone)
      .get();

    if (snapshot.empty) {
      return res.json({ success: false, message: "Nenhuma compra encontrada" });
    }

    let allNumbers: number[] = [];
    let name = "";

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.numbers && Array.isArray(data.numbers)) {
        allNumbers = [...allNumbers, ...data.numbers];
      }
      if (!name && data.name) name = data.name;
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
}
