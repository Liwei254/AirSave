import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(projectRoot, "backend/.env"), quiet: true });

const defaultAccountTypes = ["available_funds", "savings", "pending_outbound", "fees", "clearing"];
const reportDirectory = path.join(projectRoot, "migration-reports");

function nowStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function toId(value) {
  if (!value) return "";
  return typeof value.toString === "function" ? value.toString() : String(value);
}

function asDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function money(value, fallback = "0.00") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return amount.toFixed(2);
}

function optionalMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toFixed(2);
}

function cents(value) {
  const normalized = money(value);
  const [whole, decimal = "00"] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
}

function role(value) {
  return String(value || "user").toLowerCase() === "admin" ? "ADMIN" : "USER";
}

function userStatus(value) {
  return String(value || "active").toLowerCase() === "suspended" ? "SUSPENDED" : "ACTIVE";
}

function goalStatus(value) {
  const status = String(value || "active").toLowerCase();
  if (status === "completed") return "COMPLETED";
  if (status === "closed") return "CLOSED";
  return "ACTIVE";
}

function paymentStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["confirmed", "success", "successful", "completed"].includes(status)) return "CONFIRMED";
  if (["failed", "fail"].includes(status)) return "FAILED";
  if (["pending", "processing", "initiated"].includes(status)) return "PENDING_PROVIDER";
  return "CONFIRMED";
}

function providerStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["confirmed", "success", "successful", "completed"].includes(status)) return "SUCCESSFUL";
  if (["failed", "fail"].includes(status)) return "FAILED";
  if (["pending", "processing"].includes(status)) return "PENDING";
  return "INITIATED";
}

function transactionType(value) {
  const type = String(value || "deposit").toLowerCase();
  if (["purchase", "bill", "send", "withdraw", "save", "deposit"].includes(type)) return type;
  return "deposit";
}

function isSavingsLedger(ledger) {
  const reference = String(ledger.reference || "");
  const description = String(ledger.description || "").toLowerCase();
  return reference.endsWith("-SAVE") || description.includes("auto-saved") || description.includes("savings");
}

function isGoalWithdrawalLedger(ledger) {
  const description = String(ledger.description || "").toLowerCase();
  return ledger.type === "DEBIT" && description.startsWith("withdrawal from") && !description.includes("savings wallet");
}

function jsonSafe(value) {
  if (value == null) return value;
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item && typeof item === "object" && typeof item.toHexString === "function") return item.toString();
      if (item instanceof Date) return item.toISOString();
      return item;
    })
  );
}

function getCliOptions(argv = process.argv.slice(2)) {
  const flags = new Set(argv);
  const scopedFlags = ["users", "goals", "transactions", "notifications"].filter((scope) => flags.has(`--${scope}`));
  const dryRun = flags.has("--dry-run") || !flags.has("--execute");

  return {
    dryRun,
    execute: flags.has("--execute"),
    scopes: scopedFlags.length ? scopedFlags : ["users", "goals", "transactions", "notifications"],
  };
}

function createReport({ dryRun, scopes }) {
  return {
    dryRun,
    scopes,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    counts: {
      mongo: {},
      postgres: {},
      migrated: {
        users: 0,
        wallets: 0,
        ledgerAccounts: 0,
        goals: 0,
        paymentIntents: 0,
        providerTransactions: 0,
        ledgerTransactions: 0,
        notifications: 0,
      },
      skipped: {},
      failed: {},
    },
    warnings: [],
    errors: [],
    verification: {
      walletsMissing: [],
      accountsMissing: [],
      unbalancedLedgerTransactions: [],
      negativeWalletBalances: [],
      walletBalanceMismatches: [],
    },
  };
}

function createLogger(report, quiet = false) {
  return {
    info(message, details = {}) {
      if (!quiet) console.info(message, Object.keys(details).length ? details : "");
    },
    warn(message, details = {}) {
      report.warnings.push({ message, ...details });
      if (!quiet) console.warn(message, Object.keys(details).length ? details : "");
    },
    error(message, details = {}) {
      report.errors.push({ message, ...details });
      if (!quiet) console.error(message, Object.keys(details).length ? details : "");
    },
  };
}

