-- M28: Additive persistence for meal-plan-import-v1 (TASK-033)
-- 100% additive and backward-compatible with historical nutrition data.

CREATE TYPE "MealPlanLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

ALTER TABLE "meal_plans"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'generated',
  ADD COLUMN "lifecycleStatus" "MealPlanLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "importValidationStatus" TEXT,
  ADD COLUMN "importSchemaVersion" TEXT,
  ADD COLUMN "importFingerprint" TEXT,
  ADD COLUMN "importMetadata" JSONB;

CREATE UNIQUE INDEX "meal_plans_userId_importFingerprint_key"
  ON "meal_plans"("userId", "importFingerprint");

ALTER TABLE "meals"
  ADD COLUMN "scheduledTime" TEXT,
  ADD COLUMN "prepMode" TEXT,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "recipes"
  ADD COLUMN "nutritionSource" TEXT,
  ADD COLUMN "nutritionCertainty" TEXT,
  ADD COLUMN "contentFingerprint" TEXT,
  ADD COLUMN "isIncomplete" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "recipes_userId_contentFingerprint_idx"
  ON "recipes"("userId", "contentFingerprint");

ALTER TABLE "recipe_ingredients"
  ALTER COLUMN "quantity" DROP NOT NULL,
  ADD COLUMN "unitOverride" TEXT,
  ADD COLUMN "rawQuantityText" TEXT,
  ADD COLUMN "isEstimated" BOOLEAN NOT NULL DEFAULT false;

