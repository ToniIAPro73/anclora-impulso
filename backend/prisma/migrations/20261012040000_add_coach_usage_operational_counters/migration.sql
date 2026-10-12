-- Expand-only: two counters with default 0 (metadata-only on PostgreSQL 11+). Existing rows start at 0.
-- Rollback (code first, data later): ALTER TABLE "coach_usage_windows" DROP COLUMN "providerCalls", DROP COLUMN "failedAttempts";
ALTER TABLE "coach_usage_windows" ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "providerCalls" INTEGER NOT NULL DEFAULT 0;
