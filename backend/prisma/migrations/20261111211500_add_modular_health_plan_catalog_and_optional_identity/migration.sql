-- Additive Phase 2 schema extension (TASK-017, TASK-018)
-- Reuses existing health_plan_definitions table and preserves Ruta Vital v1 + legacy User.sex untouched.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sexAtBirth" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "genderIdentity" TEXT;

ALTER TABLE "health_plan_definitions" ADD COLUMN IF NOT EXISTS "cohortKey" TEXT;
ALTER TABLE "health_plan_definitions" ADD COLUMN IF NOT EXISTS "variantKey" TEXT;
ALTER TABLE "health_plan_definitions" ALTER COLUMN "maxAge" DROP NOT NULL;

UPDATE "health_plan_definitions"
SET "cohortKey" = 'RV-50-60',
    "variantKey" = COALESCE("variantKey", 'NEUTRAL')
WHERE "key" = 'ruta-vital-50-60'
  AND "cohortKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "health_plan_definitions_cohortKey_version_key"
  ON "health_plan_definitions"("cohortKey", "version");

CREATE INDEX IF NOT EXISTS "health_plan_definitions_cohortKey_variantKey_idx"
  ON "health_plan_definitions"("cohortKey", "variantKey");

