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

const safeStringify = (obj: any, indent: number = 2): string => {
  if (obj === undefined) return 'undefined';
  if (obj === null) return 'null';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  try {
    const seen = new WeakSet();
    const cleanObject = (item: any, depth = 0): any => {
      if (depth > 6) return '[Max Depth]';
      if (item === null || typeof item !== 'object') {
        if (typeof item === 'bigint') return item.toString();
        if (typeof item === 'function') return '[Function]';
        if (typeof item === 'symbol') return item.toString();
        return item;
      }
      if (seen.has(item)) return '[Circular]';
      seen.add(item);

      if (Array.isArray(item)) {
        return item.map(el => cleanObject(el, depth + 1));
      }

      const result: Record<string, any> = {};
      for (const key of Object.keys(item)) {
        try {
          result[key] = cleanObject(item[key], depth + 1);
        } catch {
          result[key] = '[Unserializable]';
        }
      }
      return result;
    };

    return JSON.stringify(cleanObject(obj), null, indent);
  } catch (e) {
    try {
      return String(obj);
    } catch {
      return "[Erro ao serializar objeto]";
    }
  }
};

const extractCandidateIdentifiers = (req: VercelRequest): string[] => {
  const ids = new Set<string>();
  const body = req.body || {};
  const query = req.query || {};

  const add = (val: any) => {
    if (val !== undefined && val !== null) {
      const s = String(val).trim();
      if (s.length > 0 && s !== "null" && s !== "undefined") {
        ids.add(s);
      }
    }
  };

  // Direct body fields
  add(body.external_id);
  add(body.externalId);
  add(body.external_reference);
  add(body.externalReference);
  add(body.identifier);
  add(body.id);
  add(body.transaction_id);
  add(body.transactionId);
  add(body.payment_id);
  add(body.paymentId);
  add(body.reference_id);
  add(body.referenceId);
  add(body.order_id);
  add(body.orderId);
  add(body.custom_id);
  add(body.customId);

  // Nested data object
  if (body.data && typeof body.data === 'object') {
    add(body.data.external_id);
    add(body.data.externalId);
    add(body.data.external_reference);
    add(body.data.externalReference);
    add(body.data.identifier);
    add(body.data.id);
    add(body.data.transaction_id);
    add(body.data.transactionId);
    add(body.data.payment_id);
    add(body.data.paymentId);
    add(body.data.reference_id);
    add(body.data.referenceId);
    add(body.data.order_id);
    add(body.data.orderId);
  }

  // Nested payment object
  if (body.payment && typeof body.payment === 'object') {
    add(body.payment.external_id);
    add(body.payment.externalId);
    add(body.payment.identifier);
    add(body.payment.id);
    add(body.payment.transaction_id);
  }

  // Nested transaction object
  if (body.transaction && typeof body.transaction === 'object') {
    add(body.transaction.external_id);
    add(body.transaction.externalId);
    add(body.transaction.identifier);
    add(body.transaction.id);
  }

  // Query params
  add(query.external_id);
  add(query.identifier);
  add(query.id);
  add(query.payment_id);

  return Array.from(ids);
};

const extractStatusInfo = (req: VercelRequest): { status: string; isPaid: boolean; isCancelled: boolean } => {
  const body = req.body || {};
  const statusValues: string[] = [];

  const addVal = (v: any) => {
    if (v !== undefined && v !== null) {
      statusValues.push(String(v));
    }
  };

  addVal(body.status);
  addVal(body.event);
  addVal(body.action);
  addVal(body.type);
  addVal(body.data?.status);
  addVal(body.data?.event);
  addVal(body.payment?.status);
  addVal(body.transaction?.status);

  const combined = statusValues.join(" ").toLowerCase();

  const paidKeywords = [
    "paid", "pago", "approved", "aprovado", "completed", "completo",
    "sucesso", "success", "confirmed", "confirmado", "settled",
    "received", "pix_received", "cashin_paid", "cash_in.paid",
    "payment.paid", "payment.approved", "transaction.paid"
  ];

  const cancelledKeywords = [
    "cancelled", "canceled", "cancelado", "expired", "expirado",
    "failed", "falhou", "rejected", "rejeitado", "refunded", "reembolsado"
  ];

  const isPaid = paidKeywords.some(kw => combined.includes(kw));
  const isCancelled = !isPaid && cancelledKeywords.some(kw => combined.includes(kw));

  return {
    status: statusValues[0] || (isPaid ? "paid" : "pending"),
    isPaid,
    isCancelled
  };
};

