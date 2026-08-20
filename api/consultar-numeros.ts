import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

const normalizePhone = (phone: string | number | undefined | null) => {
  let clean = String(phone || "").replace(/\D/g, "");
  // Se começar com 0 e tiver 11 ou 12 dígitos, remove o zero inicial (ex: 011999999999 -> 11999999999)
  if (clean.startsWith("0") && (clean.length === 11 || clean.length === 12)) {
    clean = clean.substring(1);
  }
  // Se começar com 55 e tiver 12 ou 13 dígitos, remove o 55 para busca consistente
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    clean = clean.substring(2);
  }
  return clean;
};

const normalizeName = (name: string | undefined | null): string => {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const areNamesMatching = (name1: string | undefined | null, name2: string | undefined | null): boolean => {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return true;
  return n1 === n2;
};

const isPaidStatus = (status: string) => {
  const s = String(status || "").toLowerCase().trim();
  return ["paid", "pago", "confirmed", "approved", "completed"].includes(s);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { whatsapp, cpf, nome, identifier, search } = req.body;

  const rawPhone = whatsapp ? String(whatsapp).trim() : "";
  const phone = whatsapp ? normalizePhone(whatsapp) : "";
  const rawCpf = cpf ? String(cpf).trim() : "";
  const normalizedCpf = cpf ? String(cpf).replace(/\D/g, "") : "";
  const rawSearch = String(search || "").trim();
  const searchName = String(nome || rawSearch || "").trim();
  const searchId = String(identifier || (rawSearch.includes("compra_") ? rawSearch : "")).trim();

  if (!phone && !normalizedCpf && !searchName && !searchId) {
    return res.status(400).json({ success: false, message: "Informe WhatsApp, CPF, Nome ou Código da Compra." });
  }

  try {
    const db = getDb();
    const queries: Promise<admin.firestore.QuerySnapshot>[] = [];
    const directDocPromises: Promise<admin.firestore.DocumentSnapshot>[] = [];

    // Busca direta por ID da compra se fornecido ou pesquisado
    if (searchId) {
      directDocPromises.push(db.collection("compras").doc(searchId).get());
      if (!searchId.startsWith("compra_")) {
        directDocPromises.push(db.collection("compras").doc(`compra_${searchId}`).get());
      }
      queries.push(db.collection("compras").where("identifier", "==", searchId).get());
    }

    if (rawSearch && !searchId) {
      directDocPromises.push(db.collection("compras").doc(rawSearch).get());
      queries.push(db.collection("compras").where("identifier", "==", rawSearch).get());
    }

    if (phone) {
      queries.push(db.collection("compras").where("telefone", "==", phone).get());
      queries.push(db.collection("compras").where("telefone", "==", "55" + phone).get());
      if (rawPhone && rawPhone !== phone) {
        queries.push(db.collection("compras").where("telefone", "==", rawPhone).get());
      }
    }

    if (normalizedCpf && normalizedCpf !== "00000000000") {
      queries.push(db.collection("compras").where("cpf", "==", normalizedCpf).get());
      if (rawCpf && rawCpf !== normalizedCpf) {
        queries.push(db.collection("compras").where("cpf", "==", rawCpf).get());
      }
    }

    if (searchName && searchName.length >= 3) {
      queries.push(db.collection("compras").where("nome", "==", searchName).get());
      queries.push(
        db.collection("compras")
          .where("nome", ">=", searchName)
          .where("nome", "<=", searchName + "\uf8ff")
          .limit(20)
          .get()
      );
    }

    const [snapshots, directDocs] = await Promise.all([
      Promise.all(queries),
      Promise.all(directDocPromises)
    ]);

    const allDocSnaps: admin.firestore.DocumentSnapshot[] = [];
    for (const snap of directDocs) {
      if (snap.exists) allDocSnaps.push(snap);
    }
    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        allDocSnaps.push(doc);
      }
    }

    if (allDocSnaps.length === 0) {
      return res.json({ success: false, message: "Nenhuma compra registrada para estes dados." });
    }

    let allPurchases: any[] = [];
    let name = "";
    const processedDocs = new Set<string>();
    const raffleNames: Record<string, string> = {};

    for (const doc of allDocSnaps) {
      if (processedDocs.has(doc.id)) continue;
      processedDocs.add(doc.id);

      const data = doc.data();
      if (data && data.numero && Array.isArray(data.numero)) {
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
      if (!name && data?.nome) name = data.nome;
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

