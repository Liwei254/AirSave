import { createNotification } from "../postgres/prismaNotificationService.js";

function getPayload(event = {}) {
  return event.payload && typeof event.payload === "object" ? event.payload : {};
}

function getUserId(event = {}) {
  const payload = getPayload(event);
  return payload.userId || payload.userID || payload.user;
}

function money(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2).replace(/\.00$/, "") : "0";
}

async function notify(event, { message, type = "system" }, tx) {
  const userId = getUserId(event);

  if (!userId || !message) {
    return {
      success: false,
      reason: "Missing userId or message",
    };
  }

  await createNotification({
    userId,
    message,
    type,
    sourceEventId: event.id,
  }, tx);

  return {
    success: true,
  };
}

async function handleGoalCreated(event, tx) {
  const payload = getPayload(event);
  return notify(event, {
    type: "goal",
    message: `Goal created${payload.goalName ? `: ${payload.goalName}` : ""}.`,
  }, tx);
}

async function handleGoalUpdated(event, tx) {
  const payload = getPayload(event);
  return notify(event, {
    type: "goal",
    message: `Goal updated${payload.status ? ` to ${payload.status}` : ""}.`,
  }, tx);
}

async function handleGoalCompleted(event, tx) {
  return notify(event, {
    type: "goal",
    message: "Goal completed. Nice work keeping your savings plan on track.",
  }, tx);
}

async function handleSavingsAllocated(event, tx) {
  const payload = getPayload(event);
  return notify(event, {
    type: "saving",
    message: `${money(payload.amount)} KES allocated to savings.`,
  }, tx);
}

async function handlePaymentConfirmed(event, tx) {
  const payload = getPayload(event);
  const paymentType = String(payload.type || "").toLowerCase();

  if (paymentType === "withdraw") {
    return notify(event, {
      type: "system",
      message: `Withdrawal confirmed for ${money(payload.amount || payload.totalDeducted)} KES.`,
    }, tx);
  }

  if (paymentType === "deposit") {
    return notify(event, {
      type: "system",
      message: `Deposit confirmed. ${money(payload.amount)} KES added to your AirSave wallet.`,
    }, tx);
  }

  return notify(event, {
    type: paymentType === "save" || Number(payload.savingsAmount || 0) > 0 ? "saving" : "system",
    message: `Payment confirmed for ${money(payload.roundedAmount || payload.amount)} KES.`,
  }, tx);
}

async function handlePaymentFailed(event, tx) {
  const payload = getPayload(event);
  return notify(event, {
    type: "system",
    message: `Payment failed${payload.reason ? `: ${payload.reason}` : "."}`,
  }, tx);
}

async function handleTransactionCreated(event, tx) {
  const payload = getPayload(event);
  return notify(event, {
    type: "system",
    message: `Transaction recorded for ${money(payload.amount)} KES.`,
  }, tx);
}

async function handleDepositConfirmed(event, tx) {
  const payload = getPayload(event);
  return notify(event, {
    type: "system",
    message: `Deposit confirmed. ${money(payload.amount)} KES added to your AirSave wallet.`,
  }, tx);
}

async function handleWithdrawalConfirmed(event, tx) {
  const payload = getPayload(event);
  return notify(event, {
    type: "system",
    message: `Withdrawal confirmed for ${money(payload.amount || payload.totalDeducted)} KES.`,
  }, tx);
}

export const outboxEventHandlers = {
  "goal.created": handleGoalCreated,
  "goal.updated": handleGoalUpdated,
  "goal.completed": handleGoalCompleted,
  "savings.allocated": handleSavingsAllocated,
  "payment.confirmed": handlePaymentConfirmed,
  "payment.failed": handlePaymentFailed,
  "transaction.created": handleTransactionCreated,
  "deposit.confirmed": handleDepositConfirmed,
  "wallet.deposit.confirmed": handleDepositConfirmed,
  "withdrawal.confirmed": handleWithdrawalConfirmed,
};

export async function handleOutboxEvent(event, { tx } = {}) {
  const handler = outboxEventHandlers[event?.eventType];

  if (!handler) {
    return {
      success: true,
      ignored: true,
      reason: `No handler for ${event?.eventType || "unknown event"}`,
    };
  }

  return handler(event, tx);
}
