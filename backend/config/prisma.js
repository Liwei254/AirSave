import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when the PostgreSQL datastore is enabled.");
  }

  const adapter = new PrismaPg(process.env.DATABASE_URL, {
    onPoolError(error) {
      console.error("Prisma PostgreSQL pool error:", error);
    },
  });

  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

export function getPrisma() {
  if (!globalForPrisma.__airsavePrisma) {
    globalForPrisma.__airsavePrisma = createPrismaClient();
  }

  return globalForPrisma.__airsavePrisma;
}

export async function disconnectPrisma() {
  if (globalForPrisma.__airsavePrisma) {
    await globalForPrisma.__airsavePrisma.$disconnect();
    globalForPrisma.__airsavePrisma = null;
  }
}

const prisma = new Proxy(
  {},
  {
    get(_target, property) {
      const client = getPrisma();
      const value = client[property];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

export default prisma;
