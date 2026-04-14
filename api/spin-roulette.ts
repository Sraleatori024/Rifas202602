import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from '../lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { purchaseId, raffleId } = req.body;

  if (!purchaseId || !raffleId) {
    return res.status(400).json({ error: 'purchaseId e raffleId são obrigatórios' });
  }

  try {
    const db = getDb();
    const purchaseRef = db.collection("compras").doc(purchaseId);
    const purchaseSnap = await purchaseRef.get();

    if (!purchaseSnap.exists) {
      return res.status(404).json({ error: 'Compra não encontrada' });
    }

    const purchaseData = purchaseSnap.data()!;
    
    // Validar se o pagamento foi confirmado
    const status = String(purchaseData.status || "").toLowerCase();
    if (status !== 'paid' && status !== 'pago') {
      return res.status(400).json({ error: 'A roleta só pode ser girada após a confirmação do pagamento.' });
    }

    // Validar se já girou a roleta
    if (purchaseData.roulette_spun) {
      return res.status(400).json({ error: 'A roleta já foi girada para esta compra.' });
    }

    const raffleSnap = await db.collection("raffles").doc(raffleId).get();
    if (!raffleSnap.exists) {
      return res.status(404).json({ error: 'Rifa não encontrada' });
    }

    const raffleData = raffleSnap.data()!;
    const roulette = raffleData.roulette;

    if (!roulette || !roulette.active) {
      return res.status(400).json({ error: 'Roleta não está ativa para esta rifa.' });
    }

    // Validar valor mínimo
    if (purchaseData.valor < (roulette.min_purchase_value || 0)) {
      return res.status(400).json({ error: 'Valor da compra insuficiente para girar a roleta.' });
    }

    // Lógica da Roleta
    const prizes = roulette.prizes || [];
    if (prizes.length === 0) {
      return res.status(400).json({ error: 'Nenhum prêmio configurado na roleta.' });
    }

    const totalChance = prizes.reduce((acc: number, p: any) => acc + (p.chance || 0), 0);
    let random = Math.random() * totalChance;
    let selectedPrize = prizes[0];

    for (const prize of prizes) {
      if (random < (prize.chance || 0)) {
        selectedPrize = prize;
        break;
      }
      random -= (prize.chance || 0);
    }

    // Gerar código único de prêmio
    const prizeCode = `PRIZE_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Salvar resultado na compra
    await purchaseRef.update({
      roulette_spun: true,
      roulette_result: {
        prize: selectedPrize,
        code: prizeCode,
        spun_at: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    // Se o prêmio for números extras, podemos gerá-los aqui ou deixar para o admin validar
    // Para simplificar e ser seguro, apenas retornamos o prêmio e o código.

    res.json({
      success: true,
      prize: selectedPrize,
      code: prizeCode
    });

  } catch (error: any) {
    console.error("Roulette Error:", error.message || error);
    res.status(500).json({ error: 'Erro ao processar roleta.' });
  }
}
