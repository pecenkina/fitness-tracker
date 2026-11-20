BEGIN;

CREATE TABLE users (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL CHECK (btrim(email) = email AND email <> ''),
    password_hash text NOT NULL,
    birth_date date,
    gender text,
    height_cm numeric(5,2) CHECK (height_cm > 0),
    weight_kg numeric(6,2) CHECK (weight_kg > 0),
    goal text
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE muscle_groups (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE,
    body_region text NOT NULL
);
CREATE TABLE exercises (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (btrim(name) <> ''),
    description text NOT NULL DEFAULT '',
    difficulty text NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    equipment text[] NOT NULL DEFAULT '{}',
    goals text[] NOT NULL DEFAULT '{}',
    source text,
    source_key text,
    CHECK ((source IS NULL) = (source_key IS NULL)),
    UNIQUE (source, source_key)
);
CREATE TABLE exercise_muscles (
    exercise_id integer NOT NULL REFERENCES exercises ON DELETE CASCADE,
    muscle_id integer NOT NULL REFERENCES muscle_groups,
    PRIMARY KEY (exercise_id, muscle_id)
);

CREATE TABLE plans (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users ON DELETE CASCADE,
    name text NOT NULL CHECK (btrim(name) <> '')
);
CREATE INDEX plans_by_owner ON plans (user_id);

CREATE TABLE plan_exercises (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id integer NOT NULL REFERENCES plans ON DELETE CASCADE,
    exercise_id integer NOT NULL REFERENCES exercises,
    position integer NOT NULL CHECK (position > 0),
    UNIQUE (plan_id, position)
);
CREATE TABLE plan_sets (
    plan_exercise_id integer NOT NULL REFERENCES plan_exercises ON DELETE CASCADE,
    position integer NOT NULL CHECK (position > 0),
    reps integer NOT NULL CHECK (reps > 0),
    weight_kg numeric(7,2) CHECK (weight_kg >= 0),
    PRIMARY KEY (plan_exercise_id, position)
);

CREATE TABLE workouts (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users ON DELETE CASCADE,
    workout_date date NOT NULL,
    name text NOT NULL CHECK (btrim(name) <> ''),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
    duration_minutes integer CHECK (duration_minutes > 0)
);
CREATE INDEX workouts_by_owner_date ON workouts (user_id, workout_date DESC, id DESC);

CREATE TABLE workout_exercises (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workout_id integer NOT NULL REFERENCES workouts ON DELETE CASCADE,
    exercise_id integer NOT NULL REFERENCES exercises,
    position integer NOT NULL CHECK (position > 0),
    UNIQUE (workout_id, position)
);
CREATE TABLE workout_sets (
    workout_exercise_id integer NOT NULL REFERENCES workout_exercises ON DELETE CASCADE,
    position integer NOT NULL CHECK (position > 0),
    reps integer NOT NULL CHECK (reps > 0),
    weight_kg numeric(7,2) CHECK (weight_kg >= 0),
    PRIMARY KEY (workout_exercise_id, position)
);

COMMIT;
