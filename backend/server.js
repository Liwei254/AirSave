import app from "./app.js";
import { disconnectPrisma } from "./config/prisma.js";
import { closeRedis } from "./config/redis.js";
import { logStartupChecklist, validateStartupEnvironment } from "./config/startupValidation.js";
import { startOutboxWorker } from "./workers/outboxWorker.js";

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const startup = validateStartupEnvironment();
logStartupChecklist(startup);

const outboxWorker = startup.outboxWorkerEnabled ? startOutboxWorker() : null;

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`AirSave Server running on port ${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Find the process with: netstat -ano | findstr :${PORT}`);
    console.error("Then stop that PID with: taskkill /PID <PID> /F");
    process.exit(1);
  }

  console.error("Server failed to start:", error);
  process.exit(1);
});

let shutdownInProgress = false;

async function shutdown(signal) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  console.log(`${signal} received. Shutting down AirSave server...`);
  outboxWorker?.stop();

  server.close(async () => {
    try {
      await closeRedis();
      await disconnectPrisma();
      process.exit(0);
    } catch (error) {
      console.error("Shutdown cleanup failed:", error);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
