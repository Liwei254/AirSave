import AppError from "../utils/AppError.js";
import { centsToMoney, moneyToCents } from "./ledger/prismaLedgerService.js";

export const ROUND_UP_RULES = [10, 50, 100];

export function calculateRoundUp({ originalAmount, roundUpRule }) {
  const rule = Number(roundUpRule);
  if (!ROUND_UP_RULES.includes(rule)) throw new AppError("Invalid round-up rule", 400);

  const originalCents = moneyToCents(originalAmount, "Amount required");
  const ruleCents = BigInt(rule * 100);
  const roundedCents = ((originalCents + ruleCents - 1n) / ruleCents) * ruleCents;
  const roundUpCents = roundedCents - originalCents;

  return {
    originalAmount: Number(centsToMoney(originalCents)),
    roundedAmount: Number(centsToMoney(roundedCents)),
    roundUpAmount: Number(centsToMoney(roundUpCents)),
    rule,
  };
}
