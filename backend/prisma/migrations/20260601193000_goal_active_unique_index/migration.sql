-- Preserve the Mongo invariant that each wallet can have only one active goal.
CREATE UNIQUE INDEX "goals_walletId_active_unique"
  ON "goals"("walletId")
  WHERE "status" = 'ACTIVE';
