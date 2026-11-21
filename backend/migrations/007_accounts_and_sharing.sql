BEGIN;
ALTER TABLE users ADD COLUMN moderator boolean NOT NULL DEFAULT false;
CREATE TABLE sessions (
  digest text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE exercise_submissions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id integer NOT NULL REFERENCES users ON DELETE CASCADE,
  name text NOT NULL, description text NOT NULL, equipment text NOT NULL,
  muscle text NOT NULL, difficulty text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
);
CREATE TABLE workout_shares (
  token uuid PRIMARY KEY, workout_id integer UNIQUE NOT NULL REFERENCES workouts ON DELETE CASCADE
);
CREATE TABLE workout_imports (
  token uuid NOT NULL REFERENCES workout_shares ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users ON DELETE CASCADE,
  PRIMARY KEY(token,user_id)
);
COMMIT;
