import AppError from "../../utils/AppError.js";
import { normalizePhone } from "../../utils/auth.js";
import {
  getPaymentStatus,
  handlePaymentCallback,
  processWalletPayment,
} from "./prismaTransactionService.js";

export { normalizePhone, getPaymentStatus, handlePaymentCallback };

export async function initiateSavingsPayment({ user, amount, rule = 10, goalId, idempotencyKey }) {
  if (!user?._id && !user?.id) {
    throw new AppError("User is required to initiate payment.", 400);
  }

  return processWalletPayment(user._id || user.id, {
    amount,
    goalId,
    idempotencyKey,
    phone: user.phone,
    transactionType: "save",
    merchant: "AirSave savings payment",
    description: `Savings payment using round-up rule ${rule}`,
  });
}

export async function confirmSavingsPayment(payload = {}) {
  return handlePaymentCallback(payload);
}
