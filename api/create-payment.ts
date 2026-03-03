import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return res.status(200).json({
      status: "API funcionando",
      method: req.method
    });
  } catch (error) {
    return res.status(500).json({
      error: "Erro interno",
      details: String(error)
    });
  }
}
