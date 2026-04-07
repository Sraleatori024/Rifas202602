import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

const normalizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { whatsapp, cpf } = req.body;

  if (!whatsapp && !cpf) {
    return res.status(400).json({ success: false, message: "WhatsApp ou CPF é obrigatório" });
  }

  try {
    const db = getDb();
    const phone = normalizePhone(whatsapp);
    const normalizedCpf = String(cpf || "").replace(/\D/g, "");

    let snapshots: admin.firestore.QuerySnapshot[] = [];

    if (phone && normalizedCpf) {
      const q1 = db.collection("compras").where("telefone", "==", phone).get();
      const q2 = db.collection("compras").where("cpf", "==", normalizedCpf).get();
      snapshots = await Promise.all([q1, q2]);
    } else if (phone) {
      snapshots = [await db.collection("compras").where("telefone", "==", phone).get()];
    } else if (normalizedCpf) {
      snapshots = [await db.collection("compras").where("cpf", "==", normalizedCpf).get()];
    }

    if (snapshots.every(s => s.empty)) {
      return res.json({ success: false, message: "Nenhuma compra encontrada" });
    }

    let pendingPurchases: any[] = [];
    let confirmedNumbers: number[] = [];
    let name = "";

    const processedDocs = new Set<string>();

    for (const snapshot of snapshots) {
      snapshot.forEach(doc => {
        if (processedDocs.has(doc.id)) return;
        processedDocs.add(doc.id);

        const data = doc.data();
        if (data.numero && Array.isArray(data.numero)) {
          if (data.status === "paid") {
            confirmedNumbers = [...confirmedNumbers, ...data.numero];
          } else if (data.status === "pending") {
            pendingPurchases.push({
              id: doc.id,
              numbers: data.numero,
              pix_code: data.pix_code,
              valor: data.valor,
              createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null
            });
          }
        }
        if (!name && data.nome) name = data.nome;
      });
    }

    // Remover duplicatas e ordenar números confirmados
    confirmedNumbers = [...new Set(confirmedNumbers)].sort((a, b) => a - b);

    res.json({
      success: true,
      pendingPurchases: pendingPurchases,
      confirmed: confirmedNumbers,
      name: name
    });

  } catch (error) {
    console.error("Consult Error:", error.message || error);
    res.status(500).json({ success: false, message: "Erro ao consultar números." });
  }
}