async function readModel(model) {
  if (!model) return [];
  if (Array.isArray(model)) return model;
  if (typeof model.find === "function") {
    const query = model.find({});
    if (typeof query.lean === "function") return query.lean();
    return query;
  }
  return [];
}

async function countModel(model) {
  if (!model) return 0;
  if (Array.isArray(model)) return model.length;
  if (typeof model.countDocuments === "function") return model.countDocuments({});
  return 0;
}

async function withTransaction(prisma, callback) {
  if (typeof prisma.$transaction === "function") {
    return prisma.$transaction(callback);
  }
  return callback(prisma);
}

async function findExistingUser(tx, user) {
  const filters = [{ id: toId(user._id) }];
  if (user.email) filters.push({ email: String(user.email).toLowerCase() });
  if (user.phone) filters.push({ phone: String(user.phone) });

  if (typeof tx.user.findFirst === "function") {
    return tx.user.findFirst({ where: { OR: filters } });
  }

  return null;
}

async function ensureUser(tx, user, { dryRun, report, logger }) {
  const legacyId = toId(user._id);
  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(user.phone || "").trim();

  if (!legacyId || !phone) {
    report.counts.failed.users = (report.counts.failed.users || 0) + 1;
    logger.warn("Skipping user without required id/phone", { legacyId, email });
    return null;
  }

  if (dryRun) {
    report.counts.migrated.users += 1;
    return legacyId;
  }

  const existingUser = await findExistingUser(tx, user);
  const data = {
    fullName: String(user.fullName || user.name || "").trim() || "AirSave User",
    email: email || `${legacyId}@legacy.airsave.local`,
    phone,
    passwordHash: user.passwordHash || user.password || "__MIGRATED_PASSWORD_HASH_MISSING__",
    role: role(user.role),
    status: userStatus(user.status),
    roundUpRule: Number(user.roundUpRule || 50),
    avatarUrl: user.avatarUrl || user.avatar || null,
    preferences: jsonSafe(user.preferences || {}),
    createdAt: asDate(user.createdAt),
    updatedAt: asDate(user.updatedAt) || new Date(),
  };

  const savedUser = existingUser
    ? await tx.user.update({ where: { id: existingUser.id }, data })
    : await tx.user.create({ data: { id: legacyId, ...data } });

  report.counts.migrated.users += 1;
  return savedUser.id;
}

async function ensureWalletAndAccounts(tx, { userId, walletId, dryRun, report }) {
  if (dryRun) {
    report.counts.migrated.wallets += 1;
    report.counts.migrated.ledgerAccounts += defaultAccountTypes.length;
    return walletId || `dry-wallet-${userId}`;
  }

  const existingWallet = await tx.wallet.findUnique({ where: { userId }, include: { accounts: true } });
  const wallet =
    existingWallet ||
    (await tx.wallet.create({
      data: {
        id: walletId || undefined,
        userId,
      },
      include: {
        accounts: true,
      },
    }));

  const createdAccounts = await tx.ledgerAccount.createMany({
    data: defaultAccountTypes.map((accountType) => ({
      walletId: wallet.id,
      accountType,
      currencyCode: "KES",
    })),
    skipDuplicates: true,
  });

  report.counts.migrated.wallets += existingWallet ? 0 : 1;
  report.counts.migrated.ledgerAccounts += createdAccounts?.count ?? defaultAccountTypes.length;
  return wallet.id;
}

async function getWalletWithAccounts(tx, userId) {
  return tx.wallet.findUnique({
    where: { userId },
    include: { accounts: true },
  });
}

function account(wallet, type) {
  return wallet?.accounts?.find((item) => item.accountType === type);
}

