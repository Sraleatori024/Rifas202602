import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../../lib/firebase-admin.js';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Garantir Content-Type JSON em todas as respostas
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método não permitido. Utilize POST.' 
    });
  }

  const { groupId, adminId } = req.body || {};

  if (!groupId) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID do grupo (groupId) é obrigatório.' 
    });
  }

  try {
    const db = getDb();
    const cleanGroupId = String(groupId).trim();
    const groupRef = db.collection("pix_groups").doc(cleanGroupId);

    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Grupo Pix não encontrado.' 
      });
    }

    const groupData = groupSnap.data()!;

    // Regra de sorteio único: Não permitir novo sorteio se o grupo já foi sorteado
    if (groupData.status === "completed" || groupData.status === "drawn") {
      return res.status(400).json({ 
        success: false, 
        message: 'Este sorteio já foi realizado anteriormente e não pode ser refeito.' 
      });
    }

    // Buscar somente participações daquele groupId
    const participationsSnap = await db.collection("pix_participations")
      .where("groupId", "==", cleanGroupId)
      .get();

    // Considerar somente participações válidas (status == "valid" ou "active"), excluindo explicitamente canceladas ou pendentes
    const validParticipants: any[] = [];
    participationsSnap.forEach((doc: any) => {
      const data = doc.data();
      const st = String(data.status || "").toLowerCase();
      if (st === "valid" || st === "active") {
        validParticipants.push({ docId: doc.id, ...data });
      }
    });

    if (validParticipants.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhuma participação válida encontrada para este grupo.' 
      });
    }

    // Seleciona aleatoriamente e de forma criptográfica uma participação válida
    const randomBuffer = crypto.randomBytes(4);
    const randomIndex = randomBuffer.readUInt32BE(0) % validParticipants.length;
    const winner = validParticipants[randomIndex];

    const winnerCode = winner.participationCode || winner.participation_code || winner.code || winner.docId;
    const winnerName = winner.buyer_name || winner.userName || winner.name || "Participante";
    const winnerParticipationId = winner.id || winner.docId || winnerCode;
    const groupTitle = groupData.name || groupData.title || "Grupo Pix";
    const prize = groupData.prize || groupData.prizeValue || "Prêmio PIX";

    const drawId = `draw_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const drawRef = db.collection("pix_draws").doc(drawId);

    // Registro seguro do sorteio na coleção pix_draws
    // (NÃO armazenar CPF ou telefone na informação pública do resultado)
    const drawRecord = {
      id: drawId,
      groupId: cleanGroupId,
      group_id: cleanGroupId,
      groupTitle: groupTitle,
      group_name: groupTitle,
      prize: prize,
      participationId: winnerParticipationId,
      code: winnerCode,
      winnerParticipationCode: winnerCode,
      winner_code: winnerCode,
      winner_participation_id: winnerParticipationId,
      winnerName: winnerName,
      winner_name: winnerName,
      drawnAt: admin.firestore.FieldValue.serverTimestamp(),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      drawn_by: adminId || "system_backend",
      status: "completed",
      totalValidParticipations: validParticipants.length,
      winnerIndex: randomIndex
    };

    await drawRef.set(drawRecord);

    // Atualiza status do grupo para drawn (sorteio único)
    await groupRef.update({
      status: "drawn",
      winnerParticipationCode: winnerCode,
      winner_code: winnerCode,
      winnerName: winnerName,
      winner_name: winnerName,
      drawnAt: admin.firestore.FieldValue.serverTimestamp(),
      draw_date: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[SORTEIO GRUPO PIX API] Sorteio realizado com sucesso para Grupo ${cleanGroupId}. Vencedor: ${winnerName} (${winnerCode})`);

    return res.status(200).json({
      success: true,
      groupId: cleanGroupId,
      participationId: winnerParticipationId,
      code: winnerCode,
      winnerName: winnerName,
      draw: drawRecord
    });

  } catch (error: any) {
    console.error("[SORTEIO GRUPO PIX API ERRO]:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Erro interno ao realizar sorteio do Grupo Pix' 
    });
  }
}
