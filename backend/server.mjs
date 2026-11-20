import express from 'express';
import pg from 'pg';
import {fileURLToPath} from 'node:url';
import {localJournal} from './journal.mjs';
import {localizeExercise} from './catalog/exercisedb-ru.mjs';

const db = new pg.Pool({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 4000});
db.on('error', error => console.error('PostgreSQL:', error.message));
const app = express();
if (process.argv.includes('--local-journal')) {
  app.use('/api/local/workouts', localJournal(db));
  app.use(express.static(fileURLToPath(new URL('../frontend/dist/', import.meta.url))));
}
const fields = `SELECT e.id, e.name, e.description, e.difficulty, e.equipment, e.goals,
  ARRAY(SELECT m.name FROM exercise_muscles em JOIN muscle_groups m ON m.id = em.muscle_id
        WHERE em.exercise_id = e.id ORDER BY m.name) AS muscles FROM exercises e`;
const positiveId = value => /^[1-9][0-9]{0,9}$/.test(value) && Number(value) <= 2147483647;
const missing = {error: 'Упражнение не найдено'};

app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({status: 'ok'});
  } catch {
    res.status(503).json({status: 'unavailable'});
  }
});

app.get('/api/exercises', async (req, res) => {
  const {q = '', equipment = null, difficulty = null, muscle_id = null, goal = null} = req.query;
  if ([q, equipment, difficulty, goal, muscle_id].some(v => v !== null && typeof v !== 'string')
      || (muscle_id !== null && !positiveId(muscle_id))) {
    return res.status(400).json({error: 'Некорректный фильтр'});
  }
  // Translate Cyrillic explicitly for databases using the C locale.
  const fold = value => `replace(translate(lower(${value}), 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'), 'ё', 'е')`;
  const result = await db.query(`${fields}
    WHERE strpos(${fold('e.name')}, ${fold('$1::text')}) > 0
      AND ($2::text IS NULL OR $2 = ANY(e.equipment))
      AND ($3::text IS NULL OR $3 = e.difficulty)
      AND ($4::int IS NULL OR EXISTS (SELECT 1 FROM exercise_muscles em
           WHERE em.exercise_id = e.id AND em.muscle_id = $4))
      AND ($5::text IS NULL OR $5 = ANY(e.goals))
    ORDER BY e.name, e.id`, [q.trim(), equipment, difficulty, muscle_id, goal]);
  res.json(result.rows);
});

app.get('/api/exercises/:id', async (req, res) => {
  if (!positiveId(req.params.id)) return res.status(400).json({error: 'Некорректный id'});
  const result = await db.query(`${fields} WHERE e.id = $1`, [req.params.id]);
  if (!result.rowCount) return res.status(404).json(missing);
  res.json(result.rows[0]);
});

app.get('/api/exercisedb/:id', async (req, res) => {
  const {id} = req.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return res.status(400).json({error: 'Некорректный id'});
  res.set('Cache-Control', 'no-store');
  try {
    const response = await fetch('https://oss.exercisedb.dev/api/v1/exercises/' + id,
      {signal: AbortSignal.timeout(8000)});
    if (response.status === 404) return res.status(404).json(missing);
    if (response.status === 429) return res.status(503).json({error: 'Исчерпан лимит ExerciseDB'});
    if (!response.ok) throw new Error('ExerciseDB request failed');
    const {data} = await response.json();
    if (data?.exerciseId !== id) throw new Error('Invalid exercise');
    res.json(localizeExercise(data));
  } catch {
    res.status(502).json({error: 'Не удалось получить карточку ExerciseDB'});
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error.message);
  res.status(500).json({error: 'Не удалось обработать запрос'});
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, '127.0.0.1', () => console.log('Fitness API: http://127.0.0.1:' + port));