async function migrateUsers({ prisma, collections, dryRun, report, logger }) {
  const users = await readModel(collections.users);
  const wallets = await readModel(collections.wallets);
  const walletByUser = new Map(wallets.map((wallet) => [toId(wallet.user), wallet]));
  const userMap = new Map();
  const walletMap = new Map();
  const legacyWalletMap = new Map();

  for (const user of users) {
    try {
      await withTransaction(prisma, async (tx) => {
        const userId = await ensureUser(tx, user, { dryRun, report, logger });
        if (!userId) return;

        const mongoWallet = walletByUser.get(toId(user._id));
        const legacyWalletId = toId(user.wallet || mongoWallet?._id);
        const walletId = await ensureWalletAndAccounts(tx, {
          userId,
          walletId: legacyWalletId || undefined,
          dryRun,
          report,
        });

        userMap.set(toId(user._id), userId);
        walletMap.set(toId(user._id), walletId);
        if (legacyWalletId) legacyWalletMap.set(legacyWalletId, walletId);
      });
    } catch (error) {
      report.counts.failed.users = (report.counts.failed.users || 0) + 1;
      logger.error("Failed to migrate user", { legacyId: toId(user._id), error: error.message });
    }
  }

  return { userMap, walletMap, legacyWalletMap };
}

async function hydrateUserWalletMaps({ prisma, collections, dryRun }) {
  const users = await readModel(collections.users);
  const wallets = await readModel(collections.wallets);
  const walletByUser = new Map(wallets.map((wallet) => [toId(wallet.user), wallet]));
  const userMap = new Map();
  const walletMap = new Map();
  const legacyWalletMap = new Map();

  for (const user of users) {
    const legacyUserId = toId(user._id);
    let userId = legacyUserId;
    const mongoWallet = walletByUser.get(legacyUserId);
    const legacyWalletId = toId(user.wallet || mongoWallet?._id);

    if (dryRun) {
      userMap.set(legacyUserId, userId);
      walletMap.set(legacyUserId, legacyWalletId || `dry-wallet-${legacyUserId}`);
      if (legacyWalletId) legacyWalletMap.set(legacyWalletId, legacyWalletId);
      continue;
    }

    const existingUser = await findExistingUser(prisma, user);
    if (existingUser) userId = existingUser.id;
    userMap.set(legacyUserId, userId);

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet) {
      walletMap.set(legacyUserId, wallet.id);
      if (legacyWalletId) legacyWalletMap.set(legacyWalletId, wallet.id);
    }
  }

  return { userMap, walletMap, legacyWalletMap };
}

async function migrateGoals({ prisma, collections, dryRun, report, logger, walletMap }) {
  const goals = await readModel(collections.goals);
  const activeByWallet = new Set();

  for (const goal of goals) {
    const userId = toId(goal.user);
    const walletId = walletMap.get(userId);

    if (!walletId) {
      report.counts.failed.goals = (report.counts.failed.goals || 0) + 1;
      logger.warn("Skipping goal without migrated wallet", { goalId: toId(goal._id), userId });
      continue;
    }

    const status = goalStatus(goal.status);
    const finalStatus = status === "ACTIVE" && activeByWallet.has(walletId) ? "CLOSED" : status;
    if (status === "ACTIVE" && finalStatus === "CLOSED") {
      logger.warn("Closing duplicate active goal during migration", { goalId: toId(goal._id), walletId });
    }
    if (finalStatus === "ACTIVE") activeByWallet.add(walletId);

    if (dryRun) {
      report.counts.migrated.goals += 1;
      continue;
    }

    try {
      await prisma.goal.upsert({
        where: { id: toId(goal._id) },
        create: {
          id: toId(goal._id),
          walletId,
          name: String(goal.name || "Legacy goal").trim(),
          targetAmount: money(goal.targetAmount),
          savedAmount: money(goal.currentAmount ?? goal.savedAmount),
          status: finalStatus,
          startDate: asDate(goal.startDate),
          deadline: asDate(goal.deadline || goal.expectedCompletionDate),
          expectedCompletionDate: asDate(goal.expectedCompletionDate || goal.deadline),
          template: goal.template || null,
          createdAt: asDate(goal.createdAt),
          updatedAt: asDate(goal.updatedAt) || new Date(),
        },
        update: {
          walletId,
          name: String(goal.name || "Legacy goal").trim(),
          targetAmount: money(goal.targetAmount),
          savedAmount: money(goal.currentAmount ?? goal.savedAmount),
          status: finalStatus,
          startDate: asDate(goal.startDate),
          deadline: asDate(goal.deadline || goal.expectedCompletionDate),
          expectedCompletionDate: asDate(goal.expectedCompletionDate || goal.deadline),
          template: goal.template || null,
          updatedAt: asDate(goal.updatedAt) || new Date(),
        },
      });
      report.counts.migrated.goals += 1;
    } catch (error) {
      report.counts.failed.goals = (report.counts.failed.goals || 0) + 1;
      logger.error("Failed to migrate goal", { goalId: toId(goal._id), error: error.message });
    }
  }
}

