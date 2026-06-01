import { beforeEach, describe, expect, test } from "@jest/globals";

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
  notifications: [],
};

function resetState() {
  state.counter = 0;
  state.users = [];
  state.wallets = [];
  state.ledgerAccounts = [];
  state.goals = [];
  state.paymentIntents = [];
  state.providerTransactions = [];
  state.ledgerTransactions = [];
  state.ledgerEntries = [];
  state.notifications = [];
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
  if (where.OR) return where.OR.some((filter) => matchesUser(user, filter));
  if (where.id && user.id !== where.id) return false;
  if (where.email && user.email !== where.email) return false;
  if (where.phone && user.phone !== where.phone) return false;
  return true;
}

function walletWithRelations(wallet, include = {}) {
  if (!wallet) return null;

  const record = { ...wallet };
  if (include.accounts) {
    record.accounts = state.ledgerAccounts
      .filter((account) => account.walletId === wallet.id)
      .map((account) => {
        if (typeof include.accounts === "object" && include.accounts.include?.entries) {
          return {
            ...account,
            entries: state.ledgerEntries.filter((entry) => entry.ledgerAccountId === account.id),
          };
        }
        return { ...account };
      });
  }
  if (include.user) {
    record.user = state.users.find((user) => user.id === wallet.userId) || null;
  }
  return record;
}

function userWithRelations(user, include = {}) {
  if (!user) return null;

  const record = { ...user };
  if (include.wallet) {
    const wallet = state.wallets.find((item) => item.userId === user.id) || null;
    record.wallet = walletWithRelations(wallet, include.wallet.include || {});
  }
  return record;
}

function findWallet(where = {}) {
  if (where.id) return state.wallets.find((wallet) => wallet.id === where.id) || null;
  if (where.userId) return state.wallets.find((wallet) => wallet.userId === where.userId) || null;
  return null;
}

function amountCents(value) {
  const [whole, decimal = "00"] = String(value).split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0").slice(0, 2));
}

