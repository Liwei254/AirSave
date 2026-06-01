import prisma from "../../config/prisma.js";
import {
  getWalletOrCreate,
  getAccountByType,
} from "./walletRepository.js";
import { centsToMoney, moneyToCents } from "../../services/ledger/prismaLedgerService.js";

export const oneActiveGoalMessage = "You can only have one active goal at a time.";

export async function getWalletForUser(userId, tx = prisma) {
  return getWalletOrCreate(tx, String(userId));
}

export async function getActiveGoalByUserId(userId, tx = prisma) {
  const wallet = await getWalletForUser(userId, tx);

  return tx.goal.findFirst({
    where: {
      walletId: wallet.id,
      status: "ACTIVE",
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function createGoal(userId, payload = {}, tx = prisma) {
  const wallet = await getWalletForUser(userId, tx);

  return tx.goal.create({
    data: {
      walletId: wallet.id,
      name: payload.name,
      targetAmount: payload.targetAmount,
      savedAmount: payload.savedAmount || "0.00",
      status: payload.status || "ACTIVE",
      startDate: payload.startDate || null,
      deadline: payload.deadline || null,
      expectedCompletionDate: payload.expectedCompletionDate || payload.deadline || null,
      template: payload.template || null,
    },
  });
}

export async function getGoalsByUserId(userId, tx = prisma) {
  const wallet = await getWalletForUser(userId, tx);

  return tx.goal.findMany({
    where: {
      walletId: wallet.id,
    },
    orderBy: [
      {
        status: "asc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });
}

export async function getGoalById(userId, goalId, tx = prisma) {
  const wallet = await getWalletForUser(userId, tx);

  return tx.goal.findFirst({
    where: {
      id: String(goalId),
      walletId: wallet.id,
    },
  });
}

export async function updateGoal(userId, goalId, payload = {}, tx = prisma) {
  const goal = await getGoalById(userId, goalId, tx);

  if (!goal) {
    return null;
  }

  return tx.goal.update({
    where: {
      id: goal.id,
    },
    data: payload,
  });
}

export async function closeGoal(userId, goalId, tx = prisma) {
  return updateGoal(
    userId,
    goalId,
    {
      status: "CLOSED",
    },
    tx
  );
}

export async function deleteGoal(userId, goalId, tx = prisma) {
  const goal = await getGoalById(userId, goalId, tx);

  if (!goal) {
    return null;
  }

  return tx.goal.delete({
    where: {
      id: goal.id,
    },
  });
}

export async function getGoalProgress(userId, goalId, tx = prisma) {
  const goal = await getGoalById(userId, goalId, tx);

  if (!goal) {
    return null;
  }

  const wallet = await getWalletForUser(userId, tx);
  const savingsAccount = getAccountByType(wallet, "savings");

  if (!savingsAccount) {
    return {
      goal,
      savedAmount: 0,
      savedAmountDecimal: "0.00",
    };
  }

  const entries = await tx.ledgerEntry.findMany({
    where: {
      ledgerAccountId: savingsAccount.id,
      status: "POSTED",
      ledgerTransaction: {
        paymentIntent: {
          goalId: goal.id,
          status: "CONFIRMED",
        },
      },
    },
    select: {
      amount: true,
      side: true,
    },
  });

  const savedCents = entries.reduce((total, entry) => {
    const amount = moneyToCents(entry.amount);
    return entry.side === "CREDIT" ? total + amount : total - amount;
  }, 0n);
  const normalizedSavedCents = savedCents < 0n ? 0n : savedCents;

  return {
    goal,
    savedAmount: Number(centsToMoney(normalizedSavedCents)),
    savedAmountDecimal: centsToMoney(normalizedSavedCents),
  };
}
