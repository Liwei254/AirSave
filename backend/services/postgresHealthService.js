import prisma from "../config/prisma.js";

export const requiredPostgresTables = [
  "users",
  "wallets",
  "ledger_accounts",
  "ledger_transactions",
  "ledger_entries",
  "payment_intents",
  "providers",
  "provider_transactions",
  "webhook_events",
  "outbox_events",
  "goals",
  "notifications",
  "reconciliation_runs",
  "reconciliation_items",
];

function normalizeTableName(row) {
  return row?.table_name || row?.tableName || row?.tablename || row?.name;
}

function normalizeMigration(row) {
  return {
    migrationName: row?.migration_name || row?.migrationName,
    finishedAt: row?.finished_at || row?.finishedAt || null,
    rolledBackAt: row?.rolled_back_at || row?.rolledBackAt || null,
  };
}

export async function checkPostgresHealth(client = prisma) {
  const basicQuery = await client.$queryRawUnsafe("SELECT 1 AS ok");
  
const tableRows = await client.$queryRaw`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = ANY(${requiredPostgresTables})
`;
  const presentTables = new Set(tableRows.map(normalizeTableName).filter(Boolean));
  const missingTables = requiredPostgresTables.filter((tableName) => !presentTables.has(tableName));

  const migrationTableRows = await client.$queryRawUnsafe("SELECT to_regclass('public._prisma_migrations')::text AS table_name");
  const migrationsTableExists = Boolean(normalizeTableName(migrationTableRows[0]));
  const migrationRows = migrationsTableExists
    ? await client.$queryRawUnsafe(
        'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name ASC'
      )
    : [];
  const migrations = migrationRows.map(normalizeMigration);
  const failedMigrations = migrations.filter((migration) => !migration.finishedAt || migration.rolledBackAt);

  const usersCount = await client.user.count();
  const ok = missingTables.length === 0 && migrationsTableExists && migrations.length > 0 && failedMigrations.length === 0;

  return {
    ok,
    checkedAt: new Date().toISOString(),
    connection: {
      ok: Array.isArray(basicQuery) && basicQuery.length > 0,
    },
    tables: {
      required: requiredPostgresTables,
      present: Array.from(presentTables).sort(),
      missing: missingTables,
    },
    migrations: {
      tableExists: migrationsTableExists,
      appliedCount: migrations.filter((migration) => migration.finishedAt && !migration.rolledBackAt).length,
      failed: failedMigrations,
    },
    basicQuery: {
      usersCount,
    },
  };
}
