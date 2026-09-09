import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const state = {
  counter: 0,
  users: [],
  wallets: [],
  ledgerAccounts: [],
  goals: [],
  paymentIntents: [],
  providerTransactions: [],
  ledgerTransactions: [],
  ledgerEntries: [],
  webhookEvents: [],
  outboxEvents: [],
};

function resetState() {
  state.counter = 0;
  state.users = [
    {
      id: "user-1",
      fullName: "Postgres Transaction User",
      email: "postgres-transactions@airsave.test",
      phone: "+254700000001",
      status: "ACTIVE",
      roundUpRule: 50,
      preferences: {
        autoSaveEnabled: true,
      },
    },
  ];
  state.wallets = [];
  state.ledgerAccounts = [];
  state.goals = [];
  state.paymentIntents = [];
  state.providerTransactions = [];
  state.ledgerTransactions = [];
  state.ledgerEntries = [];
  state.webhookEvents = [];
  state.outboxEvents = [];
}

function nextId(prefix) {
  state.counter += 1;
  return `${prefix}-${state.counter}`;
}

function withTimestamps(record) {
  const now = new Date();
  return {
    createdAt: now,
    updatedAt: now,
    ...record,
  };
}

function walletWithAccounts(wallet) {
  if (!wallet) return null;

  return {
    ...wallet,
    accounts: state.ledgerAccounts.filter((account) => account.walletId === wallet.id),
  };
}

function getPaymentIntentDecorated(paymentIntent) {
  if (!paymentIntent) return null;

  const providerTransactions = state.providerTransactions.filter(
    (providerTransaction) => providerTransaction.paymentIntentId === paymentIntent.id
  );
  const ledgerTransactions = state.ledgerTransactions
    .filter((ledgerTransaction) => ledgerTransaction.paymentIntentId === paymentIntent.id)
    .map((ledgerTransaction) => ({
      ...ledgerTransaction,
      entries: state.ledgerEntries
        .filter((entry) => entry.ledgerTransactionId === ledgerTransaction.id)
        .map((entry) => ({
          ...entry,
          ledgerAccount: state.ledgerAccounts.find((account) => account.id === entry.ledgerAccountId),
        })),
    }));

  return {
    ...paymentIntent,
    goal: state.goals.find((goal) => goal.id === paymentIntent.goalId) || null,
    providerTransaction: providerTransactions[0] || null,
    providerTransactions,
    ledgerTransactions,
  };
}

function getProviderTransactionDecorated(providerTransaction) {
  if (!providerTransaction) return null;

  return {
    ...providerTransaction,
    paymentIntent: state.paymentIntents.find((intent) => intent.id === providerTransaction.paymentIntentId),
    webhookEvents: state.webhookEvents.filter((event) => event.providerTransactionId === providerTransaction.id),
  };
}

