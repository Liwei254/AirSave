-- Add auth/session fields needed by the Prisma-backed registration and login flow.
ALTER TABLE "users"
  ADD COLUMN "preferences" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockUntil" TIMESTAMP(3),
  ADD COLUMN "refreshTokenHash" TEXT,
  ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetTokenHash" TEXT,
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetChannel" TEXT;
