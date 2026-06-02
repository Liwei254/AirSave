const postgresProviders = new Set(["postgres", "postgresql", "prisma"]);

export class StartupValidationError extends Error {
  constructor(errors = []) {
    super(errors.join("; "));
    this.name = "StartupValidationError";
    this.errors = errors;
  }
}

function normalize(value) {
  return String(value || "").trim();
}

function normalizeProvider(env = process.env) {
  return normalize(env.DATA_STORE || env.DATABASE_PROVIDER || env.DB_PROVIDER).toLowerCase();
}

function isPostgresProvider(provider) {
  return postgresProviders.has(provider);
}

function isEnabled(value) {
  return normalize(value).toLowerCase() === "true";
}

function hasMultipleReplicaHint(env = process.env) {
  const replicaCount = Number(env.WEB_CONCURRENCY || env.REPLICAS || env.WEB_REPLICAS || 0);
  return replicaCount > 1 || Boolean(env.RENDER_INSTANCE_ID || env.RAILWAY_REPLICA_ID || env.FLY_ALLOC_ID || env.DYNO);
}

export function getStartupEnvironment(env = process.env) {
  const provider = normalizeProvider(env);
  const postgresMode = isPostgresProvider(provider);
  const datastore = postgresMode ? "postgres" : "mongo";

  return {
    nodeEnv: normalize(env.NODE_ENV) || "development",
    port: normalize(env.PORT) || "5000",
    provider: provider || "mongo-default",
    datastore,
    postgresMode,
    outboxWorkerEnabled: isEnabled(env.ENABLE_OUTBOX_WORKER),
    databaseUrlConfigured: Boolean(normalize(env.DATABASE_URL)),
    mongoUriConfigured: Boolean(normalize(env.MONGO_URI || env.MONGODB_URI)),
    jwtSecretConfigured: Boolean(normalize(env.JWT_SECRET)),
    healthEndpoint: "/api/health/postgres",
  };
}

export function validateStartupEnvironment(env = process.env) {
  const summary = getStartupEnvironment(env);
  const errors = [];
  const warnings = [];

  if (summary.postgresMode && !summary.databaseUrlConfigured) {
    errors.push("DATABASE_URL is required when PostgreSQL datastore mode is enabled.");
  }

  if (!summary.postgresMode && !summary.mongoUriConfigured) {
    errors.push("MONGO_URI or MONGODB_URI is required when MongoDB datastore mode is enabled.");
  }

  if (summary.nodeEnv === "production" && !summary.jwtSecretConfigured) {
    errors.push("JWT_SECRET is required in production.");
  }

  if (summary.outboxWorkerEnabled && (summary.nodeEnv === "production" || hasMultipleReplicaHint(env))) {
    warnings.push(
      "ENABLE_OUTBOX_WORKER=true starts an outbox poller in this process; ensure only one web replica runs it or deploy a separate worker."
    );
  }

  if (errors.length) {
    throw new StartupValidationError(errors);
  }

  return {
    ...summary,
    warnings,
  };
}

export function logStartupChecklist(summary, logger = console) {
  logger.info("[startup] AirSave production boot checklist");
  logger.info(`[startup] datastore selected: ${summary.datastore}`);
  logger.info(`[startup] provider selected: ${summary.provider}`);
  logger.info(`[startup] outbox worker: ${summary.outboxWorkerEnabled ? "enabled" : "disabled"}`);
  logger.info(`[startup] health endpoint mounted: ${summary.healthEndpoint}`);
  logger.info(`[startup] node environment: ${summary.nodeEnv}`);
  logger.info(`[startup] port: ${summary.port}`);

  for (const warning of summary.warnings || []) {
    logger.warn(`[startup] ${warning}`);
  }
}