function idempotencyFor(prefix, record) {
  return record.paymentReference || record.providerReference || record.reference || `legacy:${prefix}:${toId(record._id)}`;
}

async function ensurePaymentIntentForRecord(tx, record, { userId, walletId, goalId = null, prefix, dryRun, report }) {
  const idempotencyKey = idempotencyFor(prefix, record);
  if (dryRun) {
    report.counts.migrated.paymentIntents += 1;
    return { id: `dry-intent-${toId(record._id)}`, idempotencyKey };
  }

  const existing = await tx.paymentIntent.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  const paymentIntent = await tx.paymentIntent.create({
    data: {
      id: `legacy-${prefix}-${toId(record._id)}`,
      userId,
      walletId,
      goalId,
      type: transactionType(record.transactionType || record.type),
      originalAmount: money(record.originalAmount ?? record.amount),
      roundedAmount: money(record.roundedAmount ?? record.amount ?? record.originalAmount),
      savingsAmount: money(record.savingsAmount ?? record.savings ?? 0),
      status: paymentStatus(record.status),
      roundingRule: Number(record.roundingType || record.roundUpRule || 50) || null,
      idempotencyKey,
      createdAt: asDate(record.createdAt),
      updatedAt: asDate(record.updatedAt) || new Date(),
    },
  });

  report.counts.migrated.paymentIntents += 1;
  return paymentIntent;
}

async function migrateProviderTransaction(tx, record, paymentIntent, { dryRun, report }) {
  const providerReference = record.providerReference || record.mpesaReceipt || record.paymentReference || record.reference;
  const checkoutRequestId = record.checkoutRequestId || record.callbackReference;

  if (!providerReference && !checkoutRequestId) return;
  if (dryRun) {
    report.counts.migrated.providerTransactions += 1;
    return;
  }

  const id = `legacy-provider-${toId(record._id)}`;
  await tx.providerTransaction.upsert({
    where: { id },
    create: {
      id,
      paymentIntentId: paymentIntent.id,
      providerName: record.provider || "legacy",
      providerReference: providerReference || null,
      checkoutRequestId: checkoutRequestId || null,
      status: providerStatus(record.status),
      amount: money(record.roundedAmount ?? record.amount ?? record.originalAmount),
      rawRequestData: jsonSafe(record),
      rawResponseData: jsonSafe(record.callbackPayload || null),
      confirmedAt: asDate(record.confirmedAt),
      createdAt: asDate(record.createdAt),
      updatedAt: asDate(record.updatedAt) || new Date(),
    },
    update: {
      providerReference: providerReference || null,
      checkoutRequestId: checkoutRequestId || null,
      status: providerStatus(record.status),
      amount: money(record.roundedAmount ?? record.amount ?? record.originalAmount),
      rawRequestData: jsonSafe(record),
      rawResponseData: jsonSafe(record.callbackPayload || null),
      confirmedAt: asDate(record.confirmedAt),
      updatedAt: asDate(record.updatedAt) || new Date(),
    },
  });
  report.counts.migrated.providerTransactions += 1;
}

function ledgerAccountsForLegacy(ledger, wallet) {
  const clearing = account(wallet, "clearing");
  const availableFunds = account(wallet, "available_funds");
  const savings = account(wallet, "savings");

  if (ledger.type === "CREDIT") {
    if (isSavingsLedger(ledger)) {
      return [
        { account: availableFunds, side: "DEBIT" },
        { account: savings, side: "CREDIT" },
      ];
    }

    return [
      { account: clearing, side: "DEBIT" },
      { account: availableFunds, side: "CREDIT" },
    ];
  }

  if (isGoalWithdrawalLedger(ledger)) {
    return [
      { account: savings, side: "DEBIT" },
      { account: clearing, side: "CREDIT" },
    ];
  }

  return [
    { account: availableFunds, side: "DEBIT" },
    { account: clearing, side: "CREDIT" },
  ];
}

