import { normalizePhone } from "../utils/auth.js";
import { v4 as uuidv4 } from "uuid";
import Payment from "../models/Payment.js";
import Goal from "../models/Goal.js";
import Notification from "../models/Notification.js";
import Transaction from "../models/Transaction.js";
import { roundAmount } from "../utils/rounding.js";
import { createLedgerEntry } from "./ledgerService.js";

function buildReference(prefix) {
  return `${prefix}-${uuidv4().slice(0, 8).toUpperCase()}`;
}

export { normalizePhone };

export async function initiateSavingsPayment({ user, wallet, amount, rule = 10, goalId }) {
  const normalizedPhone = normalizePhone(user.phone);

  if (!normalizedPhone) {
    throw new Error("A valid phone number is required to initiate payment.");
  }

  const rounding = roundAmount(amount, Number(rule) || 10);

  let goal = null;
  if (goalId) {
    goal = await Goal.findOne({ _id: goalId, user: user._id, status: "active" });
    if (!goal) {
      throw new Error("Active goal not found.");
    }
  } else {
    goal = await Goal.findOne({ user: user._id, status: "active" }).sort({ updatedAt: -1, createdAt: -1 });
  }

  const providerReference = buildReference("PAY");
  const callbackReference = buildReference("CALLBACK");

  const payment = await Payment.create({
    user: user._id,
    wallet: wallet._id,
    phone: normalizedPhone,
    originalAmount: rounding.original,
    roundedAmount: rounding.rounded,
    savingsAmount: rounding.savings,
    roundingType: String(rule || 10),
    goal: goal?._id || null,
    providerReference,
    callbackReference,
    status: "processing",
  });

  return {
    payment,
    rounding,
    checkout: {
      provider: "mock-mobile-money",
      prompt: `Approve the mobile money debit on ${normalizedPhone} to save ${rounding.savings} KES.`,
      callbackReference,
    },
  };
}

export async function confirmSavingsPayment({ callbackReference, status = "confirmed", providerPayload = null }) {
  const payment = await Payment.findOne({ callbackReference });

  if (!payment) {
    throw new Error("Payment callback not found.");
  }

  if (payment.status === "confirmed") {
    return payment;
  }

  if (status !== "confirmed") {
    payment.status = "failed";
    payment.callbackPayload = providerPayload;
    await payment.save();
    return payment;
  }

  const ledgerEntry = await createLedgerEntry({
    walletId: payment.wallet,
    amount: payment.savingsAmount,
    type: "CREDIT",
    reference: payment.providerReference,
    description: `Confirmed savings from payment ${payment.originalAmount}`,
  });

  await Transaction.create({
    user: payment.user,
    originalAmount: payment.originalAmount,
    roundedAmount: payment.roundedAmount,
    savingsAmount: payment.savingsAmount,
    roundingType: payment.roundingType,
    wallet: payment.wallet,
    goal: payment.goal || null,
    ledgerRef: ledgerEntry._id,
    status: "completed",
    reference: payment.providerReference,
  });

  await Notification.create({
    user: payment.user,
    message: `Payment confirmed. ${payment.savingsAmount} KES moved to your savings wallet.`,
    type: "saving",
  });

  if (payment.goal) {
    const goal = await Goal.findById(payment.goal);

    if (goal) {
      const nextAmount = Number(goal.currentAmount ?? goal.savedAmount ?? 0) + Number(payment.savingsAmount || 0);
      goal.savedAmount = nextAmount;
      goal.currentAmount = nextAmount;

      if (goal.currentAmount >= goal.targetAmount) {
        goal.status = "completed";
        await Notification.create({
          user: payment.user,
          message: `Goal "${goal.name}" reached after payment confirmation.`,
          type: "goal",
        });
      }

      await goal.save();
    }
  }

  payment.status = "confirmed";
  payment.callbackPayload = providerPayload;
  payment.confirmedAt = new Date();
  await payment.save();

  return payment;
}
