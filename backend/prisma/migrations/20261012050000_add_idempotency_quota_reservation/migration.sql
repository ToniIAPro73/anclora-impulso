-- Expand-only: three nullable/defaulted columns (metadata-only on PostgreSQL 11+).
-- Persists the quota reservation of an idempotent operation so that a recovered lock can reconcile it exactly once.
-- Rollback (code first, data later): ALTER TABLE "idempotency_records" DROP COLUMN "reservedWindowId",
--   DROP COLUMN "reservedOwnerToken", DROP COLUMN "reservedTokens", DROP COLUMN "reservedAt";
ALTER TABLE "idempotency_records" ADD COLUMN     "reservedAt" TIMESTAMP(3),
ADD COLUMN     "reservedOwnerToken" TEXT,
ADD COLUMN     "reservedTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reservedWindowId" TEXT;

-- Orphan reconciliation looks up unreleased reservations of a user's expired executions.
CREATE INDEX "idempotency_records_reservedWindowId_idx" ON "idempotency_records"("reservedWindowId");