async function migrateLegacyLedger(tx, ledger, { paymentIntentId = null, walletId = null, dryRun, report }) {
  if (dryRun) {
    report.counts.migrated.ledgerTransactions += 1;
    return;
  }

  const wallet = await tx.wallet.findUnique({ where: { id: walletId || toId(ledger.wallet) }, include: { accounts: true } });
  if (!wallet) throw new Error(`Wallet not found for ledger ${toId(ledger._id)}`);

  const accounts = ledgerAccountsForLegacy(ledger, wallet);
  if (accounts.some((entry) => !entry.account)) {
    throw new Error(`Missing ledger account for ledger ${toId(ledger._id)}`);
  }

  const ledgerTransactionId = `legacy-ledger-${toId(ledger._id)}`;
  const existing = await tx.ledgerTransaction.findUnique({ where: { id: ledgerTransactionId } });
  if (existing) return;

  await tx.ledgerTransaction.create({
    data: {
      id: ledgerTransactionId,
      paymentIntentId,
      description: ledger.description || `Legacy ${ledger.type} ledger`,
      createdAt: asDate(ledger.createdAt),
      updatedAt: asDate(ledger.updatedAt) || new Date(),
      entries: {
        create: accounts.map((entry, index) => ({
          id: `${ledgerTransactionId}-${entry.side.toLowerCase()}-${index}`,
          ledgerAccountId: entry.account.id,
          amount: money(ledger.amount),
          side: entry.side,
          status: ledger.status === "failed" ? "FAILED" : ledger.status === "pending" ? "PENDING" : "POSTED",
          reference: ledger.reference,
          postedAt: ledger.status === "pending" ? null : asDate(ledger.createdAt) || new Date(),
          createdAt: asDate(ledger.createdAt),
          updatedAt: asDate(ledger.updatedAt) || new Date(),
        })),
      },
    },
  });
  report.counts.migrated.ledgerTransactions += 1;
}

async function migrateTransactions({ prisma, collections, dryRun, report, logger, userMap, walletMap, legacyWalletMap }) {
  const transactions = await readModel(collections.transactions);
  const payments = await readModel(collections.payments);
  const ledgers = await readModel(collections.ledgers);
  const intentByReference = new Map();

  for (const record of [...transactions, ...payments]) {
    const legacyUserId = toId(record.user);
    const userId = userMap.get(legacyUserId) || legacyUserId;
    const walletId = walletMap.get(legacyUserId) || legacyWalletMap.get(toId(record.wallet)) || toId(record.wallet);

    if (!userId || !walletId) {
      report.counts.failed.paymentIntents = (report.counts.failed.paymentIntents || 0) + 1;
      logger.warn("Skipping transaction/payment without migrated user wallet", { recordId: toId(record._id) });
      continue;
    }

    try {
      await withTransaction(prisma, async (tx) => {
        const paymentIntent = await ensurePaymentIntentForRecord(tx, record, {
          userId,
          walletId,
          goalId: toId(record.goal) || null,
          prefix: transactions.includes(record) ? "transaction" : "payment",
          dryRun,
          report,
        });
        await migrateProviderTransaction(tx, record, paymentIntent, { dryRun, report });
        intentByReference.set(record.paymentReference || record.providerReference || record.reference, paymentIntent.id);
      });
    } catch (error) {
      report.counts.failed.paymentIntents = (report.counts.failed.paymentIntents || 0) + 1;
      logger.error("Failed to migrate transaction/payment", { recordId: toId(record._id), error: error.message });
    }
  }

  for (const ledger of ledgers) {
    try {
      await withTransaction(prisma, async (tx) => {
        const paymentIntentId = intentByReference.get(ledger.reference) || intentByReference.get(String(ledger.reference || "").replace(/-SAVE$/, ""));
        const walletId = walletMap.get(toId(ledger.user)) || legacyWalletMap.get(toId(ledger.wallet)) || toId(ledger.wallet);
        await migrateLegacyLedger(tx, ledger, { paymentIntentId: paymentIntentId || null, walletId, dryRun, report });
      });
    } catch (error) {
      report.counts.failed.ledgerTransactions = (report.counts.failed.ledgerTransactions || 0) + 1;
      logger.error("Failed to migrate ledger", { ledgerId: toId(ledger._id), error: error.message });
    }
  }
}