const generateUniqueNumbers = async (raffleId: string, quantity: number, maxNumbers: number): Promise<number[]> => {
  const generated = new Set<number>();
  while (generated.size < quantity) {
    const num = Math.floor(Math.random() * maxNumbers);
    generated.add(num);
  }
  return Array.from(generated);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log("=========================================");
  console.log("[API Webhook SyncPay] Recebido em:", new Date().toISOString());
  console.log("[API Webhook SyncPay] Headers:", safeStringify(req.headers, 2));
  console.log("[API Webhook SyncPay] Query:", safeStringify(req.query, 2));
  console.log("[API Webhook SyncPay] Body completo:", safeStringify(req.body, 2));

  const candidateIds = extractCandidateIdentifiers(req);
  const statusInfo = extractStatusInfo(req);
  const pixCode = req.body?.pix_code || req.body?.data?.pix_code || req.body?.pix_qrcode || req.body?.qrcode;

  console.log(`[API Webhook] IDs identificados:`, candidateIds);
  console.log(`[API Webhook] Status detectado: ${statusInfo.status} (isPaid: ${statusInfo.isPaid}, isCancelled: ${statusInfo.isCancelled})`);

  if (candidateIds.length === 0 && !pixCode) {
    console.error("[API Webhook Erro] Nenhum identificador ou código PIX encontrado no payload.");
    return res.status(400).json({ error: "Missing identifier/external_id in payload" });
  }

  try {
    const db = getDb();
    let purchaseDoc: any = null;

    // Multi-tier search for the purchase document
    for (const id of candidateIds) {
      // 1. Direct document lookup
      const directRef = db.collection("compras").doc(id);
      const directSnap = await directRef.get();
      if (directSnap.exists) {
        purchaseDoc = directSnap;
        console.log(`[API Webhook] Compra encontrada diretamente pelo doc.id: ${id}`);
        break;
      }

      // 2. Lookup by identifier field
      const queryId = await db.collection("compras").where("identifier", "==", id).limit(1).get();
      if (!queryId.empty) {
        purchaseDoc = queryId.docs[0];
        console.log(`[API Webhook] Compra encontrada pelo campo identifier: ${id}`);
        break;
      }

      // 3. Lookup by external_id field
      const queryExt = await db.collection("compras").where("external_id", "==", id).limit(1).get();
      if (!queryExt.empty) {
        purchaseDoc = queryExt.docs[0];
        console.log(`[API Webhook] Compra encontrada pelo campo external_id: ${id}`);
        break;
      }

      // 4. Lookup by gateway_id field
      const queryGateway = await db.collection("compras").where("gateway_id", "==", id).limit(1).get();
      if (!queryGateway.empty) {
        purchaseDoc = queryGateway.docs[0];
        console.log(`[API Webhook] Compra encontrada pelo campo gateway_id: ${id}`);
        break;
      }
    }

    // 5. Lookup by pix_code if not found yet
    if (!purchaseDoc && pixCode) {
      const queryPix = await db.collection("compras").where("pix_code", "==", String(pixCode).trim()).limit(1).get();
      if (!queryPix.empty) {
        purchaseDoc = queryPix.docs[0];
        console.log(`[API Webhook] Compra encontrada pelo campo pix_code.`);
      }
    }

    if (!purchaseDoc) {
      console.error(`[API Webhook Erro] Compra não encontrada para nenhum dos IDs: ${candidateIds.join(", ")}`);
      return res.status(404).json({ error: "Compra não encontrada", candidateIds });
    }

    // Handle Payment Cancellation / Expiration
    if (statusInfo.isCancelled) {
      console.log(`[API Webhook] Cancelando/liberando reserva para compra ${purchaseDoc.id}`);
      const purchaseData = purchaseDoc.data();
      if (purchaseData.status === "paid" || purchaseData.status === "pago") {
        return res.status(200).json({ received: true, message: "Já estava pago anteriormente." });
      }

      const batch = db.batch();
      const raffleRef = db.collection("raffles").doc(purchaseData.rifaId);
      const raffleSnap = await raffleRef.get();
      if (raffleSnap.exists) {
        const raffleData = raffleSnap.data()!;
        const currentReservations = Array.isArray(raffleData.reserved_numbers) ? raffleData.reserved_numbers : [];
        const remainingReservations = currentReservations.filter((r: any) => 
          r.id !== purchaseDoc.id && 
          r.id !== purchaseData?.identifier && 
          r.id !== purchaseData?.external_id
        );
        batch.update(raffleRef, {
          reserved_numbers: remainingReservations,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      batch.update(purchaseDoc.ref, {
        status: "cancelled",
        cancelled_at: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      return res.status(200).json({ success: true, message: "Reserva cancelada e liberada com sucesso." });
    }

    // Handle Payment Approval
    if (!statusInfo.isPaid) {
      console.log(`[API Webhook] Status '${statusInfo.status}' não indica pagamento concluído. Ignorando.`);
      return res.status(200).json({ received: true, message: `Status ${statusInfo.status} recebido e mantido pendente.` });
    }

    // Process confirmed payment
    await processPayment(purchaseDoc, res);

  } catch (error: any) {
    console.error("[API Webhook Erro Crítico]:", error.message || String(error));
    return res.status(500).json({ error: "Erro ao processar webhook.", details: error.message });
  }
}

async function processPayment(docSnap: any, res: VercelResponse) {
  const db = getDb();
  const paymentRef = docSnap.ref;
  const paymentId = docSnap.id;

  try {
    const result = await db.runTransaction(async (transaction: any) => {
      const freshPurchaseSnap = await transaction.get(paymentRef);
      if (!freshPurchaseSnap.exists) {
        throw new Error("Compra não encontrada na transação.");
      }

      const purchaseData = freshPurchaseSnap.data();
      const currentStatus = String(purchaseData.status || "").toLowerCase().trim();

      // 1. IDEMPOTENCY: Check if already paid inside transaction
      if (currentStatus === "paid" || currentStatus === "pago" || currentStatus === "approved") {
        console.log(`[API Webhook Idempotência] Compra ${paymentId} já confirmada anteriormente.`);
        return { alreadyPaid: true, purchaseData };
      }

      const { rifaId, numero, nome, telefone, valor, quantity } = purchaseData;
      if (!rifaId) {
        throw new Error("rifaId missing in purchase document");
      }

      const raffleRef = db.collection("raffles").doc(rifaId);
      const raffleSnap = await transaction.get(raffleRef);
      if (!raffleSnap.exists) {
        throw new Error("Rifa não encontrada");
      }

      const raffleData = raffleSnap.data()!;
      let numbersToConfirm: number[] = Array.isArray(numero) ? numero.map(Number) : [];

      const existingPaidNumbers = new Set<number>(
        Array.isArray(raffleData.paid_numbers) ? raffleData.paid_numbers.map(Number) : []
      );

      // 2. DETECÇÃO DE CONFLITO ATÔMICA (Sem substituição silenciosa)
      const conflictingNumbers = numbersToConfirm.filter(n => existingPaidNumbers.has(n));
      if (conflictingNumbers.length > 0) {
        console.error(`[API Webhook CONFLITO CRÍTICO] Números ${conflictingNumbers.join(", ")} já foram pagos por outro cliente na rifa ${rifaId}. Compra ${paymentId} marcada com payment_conflict.`);
        transaction.update(paymentRef, {
          status: "payment_conflict",
          conflict_numbers: conflictingNumbers,
          conflict_detected_at: admin.firestore.FieldValue.serverTimestamp(),
          webhook_processed_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return { conflict: true, conflictingNumbers, purchaseData };
      }

      // 3. ATUALIZAÇÃO ATÔMICA DA RIFA
      const currentReservations = Array.isArray(raffleData.reserved_numbers) ? raffleData.reserved_numbers : [];
      const remainingReservations = currentReservations.filter((r: any) => 
        r.id !== paymentId && 
        r.id !== purchaseData?.identifier && 
        r.id !== purchaseData?.external_id
      );

      const updatedPaidList = Array.from(new Set([...Array.from(existingPaidNumbers), ...numbersToConfirm]));
      const existingOccupied = Array.isArray(raffleData.occupied_numbers) ? raffleData.occupied_numbers.map(Number) : [];
      const updatedOccupiedList = Array.from(new Set([...existingOccupied, ...numbersToConfirm]));

      transaction.update(raffleRef, {
        reserved_numbers: remainingReservations,
        paid_numbers: updatedPaidList,
        occupied_numbers: updatedOccupiedList,
        sold_count: admin.firestore.FieldValue.increment(numbersToConfirm.length),
        revenue: admin.firestore.FieldValue.increment(Number(valor || 0)),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. ELEGIBILIDADE DA ROLETA
      let rouletteEligible = false;
      if (raffleData.roulette?.active && Number(valor || 0) >= Number(raffleData.roulette.min_purchase_value || 0)) {
        rouletteEligible = true;
      }

      // 5. ATUALIZAÇÃO DA COMPRA
      transaction.update(paymentRef, {
        status: "paid",
        numero: numbersToConfirm,
        paid_at: admin.firestore.FieldValue.serverTimestamp(),
        webhook_processed_at: admin.firestore.FieldValue.serverTimestamp(),
        roulette_eligible: rouletteEligible,
        roulette_spun: false
      });

      // 6. HISTÓRICO DO USUÁRIO
      const cleanPhone = normalizePhone(telefone);
      if (cleanPhone) {
        const userRef = db.collection("users").doc(cleanPhone);
        transaction.set(userRef, {
          name: nome || '',
          whatsapp: cleanPhone,
          purchases: admin.firestore.FieldValue.arrayUnion({
            rifaId,
            numero: numbersToConfirm,
            purchaseId: paymentId,
            valor: Number(valor || 0),
            paid_at: new Date().toISOString()
          })
        }, { merge: true });
      }

      return { success: true, numbersToConfirm, rifaId, nome, telefone, valor };
    });

    if (result.alreadyPaid) {
      return res.status(200).json({ 
        success: true, 
        idempotent: true, 
        message: "Pagamento já confirmado! Boa sorte 🍀" 
      });
    }

    if (result.conflict) {
      return res.status(200).json({
        success: false,
        conflict: true,
        message: "Conflito detectado: número já pago anteriormente por outro comprador. Compra registrada para suporte.",
        conflict_numbers: result.conflictingNumbers
      });
    }

    // 7. Atualização dos documentos individuais de número em background (merge seguro)
    const raffleRef = db.collection("raffles").doc(result.rifaId);
    const numbersRef = raffleRef.collection("numbers");
    const numBatch = db.batch();
    for (const num of result.numbersToConfirm) {
      numBatch.set(numbersRef.doc(String(num)), {
        number: Number(num),
        status: 'paid',
        buyer_name: result.nome || '',
        buyer_whatsapp: result.telefone || '',
        userName: result.nome || '',
        userId: result.telefone || '',
        purchase_id: paymentId,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    await numBatch.commit().catch((err: any) => console.error("Erro ao atualizar subcoleção numbers:", err.message));

    console.log(`[API Webhook Sucesso Atômico] Pagamento ${paymentId} confirmado e números salvos com sucesso.`);
    return res.status(200).json({ 
      success: true, 
      message: "Pagamento confirmado com sucesso! Boa sorte 🍀",
      purchase_id: paymentId,
      numbers: result.numbersToConfirm
    });

  } catch (err: any) {
    console.error(`[API Webhook Erro no processamento de pagamento ${paymentId}]:`, err.message || String(err));
    return res.status(500).json({ error: "Erro interno ao processar pagamento", details: err.message });
  }
}
