import prisma from "../../config/prisma.js";
import {
  getAccountByType,
  getWalletByUserId,
  getWalletOrCreate,
} from "../../repositories/postgres/walletRepository.js";
import AppError from "../../utils/AppError.js";
import { normalizePhone } from "../../utils/auth.js";
import {
  getWalletBalance,
  normalizeMoney,
  postDoubleEntry,
} from "../ledger/prismaLedgerService.js";

function buildReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function serializeLedgerTransaction(ledgerTransaction) {
  const walletFacingEntry =
    ledgerTransaction.entries.find((entry) => entry.ledgerAccount.accountType === "available_funds") ||
    ledgerTransaction.entries[0];

  return {
    _id: ledgerTransaction.id,
    id: ledgerTransaction.id,
    amount: Number(walletFacingEntry?.amount || 0),
    type: walletFacingEntry?.side || "CREDIT",
    reference: walletFacingEntry?.reference || ledgerTransaction.id,
    description: ledgerTransaction.description,
    status: "completed",
    createdAt: ledgerTransaction.createdAt,
    entries: ledgerTransaction.entries.map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount),
      side: entry.side,
      accountType: entry.ledgerAccount.accountType,
      reference: entry.reference,
      status: entry.status,
    })),
  };
}

async function getUserWallet(userId, tx = prisma) {
  const wallet = await getWalletByUserId(tx, String(userId));

  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  return wallet;
}

export async function getWallet(userId) {
  const wallet = await prisma.$transaction((tx) => getWalletOrCreate(tx, String(userId)));
  const balance = await getWalletBalance(wallet.id);
  const transactionsCount = await prisma.ledgerTransaction.count({
    where: {
      entries: {
        some: {
          ledgerAccount: {
            walletId: wallet.id,
          },
          status: "POSTED",
        },
      },
    },
  });

  return {
    walletId: wallet.id,
    balance,
    transactionsCount,
  };
}

export async function depositWallet(userId, payload = {}, user = {}) {
  const amount = normalizeMoney(payload.amount, "Enter a valid deposit amount.");
  const numericAmount = Number(amount);
  const sourceMethod = String(payload.sourceMethod || "M-Pesa").trim();
  const phoneNumber = normalizePhone(payload.phoneNumber || payload.phone || user.phone);
  const reference = String(payload.idempotencyKey || "").trim() || buildReference("DEP");

  if (!phoneNumber) {
    throw new AppError("A valid Kenyan phone number is required.", 400);
  }

  if (sourceMethod.toLowerCase() !== "m-pesa") {
    throw new AppError("M-Pesa is the supported deposit method.", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await getWalletOrCreate(tx, String(userId));
    const availableFunds = getAccountByType(wallet, "available_funds");
    const clearing = getAccountByType(wallet, "clearing");

    if (!availableFunds || !clearing) {
      throw new AppError("Wallet ledger accounts are not configured.", 500);
    }

    const existingIntent = await tx.paymentIntent.findUnique({
      where: {
        idempotencyKey: reference,
      },
      include: {
        ledgerTransactions: {
          include: {
            entries: {
              include: {
                ledgerAccount: true,
              },
            },
          },
        },
      },
    });

    if (existingIntent?.status === "CONFIRMED") {
      return {
        wallet,
        paymentIntent: existingIntent,
        ledgerTransaction: existingIntent.ledgerTransactions[0] || null,
        replayed: true,
      };
    }

    if (existingIntent) {
      throw new AppError("Deposit is already being processed.", 409);
    }

    const paymentIntent = await tx.paymentIntent.create({
      data: {
        userId: String(userId),
        walletId: wallet.id,
        type: "deposit",
        originalAmount: amount,
        roundedAmount: amount,
        savingsAmount: "0.00",
        status: "PENDING_PROVIDER",
        idempotencyKey: reference,
      },
    });

    const providerTransaction = await tx.providerTransaction.create({
      data: {
        paymentIntentId: paymentIntent.id,
        providerName: "M-Pesa",
        providerReference: reference,
        status: "SUCCESSFUL",
        amount,
        rawRequestData: {
          phoneNumber,
          sourceMethod: "M-Pesa",
        },
        rawResponseData: {
          simulated: true,
          reference,
        },
        confirmedAt: new Date(),
      },
    });

    const ledgerTransaction = await postDoubleEntry(tx, {
      paymentIntentId: paymentIntent.id,
      description: `Wallet deposit from M-Pesa ${phoneNumber}.`,
      entries: [
        {
          ledgerAccountId: clearing.id,
          amount,
          side: "DEBIT",
          reference,
        },
        {
          ledgerAccountId: availableFunds.id,
          amount,
          side: "CREDIT",
          reference,
        },
      ],
    });

    const confirmedIntent = await tx.paymentIntent.update({
      where: {
        id: paymentIntent.id,
      },
      data: {
        providerTransactionId: providerTransaction.id,
        status: "CONFIRMED",
      },
    });

    await tx.outboxEvent.create({
      data: {
        relatedId: confirmedIntent.id,
        eventType: "wallet.deposit.confirmed",
        payload: {
          userId: String(userId),
          walletId: wallet.id,
          paymentIntentId: confirmedIntent.id,
          amount,
          reference,
        },
      },
    });

    return {
      wallet,
      paymentIntent: confirmedIntent,
      ledgerTransaction,
      replayed: false,
    };
  });

  const balance = await getWalletBalance(result.wallet.id);
  const transaction = result.ledgerTransaction ? serializeLedgerTransaction(result.ledgerTransaction) : null;

  return {
    message: result.replayed ? "Deposit already confirmed." : "Deposit confirmed successfully.",
    reference,
    status: "confirmed",
    amount: numericAmount,
    sourceMethod: "M-Pesa",
    phoneNumber,
    balance,
    transaction,
    paymentIntentId: result.paymentIntent.id,
  };
}

export async function getTransactionHistory(userId) {
  const wallet = await getUserWallet(userId);
  const transactions = await prisma.ledgerTransaction.findMany({
    where: {
      entries: {
        some: {
          ledgerAccount: {
            walletId: wallet.id,
          },
        },
      },
    },
    include: {
      entries: {
        include: {
          ledgerAccount: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    walletId: wallet.id,
    count: transactions.length,
    transactions: transactions.map(serializeLedgerTransaction),
  };
}
