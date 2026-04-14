import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

const normalizePhone = (phone: string) => {
  let clean = String(phone || "").replace(/\D/g, "");
  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55 para busca consistente
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    clean = clean.substring(2);
  }
  return clean;
};

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
      const q1 = db.collection("compras").where("telefone", "==", phone).get();
      const q2 = db.collection("compras").where("telefone", "==", "55" + phone).get();
      snapshots = await Promise.all([q1, q2]);
    } else if (normalizedCpf) {
      snapshots = [await db.collection("compras").where("cpf", "==", normalizedCpf).get()];
    }

    if (snapshots.every(s => s.empty)) {
      return res.json({ success: false, message: "Nenhuma compra encontrada" });
    }

    let confirmedNumbers: any[] = [];
    let name = "";
    const processedDocs = new Set<string>();
    const raffleNames: Record<string, string> = {};

    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        if (processedDocs.has(doc.id)) continue;
        processedDocs.add(doc.id);

        const data = doc.data();
        if (data.numero && Array.isArray(data.numero)) {
          const status = String(data.status || "").toLowerCase();
          if (status === "paid" || status === "pago" || status === "pending") {
            const rifaId = data.rifaId;
            if (rifaId && !raffleNames[rifaId]) {
              const rSnap = await db.collection("raffles").doc(rifaId).get();
              if (rSnap.exists) {
                raffleNames[rifaId] = rSnap.data()?.name || "Rifa";
              }
            }
            
            confirmedNumbers.push({
              raffleName: raffleNames[rifaId] || "Rifa",
              numbers: data.numero,
              status: status,
              pix_code: data.pix_code
            });
          }
        }
        if (!name && data.nome) name = data.nome;
      }
    }

    res.json({
      success: true,
      purchases: confirmedNumbers,
      name: name
    });

  } catch (error) {
    console.error("Consult Error:", error.message || error);
    res.status(500).json({ success: false, message: "Erro ao consultar números." });
  }
}