const fakePrisma = {
  async $transaction(callback) {
    return callback(fakePrisma);
  },
  user: {
    async findFirst({ where = {} } = {}) {
      return state.users.find((user) => matchesUser(user, where)) || null;
    },
    async create({ data }) {
      const user = withTimestamps({ id: nextId("user"), ...data });
      state.users.push(user);
      return user;
    },
    async update({ where, data }) {
      const user = state.users.find((record) => record.id === where.id);
      Object.assign(user, cleanData(data), { updatedAt: new Date() });
      return user;
    },
    async count() {
      return state.users.length;
    },
    async findMany({ include = {} } = {}) {
      return state.users.map((user) => userWithRelations(user, include));
    },
  },
  wallet: {
    async findUnique({ where = {}, include = {} } = {}) {
      return walletWithRelations(findWallet(where), include);
    },
    async create({ data, include = {} }) {
      const wallet = withTimestamps({ id: nextId("wallet"), ...data });
      state.wallets.push(wallet);
      return walletWithRelations(wallet, include);
    },
    async count() {
      return state.wallets.length;
    },
    async findMany({ include = {} } = {}) {
      return state.wallets.map((wallet) => walletWithRelations(wallet, include));
    },
  },
  ledgerAccount: {
    async createMany({ data = [] } = {}) {
      let count = 0;
      data.forEach((item) => {
        const exists = state.ledgerAccounts.some(
          (account) =>
            account.walletId === item.walletId &&
            account.accountType === item.accountType &&
            account.currencyCode === item.currencyCode
        );
        if (exists) return;
        state.ledgerAccounts.push(withTimestamps({ id: nextId("account"), ...item }));
        count += 1;
      });
      return { count };
    },
  },
  goal: {
    async upsert({ where, create, update }) {
      const existing = state.goals.find((goal) => goal.id === where.id);
      if (existing) {
        Object.assign(existing, cleanData(update), { updatedAt: new Date() });
        return existing;
      }
      const goal = withTimestamps(create);
      state.goals.push(goal);
      return goal;
    },
    async count() {
      return state.goals.length;
    },
  },
  paymentIntent: {
    async findUnique({ where }) {
      if (where.idempotencyKey) {
        return state.paymentIntents.find((intent) => intent.idempotencyKey === where.idempotencyKey) || null;
      }
      if (where.id) return state.paymentIntents.find((intent) => intent.id === where.id) || null;
      return null;
    },
    async create({ data }) {
      const intent = withTimestamps({ id: nextId("intent"), ...data });
      state.paymentIntents.push(intent);
      return intent;
    },
    async count() {
      return state.paymentIntents.length;
    },
  },
  providerTransaction: {
    async upsert({ where, create, update }) {
      const existing = state.providerTransactions.find((providerTransaction) => providerTransaction.id === where.id);
      if (existing) {
        Object.assign(existing, cleanData(update), { updatedAt: new Date() });
        return existing;
      }
      const providerTransaction = withTimestamps(create);
      state.providerTransactions.push(providerTransaction);
      return providerTransaction;
    },
  },
  ledgerTransaction: {
    async findUnique({ where }) {
      return state.ledgerTransactions.find((ledgerTransaction) => ledgerTransaction.id === where.id) || null;
    },
    async create({ data }) {
      const { entries, ...transactionData } = data;
      const ledgerTransaction = withTimestamps(transactionData);
      state.ledgerTransactions.push(ledgerTransaction);
      (entries?.create || []).forEach((entry) => {
        state.ledgerEntries.push(withTimestamps({ ledgerTransactionId: ledgerTransaction.id, ...entry }));
      });
      return {
        ...ledgerTransaction,
        entries: state.ledgerEntries.filter((entry) => entry.ledgerTransactionId === ledgerTransaction.id),
      };
    },
    async count() {
      return state.ledgerTransactions.length;
    },
    async findMany({ include = {} } = {}) {
      return state.ledgerTransactions.map((ledgerTransaction) => ({
        ...ledgerTransaction,
        entries: include.entries
          ? state.ledgerEntries.filter((entry) => entry.ledgerTransactionId === ledgerTransaction.id)
          : undefined,
      }));
    },
  },
  notification: {
    async upsert({ where, create, update }) {
      const existing = state.notifications.find((notification) => {
        if (where.sourceEventId) return notification.sourceEventId === where.sourceEventId;
        return notification.id === where.id;
      });
      if (existing) {
        Object.assign(existing, cleanData(update), { updatedAt: new Date() });
        return existing;
      }
      const notification = withTimestamps(create);
      state.notifications.push(notification);
      return notification;
    },
    async count() {
      return state.notifications.length;
    },
  },
};

const { runMongoToPostgresMigration } = await import("../../scripts/migrateMongoToPostgres.js");

function legacyCollections(overrides = {}) {
  return {
    users: [
      {
        _id: "mongo-user-1",
        fullName: "Legacy Saver",
        email: "legacy@airsave.test",
        phone: "+254700000001",
        passwordHash: "hashed-password",
        roundUpRule: 50,
        walletBalance: 100,
      },
    ],
    wallets: [{ _id: "mongo-wallet-1", user: "mongo-user-1", balance: 100 }],
    goals: [],
    transactions: [],
    payments: [],
    ledgers: [],
    notifications: [],
    ...overrides,
  };
}

async function runMigration(collections, scopes, dryRun = false) {
  return runMongoToPostgresMigration({
    prisma: fakePrisma,
    collections,
    scopes,
    dryRun,
    quiet: true,
  });
}

beforeEach(() => {
  resetState();
});

