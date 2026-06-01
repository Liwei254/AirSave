const postgresProviders = new Set(["postgres", "postgresql", "prisma"]);

export function isPostgresDataStoreEnabled() {
  const provider = String(
    process.env.DATA_STORE || process.env.DATABASE_PROVIDER || process.env.DB_PROVIDER || ""
  )
    .trim()
    .toLowerCase();

  return postgresProviders.has(provider);
}
