import prisma from "../../config/prisma.js";

export async function createProviderTransaction(data, tx = prisma) {
  return tx.providerTransaction.create({
    data,
  });
}

export async function updateProviderTransactionStatus(id, status, data = {}, tx = prisma) {
  return tx.providerTransaction.update({
    where: {
      id: String(id),
    },
    data: {
      ...data,
      status,
    },
  });
}

export async function findByProviderReference(providerReference, tx = prisma) {
  if (!providerReference) return null;

  return tx.providerTransaction.findFirst({
    where: {
      providerReference: String(providerReference),
    },
    include: {
      paymentIntent: true,
      webhookEvents: true,
    },
  });
}

export async function findByCheckoutRequestId(checkoutRequestId, tx = prisma) {
  if (!checkoutRequestId) return null;

  return tx.providerTransaction.findFirst({
    where: {
      checkoutRequestId: String(checkoutRequestId),
    },
    include: {
      paymentIntent: true,
      webhookEvents: true,
    },
  });
}
