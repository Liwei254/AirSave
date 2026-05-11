import AppError from "../utils/AppError.js";
import { normalizePhone } from "../utils/auth.js";
import { processWalletPayment } from "./transactionService.js";

export { normalizePhone };

export async function initiateSavingsPayment({ user, amount, rule = 10, goalId }) {
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

export async function confirmSavingsPayment() {
  throw new AppError("Payment confirmation is handled by transactionService.", 400);
}
