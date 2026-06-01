import request from "supertest";
import { describe, expect, jest, test } from "@jest/globals";

const healthPrisma = {
  async $queryRawUnsafe(query, ...params) {
    if (query.includes("SELECT 1")) {
      return [{ ok: 1 }];
    }

    if (query.includes("information_schema.tables")) {
      return params.map((tableName) => ({ table_name: tableName }));
    }

    if (query.includes("to_regclass")) {
      return [{ table_name: "_prisma_migrations" }];
    }

    if (query.includes("_prisma_migrations")) {
      return [
        {
          migration_name: "20260601153511_init_postgres_fintech_schema",
          finished_at: new Date(),
          rolled_back_at: null,
        },
      ];
    }

    return [];
  },
  user: {
    async count() {
      return 2;
    },
  },
};

jest.unstable_mockModule("../config/prisma.js", () => ({
  default: healthPrisma,
  getPrisma: () => healthPrisma,
  disconnectPrisma: async () => {},
}));

const { default: app } = await import("../app.js");
const { runPostgresLedgerVerification } = await import("../../scripts/verifyPostgresLedger.js");

const defaultAccountTypes = ["available_funds", "savings", "pending_outbound", "fees", "clearing"];

function makeAccounts(walletId, entries = []) {
  return defaultAccountTypes.map((accountType) => ({
    id: `${walletId}-${accountType}`,
    walletId,
    accountType,
    entries: accountType === "available_funds" ? entries : [],
  }));
}

function makeVerificationClient({
  ledgerTransactions = [],
  wallets = [],
  goals = [],
  paymentIntents = [],
  providerTransactions = [],
  outboxEvents = [],
} = {}) {
  return {
    ledgerTransaction: {
      async findMany() {
        return ledgerTransactions;
      },
    },
    wallet: {
      async findMany() {
        return wallets;
      },
    },
    goal: {
      async findMany({ where = {} } = {}) {
        return goals.filter((goal) => (where.status ? goal.status === where.status : true));
      },
    },
    paymentIntent: {
      async findMany({ where = {} } = {}) {
        return paymentIntents.filter((paymentIntent) => (where.status ? paymentIntent.status === where.status : true));
      },
    },
    providerTransaction: {
      async findMany({ where = {} } = {}) {
        return providerTransactions.filter((providerTransaction) =>
          where.status ? providerTransaction.status === where.status : true
        );
      },
    },
    outboxEvent: {
      async findMany({ where = {}, take = 100 } = {}) {
        return outboxEvents
          .filter((event) => (typeof where.published === "boolean" ? event.published === where.published : true))
          .slice(0, take);
      },
      async count({ where = {} } = {}) {
        return outboxEvents.filter((event) =>
          typeof where.published === "boolean" ? event.published === where.published : true
        ).length;
      },
    },
  };
}

function validClient(overrides = {}) {
  const ledgerTransaction = {
    id: "ledger-1",
    entries: [
      { amount: "100.00", side: "DEBIT", status: "POSTED" },
      { amount: "100.00", side: "CREDIT", status: "POSTED" },
    ],
  };

  return makeVerificationClient({
    ledgerTransactions: [ledgerTransaction],
    wallets: [
      {
        id: "wallet-1",
        accounts: makeAccounts("wallet-1", [{ amount: "100.00", side: "CREDIT", status: "POSTED" }]),
      },
    ],
    goals: [{ id: "goal-1", walletId: "wallet-1", status: "ACTIVE" }],
    paymentIntents: [
      {
        id: "intent-1",
        status: "CONFIRMED",
        idempotencyKey: "intent-key-1",
        ledgerTransactions: [ledgerTransaction],
      },
    ],
    providerTransactions: [
      {
        id: "provider-1",
        status: "SUCCESSFUL",
        paymentIntentId: "intent-1",
        paymentIntent: { id: "intent-1" },
      },
    ],
    outboxEvents: [],
    ...overrides,
  });
}

describe("Postgres cutover readiness", () => {
  test("health check reports a healthy PostgreSQL runtime", async () => {
    const response = await request(app).get("/api/health/postgres").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        ok: true,
        connection: { ok: true },
        migrations: {
          tableExists: true,
          appliedCount: 1,
          failed: [],
        },
        basicQuery: {
          usersCount: 2,
        },
      },
    });
    expect(response.body.data.tables.missing).toEqual([]);
  });

  test("ledger verification passes valid entries", async () => {
    const report = await runPostgresLedgerVerification({ client: validClient() });

    expect(report.ok).toBe(true);
    expect(report.failures.unbalancedLedgerTransactions).toEqual([]);
    expect(report.failures.walletsMissingDefaultAccounts).toEqual([]);
    expect(report.failures.confirmedPaymentIntentsMissingLedgerTransactions).toEqual([]);
  });

  test("ledger verification detects unbalanced entries", async () => {
    const report = await runPostgresLedgerVerification({
      client: validClient({
        ledgerTransactions: [
          {
            id: "ledger-unbalanced",
            entries: [
              { amount: "100.00", side: "DEBIT", status: "POSTED" },
              { amount: "99.00", side: "CREDIT", status: "POSTED" },
            ],
          },
        ],
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.failures.unbalancedLedgerTransactions).toEqual([
      {
        ledgerTransactionId: "ledger-unbalanced",
        debit: "100.00",
        credit: "99.00",
      },
    ]);
  });

  test("ledger verification detects wallets missing default accounts", async () => {
    const report = await runPostgresLedgerVerification({
      client: validClient({
        wallets: [
          {
            id: "wallet-missing-accounts",
            accounts: [{ id: "available", walletId: "wallet-missing-accounts", accountType: "available_funds", entries: [] }],
          },
        ],
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.failures.walletsMissingDefaultAccounts).toEqual([
      {
        walletId: "wallet-missing-accounts",
        missing: ["savings", "pending_outbound", "fees", "clearing"],
      },
    ]);
  });

  test("ledger verification detects confirmed payment intents without ledger transactions", async () => {
    const report = await runPostgresLedgerVerification({
      client: validClient({
        paymentIntents: [
          {
            id: "intent-without-ledger",
            status: "CONFIRMED",
            idempotencyKey: "missing-ledger-key",
            ledgerTransactions: [],
          },
        ],
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.failures.confirmedPaymentIntentsMissingLedgerTransactions).toEqual([
      {
        paymentIntentId: "intent-without-ledger",
        idempotencyKey: "missing-ledger-key",
      },
    ]);
  });
});
