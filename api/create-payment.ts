import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    const { amount, name, phone } = req.body;

    if (!process.env.SYNCPAY_SECRET_KEY) {
      return res.status(500).json({ error: 'SYNCPAY_SECRET_KEY não definida' });
    }

    const response = await fetch('https://api.syncpay.com.br/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SYNCPAY_SECRET_KEY}`
      },
      body: JSON.stringify({
        amount,
        description: 'Compra de Rifa',
        customer: {
          name,
          phone
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Erro na SyncPay',
        details: data
      });
    }

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('ERRO CREATE PAYMENT:', error);

    return res.status(500).json({
      error: 'Erro interno no servidor',
      message: error.message
    });
  }
}