describe("Mongo to Postgres migration script", () => {
  test("dry-run reports planned user migration without writing data", async () => {
    const report = await runMigration(legacyCollections(), ["users"], true);

    expect(report.dryRun).toBe(true);
    expect(report.counts.migrated.users).toBe(1);
    expect(state.users).toHaveLength(0);
    expect(state.wallets).toHaveLength(0);
    expect(state.ledgerAccounts).toHaveLength(0);
  });

  test("users, wallets, and default ledger accounts migrate idempotently", async () => {
    const collections = legacyCollections();

    await runMigration(collections, ["users"]);
    await runMigration(collections, ["users"]);

    expect(state.users).toHaveLength(1);
    expect(state.wallets).toHaveLength(1);
    expect(state.wallets[0]).toMatchObject({ id: "mongo-wallet-1", userId: "mongo-user-1" });
    expect(state.ledgerAccounts).toHaveLength(5);
    expect(new Set(state.ledgerAccounts.map((account) => account.accountType))).toEqual(
      new Set(["available_funds", "savings", "pending_outbound", "fees", "clearing"])
    );
  });

  test("legacy ledger entries convert to balanced double-entry transactions", async () => {
    const collections = legacyCollections({
      transactions: [
        {
          _id: "legacy-transaction-1",
          user: "mongo-user-1",
          wallet: "mongo-wallet-1",
          type: "deposit",
          amount: 100,
          status: "completed",
          paymentReference: "legacy-reference-1",
        },
      ],
      ledgers: [
        {
          _id: "legacy-ledger-1",
          user: "mongo-user-1",
          wallet: "mongo-wallet-1",
          amount: 100,
          type: "CREDIT",
          status: "completed",
          reference: "legacy-reference-1",
          description: "Legacy deposit",
        },
      ],
    });

    const report = await runMigration(collections, ["users", "transactions"]);
    const entries = state.ledgerEntries.filter((entry) => entry.ledgerTransactionId === "legacy-ledger-legacy-ledger-1");
    const debits = entries.filter((entry) => entry.side === "DEBIT").reduce((sum, entry) => sum + amountCents(entry.amount), 0);
    const credits = entries.filter((entry) => entry.side === "CREDIT").reduce((sum, entry) => sum + amountCents(entry.amount), 0);

    expect(state.paymentIntents).toHaveLength(1);
    expect(state.ledgerTransactions).toHaveLength(1);
    expect(entries).toHaveLength(2);
    expect(debits).toBe(credits);
    expect(debits).toBe(10000);
    expect(report.verification.unbalancedLedgerTransactions).toHaveLength(0);
    expect(report.verification.walletBalanceMismatches).toHaveLength(0);
  });

  test("duplicate transaction migration does not duplicate intents or ledger postings", async () => {
    const collections = legacyCollections({
      transactions: [
        {
          _id: "legacy-transaction-1",
          user: "mongo-user-1",
          wallet: "mongo-wallet-1",
          type: "deposit",
          amount: 100,
          status: "completed",
          paymentReference: "legacy-reference-1",
        },
      ],
      ledgers: [
        {
          _id: "legacy-ledger-1",
          user: "mongo-user-1",
          wallet: "mongo-wallet-1",
          amount: 100,
          type: "CREDIT",
          status: "completed",
          reference: "legacy-reference-1",
          description: "Legacy deposit",
        },
      ],
    });

    await runMigration(collections, ["users", "transactions"]);
    await runMigration(collections, ["users", "transactions"]);

    expect(state.paymentIntents).toHaveLength(1);
    expect(state.providerTransactions).toHaveLength(1);
    expect(state.ledgerTransactions).toHaveLength(1);
    expect(state.ledgerEntries).toHaveLength(2);
  });

  test("notifications migrate once using legacy source references", async () => {
    const collections = legacyCollections({
      notifications: [
        {
          _id: "legacy-notification-1",
          user: "mongo-user-1",
          type: "saving",
          message: "You saved KES 25.00",
          read: false,
        },
      ],
    });

    await runMigration(collections, ["users", "notifications"]);
    await runMigration(collections, ["notifications"]);

    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      id: "legacy-notification-1",
      userId: "mongo-user-1",
      sourceEventId: "legacy-notification-legacy-notification-1",
      read: false,
    });
  });
});