const fakePrisma = {
  async $transaction(callback) {
    return callback(fakePrisma);
  },
  user: {
    async findUnique({ where }) {
      return state.users.find((user) => user.id === where.id) || null;
    },
    async update({ where, data }) {
      const user = state.users.find((record) => record.id === where.id);
      Object.assign(user, data);
      return user;
    },
  },
  wallet: {
    async findUnique({ where, include } = {}) {
      const wallet =
        state.wallets.find((record) => record.id === where?.id || record.userId === where?.userId) || null;
      return include?.accounts ? walletWithAccounts(wallet) : wallet;
    },
    async create({ data }) {
      const wallet = withTimestamps({
        id: nextId("wallet"),
        ...data,
      });
      state.wallets.push(wallet);
      return wallet;
    },
  },
  ledgerAccount: {
    async createMany({ data, skipDuplicates }) {
      data.forEach((input) => {
        const duplicate = state.ledgerAccounts.find(
          (account) =>
            account.walletId === input.walletId &&
            account.accountType === input.accountType &&
            account.currencyCode === input.currencyCode
        );
        if (duplicate && skipDuplicates) return;

        state.ledgerAccounts.push(
          withTimestamps({
            id: nextId("acct"),
            ...input,
          })
        );
      });
      return { count: data.length };
    },
    async findMany({ where } = {}) {
      return state.ledgerAccounts.filter((account) => {
        if (where?.walletId && account.walletId !== where.walletId) return false;
        if (where?.currencyCode && account.currencyCode !== where.currencyCode) return false;
        if (where?.accountType?.in && !where.accountType.in.includes(account.accountType)) return false;
        return true;
      });
    },
  },
  goal: {
    async findFirst({ where } = {}) {
      return (
        state.goals.find((goal) => {
          if (where?.id && goal.id !== where.id) return false;
          if (where?.walletId && goal.walletId !== where.walletId) return false;
          if (where?.status && goal.status !== where.status) return false;
          return true;
        }) || null
      );
    },
    async update({ where, data }) {
      const goal = state.goals.find((record) => record.id === where.id);
      Object.assign(goal, data, { updatedAt: new Date() });
      return goal;
    },
  },
  paymentIntent: {
    async findUnique({ where } = {}) {
      const paymentIntent =
        state.paymentIntents.find(
          (intent) => intent.id === where?.id || intent.idempotencyKey === where?.idempotencyKey
        ) || null;
      return getPaymentIntentDecorated(paymentIntent);
    },
    async findFirst({ where } = {}) {
      const paymentIntent =
        state.paymentIntents.find((intent) => {
          if (where?.userId && intent.userId !== where.userId) return false;
          if (where?.id && intent.id !== where.id) return false;
          if (where?.idempotencyKey && intent.idempotencyKey !== where.idempotencyKey) return false;
          if (where?.OR) {
            return where.OR.some((condition) => {
              if (condition.id) return intent.id === condition.id;
              if (condition.idempotencyKey) return intent.idempotencyKey === condition.idempotencyKey;
              return false;
            });
          }
          return true;
        }) || null;
      return getPaymentIntentDecorated(paymentIntent);
    },
    async findMany({ where } = {}) {
      return state.paymentIntents
        .filter((intent) => {
          if (where?.userId && intent.userId !== where.userId) return false;
          if (where?.walletId && intent.walletId !== where.walletId) return false;
          if (where?.status && intent.status !== where.status) return false;
          if (where?.type && intent.type !== where.type) return false;
          return true;
        })
        .map(getPaymentIntentDecorated)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    },
    async create({ data }) {
      const paymentIntent = withTimestamps({
        id: nextId("intent"),
        ...data,
      });
      state.paymentIntents.push(paymentIntent);
      return paymentIntent;
    },
    async update({ where, data }) {
      const paymentIntent = state.paymentIntents.find((intent) => intent.id === where.id);
      Object.assign(paymentIntent, data, { updatedAt: new Date() });
      return getPaymentIntentDecorated(paymentIntent);
    },
  },
  providerTransaction: {
    async create({ data }) {
      const providerTransaction = withTimestamps({
        id: nextId("provider"),
        ...data,
      });
      state.providerTransactions.push(providerTransaction);
      return providerTransaction;
    },
    async update({ where, data }) {
      const providerTransaction = state.providerTransactions.find((record) => record.id === where.id);
      Object.assign(providerTransaction, data, { updatedAt: new Date() });
      return getProviderTransactionDecorated(providerTransaction);
    },
    async findFirst({ where } = {}) {
      const providerTransaction =
        state.providerTransactions.find((record) => {
          if (where?.providerReference && record.providerReference !== where.providerReference) return false;
          if (where?.checkoutRequestId && record.checkoutRequestId !== where.checkoutRequestId) return false;
          return true;
        }) || null;
      return getProviderTransactionDecorated(providerTransaction);
    },
    async findUnique({ where } = {}) {
      const providerTransaction = state.providerTransactions.find((record) => record.id === where.id) || null;
      return getProviderTransactionDecorated(providerTransaction);
    },
  },
  ledgerTransaction: {
    async create({ data }) {
      const ledgerTransaction = withTimestamps({
        id: nextId("ledger-tx"),
        ...data,
      });
      state.ledgerTransactions.push(ledgerTransaction);
      return ledgerTransaction;
    },
    async findUnique({ where } = {}) {
      const ledgerTransaction = state.ledgerTransactions.find((record) => record.id === where.id) || null;
      return ledgerTransaction
        ? {
            ...ledgerTransaction,
            entries: state.ledgerEntries
              .filter((entry) => entry.ledgerTransactionId === ledgerTransaction.id)
              .map((entry) => ({
                ...entry,
                ledgerAccount: state.ledgerAccounts.find((account) => account.id === entry.ledgerAccountId),
              })),
          }
        : null;
    },
    async findMany({ where } = {}) {
      return state.ledgerTransactions.filter((ledgerTransaction) => {
        if (where?.paymentIntentId && ledgerTransaction.paymentIntentId !== where.paymentIntentId) return false;
        return true;
      });
    },
  },
  ledgerEntry: {
    async create({ data }) {
      const ledgerEntry = withTimestamps({
        id: nextId("entry"),
        ...data,
      });
      state.ledgerEntries.push(ledgerEntry);
      return ledgerEntry;
    },
    async findMany({ where } = {}) {
      return state.ledgerEntries.filter((entry) => {
        if (where?.ledgerAccountId && entry.ledgerAccountId !== where.ledgerAccountId) return false;
        if (where?.status && entry.status !== where.status) return false;

        const accountFilter = where?.ledgerAccount;
        if (accountFilter) {
          const account = state.ledgerAccounts.find((record) => record.id === entry.ledgerAccountId);
          if (accountFilter.walletId && account?.walletId !== accountFilter.walletId) return false;
          if (accountFilter.accountType?.in && !accountFilter.accountType.in.includes(account?.accountType)) {
            return false;
          }
        }

        const paymentIntentFilter = where?.ledgerTransaction?.paymentIntent;
        if (paymentIntentFilter) {
          const ledgerTransaction = state.ledgerTransactions.find(
            (record) => record.id === entry.ledgerTransactionId
          );
          const paymentIntent = state.paymentIntents.find(
            (record) => record.id === ledgerTransaction?.paymentIntentId
          );
          if (!paymentIntent) return false;
          if (paymentIntentFilter.goalId && paymentIntent.goalId !== paymentIntentFilter.goalId) return false;
          if (paymentIntentFilter.status && paymentIntent.status !== paymentIntentFilter.status) return false;
        }

        return true;
      });
    },
  },
  webhookEvent: {
    async findUnique({ where } = {}) {
      return state.webhookEvents.find((event) => event.dedupeKey === where.dedupeKey) || null;
    },
    async create({ data }) {
      const webhookEvent = withTimestamps({
        id: nextId("webhook"),
        receivedAt: new Date(),
        ...data,
      });
      state.webhookEvents.push(webhookEvent);
      return webhookEvent;
    },
  },
  outboxEvent: {
    async create({ data }) {
      const outboxEvent = withTimestamps({
        id: nextId("outbox"),
        published: false,
        ...data,
      });
      state.outboxEvents.push(outboxEvent);
      return outboxEvent;
    },
  },
};

