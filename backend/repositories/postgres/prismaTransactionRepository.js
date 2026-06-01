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
