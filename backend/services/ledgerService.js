import Ledger from "../models/Ledger.js";

export async function calculateWalletBalance(walletId) {
  const entries = await Ledger.find({ wallet: walletId, status: "completed" }).select("amount type");

  return entries.reduce((balance, entry) => {
    if (entry.type === "CREDIT") return balance + entry.amount;
    if (entry.type === "DEBIT") return balance - entry.amount;
    return balance;
  }, 0);
}

export async function createLedgerEntry({
  walletId,
  amount,
  type,
  reference,
  description,
  status = "completed",
}) {
  return Ledger.create({
    wallet: walletId,
    amount,
    type,
    reference,
    description,
    status,
  });
}
