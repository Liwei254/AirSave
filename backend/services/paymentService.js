import { isPostgresDataStoreEnabled } from "../config/dataStore.js";
import AppError from "../utils/AppError.js";
import { normalizePhone } from "../utils/auth.js";
import { processWalletPayment } from "./transactionService.js";
import * as prismaPaymentService from "./postgres/prismaPaymentService.js";

export { normalizePhone };

export async function initiateSavingsPayment({ user, amount, rule = 10, goalId, idempotencyKey }) {
  if (isPostgresDataStoreEnabled()) {
    return prismaPaymentService.initiateSavingsPayment({ user, amount, rule, goalId, idempotencyKey });
  }

  if (!user?._id) {
    throw new AppError("User is required to initiate payment.", 400);
  }

  return processWalletPayment(user._id, {
    amount,
    goalId,
    phone: user.phone,
    transactionType: "purchase",
    tillNumber: "00000",
    merchant: "AirSave savings payment",
    description: `Savings payment using round-up rule ${rule}`,
  });
}

export async function confirmSavingsPayment(payload = {}) {
  if (isPostgresDataStoreEnabled()) {
    return prismaPaymentService.confirmSavingsPayment(payload);
  }

  throw new AppError("Payment confirmation is handled by transactionService.", 400);
}
