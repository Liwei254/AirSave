import prisma from "../../config/prisma.js";
import { getActiveGoalByUserId, getGoalById, getGoalProgress as getGoalProgressRecord, updateGoal as updateGoalRecord } from "../../repositories/postgres/prismaGoalRepository.js";
import { createPaymentIntent, getPaymentIntentByIdempotencyKey, getPaymentIntentDetails, updatePaymentIntentStatus } from "../../repositories/postgres/prismaPaymentIntentRepository.js";
import { createProviderTransaction } from "../../repositories/postgres/prismaProviderTransactionRepository.js";
import { getAccountByType, getWalletOrCreate } from "../../repositories/postgres/walletRepository.js";
import AppError from "../../utils/AppError.js";
import { normalizePhone } from "../../utils/auth.js";
import { roundAmount } from "../../utils/rounding.js";
import { getWalletBalance, moneyToCents, normalizeMoney, postDoubleEntry } from "../ledger/prismaLedgerService.js";
import { normalizePreferencePayload } from "./mappers.js";

const validOperators = new Set(["safaricom", "airtel", "telkom"]);
const validRoundUpRules = new Set([10, 50, 100]);

function reference() { return `AIRTIME-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function requireAccount(wallet, type) {
  const account = getAccountByType(wallet, type);
  if (!account) throw new AppError(`Wallet ledger account ${type} is not configured.`, 500);
  return account;
}
function serializeGoal(goal, progress) {
  if (!goal) return null;
  const savedAmount = Number(progress?.savedAmount ?? goal.savedAmount ?? 0);
  return { id: goal.id, _id: goal.id, name: goal.name, savedAmount, currentAmount: savedAmount, targetAmount: Number(goal.targetAmount), status: String(goal.status).toLowerCase() };
}
async function updateGoalProjection(userId, goalId, tx) {
  if (!goalId) return null;
  const progress = await getGoalProgressRecord(userId, goalId, tx);
  if (!progress) throw new AppError("Goal not found.", 404);
  const goal = await updateGoalRecord(userId, goalId, { savedAmount: progress.savedAmountDecimal }, tx);
  return serializeGoal(goal, progress);
}

export async function purchaseAirtime(userId, payload = {}) {
  const amount = normalizeMoney(payload.amount, "Airtime amount is required.");
  const phone = normalizePhone(payload.phone);
  const operator = String(payload.operator || "").trim().toLowerCase();
  const idempotencyKey = String(payload.idempotencyKey || reference()).trim();

  if (!phone) throw new AppError("A valid Kenyan phone number is required.", 400);
  if (!validOperators.has(operator)) throw new AppError("Unsupported mobile network.", 400);

  return prisma.$transaction(async (tx) => {
    const existing = await getPaymentIntentByIdempotencyKey(idempotencyKey, tx);
    if (existing) {
      const details = await getPaymentIntentDetails(userId, existing.id, tx);
      return { status: "confirmed", replayed: true, paymentReference: details.idempotencyKey, paymentIntentId: details.id, amount: Number(details.originalAmount), savingsAmount: Number(details.savingsAmount || 0) };
    }

    const user = await tx.user.findUnique({ where: { id: String(userId) } });
    if (!user) throw new AppError("User not found", 404);
    if (user.status === "SUSPENDED") throw new AppError("Account is suspended", 403);

    const preferences = normalizePreferencePayload({}, user.preferences || {});
    if (preferences.autoSaveEnabled === false) throw new AppError("Auto-save is disabled. Enable it in Settings to continue.", 400);

    const roundUpRule = Number(user.roundUpRule || 50);
    if (!validRoundUpRules.has(roundUpRule)) throw new AppError("Invalid saved round-up rule.", 400);

    const wallet = await getWalletOrCreate(tx, String(userId));
    const rounding = roundAmount(Number(amount), roundUpRule);
    const roundedAmount = normalizeMoney(rounding.rounded);
    const savingsAmount = normalizeMoney(rounding.savings || "0.00", "Invalid round-up amount.", { allowZero: true });
    const availableBalance = await getWalletBalance(wallet.id, tx);

    if (Number(roundedAmount) > availableBalance) throw new AppError("Insufficient wallet balance. Deposit funds before buying airtime.", 400);

    const availableFunds = requireAccount(wallet, "available_funds");
    const clearing = requireAccount(wallet, "clearing");
    const savings = requireAccount(wallet, "savings");
    const activeGoal = payload.goalId ? await getGoalById(userId, payload.goalId, tx) : await getActiveGoalByUserId(userId, tx);

    if (payload.goalId && (!activeGoal || activeGoal.status !== "ACTIVE")) throw new AppError("Active goal not found.", 404);
    if (activeGoal && activeGoal.status !== "ACTIVE") throw new AppError("Savings can only be allocated to an active goal.", 400);

    const paymentIntent = await createPaymentIntent({
      userId: String(userId),
      walletId: wallet.id,
      goalId: activeGoal?.id || null,
      type: "airtime",
      originalAmount: amount,
      roundedAmount,
      savingsAmount,
      status: "PENDING_PROVIDER",
      roundingRule: roundUpRule,
      idempotencyKey,
    }, tx);

    await createProviderTransaction({
      paymentIntentId: paymentIntent.id,
      providerName: "mock-mobile-money",
      providerReference: idempotencyKey,
      checkoutRequestId: `AIRTIME-CALLBACK-${paymentIntent.id}`,
      status: "SUCCESSFUL",
      amount: roundedAmount,
      rawRequestData: { phone, operator, merchant: `${operator} Airtime`, description: payload.description || `${operator} airtime purchase`, transactionType: "airtime" },
      rawResponseData: { simulated: true, reference: idempotencyKey },
      confirmedAt: new Date(),
    }, tx);

    await postDoubleEntry(tx, {
      paymentIntentId: paymentIntent.id,
      description: `${operator} airtime purchase for ${phone}.`,
      entries: [
        { ledgerAccountId: availableFunds.id, amount: roundedAmount, side: "DEBIT", reference: idempotencyKey },
        { ledgerAccountId: clearing.id, amount, side: "CREDIT", reference: idempotencyKey },
        ...(Number(savingsAmount) > 0 ? [{ ledgerAccountId: savings.id, amount: savingsAmount, side: "CREDIT", reference: `${idempotencyKey}-SAVE` }] : []),
      ],
    });

    const confirmedIntent = await updatePaymentIntentStatus(paymentIntent.id, "CONFIRMED", tx);
    const goal = activeGoal ? await updateGoalProjection(userId, activeGoal.id, tx) : null;

    await tx.outboxEvent.create({ data: { relatedId: confirmedIntent.id, eventType: "payment.confirmed", payload: { userId: String(userId), walletId: wallet.id, paymentIntentId: confirmedIntent.id, type: "airtime", amount, roundedAmount, savingsAmount, idempotencyKey } } });
    if (Number(savingsAmount) > 0) await tx.outboxEvent.create({ data: { relatedId: confirmedIntent.id, eventType: "savings.allocated", payload: { userId: String(userId), walletId: wallet.id, goalId: activeGoal?.id || null, paymentIntentId: confirmedIntent.id, amount: savingsAmount, idempotencyKey } } });

    return {
      status: "confirmed",
      message: Number(savingsAmount) > 0 ? `Airtime purchased and ${savingsAmount} KES saved automatically.` : "Airtime purchased successfully.",
      paymentReference: confirmedIntent.idempotencyKey,
      paymentIntentId: confirmedIntent.id,
      operator,
      phone,
      amount: Number(amount),
      chargedAmount: Number(roundedAmount),
      savingsAmount: Number(savingsAmount),
      roundUpRule,
      balance: await getWalletBalance(wallet.id, tx),
      goal,
    };
  });
}
