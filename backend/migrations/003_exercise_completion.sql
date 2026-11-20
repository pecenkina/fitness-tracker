ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT true;
