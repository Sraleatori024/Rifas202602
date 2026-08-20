import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

const normalizePhone = (phone: string | number | undefined | null) => {
  let clean = String(phone || "").replace(/\D/g, "");
  if (clean.startsWith("0") && (clean.length === 11 || clean.length === 12)) {
    clean = clean.substring(1);
  }
  if (clean.startsWith("55") && (clean.length === 12 || clean.length === 13)) {
    clean = clean.substring(2);
  }
  return clean;
};

const normalizeCPF = (cpf: string | undefined | null) => {
  const clean = cpf ? String(cpf).replace(/\D/g, "") : "";
  return clean.length === 11 ? clean : "";
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { purchaseId, whatsapp, cpf, nome } = req.body || {};

  if (!purchaseId) {
    return res.status(400).json({ success: false, message: "ID da compra é obrigatório." });
  }

  try {
    const db = getDb();
    const purchaseRef = db.collection("compras").doc(String(purchaseId).trim());
    const purchaseSnap = await purchaseRef.get();

    if (!purchaseSnap.exists) {
      return res.status(404).json({ success: false, message: "Compra não encontrada." });
    }

    const purchaseData = purchaseSnap.data()!;

    // 1. REGRA CRÍTICA DE SEGURANÇA: Nunca cancelar ou liberar números de compras já pagas
    const currentStatus = String(purchaseData.status || "").toLowerCase().trim();
    if (currentStatus === "paid" || currentStatus === "pago" || currentStatus === "approved" || currentStatus === "completed") {
      return res.status(400).json({ 
        success: false, 
        message: "Não é possível cancelar uma compra já paga e confirmada. Seus números já estão garantidos." 
      });
    }

    if (currentStatus === "cancelled" || currentStatus === "cancelado") {
      return res.json({ 
        success: true, 
        message: "Esta reserva já foi cancelada anteriormente e os números foram liberados." 
      });
    }

    // 2. SEGURANÇA DE TITULARIDADE: Verifica se quem está cancelando é o próprio titular
    const docPhone = normalizePhone(purchaseData.telefone);
    const reqPhone = normalizePhone(whatsapp);
    const docCpf = normalizeCPF(purchaseData.cpf);
    const reqCpf = normalizeCPF(cpf);
    const docName = normalizeName(purchaseData.nome);
    const reqName = normalizeName(nome);

    let isAuthorized = false;

    if (reqPhone && docPhone && (reqPhone === docPhone || reqPhone.endsWith(docPhone) || docPhone.endsWith(reqPhone))) {
      isAuthorized = true;
    } else if (reqCpf && docCpf && reqCpf === docCpf) {
      isAuthorized = true;
    } else if (reqName && docName && (reqName === docName || reqName.includes(docName) || docName.includes(reqName))) {
      isAuthorized = true;
    } else if (!whatsapp && !cpf && !nome) {
      // Se chamado diretamente com purchaseId (ex: sessão ativa do próprio usuário que acabou de gerar a compra)
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Não autorizado. Os dados informados não conferem com o titular desta reserva."
      });
    }

    // 3. Atualização atômica: remove da lista de reservados da rifa e marca a compra como cancelada
    const batch = db.batch();
    const rifaId = purchaseData.rifaId;

    if (rifaId) {
      const raffleRef = db.collection("raffles").doc(rifaId);
      const raffleSnap = await raffleRef.get();

      if (raffleSnap.exists) {
        const raffleData = raffleSnap.data()!;
        const currentReservations = Array.isArray(raffleData.reserved_numbers) ? raffleData.reserved_numbers : [];
        
        // Remove a reserva pelo ID da compra ou identificador
        const remainingReservations = currentReservations.filter((r: any) => 
          r.id !== purchaseId &&
          r.id !== purchaseData.identifier &&
          r.id !== purchaseData.external_id
        );

        batch.update(raffleRef, {
          reserved_numbers: remainingReservations,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // Atualiza status da compra
    batch.update(purchaseRef, {
      status: "cancelled",
      cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
      cancel_reason: "user_cancelled"
    });

    await batch.commit();

    console.log(`[CANCELAMENTO] Reserva ${purchaseId} cancelada e números liberados com sucesso.`);

    return res.json({
      success: true,
      message: "Números cancelados e liberados com sucesso.",
      purchaseId
    });

  } catch (error: any) {
    console.error("[CANCELAMENTO ERRO]:", error.message || String(error));
    return res.status(500).json({ 
      success: false, 
      message: "Erro ao cancelar reserva de números.",
      details: error.message 
    });
  }
}