jest.unstable_mockModule("../config/prisma.js", () => ({
  default: fakePrisma,
  getPrisma: () => fakePrisma,
  disconnectPrisma: async () => {},
}));

const { depositWallet } = await import("../services/postgres/walletService.js");
const {
  getPaymentStatus,
  getSavingsActivity,
  handlePaymentCallback,
  processWalletPayment,
} = await import("../services/postgres/prismaTransactionService.js");

beforeEach(() => {
  resetState();
});

async function ensureWallet() {
  await depositWallet(
    "user-1",
    {
      amount: 1000,
      phoneNumber: "+254700000001",
      sourceMethod: "M-Pesa",
      idempotencyKey: "seed-deposit",
    },
    state.users[0]
  );
}

function entriesForIntent(idempotencyKey) {
  const intent = state.paymentIntents.find((record) => record.idempotencyKey === idempotencyKey);
  return state.ledgerEntries.filter((entry) => {
    const ledgerTransaction = state.ledgerTransactions.find(
      (record) => record.id === entry.ledgerTransactionId
    );
    return ledgerTransaction?.paymentIntentId === intent?.id;
  });
}

function debitCreditTotals(entries) {
  return entries.reduce(
    (totals, entry) => ({
      debits: totals.debits + (entry.side === "DEBIT" ? Number(entry.amount) : 0),
      credits: totals.credits + (entry.side === "CREDIT" ? Number(entry.amount) : 0),
    }),
    { debits: 0, credits: 0 }
  );
}

