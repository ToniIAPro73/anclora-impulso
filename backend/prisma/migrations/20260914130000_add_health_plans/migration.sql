-- Additive Health Plans foundation. Existing fitness data is untouched.
CREATE TABLE "health_plan_definitions" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "nameEs" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "descriptionEs" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL,
  "minAge" INTEGER NOT NULL,
  "maxAge" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "health_plan_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_definitions_key_key" ON "health_plan_definitions"("key");
CREATE INDEX "health_plan_definitions_status_idx" ON "health_plan_definitions"("status");

CREATE TABLE "health_plan_phases" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "nameEs" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "descriptionEs" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "durationLabel" TEXT NOT NULL,
  CONSTRAINT "health_plan_phases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_phases_planId_key_key" ON "health_plan_phases"("planId", "key");
CREATE INDEX "health_plan_phases_planId_order_idx" ON "health_plan_phases"("planId", "order");

CREATE TABLE "health_plan_weeks" (
  "id" TEXT NOT NULL,
  "phaseId" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "objectiveEs" TEXT NOT NULL,
  "objectiveEn" TEXT NOT NULL,
  "fullVersion" JSONB NOT NULL,
  "minimumVersion" JSONB NOT NULL,
  "safetyConstraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "progressSignals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "health_plan_weeks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_weeks_phaseId_weekNumber_key" ON "health_plan_weeks"("phaseId", "weekNumber");
CREATE INDEX "health_plan_weeks_phaseId_weekNumber_idx" ON "health_plan_weeks"("phaseId", "weekNumber");

CREATE TABLE "health_plan_actions" (
  "id" TEXT NOT NULL,
  "weekId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "pillar" TEXT NOT NULL,
  "titleEs" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "descriptionEs" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "route" TEXT,
  "minimumEligible" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL,
  CONSTRAINT "health_plan_actions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_actions_weekId_key_key" ON "health_plan_actions"("weekId", "key");
CREATE INDEX "health_plan_actions_weekId_order_idx" ON "health_plan_actions"("weekId", "order");

CREATE TABLE "health_plan_pillars" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "nameEs" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  CONSTRAINT "health_plan_pillars_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_pillars_planId_key_key" ON "health_plan_pillars"("planId", "key");

CREATE TABLE "health_plan_content_references" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "evidenceLevel" TEXT NOT NULL,
  "claimType" TEXT NOT NULL,
  "safetyLevel" TEXT NOT NULL,
  "contentOwner" TEXT NOT NULL,
  "lastReviewedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "health_plan_content_references_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_content_references_planId_key_locale_key" ON "health_plan_content_references"("planId", "key", "locale");
CREATE INDEX "health_plan_content_references_planId_locale_idx" ON "health_plan_content_references"("planId", "locale");

CREATE TABLE "health_plan_enrollments" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "safetyCategory" TEXT NOT NULL DEFAULT 'SELF_MANAGED',
  "safetyReasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "currentWeek" INTEGER NOT NULL DEFAULT 1,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pausedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "health_plan_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_enrollments_userId_planId_key" ON "health_plan_enrollments"("userId", "planId");
CREATE INDEX "health_plan_enrollments_userId_status_idx" ON "health_plan_enrollments"("userId", "status");

CREATE TABLE "health_plan_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "baselineActivity" TEXT NOT NULL,
  "availableTime" TEXT NOT NULL,
  "preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "equipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "knownLimitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "adaptation" TEXT NOT NULL DEFAULT 'MAINTAIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "health_plan_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_profiles_enrollmentId_key" ON "health_plan_profiles"("enrollmentId");
CREATE UNIQUE INDEX "health_plan_profiles_userId_enrollmentId_key" ON "health_plan_profiles"("userId", "enrollmentId");
CREATE INDEX "health_plan_profiles_userId_idx" ON "health_plan_profiles"("userId");

CREATE TABLE "health_plan_week_status" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "weekId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'current',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "health_plan_week_status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_week_status_enrollmentId_weekId_key" ON "health_plan_week_status"("enrollmentId", "weekId");
CREATE INDEX "health_plan_week_status_enrollmentId_status_idx" ON "health_plan_week_status"("enrollmentId", "status");

CREATE TABLE "health_plan_action_status" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "health_plan_action_status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_plan_action_status_enrollmentId_actionId_key" ON "health_plan_action_status"("enrollmentId", "actionId");
CREATE INDEX "health_plan_action_status_enrollmentId_status_idx" ON "health_plan_action_status"("enrollmentId", "status");

ALTER TABLE "health_plan_phases" ADD CONSTRAINT "health_plan_phases_planId_fkey" FOREIGN KEY ("planId") REFERENCES "health_plan_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_weeks" ADD CONSTRAINT "health_plan_weeks_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "health_plan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_actions" ADD CONSTRAINT "health_plan_actions_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "health_plan_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_pillars" ADD CONSTRAINT "health_plan_pillars_planId_fkey" FOREIGN KEY ("planId") REFERENCES "health_plan_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_content_references" ADD CONSTRAINT "health_plan_content_references_planId_fkey" FOREIGN KEY ("planId") REFERENCES "health_plan_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_enrollments" ADD CONSTRAINT "health_plan_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_enrollments" ADD CONSTRAINT "health_plan_enrollments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "health_plan_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "health_plan_profiles" ADD CONSTRAINT "health_plan_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_profiles" ADD CONSTRAINT "health_plan_profiles_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "health_plan_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_week_status" ADD CONSTRAINT "health_plan_week_status_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "health_plan_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_week_status" ADD CONSTRAINT "health_plan_week_status_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "health_plan_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_action_status" ADD CONSTRAINT "health_plan_action_status_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "health_plan_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_plan_action_status" ADD CONSTRAINT "health_plan_action_status_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "health_plan_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
