import dotenv from "dotenv";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import prisma, { disconnectPrisma } from "../backend/config/prisma.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(projectRoot, "backend/.env"), quiet: true });

const defaultAccountTypes = ["available_funds", "savings", "pending_outbound", "fees", "clearing"];

function cents(value) {
  const raw = value == null ? "" : String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return 0n;

  const sign = raw.startsWith("-") ? -1n : 1n;
  const [whole, decimal = "00"] = raw.replace("-", "").split(".");
  return sign * (BigInt(whole || "0") * 100n + BigInt(decimal.padEnd(2, "0").slice(0, 2)));
}

function moneyFromCents(value) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function accountBalance(account) {
  return (account?.entries || [])
    .filter((entry) => entry.status === "POSTED")
    .reduce((total, entry) => (entry.side === "CREDIT" ? total + cents(entry.amount) : total - cents(entry.amount)), 0n);
}

function countIssues(groups) {
  return Object.values(groups).reduce((sum, items) => sum + items.length, 0);
}

function createReport() {
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    totals: {
      ledgerTransactions: 0,
      wallets: 0,
      activeGoals: 0,
      confirmedPaymentIntents: 0,
      successfulProviderTransactions: 0,
      unpublishedOutboxEvents: 0,
    },
    failures: {
      unbalancedLedgerTransactions: [],
      walletsMissingDefaultAccounts: [],
      duplicateActiveGoals: [],
      confirmedPaymentIntentsMissingLedgerTransactions: [],
      providerTransactionsMissingPaymentIntent: [],
      negativeAvailableFunds: [],
    },
    warnings: {
      unpublishedOutboxEvents: [],
    },
  };
}

function getAccount(wallet, accountType) {
  return wallet?.accounts?.find((account) => account.accountType === accountType);
}

async function verifyLedgerTransactions(client, report) {
  const ledgerTransactions = await client.ledgerTransaction.findMany({ include: { entries: true } });
  report.totals.ledgerTransactions = ledgerTransactions.length;

  ledgerTransactions.forEach((transaction) => {
    const totals = transaction.entries.reduce(
      (sum, entry) => {
        if (entry.side === "DEBIT") sum.debit += cents(entry.amount);
        if (entry.side === "CREDIT") sum.credit += cents(entry.amount);
        return sum;
      },
      { debit: 0n, credit: 0n }
    );

    if (totals.debit !== totals.credit) {
      report.failures.unbalancedLedgerTransactions.push({
        ledgerTransactionId: transaction.id,
        debit: moneyFromCents(totals.debit),
        credit: moneyFromCents(totals.credit),
      });
    }
  });
}

async function verifyWallets(client, report) {
  const wallets = await client.wallet.findMany({
    include: {
      accounts: {
        include: {
          entries: true,
        },
      },
    },
  });
  report.totals.wallets = wallets.length;

  wallets.forEach((wallet) => {
    const existingTypes = new Set(wallet.accounts.map((account) => account.accountType));
    const missing = defaultAccountTypes.filter((accountType) => !existingTypes.has(accountType));
    if (missing.length) {
      report.failures.walletsMissingDefaultAccounts.push({ walletId: wallet.id, missing });
    }

    const availableFunds = getAccount(wallet, "available_funds");
    const availableBalance = accountBalance(availableFunds);
    if (availableFunds && availableBalance < 0n) {
      report.failures.negativeAvailableFunds.push({
        walletId: wallet.id,
        accountId: availableFunds.id,
        balance: moneyFromCents(availableBalance),
      });
    }
  });
}

async function verifyGoals(client, report) {
  const activeGoals = await client.goal.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, walletId: true },
  });
  report.totals.activeGoals = activeGoals.length;

  const goalsByWallet = new Map();
  activeGoals.forEach((goal) => {
    const goals = goalsByWallet.get(goal.walletId) || [];
    goals.push(goal.id);
    goalsByWallet.set(goal.walletId, goals);
  });

  goalsByWallet.forEach((goalIds, walletId) => {
    if (goalIds.length > 1) {
      report.failures.duplicateActiveGoals.push({ walletId, goalIds });
    }
  });
}

async function verifyPaymentIntents(client, report) {
  const confirmedPaymentIntents = await client.paymentIntent.findMany({
    where: { status: "CONFIRMED" },
    include: { ledgerTransactions: true },
  });
  report.totals.confirmedPaymentIntents = confirmedPaymentIntents.length;

  confirmedPaymentIntents.forEach((paymentIntent) => {
    if (!paymentIntent.ledgerTransactions?.length) {
      report.failures.confirmedPaymentIntentsMissingLedgerTransactions.push({
        paymentIntentId: paymentIntent.id,
        idempotencyKey: paymentIntent.idempotencyKey,
      });
    }
  });
}

async function verifyProviderTransactions(client, report) {
  const successfulProviderTransactions = await client.providerTransaction.findMany({
    where: { status: "SUCCESSFUL" },
    include: { paymentIntent: true },
  });
  report.totals.successfulProviderTransactions = successfulProviderTransactions.length;

  successfulProviderTransactions.forEach((providerTransaction) => {
    if (!providerTransaction.paymentIntent) {
      report.failures.providerTransactionsMissingPaymentIntent.push({
        providerTransactionId: providerTransaction.id,
        paymentIntentId: providerTransaction.paymentIntentId,
        providerReference: providerTransaction.providerReference,
      });
    }
  });
}

async function verifyOutbox(client, report, outboxLimit) {
  const unpublishedOutboxEvents = await client.outboxEvent.findMany({
    where: { published: false },
    orderBy: { createdAt: "asc" },
    take: outboxLimit,
  });
  const unpublishedOutboxCount =
    typeof client.outboxEvent.count === "function"
      ? await client.outboxEvent.count({ where: { published: false } })
      : unpublishedOutboxEvents.length;

  report.totals.unpublishedOutboxEvents = unpublishedOutboxCount;
  report.warnings.unpublishedOutboxEvents = unpublishedOutboxEvents.map((event) => ({
    outboxEventId: event.id,
    eventType: event.eventType,
    relatedId: event.relatedId,
    createdAt: event.createdAt,
  }));
}

export async function runPostgresLedgerVerification({ client = prisma, outboxLimit = 100 } = {}) {
  const report = createReport();

  await verifyLedgerTransactions(client, report);
  await verifyWallets(client, report);
  await verifyGoals(client, report);
  await verifyPaymentIntents(client, report);
  await verifyProviderTransactions(client, report);
  await verifyOutbox(client, report, outboxLimit);

  report.ok = countIssues(report.failures) === 0;
  return report;
}

function printReport(report) {
  console.info("PostgreSQL ledger verification summary");
  console.info(JSON.stringify(report, null, 2));
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runPostgresLedgerVerification()
    .then((report) => {
      printReport(report);
      process.exitCode = report.ok ? 0 : 1;
    })
    .catch((error) => {
      console.error("PostgreSQL ledger verification failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
