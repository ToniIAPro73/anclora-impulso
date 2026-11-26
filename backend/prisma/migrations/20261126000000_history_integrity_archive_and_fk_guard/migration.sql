-- History integrity F1 (sdd/features/history-integrity-f1).
-- Additive and non-destructive: two nullable columns, two indexes, and five foreign-key action changes.
-- No row is rewritten. Exercises and routines that have history are archived instead of deleted; the database
-- refuses to delete them. NO ACTION is checked at end of statement, so deleting a user (which cascades to both
-- routines and sessions in one statement) keeps working.

-- DropForeignKey
ALTER TABLE "exercise_progression_states" DROP CONSTRAINT "exercise_progression_states_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "personal_records" DROP CONSTRAINT "personal_records_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "session_exercises" DROP CONSTRAINT "session_exercises_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "workout_exercises" DROP CONSTRAINT "workout_exercises_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_workoutId_fkey";

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "exercises_archivedAt_idx" ON "exercises"("archivedAt");

-- CreateIndex
CREATE INDEX "workouts_archivedAt_idx" ON "workouts"("archivedAt");

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_progression_states" ADD CONSTRAINT "exercise_progression_states_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

