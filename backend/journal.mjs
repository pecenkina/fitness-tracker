import express from 'express';

const profile = 'journal-demo@fitness.invalid';
const marker = '!local-journal-demo';
const positive = n => Number.isInteger(n) && n > 0 && n <= 2147483647;

function validWorkout(value) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120) return false;
  const date = value.workout_date;
  if (typeof date !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) return false;
  if (value.duration_minutes != null && !positive(value.duration_minutes)) return false;
  return Array.isArray(value.exercises) && value.exercises.length > 0 && value.exercises.length <= 50 &&
    value.exercises.every(e => e && positive(e.exercise_id) && Array.isArray(e.sets) &&
      e.sets.length > 0 && e.sets.length <= 50 && e.sets.every(s => s && positive(s.reps) &&
        (s.weight_kg === null || (typeof s.weight_kg === 'number' && s.weight_kg >= 0 &&
          s.weight_kg < 100000 && /^\d+(\.\d{1,2})?$/.test(String(s.weight_kg))))));
}

export function localJournal(db) {
  const router = express.Router();
  router.get('/', async (_req, res) => {
    const result = await db.query(`
      SELECT w.id, w.name, to_char(w.workout_date, 'YYYY-MM-DD') AS workout_date, w.duration_minutes,
        COALESCE((SELECT json_agg(json_build_object(
          'name', e.name, 'exercise_id', e.id, 'sets', (SELECT json_agg(json_build_object(
            'reps', s.reps, 'weight_kg', s.weight_kg) ORDER BY s.position)
            FROM workout_sets s WHERE s.workout_exercise_id = we.id)) ORDER BY we.position)
          FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
          WHERE we.workout_id = w.id), '[]'::json) AS exercises
      FROM workouts w JOIN users u ON u.id = w.user_id
      WHERE u.email = $1 AND u.password_hash = $2 AND w.status = 'completed'
      ORDER BY w.workout_date DESC, w.id DESC`, [profile, marker]);
    res.set('Cache-Control', 'no-store').json(result.rows);
  });

  router.post('/', express.json({limit: '200kb'}), async (req, res) => {
    if (!req.is('application/json') || !validWorkout(req.body)) {
      return res.status(400).json({error: 'Проверьте дату, название, упражнения и значения подходов.'});
    }
    const {name, workout_date, duration_minutes, exercises} = req.body;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO users(email,password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING', [profile, marker]);
      const owner = await client.query('SELECT id FROM users WHERE email=$1 AND password_hash=$2', [profile, marker]);
      if (!owner.rowCount) throw new Error('Локальный профиль недоступен');
      const insert = await client.query(`INSERT INTO workouts(user_id,name,workout_date,duration_minutes,status)
        VALUES ($1,$2,$3,$4,'completed') RETURNING id`, [owner.rows[0].id, name.trim(), workout_date, duration_minutes ?? null]);
      const id = insert.rows[0].id;
      for (const [i, exercise] of exercises.entries()) {
        const move = await client.query(`INSERT INTO workout_exercises(workout_id,exercise_id,position)
          VALUES ($1,$2,$3) RETURNING id`, [id, exercise.exercise_id, i + 1]);
        await client.query(`INSERT INTO workout_sets(workout_exercise_id,position,reps,weight_kg)
          SELECT $1, ord, (s->>'reps')::integer, (s->>'weight_kg')::numeric
          FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS a(s,ord)`, [move.rows[0].id, JSON.stringify(exercise.sets)]);
      }
      await client.query('COMMIT');
      res.status(201).json({id});
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23503') return res.status(400).json({error: 'Выберите упражнение из актуального каталога.'});
      throw error;
    } finally {
      client.release();
    }
  });
  return router;
}
