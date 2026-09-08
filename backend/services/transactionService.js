import prisma from "../config/prisma.js";
import { findByCheckoutRequestId, findByProviderReference, updateProviderTransactionStatus } from "../repositories/postgres/prismaProviderTransactionRepository.js";
import { updatePaymentIntentStatus } from "../repositories/postgres/prismaPaymentIntentRepository.js";
import AppError from "../utils/AppError.js";

export {
  getPaymentStatus,
  getRecentTransactions,
  getSavingsActivity,
  getTransactionDetails,
  processWalletPayment,
  submitWithdrawal,
} from "./postgres/prismaTransactionService.js";

export async function handlePaymentCallback(payload = {}) {
  const checkoutRequestId = payload.checkoutRequestId || payload.callbackReference;
  const providerReference = payload.providerReference || payload.paymentReference || payload.reference;
  const providerTransaction =
    (await findByCheckoutRequestId(checkoutRequestId)) ||
    (await findByProviderReference(providerReference));

  if (!providerTransaction) throw new AppError("Payment not found", 404);

  const dedupeKey = String(
    payload.dedupeKey ||
      payload.callbackReference ||
      payload.checkoutRequestId ||
      `${providerTransaction.id}:${payload.status || "callback"}`
  );

  return prisma.$transaction(async (tx) => {
    const existingEvent = await tx.webhookEvent.findUnique({ where: { dedupeKey } });
    const callbackProviderTransaction = await tx.providerTransaction.findUnique({
      where: { id: providerTransaction.id },
      include: { paymentIntent: true },
    });

    if (existingEvent) {
      return {
        status: String(callbackProviderTransaction.paymentIntent.status).toLowerCase(),
        paymentReference: callbackProviderTransaction.paymentIntent.idempotencyKey,
        replayed: true,
      };
    }

    const normalizedStatus = String(payload.status || "").toLowerCase();
    const providerStatus = ["success", "successful", "confirmed", "completed"].includes(normalizedStatus)
      ? "SUCCESSFUL"
      : ["fail", "failed", "cancelled", "canceled"].includes(normalizedStatus)
        ? "FAILED"
        : "PENDING";

    await tx.webhookEvent.create({
      data: {
        providerTransactionId: callbackProviderTransaction.id,
        eventType: payload.eventType || "payment.callback",
        rawPayload: payload,
        dedupeKey,
        processedAt: new Date(),
      },
    });

    await updateProviderTransactionStatus(
      callbackProviderTransaction.id,
      providerStatus,
      {
        rawResponseData: payload,
        ...(providerStatus === "SUCCESSFUL" ? { confirmedAt: new Date() } : {}),
      },
      tx
    );

    let paymentIntent = callbackProviderTransaction.paymentIntent;
    if (providerStatus === "FAILED" && paymentIntent.status !== "CONFIRMED") {
      paymentIntent = await updatePaymentIntentStatus(paymentIntent.id, "FAILED", tx);
    } else if (providerStatus === "SUCCESSFUL" && paymentIntent.status !== "CONFIRMED") {
      paymentIntent = await updatePaymentIntentStatus(paymentIntent.id, "PROVIDER_CONFIRMED", tx);
    }

    return {
      status: String(paymentIntent.status).toLowerCase(),
      paymentReference: paymentIntent.idempotencyKey,
      replayed: false,
    };
  });
}

export async function createTransactionRecord() {
  throw new AppError("Transaction records are represented by payment intents in PostgreSQL mode.", 400);
}
