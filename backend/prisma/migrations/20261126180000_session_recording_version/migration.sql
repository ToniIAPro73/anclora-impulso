-- Session recording F2: mark faithful sessions. Existing rows are legacy (1); additive, no data rewrite.
ALTER TABLE "workout_sessions" ADD COLUMN "recordingVersion" INTEGER NOT NULL DEFAULT 1;
