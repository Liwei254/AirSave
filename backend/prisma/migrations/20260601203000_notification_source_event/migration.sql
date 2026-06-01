-- Make outbox-driven notification processing retry-safe.
ALTER TABLE "notifications"
  ADD COLUMN "sourceEventId" TEXT;

CREATE UNIQUE INDEX "notifications_sourceEventId_key" ON "notifications"("sourceEventId");
