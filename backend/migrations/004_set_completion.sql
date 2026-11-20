BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='workout_sets'::regclass
                 AND attname='completed' AND NOT attisdropped) THEN
    ALTER TABLE workout_sets ADD COLUMN completed boolean NOT NULL DEFAULT true;
    UPDATE workout_sets s SET completed=false FROM workout_exercises e
    WHERE s.workout_exercise_id=e.id AND NOT e.completed;
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
COMMIT;
