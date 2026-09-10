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

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  return tx.paymentIntent.findMany({
    where,
    include: paymentIntentInclude,
    orderBy: {
      createdAt: "desc",
    },
    skip: filters.skip || 0,
    take: filters.take || filters.limit || 100,
  });
}

/**
 * Returns only confirmed savings activity for dashboard metrics.
 * The aggregation is performed in PostgreSQL so the dashboard does not
 * need to load an arbitrary number of historical transactions into memory.
 */
export async function getDashboardSavingsMetrics(userId, timeZone = "Africa/Nairobi", tx = prisma) {
  const safeTimeZone = String(timeZone || "Africa/Nairobi").trim() || "Africa/Nairobi";

  const rows = await tx.$queryRaw`
    WITH savings_activity AS (
      SELECT
        p."createdAt" AT TIME ZONE ${safeTimeZone} AS local_created_at,
        p."savingsAmount" AS savings_amount
      FROM "payment_intents" p
      WHERE p."userId" = ${String(userId)}
        AND p."status" = 'CONFIRMED'
        AND p."type" IN ('save', 'purchase', 'bill', 'airtime')
        AND p."savingsAmount" IS NOT NULL
        AND p."savingsAmount" > 0
    )
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN local_created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE ${safeTimeZone})
            THEN savings_amount
            ELSE 0
          END
        ),
        0
      ) AS "savedThisMonth",
      ARRAY_AGG(DISTINCT local_created_at::date ORDER BY local_created_at::date DESC) AS "savingDays"
    FROM savings_activity
  `;

  const row = rows[0] || {};
  return {
    savedThisMonth: Number(row.savedThisMonth || 0),
    savingDays: Array.isArray(row.savingDays)
      ? row.savingDays.map((day) => new Date(day))
      : [],
  };
}

export async function getTransactionDetails(userId, transactionId, tx = prisma) {
  return tx.paymentIntent.findFirst({
    where: {
      userId: String(userId),
      OR: [
        {
          id: String(transactionId),
        },
        {
          idempotencyKey: String(transactionId),
        },
      ],
    },
    include: paymentIntentInclude,
  });
}

export async function listLedgerTransactionsByPaymentIntent(paymentIntentId, tx = prisma) {
  return tx.ledgerTransaction.findMany({
    where: {
      paymentIntentId: String(paymentIntentId),
    },
    include: {
      entries: {
        include: {
          ledgerAccount: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
