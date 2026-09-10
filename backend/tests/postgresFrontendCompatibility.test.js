import request from "supertest";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  expectGoalShape,
  expectNotificationShape,
  expectTransactionShape,
  expectUserShape,
  expectWalletShape,
  expectWalletTransactionShape,
} from "./compatibilityShape.js";

const defaultAccountTypes = ["available_funds", "savings", "pending_outbound", "fees", "clearing"];
const defaultPreferences = {
  notifications: true,
  theme: "light",
  privacyMode: false,
  securityAlerts: true,
  linkedPaymentMethods: true,
  autoSaveEnabled: true,
};

const state = {
  counter: 0,
  users: [],
  wallets: [],
  ledgerAccounts: [],
  ledgerTransactions: [],
  ledgerEntries: [],
  paymentIntents: [],
  providerTransactions: [],
  goals: [],
  notifications: [],
  outboxEvents: [],
};

function resetState() {
  state.counter = 0;
  state.users = [];
  state.wallets = [];
  state.ledgerAccounts = [];
  state.ledgerTransactions = [];
  state.ledgerEntries = [];
  state.paymentIntents = [];
  state.providerTransactions = [];
  state.goals = [];
  state.notifications = [];
  state.outboxEvents = [];
}

function nextId(prefix) {
  state.counter += 1;
  return `${prefix}-${state.counter}`;
}

