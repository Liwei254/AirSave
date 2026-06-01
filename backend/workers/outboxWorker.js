import dotenv from "dotenv";
import { pathToFileURL } from "url";
import prisma, { disconnectPrisma } from "../config/prisma.js";
import { handleOutboxEvent } from "../services/outbox/outboxEventHandlers.js";

dotenv.config();

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_INTERVAL_MS = 5000;

function logWorker(event, details = {}) {
  console.info(
    JSON.stringify({
      scope: "outbox_worker",
      event,
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}

export async function processOutboxBatch({ limit = DEFAULT_BATCH_SIZE, tx = prisma } = {}) {
  const events = await tx.outboxEvent.findMany({
    where: {
      published: false,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const result = await handleOutboxEvent(event, { tx });

      if (!result?.success) {
        failed += 1;
        logWorker("event_not_published", {
          outboxEventId: event.id,
          eventType: event.eventType,
          reason: result?.reason || "handler returned failure",
        });
        continue;
      }

      await tx.outboxEvent.update({
        where: {
          id: event.id,
        },
        data: {
          published: true,
        },
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      logWorker("event_failed", {
        outboxEventId: event.id,
        eventType: event.eventType,
        error: error?.message || String(error),
      });
    }
  }

  return {
    scanned: events.length,
    processed,
    failed,
  };
}

export function startOutboxWorker({
  intervalMs = Number(process.env.OUTBOX_WORKER_INTERVAL_MS || DEFAULT_INTERVAL_MS),
  limit = Number(process.env.OUTBOX_WORKER_BATCH_SIZE || DEFAULT_BATCH_SIZE),
} = {}) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;

    try {
      await processOutboxBatch({ limit });
    } catch (error) {
      logWorker("batch_failed", {
        error: error?.message || String(error),
      });
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, Math.max(1000, intervalMs));
  timer.unref?.();
  void tick();

  logWorker("started", {
    intervalMs,
    limit,
  });

  return {
    stop() {
      clearInterval(timer);
      logWorker("stopped");
    },
  };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const worker = startOutboxWorker();

  async function shutdown(signal) {
    logWorker("shutdown", { signal });
    worker.stop();
    await disconnectPrisma();
    process.exit(0);
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}