describe("Prisma transaction/payment service", () => {
  test("idempotent deposit does not duplicate ledger entries", async () => {
    const first = await depositWallet(
      "user-1",
      {
        amount: 500,
        phoneNumber: "+254700000001",
        sourceMethod: "M-Pesa",
        idempotencyKey: "deposit-500",
      },
      state.users[0]
    );
    const ledgerCount = state.ledgerEntries.length;
    const second = await depositWallet(
      "user-1",
      {
        amount: 500,
        phoneNumber: "+254700000001",
        sourceMethod: "M-Pesa",
        idempotencyKey: "deposit-500",
      },
      state.users[0]
    );

    expect(first.paymentIntentId).toBe(second.paymentIntentId);
    expect(state.paymentIntents.filter((intent) => intent.idempotencyKey === "deposit-500")).toHaveLength(1);
    expect(state.ledgerEntries).toHaveLength(ledgerCount);
  });

  test("lists transaction history from payment intents and ledger details", async () => {
    await ensureWallet();
    await processWalletPayment("user-1", {
      amount: 200,
      phone: "+254711000001",
      transactionType: "send",
      idempotencyKey: "send-200",
    });

    const activity = await getSavingsActivity("user-1");

    expect(activity.map((item) => item.reference)).toEqual(expect.arrayContaining(["seed-deposit", "send-200"]));
    expect(activity.find((item) => item.reference === "send-200")).toMatchObject({
      type: "send",
      amount: 200,
      status: "confirmed",
      ledgerEntries: expect.arrayContaining([
        expect.objectContaining({ side: "DEBIT", accountType: "available_funds" }),
        expect.objectContaining({ side: "CREDIT", accountType: "pending_outbound" }),
      ]),
    });
  });

  test("creates provider transactions and exposes payment intent status", async () => {
    await ensureWallet();
    const result = await processWalletPayment("user-1", {
      amount: 123,
      tillNumber: "123456",
      transactionType: "purchase",
      idempotencyKey: "buy-123",
      callbackReference: "callback-buy-123",
    });

    expect(result).toMatchObject({
      paymentReference: "buy-123",
      status: "confirmed",
      chargedAmount: 150,
      savingsAmount: 27,
    });
    expect(state.providerTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerReference: "buy-123",
          checkoutRequestId: "callback-buy-123",
          status: "SUCCESSFUL",
        }),
      ])
    );

    await expect(getPaymentStatus("user-1", "buy-123")).resolves.toMatchObject({
      status: "confirmed",
      paymentReference: "buy-123",
    });
  });

  test("send money posts balanced double-entry ledger movement", async () => {
    await ensureWallet();
    await processWalletPayment("user-1", {
      amount: 250,
      phone: "+254711000002",
      transactionType: "send",
      idempotencyKey: "send-250",
    });

    const totals = debitCreditTotals(entriesForIntent("send-250"));

    expect(totals).toEqual({ debits: 250, credits: 250 });
  });

  test("airtime keeps the service amount separate from the automatic goal saving", async () => {
    await ensureWallet();
    state.goals.push(
      withTimestamps({
        id: "goal-airtime",
        walletId: state.wallets[0].id,
        name: "Emergency Fund",
        targetAmount: 10000,
        savedAmount: 0,
        status: "ACTIVE",
      })
    );

    const first = await processWalletPayment("user-1", {
      amount: 87,
      phone: "+254711000003",
      transactionType: "airtime",
      idempotencyKey: "airtime-87",
    });
    const entryCount = entriesForIntent("airtime-87").length;
    const second = await processWalletPayment("user-1", {
      amount: 87,
      phone: "+254711000003",
      transactionType: "airtime",
      idempotencyKey: "airtime-87",
    });

    expect(first).toMatchObject({ amount: 87, chargedAmount: 100, savingsAmount: 13, goal: { name: "Emergency Fund" } });
    expect(second.paymentReference).toBe(first.paymentReference);
    expect(entriesForIntent("airtime-87")).toHaveLength(entryCount);
    expect(debitCreditTotals(entriesForIntent("airtime-87"))).toEqual({ debits: 100, credits: 100 });
    expect(state.goals.find((goal) => goal.id === "goal-airtime").savedAmount).toBe("13.00");
  });

  test("airtime with a nonzero round-up requires an active goal", async () => {
    await ensureWallet();

    await expect(
      processWalletPayment("user-1", {
        amount: 87,
        phone: "+254711000004",
        transactionType: "airtime",
        idempotencyKey: "airtime-no-goal",
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(state.paymentIntents).toHaveLength(1);
  });

  test("webhook replay is idempotent and does not duplicate webhook events", async () => {
    await ensureWallet();
    await processWalletPayment("user-1", {
      amount: 100,
      businessNumber: "987654",
      accountNumber: "ACC-1",
      transactionType: "bill",
      idempotencyKey: "bill-100",
      callbackReference: "callback-bill-100",
    });

    const ledgerEntryCount = entriesForIntent("bill-100").length;
    const first = await handlePaymentCallback({
      checkoutRequestId: "callback-bill-100",
      status: "successful",
      dedupeKey: "callback-bill-100-success",
      raw: { ok: true },
    });
    const second = await handlePaymentCallback({
      checkoutRequestId: "callback-bill-100",
      status: "successful",
      dedupeKey: "callback-bill-100-success",
      raw: { ok: true },
    });

    expect(first).toMatchObject({ status: "confirmed", replayed: false });
    expect(second).toMatchObject({ status: "confirmed", replayed: true });
    expect(state.webhookEvents).toHaveLength(1);
    expect(entriesForIntent("bill-100")).toHaveLength(ledgerEntryCount);
  });
});
