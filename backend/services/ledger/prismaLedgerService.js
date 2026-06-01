import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";

const validLedgerSides = new Set(["DEBIT", "CREDIT"]);

export function moneyToCents(value, message = "Enter a valid amount.", options = {}) {
  const rawValue = typeof value?.toString === "function" ? value.toString() : String(value || "");
  const normalizedValue = rawValue.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    throw new AppError(message, 400);
  }

  const [wholePart, decimalPart = ""] = normalizedValue.split(".");
  const cents = BigInt(wholePart) * 100n + BigInt(decimalPart.padEnd(2, "0"));

  if (cents < 0n || (!options.allowZero && cents <= 0n)) {
    throw new AppError(message, 400);
  }

  return cents;
}

export function centsToMoney(cents) {
  const sign = cents < 0n ? "-" : "";
  const absoluteValue = cents < 0n ? -cents : cents;
  const whole = absoluteValue / 100n;
  const fraction = String(absoluteValue % 100n).padStart(2, "0");

  return `${sign}${whole}.${fraction}`;
}

export function normalizeMoney(value, message = "Enter a valid amount.", options = {}) {
  return centsToMoney(moneyToCents(value, message, options));
}

function assertLedgerSide(side) {
  const normalizedSide = String(side || "").toUpperCase();

  if (!validLedgerSides.has(normalizedSide)) {
    throw new AppError("Invalid ledger entry side.", 400);
  }

  return normalizedSide;
}

function assertBalancedEntries(entries = []) {
  let debitTotal = 0n;
  let creditTotal = 0n;

  if (!Array.isArray(entries) || entries.length < 2) {
    throw new AppError("A ledger transaction requires at least two entries.", 400);
  }

  entries.forEach((entry) => {
    const amount = moneyToCents(entry.amount);
    const side = assertLedgerSide(entry.side);

    if (side === "DEBIT") {
      debitTotal += amount;
    } else {
      creditTotal += amount;
    }
  });

  if (debitTotal === 0n || creditTotal === 0n) {
    throw new AppError("A ledger transaction requires both debit and credit entries.", 400);
  }

  if (debitTotal !== creditTotal) {
    throw new AppError("Ledger debits and credits must balance.", 400);
  }
}

export async function createLedgerTransaction(tx, { paymentIntentId = null, description = "" } = {}) {
  return tx.ledgerTransaction.create({
    data: {
      paymentIntentId,
      description,
    },
  });
}

export async function createLedgerEntry(
  tx,
  { ledgerTransactionId, ledgerAccountId, amount, side, reference = null, status = "POSTED" }
) {
  return tx.ledgerEntry.create({
    data: {
      ledgerTransactionId,
      ledgerAccountId,
      amount: normalizeMoney(amount),
      side: assertLedgerSide(side),
      status,
      reference,
      postedAt: status === "POSTED" ? new Date() : null,
    },
  });
}

export async function postDoubleEntry(
  tx,
  { paymentIntentId = null, description = "", entries = [] } = {}
) {
  assertBalancedEntries(entries);

  const ledgerTransaction = await createLedgerTransaction(tx, {
    paymentIntentId,
    description,
  });

  for (const entry of entries) {
    await createLedgerEntry(tx, {
      ...entry,
      ledgerTransactionId: ledgerTransaction.id,
    });
  }

  return tx.ledgerTransaction.findUnique({
    where: {
      id: ledgerTransaction.id,
    },
    include: {
      entries: {
        include: {
          ledgerAccount: true,
        },
      },
    },
  });
}

export async function computeAccountBalance(ledgerAccountId, tx = prisma) {
  const entries = await tx.ledgerEntry.findMany({
    where: {
      ledgerAccountId,
      status: "POSTED",
    },
    select: {
      amount: true,
      side: true,
    },
  });

  const balance = entries.reduce((total, entry) => {
    const amount = moneyToCents(entry.amount);
    return entry.side === "CREDIT" ? total + amount : total - amount;
  }, 0n);

  return Number(centsToMoney(balance));
}

export async function getWalletBalance(walletId, tx = prisma, accountTypes = ["available_funds"]) {
  const accounts = await tx.ledgerAccount.findMany({
    where: {
      walletId,
      accountType: {
        in: accountTypes,
      },
    },
    select: {
      id: true,
    },
  });

  if (!accounts.length) {
    return 0;
  }

  const balances = await Promise.all(accounts.map((account) => computeAccountBalance(account.id, tx)));
  return Number(balances.reduce((total, balance) => total + balance, 0).toFixed(2));
}