async function migrateNotifications({ prisma, collections, dryRun, report, logger, userMap }) {
  const notifications = await readModel(collections.notifications);

  for (const notification of notifications) {
    const legacyUserId = toId(notification.user);
    const userId = userMap.get(legacyUserId) || legacyUserId;
    if (!userId) {
      report.counts.failed.notifications = (report.counts.failed.notifications || 0) + 1;
      logger.warn("Skipping notification without user", { notificationId: toId(notification._id) });
      continue;
    }

    if (dryRun) {
      report.counts.migrated.notifications += 1;
      continue;
    }

    try {
      await prisma.notification.upsert({
        where: { sourceEventId: `legacy-notification-${toId(notification._id)}` },
        create: {
          id: toId(notification._id),
          userId,
          type: notification.type || "system",
          message: String(notification.message || "").trim(),
          read: Boolean(notification.read),
          sourceEventId: `legacy-notification-${toId(notification._id)}`,
          createdAt: asDate(notification.createdAt),
          updatedAt: asDate(notification.updatedAt) || new Date(),
        },
        update: {
          type: notification.type || "system",
          message: String(notification.message || "").trim(),
          read: Boolean(notification.read),
          updatedAt: asDate(notification.updatedAt) || new Date(),
        },
      });
      report.counts.migrated.notifications += 1;
    } catch (error) {
      report.counts.failed.notifications = (report.counts.failed.notifications || 0) + 1;
      logger.error("Failed to migrate notification", { notificationId: toId(notification._id), error: error.message });
    }
  }
}

async function verifyMigration({ prisma, collections, report, dryRun }) {
  report.counts.mongo = {
    users: await countModel(collections.users),
    goals: await countModel(collections.goals),
    transactions: await countModel(collections.transactions),
    payments: await countModel(collections.payments),
    ledgers: await countModel(collections.ledgers),
    notifications: await countModel(collections.notifications),
  };

  const mongoUsers = await readModel(collections.users);
  const mongoWallets = await readModel(collections.wallets);
  const legacyBalanceByUser = new Map();

  mongoUsers.forEach((user) => {
    const balance = optionalMoney(user.walletBalance ?? user.balance ?? user.availableBalance);
    if (balance !== null) legacyBalanceByUser.set(toId(user._id), balance);
  });

  mongoWallets.forEach((wallet) => {
    const balance = optionalMoney(wallet.walletBalance ?? wallet.balance ?? wallet.availableBalance);
    if (balance !== null) legacyBalanceByUser.set(toId(wallet.user), balance);
  });

  report.counts.postgres = {
    users: await prisma.user.count(),
    wallets: await prisma.wallet.count(),
    goals: await prisma.goal.count(),
    paymentIntents: await prisma.paymentIntent.count(),
    ledgerTransactions: await prisma.ledgerTransaction.count(),
    notifications: await prisma.notification.count(),
  };

  if (dryRun) return;

  const users = await prisma.user.findMany({ include: { wallet: { include: { accounts: true } } } });
  users.forEach((user) => {
    if (!user.wallet) {
      report.verification.walletsMissing.push(user.id);
      return;
    }

    const existingTypes = new Set(user.wallet.accounts.map((item) => item.accountType));
    const missing = defaultAccountTypes.filter((item) => !existingTypes.has(item));
    if (missing.length) {
      report.verification.accountsMissing.push({ walletId: user.wallet.id, missing });
    }
  });

  const ledgerTransactions = await prisma.ledgerTransaction.findMany({ include: { entries: true } });
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
      report.verification.unbalancedLedgerTransactions.push(transaction.id);
    }
  });

  const wallets = await prisma.wallet.findMany({ include: { accounts: { include: { entries: true } }, user: true } });
  wallets.forEach((wallet) => {
    const available = account(wallet, "available_funds");
    if (!available) return;

    const balance = available.entries
      .filter((entry) => entry.status === "POSTED")
      .reduce((total, entry) => (entry.side === "CREDIT" ? total + cents(entry.amount) : total - cents(entry.amount)), 0n);

    if (balance < 0n) {
      report.verification.negativeWalletBalances.push({ walletId: wallet.id, balance: money(Number(balance) / 100) });
    }

    const legacyBalance = legacyBalanceByUser.get(wallet.userId);
    const computedBalance = money(Number(balance) / 100);
    if (legacyBalance !== undefined && cents(legacyBalance) !== cents(computedBalance)) {
      report.verification.walletBalanceMismatches.push({
        walletId: wallet.id,
        userId: wallet.userId,
        legacyBalance,
        computedAvailableFunds: computedBalance,
      });
    }
  });
}

