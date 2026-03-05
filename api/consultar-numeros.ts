import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, admin } from '../firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { whatsapp } = req.body;

  if (!whatsapp) {
    return res.status(400).json({ error: "WhatsApp é obrigatório" });
  }

  try {
    const userRef = db.collection("users").doc(whatsapp);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const userData = userSnap.data()!;
    
    // Fetch raffle names for better UX
    const purchases = userData.purchases || [];
    const enrichedPurchases = await Promise.all(purchases.map(async (p: any) => {
      const raffleRef = db.collection("raffles").doc(p.raffleId);
      const raffleSnap = await raffleRef.get();
      return {
        ...p,
        raffleName: raffleSnap.exists ? raffleSnap.data()?.name : "Rifa Excluída"
      };
    }));

    res.json({
      success: true,
      name: userData.name,
      whatsapp: userData.whatsapp,
      instagram: userData.instagram,
      purchases: enrichedPurchases
    });

  } catch (error) {
    console.error("Consult Error:", error);
    res.status(500).json({ error: "Erro ao consultar números." });
  }
}
