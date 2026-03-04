
export async function generateToken() {
  const clientId = process.env.SYNC_CLIENT_ID;
  const clientSecret = process.env.SYNC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Configuração de API SyncPayments (SYNC_CLIENT_ID ou SYNC_CLIENT_SECRET) ausente.");
  }

  const response = await fetch("https://api.syncpayments.com.br/api/partner/v1/auth-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Erro ao gerar token SyncPayments:", errorText);
    throw new Error(`Falha na autenticação SyncPayments: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Resposta da SyncPayments não contém access_token.");
  }

  return data.access_token;
}

export async function createCashIn(token: string, data: any) {
  if (!token) {
    throw new Error("Token de acesso é obrigatório para criar Cash-In.");
  }

  const response = await fetch("https://api.syncpayments.com.br/api/partner/v1/cash-in", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error("Erro ao criar Cash-In SyncPayments:", responseData);
    const error: any = new Error("Erro na API SyncPayments");
    error.status = response.status;
    error.details = responseData;
    throw error;
  }

  return responseData;
}
