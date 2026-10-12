-- Expand-only. Historical rows keep generationMode = 'unknown' (origin not recorded); nothing is back-filled.
-- Rollback (manual, not automatic): ALTER TABLE "workouts" DROP CONSTRAINT "workouts_generationMode_check",
--   DROP COLUMN "generationMode", DROP COLUMN "generationVersion", DROP COLUMN "generationReason";
ALTER TABLE "workouts" ADD COLUMN     "generationMode" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "generationReason" TEXT,
ADD COLUMN     "generationVersion" TEXT;

ALTER TABLE "workouts" ADD CONSTRAINT "workouts_generationMode_check"
  CHECK ("generationMode" IN ('ai', 'fallback', 'manual', 'unknown'));
