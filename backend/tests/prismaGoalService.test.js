import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const state = {
  counter: 0,
  users: [],
  wallets: [],
  ledgerAccounts: [],
  goals: [],
  paymentIntents: [],
  ledgerTransactions: [],
  ledgerEntries: [],
  outboxEvents: [],
};

function resetState() {
  state.counter = 0;
  state.users = [
    {
      id: "user-1",
      fullName: "Postgres Goal User",
      email: "postgres-goals@airsave.test",
      phone: "+254700000001",
      roundUpRule: 50,
    },
  ];
  state.wallets = [];
  state.ledgerAccounts = [];
  state.goals = [];
  state.paymentIntents = [];
  state.ledgerTransactions = [];
  state.ledgerEntries = [];
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

function findWallet(where = {}) {
  if (where.userId) {
    return state.wallets.find((wallet) => wallet.userId === where.userId) || null;
  }

  if (where.id) {
    return state.wallets.find((wallet) => wallet.id === where.id) || null;
  }

  return null;
}

function matchesGoal(goal, where = {}) {
  if (where.id && goal.id !== where.id) return false;
  if (where.walletId && goal.walletId !== where.walletId) return false;
  if (where.status && goal.status !== where.status) return false;
  return true;
}

function getLedgerTransactionWithEntries(ledgerTransaction) {
  if (!ledgerTransaction) return null;

  return {
    ...ledgerTransaction,
    entries: state.ledgerEntries
      .filter((entry) => entry.ledgerTransactionId === ledgerTransaction.id)
      .map((entry) => ({
        ...entry,
        ledgerAccount: state.ledgerAccounts.find((account) => account.id === entry.ledgerAccountId),
      })),
  };
}

const fakePrisma = {
  async $transaction(callback) {
    return callback(fakePrisma);
  },
  user: {
    async update({ where, data }) {
      const user = state.users.find((record) => record.id === where.id);
      Object.assign(user, data);
      return user;
    },
  },
  wallet: {
    async findUnique({ where, include } = {}) {
      const wallet = findWallet(where);
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
    async create({ data }) {
      const goal = withTimestamps({
        id: nextId("goal"),
        ...data,
      });
      state.goals.push(goal);
      return goal;
    },
    async findMany({ where } = {}) {
      return state.goals.filter((goal) => matchesGoal(goal, where));
    },
    async findFirst({ where } = {}) {
      return state.goals.find((goal) => matchesGoal(goal, where)) || null;
    },
    async update({ where, data }) {
      const goal = state.goals.find((record) => record.id === where.id);
      if (!goal) return null;
      Object.assign(goal, data, { updatedAt: new Date() });
      return goal;
    },
    async delete({ where }) {
      const index = state.goals.findIndex((record) => record.id === where.id);
      if (index === -1) return null;
      const [goal] = state.goals.splice(index, 1);
      return goal;
    },
  },
  paymentIntent: {
    async findUnique({ where }) {
      if (where.idempotencyKey) {
        return state.paymentIntents.find((intent) => intent.idempotencyKey === where.idempotencyKey) || null;
      }

      if (where.id) {
        return state.paymentIntents.find((intent) => intent.id === where.id) || null;
      }

      return null;
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
      return paymentIntent;
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
    async findUnique({ where }) {
      return getLedgerTransactionWithEntries(
        state.ledgerTransactions.find((ledgerTransaction) => ledgerTransaction.id === where.id)
      );
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

const {
  allocateSavingsToGoal,
  createGoal,
  getGoals,
} = await import("../services/postgres/prismaGoalService.js");

beforeEach(() => {
  resetState();
});

function getWallet() {
  return state.wallets.find((wallet) => wallet.userId === "user-1");
}

function getAccount(accountType) {
  const wallet = getWallet();
  return state.ledgerAccounts.find((account) => account.walletId === wallet.id && account.accountType === accountType);
}

function seedAvailableFunds(amount) {
  const availableFunds = getAccount("available_funds");
  const clearing = getAccount("clearing");
  const ledgerTransaction = withTimestamps({
    id: nextId("seed-ledger-tx"),
    paymentIntentId: null,
    description: "Seed wallet balance",
  });

  state.ledgerTransactions.push(ledgerTransaction);
  state.ledgerEntries.push(
    withTimestamps({
      id: nextId("seed-entry"),
      ledgerTransactionId: ledgerTransaction.id,
      ledgerAccountId: clearing.id,
      amount: String(Number(amount).toFixed(2)),
      side: "DEBIT",
      status: "POSTED",
      reference: "seed-deposit",
      postedAt: new Date(),
    }),
    withTimestamps({
      id: nextId("seed-entry"),
      ledgerTransactionId: ledgerTransaction.id,
      ledgerAccountId: availableFunds.id,
      amount: String(Number(amount).toFixed(2)),
      side: "CREDIT",
      status: "POSTED",
      reference: "seed-deposit",
      postedAt: new Date(),
    })
  );
}

function getSavingsLedgerEntries() {
  const savings = getAccount("savings");
  return state.ledgerEntries.filter((entry) => entry.ledgerAccountId === savings.id);
}

describe("Prisma goal service", () => {
  test("creates a goal with default ledger accounts and a goal.created outbox event", async () => {
    const goal = await createGoal("user-1", {
      name: "Emergency Fund",
      targetAmount: 1000,
      expectedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(goal).toMatchObject({
      _id: expect.any(String),
      name: "Emergency Fund",
      targetAmount: 1000,
      savedAmount: 0,
      currentAmount: 0,
      status: "active",
    });
    expect(state.ledgerAccounts.map((account) => account.accountType).sort()).toEqual([
      "available_funds",
      "clearing",
      "fees",
      "pending_outbound",
      "savings",
    ]);
    expect(state.outboxEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "goal.created", relatedId: goal.id })])
    );
  });

  test("lists user goals with ledger-derived progress", async () => {
    const firstGoal = await createGoal("user-1", {
      name: "Rent",
      targetAmount: 2000,
      duration: "30 days",
    });
    seedAvailableFunds(500);
    await allocateSavingsToGoal("user-1", firstGoal.id, 125, {
      idempotencyKey: "save-rent-125",
    });

    const goals = await getGoals("user-1");

    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      id: firstGoal.id,
      savedAmount: 125,
      currentAmount: 125,
      progressPercent: 6.25,
    });
  });

  test("allocates savings to a goal through balanced double-entry ledger posting", async () => {
    const goal = await createGoal("user-1", {
      name: "School Fees",
      targetAmount: 500,
      duration: "8 weeks",
    });
    seedAvailableFunds(300);

    const result = await allocateSavingsToGoal("user-1", goal.id, 150, {
      idempotencyKey: "save-school-150",
      description: "Manual school fees allocation",
    });

    expect(result).toMatchObject({
      status: "confirmed",
      amount: 150,
      replayed: false,
    });
    expect(result.goal).toMatchObject({
      id: goal.id,
      savedAmount: 150,
      currentAmount: 150,
    });

    const paymentIntent = state.paymentIntents.find((intent) => intent.idempotencyKey === "save-school-150");
    const ledgerEntries = state.ledgerEntries.filter((entry) => {
      const ledgerTransaction = state.ledgerTransactions.find(
        (record) => record.id === entry.ledgerTransactionId
      );
      return ledgerTransaction?.paymentIntentId === paymentIntent.id;
    });
    const debits = ledgerEntries
      .filter((entry) => entry.side === "DEBIT")
      .reduce((total, entry) => total + Number(entry.amount), 0);
    const credits = ledgerEntries
      .filter((entry) => entry.side === "CREDIT")
      .reduce((total, entry) => total + Number(entry.amount), 0);

    expect(paymentIntent).toMatchObject({
      type: "save",
      status: "CONFIRMED",
      goalId: goal.id,
    });
    expect(debits).toBe(150);
    expect(credits).toBe(150);
    expect(getSavingsLedgerEntries()).toHaveLength(1);
  });

  test("replays the same savings idempotency key without duplicating ledger entries", async () => {
    const goal = await createGoal("user-1", {
      name: "Holiday",
      targetAmount: 300,
      duration: "12 weeks",
    });
    seedAvailableFunds(300);

    const firstResult = await allocateSavingsToGoal("user-1", goal.id, 75, {
      idempotencyKey: "save-holiday-75",
    });
    const ledgerEntryCount = state.ledgerEntries.length;
    const secondResult = await allocateSavingsToGoal("user-1", goal.id, 75, {
      idempotencyKey: "save-holiday-75",
    });

    expect(firstResult.replayed).toBe(false);
    expect(secondResult.replayed).toBe(true);
    expect(state.ledgerEntries).toHaveLength(ledgerEntryCount);
    expect(state.paymentIntents.filter((intent) => intent.idempotencyKey === "save-holiday-75")).toHaveLength(1);
  });

  test("marks the goal completed and emits goal.completed when savings reach the target", async () => {
    const goal = await createGoal("user-1", {
      name: "Phone",
      targetAmount: 100,
      duration: "4 weeks",
    });
    seedAvailableFunds(150);

    const result = await allocateSavingsToGoal("user-1", goal.id, 100, {
      idempotencyKey: "save-phone-100",
    });

    expect(result.goal).toMatchObject({
      id: goal.id,
      savedAmount: 100,
      status: "completed",
    });
    expect(state.outboxEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "savings.allocated" }),
        expect.objectContaining({ eventType: "goal.completed", relatedId: goal.id }),
      ])
    );
  });
});
