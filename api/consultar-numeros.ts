import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

const normalizePhone = (phone: string) => {
  let clean = String(phone || "").replace(/\D/g, "");
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    clean = clean.substring(2);
  }
  return clean;
};

const isPaidStatus = (status: string) => {
  const s = String(status || "").toLowerCase().trim();
  return ["paid", "pago", "confirmed", "approved", "completed"].includes(s);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { whatsapp, cpf } = req.body;

  if (!whatsapp && !cpf) {
    return res.status(400).json({ success: false, message: "WhatsApp ou CPF é obrigatório para consulta." });
  }

  try {
    const db = getDb();
    const phone = whatsapp ? normalizePhone(whatsapp) : "";
    const rawPhone = whatsapp ? String(whatsapp).trim() : "";
    const normalizedCpf = cpf ? String(cpf).replace(/\D/g, "") : "";
    const rawCpf = cpf ? String(cpf).trim() : "";

    const queries: Promise<admin.firestore.QuerySnapshot>[] = [];

    if (phone) {
      queries.push(db.collection("compras").where("telefone", "==", phone).get());
      queries.push(db.collection("compras").where("telefone", "==", "55" + phone).get());
      if (rawPhone && rawPhone !== phone) {
        queries.push(db.collection("compras").where("telefone", "==", rawPhone).get());
      }
    }

    if (normalizedCpf) {
      queries.push(db.collection("compras").where("cpf", "==", normalizedCpf).get());
      if (rawCpf && rawCpf !== normalizedCpf) {
        queries.push(db.collection("compras").where("cpf", "==", rawCpf).get());
      }
    }

    const snapshots = await Promise.all(queries);

    if (snapshots.every(s => s.empty)) {
      return res.json({ success: false, message: "Nenhuma compra registrada para este WhatsApp ou CPF." });
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

          const status = String(data.status || "pending").toLowerCase();
          const isPaid = isPaidStatus(status);

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

    // Ordena: compras pagas primeiro, e por data mais recente
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
    console.error("Consult Error:", error.message || error);
    res.status(500).json({ success: false, message: "Erro ao consultar números." });
  }
}

