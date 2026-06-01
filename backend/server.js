import app from "./app.js";
import connectDB from "./config/db.js";
import { disconnectPrisma } from "./config/prisma.js";
import { closeRedis } from "./config/redis.js";
import { startOutboxWorker } from "./workers/outboxWorker.js";

connectDB();
const outboxWorker = process.env.ENABLE_OUTBOX_WORKER === "true" ? startOutboxWorker() : null;

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

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down AirSave server...`);
  outboxWorker?.stop();
  server.close(async () => {
    await closeRedis();
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
