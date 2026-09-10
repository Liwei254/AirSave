import prisma from "../../config/prisma.js";
import { getWalletOrCreate } from "./walletRepository.js";

const paymentIntentInclude = {
  goal: true,
  providerTransaction: true,
  providerTransactions: true,
  ledgerTransactions: {
    include: {
      entries: {
        include: {
          ledgerAccount: true,
        },
      },
    },
  },
};

export async function listWalletTransactions(userId, filters = {}, tx = prisma) {
  const wallet = await getWalletOrCreate(tx, String(userId));
  const where = {
    userId: String(userId),
    walletId: wallet.id,
  };

  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  return tx.paymentIntent.findMany({
    where,
    include: paymentIntentInclude,
    orderBy: { createdAt: "desc" },
    skip: filters.skip || 0,
    take: filters.take || filters.limit || 100,
  });
}

/**
 * Aggregate dashboard savings directly in PostgreSQL.
 * Savings are sourced from the authoritative ledger so the metric cannot be
 * inflated by deposits or by non-posted/reversed transactions.
 */
export async function getDashboardSavingsMetrics(userId, timeZone = "Africa/Nairobi", tx = prisma) {
  const safeTimeZone = String(timeZone || "Africa/Nairobi").trim() || "Africa/Nairobi";
  const currentLocalDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [monthRows, dayRows] = await Promise.all([
    tx.$queryRaw`
      SELECT COALESCE(SUM(le.amount), 0) AS "savedThisMonth"
      FROM "ledger_entries" le
      INNER JOIN "ledger_transactions" lt ON lt.id = le."ledgerTransactionId"
      INNER JOIN "payment_intents" p ON p.id = lt."paymentIntentId"
      INNER JOIN "ledger_accounts" la ON la.id = le."ledgerAccountId"
      WHERE p."userId" = ${String(userId)}
        AND p."status" = 'CONFIRMED'
        AND p."createdAt" >= (date_trunc('month', CURRENT_DATE AT TIME ZONE ${safeTimeZone}) AT TIME ZONE ${safeTimeZone})
        AND p."createdAt" < ((date_trunc('month', CURRENT_DATE AT TIME ZONE ${safeTimeZone}) + INTERVAL '1 month') AT TIME ZONE ${safeTimeZone})
        AND le."status" = 'POSTED'
        AND le."side" = 'CREDIT'
        AND la."accountType" = 'savings'
        AND p."type" IN ('save', 'purchase', 'bill', 'airtime')
    `,
    tx.$queryRaw`
      SELECT DISTINCT DATE(p."createdAt" AT TIME ZONE ${safeTimeZone}) AS "savingDay"
      FROM "ledger_entries" le
      INNER JOIN "ledger_transactions" lt ON lt.id = le."ledgerTransactionId"
      INNER JOIN "payment_intents" p ON p.id = lt."paymentIntentId"
      INNER JOIN "ledger_accounts" la ON la.id = le."ledgerAccountId"
      WHERE p."userId" = ${String(userId)}
        AND p."status" = 'CONFIRMED'
        AND le."status" = 'POSTED'
        AND le."side" = 'CREDIT'
        AND la."accountType" = 'savings'
        AND le.amount > 0
        AND p."type" IN ('save', 'purchase', 'bill', 'airtime')
      ORDER BY "savingDay" DESC
    `,
  ]);

  return {
    savedThisMonth: Number(monthRows[0]?.savedThisMonth || 0),
    savingDays: dayRows
      .map((row) => row.savingDay)
      .filter(Boolean)
      .map((value) => new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`)),
    asOfLocalDate: currentLocalDate,
  };
}

export async function getTransactionDetails(userId, transactionId, tx = prisma) {
  return tx.paymentIntent.findFirst({
    where: {
      userId: String(userId),
      OR: [
        { id: String(transactionId) },
        { idempotencyKey: String(transactionId) },
      ],
    },
    include: paymentIntentInclude,
  });
}

export async function listLedgerTransactionsByPaymentIntent(paymentIntentId, tx = prisma) {
  return tx.ledgerTransaction.findMany({
    where: { paymentIntentId: String(paymentIntentId) },
    include: {
      entries: {
        include: { ledgerAccount: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