export async function runMongoToPostgresMigration({
  prisma,
  collections,
  dryRun = true,
  scopes = ["users", "goals", "transactions", "notifications"],
  quiet = false,
} = {}) {
  if (!prisma) throw new Error("Prisma client is required");
  if (!collections) throw new Error("Mongo collections/models are required");

  const report = createReport({ dryRun, scopes });
  const logger = createLogger(report, quiet);
  const scopeSet = new Set(scopes);
  let maps = { userMap: new Map(), walletMap: new Map() };

  logger.info(dryRun ? "Starting dry-run migration" : "Starting execute migration", { scopes });

  if (scopeSet.has("users")) {
    maps = await migrateUsers({ prisma, collections, dryRun, report, logger });
  } else {
    maps = await hydrateUserWalletMaps({ prisma, collections, dryRun });
  }

  if (scopeSet.has("goals")) {
    await migrateGoals({ prisma, collections, dryRun, report, logger, walletMap: maps.walletMap });
  }

  if (scopeSet.has("transactions")) {
    await migrateTransactions({
      prisma,
      collections,
      dryRun,
      report,
      logger,
      userMap: maps.userMap,
      walletMap: maps.walletMap,
      legacyWalletMap: maps.legacyWalletMap,
    });
  }

  if (scopeSet.has("notifications")) {
    await migrateNotifications({ prisma, collections, dryRun, report, logger, userMap: maps.userMap });
  }

  await verifyMigration({ prisma, collections, report, dryRun });
  report.finishedAt = new Date().toISOString();
  return report;
}

async function loadMongoCollections() {
  const [
    { default: User },
    { default: Wallet },
    { default: Goal },
    { default: Transaction },
    { default: Payment },
    { default: Ledger },
    { default: Notification },
  ] = await Promise.all([
    import("../backend/models/User.js"),
    import("../backend/models/Wallet.js"),
    import("../backend/models/Goal.js"),
    import("../backend/models/Transaction.js"),
    import("../backend/models/Payment.js"),
    import("../backend/models/Ledger.js"),
    import("../backend/models/Notification.js"),
  ]);

  return {
    users: User,
    wallets: Wallet,
    goals: Goal,
    transactions: Transaction,
    payments: Payment,
    ledgers: Ledger,
    notifications: Notification,
  };
}

async function writeReport(report) {
  await fs.mkdir(reportDirectory, { recursive: true });
  const filePath = path.join(reportDirectory, `mongo-to-postgres-${nowStamp()}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
  return filePath;
}

async function main() {
  const options = getCliOptions();
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI or MONGODB_URI is required");
  }

  if (!options.execute) {
    console.info("Running in dry-run mode. Pass --execute to write to PostgreSQL.");
  }

  const mongoose = (await import("../backend/node_modules/mongoose/index.js")).default;
  const { default: prisma, disconnectPrisma } = await import("../backend/config/prisma.js");

  await mongoose.connect(mongoUri);

  try {
    const collections = await loadMongoCollections();
    const report = await runMongoToPostgresMigration({
      prisma,
      collections,
      dryRun: options.dryRun,
      scopes: options.scopes,
    });
    const reportPath = await writeReport(report);

    console.info("Migration summary");
    console.info(JSON.stringify({ reportPath, counts: report.counts, verification: report.verification }, null, 2));
  } finally {
    await mongoose.disconnect();
    await disconnectPrisma();
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
}