function cleanData(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function withTimestamps(record) {
  const now = new Date();
  return {
    createdAt: now,
    updatedAt: now,
    ...cleanData(record),
  };
}

function matchesUser(user, where = {}) {
  if (where.OR) return where.OR.some((condition) => matchesUser(user, condition));
  if (where.id && user.id !== where.id) return false;
  if (where.email && user.email !== where.email) return false;
  if (where.phone?.in && !where.phone.in.includes(user.phone)) return false;
  if (where.phone && typeof where.phone === "string" && user.phone !== where.phone) return false;
  if (where.id?.not && user.id === where.id.not) return false;
  return true;
}

function matchesGoal(goal, where = {}) {
  if (where.id && goal.id !== where.id) return false;
  if (where.walletId && goal.walletId !== where.walletId) return false;
  if (where.status && goal.status !== where.status) return false;
  return true;
}

function matchesPaymentIntent(paymentIntent, where = {}) {
  if (where.OR) return where.OR.some((condition) => matchesPaymentIntent(paymentIntent, condition));
  if (where.id && paymentIntent.id !== where.id) return false;
  if (where.idempotencyKey && paymentIntent.idempotencyKey !== where.idempotencyKey) return false;
  if (where.userId && paymentIntent.userId !== where.userId) return false;
  if (where.walletId && paymentIntent.walletId !== where.walletId) return false;
  if (where.status && paymentIntent.status !== where.status) return false;
  if (where.type && paymentIntent.type !== where.type) return false;
  return true;
}

function findWallet(where = {}) {
  if (where.id) return state.wallets.find((wallet) => wallet.id === where.id) || null;
  if (where.userId) return state.wallets.find((wallet) => wallet.userId === where.userId) || null;
  return null;
}

function walletWithInclude(wallet, include = {}) {
  if (!wallet) return null;

  return {
    ...wallet,
    ...(include.accounts
      ? {
          accounts: state.ledgerAccounts.filter((account) => account.walletId === wallet.id),
        }
      : {}),
  };
}

function userWithInclude(user, include = {}) {
  if (!user) return null;

  return {
    ...user,
    ...(include.wallet
      ? {
          wallet: state.wallets.find((wallet) => wallet.userId === user.id) || null,
        }
      : {}),
  };
}

function ledgerTransactionWithEntries(ledgerTransaction) {
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

function paymentIntentWithInclude(paymentIntent) {
  if (!paymentIntent) return null;

  const providerTransactions = state.providerTransactions.filter(
    (providerTransaction) => providerTransaction.paymentIntentId === paymentIntent.id
  );
  const linkedProviderTransaction =
    state.providerTransactions.find((providerTransaction) => providerTransaction.id === paymentIntent.providerTransactionId) ||
    providerTransactions[0] ||
    null;

  return {
    ...paymentIntent,
    goal: paymentIntent.goalId ? state.goals.find((goal) => goal.id === paymentIntent.goalId) || null : null,
    providerTransaction: linkedProviderTransaction,
    providerTransactions,
    ledgerTransactions: state.ledgerTransactions
      .filter((ledgerTransaction) => ledgerTransaction.paymentIntentId === paymentIntent.id)
      .map(ledgerTransactionWithEntries),
  };
}

function accountBalance(accountId) {
  return state.ledgerEntries
    .filter((entry) => entry.ledgerAccountId === accountId && entry.status === "POSTED")
    .reduce((total, entry) => (entry.side === "CREDIT" ? total + Number(entry.amount) : total - Number(entry.amount)), 0);
}

const fakePrisma = {
  async $transaction(callback) {
    return callback(fakePrisma);
  },
  user: {
    async findFirst({ where = {}, include = {} } = {}) {
      return userWithInclude(state.users.find((user) => matchesUser(user, where)) || null, include);
    },
    async findUnique({ where = {}, include = {} } = {}) {
      return userWithInclude(state.users.find((user) => matchesUser(user, where)) || null, include);
    },
    async create({ data }) {
      const user = withTimestamps({
        id: nextId("user"),
        role: "USER",
        status: "ACTIVE",
        roundUpRule: 50,
        preferences: defaultPreferences,
        ...data,
      });
      state.users.push(user);
      return user;
    },
    async update({ where, data, include = {} }) {
      const user = state.users.find((record) => record.id === where.id);
      Object.assign(user, cleanData(data), { updatedAt: new Date() });
      return userWithInclude(user, include);
    },
    async updateMany({ where = {}, data }) {
      let count = 0;
      state.users.forEach((user) => {
        if (!matchesUser(user, where)) return;
        Object.assign(user, cleanData(data), { updatedAt: new Date() });
        count += 1;
      });
      return { count };
    },
  },
  wallet: {
    async findUnique({ where = {}, include = {} } = {}) {
      return walletWithInclude(findWallet(where), include);
    },
    async create({ data }) {
      const wallet = withTimestamps({ id: nextId("wallet"), ...data });
      state.wallets.push(wallet);
      return wallet;
    },
  },
  ledgerAccount: {
    async createMany({ data = [], skipDuplicates = false } = {}) {
      let count = 0;
      data.forEach((accountData) => {
        const duplicate = state.ledgerAccounts.find(
          (account) =>
            account.walletId === accountData.walletId &&
            account.accountType === accountData.accountType &&
            account.currencyCode === accountData.currencyCode
        );
        if (duplicate && skipDuplicates) return;
        state.ledgerAccounts.push(withTimestamps({ id: nextId("account"), ...accountData }));
        count += 1;
      });
      return { count };
    },
    async findMany({ where = {} } = {}) {
      return state.ledgerAccounts.filter((account) => {
        if (where.walletId && account.walletId !== where.walletId) return false;
        if (where.currencyCode && account.currencyCode !== where.currencyCode) return false;
        if (where.accountType?.in && !where.accountType.in.includes(account.accountType)) return false;
        return true;
      });
    },
  },
  ledgerTransaction: {
    async create({ data }) {
      const ledgerTransaction = withTimestamps({ id: nextId("ledger-transaction"), ...data });
      state.ledgerTransactions.push(ledgerTransaction);
      return ledgerTransaction;
    },
    async findUnique({ where }) {
      return ledgerTransactionWithEntries(
        state.ledgerTransactions.find((ledgerTransaction) => ledgerTransaction.id === where.id)
      );
    },
    async findMany({ where = {} } = {}) {
      const walletId = where.entries?.some?.ledgerAccount?.walletId;
      const status = where.entries?.some?.status;

      return state.ledgerTransactions
        .filter((ledgerTransaction) => {
          if (where.paymentIntentId && ledgerTransaction.paymentIntentId !== where.paymentIntentId) return false;
          if (!walletId && !status) return true;
          return state.ledgerEntries.some((entry) => {
            const account = state.ledgerAccounts.find((item) => item.id === entry.ledgerAccountId);
            if (entry.ledgerTransactionId !== ledgerTransaction.id) return false;
            if (walletId && account?.walletId !== walletId) return false;
            if (status && entry.status !== status) return false;
            return true;
          });
        })
        .map(ledgerTransactionWithEntries)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    },
    async count({ where = {} } = {}) {
      return (await fakePrisma.ledgerTransaction.findMany({ where })).length;
    },
  },
  ledgerEntry: {
    async create({ data }) {
      const ledgerEntry = withTimestamps({
        id: nextId("ledger-entry"),
        status: "POSTED",
        ...data,
      });
      state.ledgerEntries.push(ledgerEntry);
      return ledgerEntry;
    },
    async findMany({ where = {}, select } = {}) {
      const entries = state.ledgerEntries.filter((entry) => {
        if (where.ledgerAccountId && entry.ledgerAccountId !== where.ledgerAccountId) return false;
        if (where.status && entry.status !== where.status) return false;

        const paymentIntentFilter = where.ledgerTransaction?.paymentIntent;
        if (paymentIntentFilter) {
          const ledgerTransaction = state.ledgerTransactions.find((record) => record.id === entry.ledgerTransactionId);
          const paymentIntent = state.paymentIntents.find((record) => record.id === ledgerTransaction?.paymentIntentId);
          if (!paymentIntent) return false;
          if (paymentIntentFilter.goalId && paymentIntent.goalId !== paymentIntentFilter.goalId) return false;
          if (paymentIntentFilter.status && paymentIntent.status !== paymentIntentFilter.status) return false;
        }

        return true;
      });

      if (!select) return entries;
      return entries.map((entry) => {
        const selected = {};
        Object.keys(select).forEach((key) => {
          selected[key] = entry[key];
        });
        return selected;
      });
    },
  },
  goal: {
    async create({ data }) {
      const goal = withTimestamps({ id: nextId("goal"), ...data });
      state.goals.push(goal);
      return goal;
    },
    async findFirst({ where = {} } = {}) {
      return state.goals.find((goal) => matchesGoal(goal, where)) || null;
    },
    async findMany({ where = {} } = {}) {
      return state.goals.filter((goal) => matchesGoal(goal, where));
    },
    async update({ where, data }) {
      const goal = state.goals.find((record) => record.id === where.id);
      Object.assign(goal, cleanData(data), { updatedAt: new Date() });
      return goal;
    },
  },
  paymentIntent: {
    async findUnique({ where = {} } = {}) {
      return paymentIntentWithInclude(state.paymentIntents.find((paymentIntent) => matchesPaymentIntent(paymentIntent, where)));
    },
    async findFirst({ where = {} } = {}) {
      return paymentIntentWithInclude(state.paymentIntents.find((paymentIntent) => matchesPaymentIntent(paymentIntent, where)));
    },
    async findMany({ where = {}, skip = 0, take = 100 } = {}) {
      return state.paymentIntents
        .filter((paymentIntent) => matchesPaymentIntent(paymentIntent, where))
        .map(paymentIntentWithInclude)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(skip, skip + take);
    },
    async create({ data }) {
      const paymentIntent = withTimestamps({ id: nextId("payment-intent"), ...data });
      state.paymentIntents.push(paymentIntent);
      return paymentIntent;
    },
    async update({ where, data }) {
      const paymentIntent = state.paymentIntents.find((record) => record.id === where.id);
      Object.assign(paymentIntent, cleanData(data), { updatedAt: new Date() });
      return paymentIntentWithInclude(paymentIntent);
    },
  },
  providerTransaction: {
    async create({ data }) {
      const providerTransaction = withTimestamps({ id: nextId("provider-transaction"), ...data });
      state.providerTransactions.push(providerTransaction);
      return providerTransaction;
    },
    async findFirst({ where = {}, include = {} } = {}) {
      const providerTransaction =
        state.providerTransactions.find((record) => {
          if (where.providerReference && record.providerReference !== where.providerReference) return false;
          if (where.checkoutRequestId && record.checkoutRequestId !== where.checkoutRequestId) return false;
          return true;
        }) || null;
      if (!providerTransaction) return null;
      return {
        ...providerTransaction,
        ...(include.paymentIntent
          ? {
              paymentIntent: state.paymentIntents.find((intent) => intent.id === providerTransaction.paymentIntentId),
            }
          : {}),
        ...(include.webhookEvents ? { webhookEvents: [] } : {}),
      };
    },
    async findUnique({ where = {}, include = {} } = {}) {
      const providerTransaction = state.providerTransactions.find((record) => record.id === where.id) || null;
      if (!providerTransaction) return null;
      return {
        ...providerTransaction,
        ...(include.paymentIntent
          ? {
              paymentIntent: state.paymentIntents.find((intent) => intent.id === providerTransaction.paymentIntentId),
            }
          : {}),
      };
    },
    async update({ where, data }) {
      const providerTransaction = state.providerTransactions.find((record) => record.id === where.id);
      Object.assign(providerTransaction, cleanData(data), { updatedAt: new Date() });
      return providerTransaction;
    },
  },
  notification: {
    async findMany({ where = {}, skip = 0, take = 50 } = {}) {
      return state.notifications
        .filter((notification) => {
          if (where.userId && notification.userId !== where.userId) return false;
          if (typeof where.read === "boolean" && notification.read !== where.read) return false;
          return true;
        })
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(skip, skip + take);
    },
    async findFirst({ where = {} } = {}) {
      return (
        state.notifications.find((notification) => {
          if (where.id && notification.id !== where.id) return false;
          if (where.userId && notification.userId !== where.userId) return false;
          return true;
        }) || null
      );
    },
    async update({ where, data }) {
      const notification = state.notifications.find((record) => record.id === where.id);
      Object.assign(notification, cleanData(data), { updatedAt: new Date() });
      return notification;
    },
    async count({ where = {} } = {}) {
      return (await fakePrisma.notification.findMany({ where })).length;
    },
  },
  outboxEvent: {
    async create({ data }) {
      const outboxEvent = withTimestamps({ id: nextId("outbox"), published: false, ...data });
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

const { default: app } = await import("../app.js");

function expectSuccess(response) {
  expect(response.body).toMatchObject({ success: true });
  expect(response.body.data).toBeDefined();
  return response.body.data;
}

function makeUser() {
  return {
    fullName: "Frontend Compatibility User",
    email: "frontend-compat@airsave.test",
    phone: "+254700300400",
    password: "Passw0rd!42",
  };
}

function seedNotification(userId) {
  const notification = withTimestamps({
    id: nextId("notification"),
    userId,
    type: "saving",
    message: "Your savings are moving nicely.",
    read: false,
  });
  state.notifications.push(notification);
  return notification;
}

beforeEach(() => {
  resetState();
});

describe("Postgres frontend/API compatibility", () => {
  test("supports the main frontend flows without frontend-specific payload changes", async () => {
    const user = makeUser();
    const registerData = expectSuccess(await request(app).post("/api/auth/register").send(user).expect(201));
    expectUserShape(expect, registerData.user);
    expect(registerData.token).toEqual(expect.any(String));
    expect(state.ledgerAccounts).toHaveLength(defaultAccountTypes.length);

    const agent = request.agent(app);
    const loginData = expectSuccess(
      await agent.post("/api/auth/login").send({ emailOrPhone: user.phone, password: user.password }).expect(200)
    );
    expectUserShape(expect, loginData.user);

    const profileData = expectSuccess(await agent.get("/api/auth/me").expect(200));
    expectUserShape(expect, profileData.user);

    const walletData = expectSuccess(await agent.get("/api/wallet").expect(200));
    expectWalletShape(expect, walletData);
    expect(walletData.balance).toBe(0);

    const depositData = expectSuccess(
      await agent
        .post("/api/wallet/deposit")
        .send({ amount: 500, phoneNumber: user.phone, sourceMethod: "M-Pesa" })
        .expect(201)
    );
    expect(depositData).toEqual(
      expect.objectContaining({
        message: expect.any(String),
        reference: expect.any(String),
        status: "confirmed",
        amount: 500,
        balance: 500,
        transaction: expect.objectContaining({
          _id: expect.any(String),
          amount: 500,
          createdAt: expect.anything(),
        }),
      })
    );

    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const goalData = expectSuccess(
      await agent
        .post("/api/goals")
        .send({ name: "Frontend Goal", targetAmount: 300, expectedCompletionDate: deadline, status: "active" })
        .expect(201)
    );
    expectGoalShape(expect, goalData);

    const allocationData = expectSuccess(
      await agent
        .post("/api/transactions/payments/initiate")
        .send({ amount: 50, transactionType: "save", goalId: goalData._id })
        .expect(201)
    );
    expect(allocationData).toEqual(
      expect.objectContaining({
        paymentReference: expect.any(String),
        status: "confirmed",
        amount: 50,
        balance: 450,
        transaction: expect.objectContaining({
          _id: expect.any(String),
          type: "save",
          transactionType: "save",
          date: expect.anything(),
        }),
      })
    );

    const walletAfterAllocation = expectSuccess(await agent.get("/api/wallet").expect(200));
    expectWalletShape(expect, walletAfterAllocation);
    expect(walletAfterAllocation.balance).toBe(450);

    const walletTransactionsData = expectSuccess(await agent.get("/api/wallet/transactions").expect(200));
    expect(walletTransactionsData.transactions).toHaveLength(2);
    expectWalletTransactionShape(expect, walletTransactionsData.transactions[0]);

    const activityData = expectSuccess(await agent.get("/api/transactions/activity").expect(200));
    expect(activityData).toHaveLength(2);
    expectTransactionShape(expect, activityData[0]);
    expect(activityData.map((transaction) => transaction._id)).toEqual(
      expect.arrayContaining([allocationData.transaction._id, depositData.paymentIntentId])
    );

    const dashboardData = expectSuccess(await agent.get("/api/dashboard/summary").expect(200));
    expect(dashboardData).toEqual(
      expect.objectContaining({
        walletBalance: 450,
        savedThisMonth: expect.any(Number),
        savingsStreak: expect.any(Number),
        activeGoal: expect.any(Object),
        recentTransactions: expect.any(Array),
        unreadNotifications: expect.any(Number),
      })
    );
    expect(dashboardData.savedThisMonth).toBe(50);
    expect(dashboardData.savingsStreak).toBe(1);
    expect(dashboardData).not.toHaveProperty("totalSaved");
    expect(dashboardData).not.toHaveProperty("weeklySavings");
    expectGoalShape(expect, dashboardData.activeGoal);

    const notification = seedNotification(loginData.user._id);
    const notificationsData = expectSuccess(await agent.get("/api/notifications").expect(200));
    expect(notificationsData).toHaveLength(1);
    expectNotificationShape(expect, notificationsData[0]);

    const markReadData = expectSuccess(await agent.put(`/api/notifications/${notification.id}/read`).send({}).expect(200));
    expectNotificationShape(expect, markReadData.notification);
    expect(markReadData.notification).toMatchObject({ _id: notification.id, read: true });
  });
});
