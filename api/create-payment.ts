import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(
      "https://api.syncpayments.com.br/api/partner/v1/auth-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.SYNC_CLIENT_ID,
          client_secret: process.env.SYNC_CLIENT_SECRET,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao autenticar na SyncPayments");
    }

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error("ERRO CREATE PAYMENT:", error);
    return res.status(500).json({ error: "Erro interno ao criar pagamento" });
  }
}
