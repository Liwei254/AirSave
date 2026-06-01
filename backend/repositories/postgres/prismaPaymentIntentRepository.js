import prisma from "../../config/prisma.js";

const detailInclude = {
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

export async function createPaymentIntent(data, tx = prisma) {
  return tx.paymentIntent.create({
    data,
  });
}

export async function getPaymentIntentById(id, tx = prisma) {
  return tx.paymentIntent.findUnique({
    where: {
      id: String(id),
    },
    include: detailInclude,
  });
}

export async function getPaymentIntentByIdempotencyKey(idempotencyKey, tx = prisma) {
  if (!idempotencyKey) return null;

  return tx.paymentIntent.findUnique({
    where: {
      idempotencyKey: String(idempotencyKey),
    },
    include: detailInclude,
  });
}

export async function updatePaymentIntentStatus(id, status, tx = prisma, data = {}) {
  return tx.paymentIntent.update({
    where: {
      id: String(id),
    },
    data: {
      ...data,
      status,
    },
    include: detailInclude,
  });
}

export async function listPaymentIntentsByUser(userId, filters = {}, tx = prisma) {
  const where = {
    userId: String(userId),
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  return tx.paymentIntent.findMany({
    where,
    include: detailInclude,
    orderBy: {
      createdAt: "desc",
    },
    skip: filters.skip || 0,
    take: filters.take || filters.limit || 50,
  });
}

export async function getPaymentIntentDetails(userId, paymentIntentId, tx = prisma) {
  return tx.paymentIntent.findFirst({
    where: {
      id: String(paymentIntentId),
      userId: String(userId),
    },
    include: detailInclude,
  });
}
