import express from 'express';

const positive = n => Number.isInteger(n) && n > 0 && n <= 2147483647;

function validWorkout(value, plan) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120) return false;
  if (!plan && !['completed','draft'].includes(value.status ?? 'completed')) return false;
  const date = plan ? '2000-01-01' : value.workout_date;
  if (typeof date !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) return false;
  if (value.duration_minutes != null && !positive(value.duration_minutes)) return false;
  return Array.isArray(value.exercises) && value.exercises.length > 0 && value.exercises.length <= 50 &&
    value.exercises.every(e => e && (e.completed === undefined || typeof e.completed === 'boolean') && positive(e.exercise_id) && Array.isArray(e.sets) &&
      e.sets.length > 0 && e.sets.length <= 50 && e.sets.every(s => s && (s.completed === undefined || typeof s.completed === 'boolean') && positive(s.reps) &&
        (s.weight_kg === null || (typeof s.weight_kg === 'number' && s.weight_kg >= 0 &&
          s.weight_kg < 100000 && /^\d+(\.\d{1,2})?$/.test(String(s.weight_kg))))));
}

export function localJournal(db) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    const result = await db.query(`
      SELECT w.id, w.name, to_char(w.workout_date, 'YYYY-MM-DD') AS workout_date, w.duration_minutes, w.status,
        COALESCE((SELECT json_agg(json_build_object(
          'completed', we.completed, 'name', e.name, 'exercise_id', e.id, 'sets', (SELECT json_agg(json_build_object(
            'reps', s.reps, 'weight_kg', s.weight_kg, 'completed', s.completed) ORDER BY s.position)
            FROM workout_sets s WHERE s.workout_exercise_id = we.id)) ORDER BY we.position)
          FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
          WHERE we.workout_id = w.id), '[]'::json) AS exercises
      FROM workouts w JOIN users u ON u.id = w.user_id
      WHERE u.id = $1 AND w.status = $2
      ORDER BY w.workout_date DESC, w.id DESC`, [req.account.id, req.query.status ?? 'completed']);
    res.set('Cache-Control', 'no-store').json(result.rows);
  });

  router.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d*$/.test(id) || !positive(Number(id))) return res.status(400).json({error: 'Некорректный номер записи'});
    next();
  });
  router.delete('/:id', async (req, res) => {
    const result = await db.query(`DELETE FROM workouts w USING users u WHERE w.user_id=u.id
      AND u.id=$1 AND w.id=$2 AND w.status=$3`, [req.account.id, req.params.id,req.query.status ?? 'completed']);
    if (!result.rowCount) return res.status(404).json({error: 'Тренировка не найдена'});
    res.sendStatus(204);
  });

  const parse = express.json({limit: '200kb'});
  router.post('/', parse, saveEntry(db, false));
  router.put('/:id', parse, saveEntry(db, false));
  return router;
}

export function localPlans(db) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    const result = await db.query(`SELECT p.id, p.name,
      (SELECT json_agg(json_build_object('exercise_id', e.id, 'name', e.name, 'sets',
        (SELECT json_agg(json_build_object('reps', s.reps, 'weight_kg', s.weight_kg) ORDER BY s.position)
         FROM plan_sets s WHERE s.plan_exercise_id=pe.id)) ORDER BY pe.position)
       FROM plan_exercises pe JOIN exercises e ON e.id=pe.exercise_id WHERE pe.plan_id=p.id) AS exercises
      FROM plans p JOIN users u ON u.id=p.user_id WHERE u.id=$1
      ORDER BY p.id DESC`, [req.account.id]);
    res.set('Cache-Control','no-store').json(result.rows);
  });

  router.put('/:id', express.json({limit:'200kb'}),saveEntry(db,true));
  const create=saveEntry(db,true);
  router.post('/', express.json({limit:'200kb'}), async (req, res) => {
    if (req.body?.exercises !== undefined) return create(req,res);
    const {workout_id, name} = req.body ?? {};
    if (!positive(workout_id) || typeof name !== 'string' || !name.trim() || name.length > 120) {
      return res.status(400).json({error:'Укажите тренировку и название плана до 120 символов.'});
    }
    // All reads use one snapshot, including sets from a concurrently edited workout.
    const copy = await db.query(`WITH source AS (
        SELECT w.id,w.user_id FROM workouts w JOIN users u ON u.id=w.user_id
        WHERE w.id=$1 AND u.id=$2 AND w.status='completed'
      ), plan AS (
        INSERT INTO plans(user_id,name) SELECT user_id,$3 FROM source RETURNING id
      ), moves AS (
        SELECT we.* FROM workout_exercises we JOIN source ON source.id=we.workout_id
      ), copied AS (
        INSERT INTO plan_exercises(plan_id,exercise_id,position)
        SELECT plan.id,m.exercise_id,m.position FROM plan CROSS JOIN moves m RETURNING id,position
      ), copied_sets AS (
        INSERT INTO plan_sets(plan_exercise_id,position,reps,weight_kg)
        SELECT c.id,s.position,s.reps,s.weight_kg FROM copied c JOIN moves m USING(position)
        JOIN workout_sets s ON s.workout_exercise_id=m.id
      ) SELECT id FROM plan`, [workout_id,req.account.id,name.trim()]);
    if (!copy.rowCount) return res.status(404).json({error:'Тренировка не найдена'});
    res.status(201).json(copy.rows[0]);
  });

  router.delete('/:id', async (req,res) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || !positive(Number(req.params.id))) {
      return res.status(400).json({error:'Некорректный номер плана'});
    }
    const result=await db.query(`DELETE FROM plans p USING users u WHERE p.user_id=u.id
      AND u.id=$1 AND p.id=$2`,[req.account.id,req.params.id]);
    if (!result.rowCount) return res.status(404).json({error:'План не найден'});
    res.sendStatus(204);
  });
  return router;
}

function saveEntry(db, plan) {
  return async function save(req, res) {
    if (!req.is('application/json') || !validWorkout(req.body, plan)) {
      return res.status(400).json({error: 'Проверьте дату, название, упражнения и значения подходов.'});
    }
    const {name, workout_date, duration_minutes, exercises} = req.body;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const status=req.body.status ?? 'completed';
      const previous=req.body.previous_status ?? 'completed';
      const user=req.account.id;
      const params = [req.account.id, name.trim(), workout_date, duration_minutes ?? null];
      const workout = plan
        ? (req.params.id
          ? await client.query('UPDATE plans SET name=$2 WHERE id=$3 AND user_id=$1 RETURNING id',[user,name.trim(),req.params.id])
          : await client.query('INSERT INTO plans(user_id,name) VALUES ($1,$2) RETURNING id',[user,name.trim()]))
        : req.params.id
        ? await client.query(`UPDATE workouts SET name=$2, workout_date=$3, duration_minutes=$4,status=$6
            WHERE user_id=$1 AND id=$5 AND status=$7 RETURNING id`, [...params, req.params.id,status,previous])
        : await client.query(`INSERT INTO workouts(user_id,name,workout_date,duration_minutes,status)
            VALUES ($1,$2,$3,$4,$5) RETURNING id`, [...params,status]);
      if (!workout.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({error: 'Тренировка не найдена'});
      }
      const id = workout.rows[0].id;
      if (req.params.id) await client.query(plan
        ? 'DELETE FROM plan_exercises WHERE plan_id=$1' : 'DELETE FROM workout_exercises WHERE workout_id=$1',[id]);
      await writeExercises(client,id,exercises,plan);
      if (!plan && req.body.save_as_plan === true) {
        const copy=await client.query('INSERT INTO plans(user_id,name) VALUES ($1,$2) RETURNING id',[user,name.trim()]);
        await writeExercises(client,copy.rows[0].id,exercises,true);
      }
      await client.query('COMMIT');
      res.status(req.params.id ? 200 : 201).json({id});
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23503') return res.status(400).json({error: 'Выберите упражнение из актуального каталога.'});
      throw error;
    } finally {
      client.release();
    }
  }
}
async function writeExercises(client,id,exercises,plan) {
  for (const [i, e] of exercises.entries()) {
    const sets=e.sets.map(s=>({...s,completed:s.completed ?? e.completed ?? true}));
    const params=[id,e.exercise_id,i+1];
    const move=plan
      ? await client.query('INSERT INTO plan_exercises(plan_id,exercise_id,position) VALUES ($1,$2,$3) RETURNING id',params)
      : await client.query('INSERT INTO workout_exercises(workout_id,exercise_id,position,completed) VALUES ($1,$2,$3,$4) RETURNING id',[...params,sets.some(s=>s.completed)]);
    const table=plan ? 'plan' : 'workout';
    await client.query(`INSERT INTO ${table}_sets(${table}_exercise_id,position,reps,weight_kg${plan?'':',completed'})
      SELECT $1, ord, (s->>'reps')::integer, (s->>'weight_kg')::numeric${plan?'':", (s->>'completed')::boolean"}
      FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS a(s,ord)`,[move.rows[0].id,JSON.stringify(sets)]);
  }
}

export function customExercises(db) {
  const router=express.Router();
  router.post('/',express.json(),async (req,res)=>{
    const {name,description='',equipment='',muscle='',difficulty='beginner'}=req.body ?? {};
    if (typeof name!=='string' || !name.trim() || name.length>120 ||
      [description,equipment,muscle].some(v=>typeof v!=='string' || v.length>500) ||
      !['beginner','intermediate','advanced'].includes(difficulty)) return res.status(400).json({error:'Проверьте поля упражнения.'});
    await db.query(`INSERT INTO exercise_submissions(author_id,name,description,equipment,muscle,difficulty)
      VALUES ($1,$2,$3,$4,$5,$6)`,[req.account.id,name.trim(),description.trim(),equipment.trim(),muscle,difficulty]);
    res.status(202).json({status:'pending'});
  });
  return router;
}

export function localProfile(db) {
  const router=express.Router();
  router.get('/',async (req,res)=>{
    const result=await db.query(`SELECT display_name, weight_kg, height_cm, to_char(birth_date,'YYYY-MM-DD') AS birth_date,
      gender, goal FROM users WHERE id=$1`,[req.account.id]);
    res.json(result.rows[0] ?? {});
  });
  router.put('/goals',express.json(),async (req,res)=>{
    const values=req.body?.goals;
    if (!Array.isArray(values) || !values.length || values.some(v=>typeof v!=='string' || !v || v.includes(',')) ||
        values.join(',').length>120) return res.status(400).json({error:'Выберите группы мышц.'});
    const valid=await db.query('SELECT DISTINCT body_region FROM muscle_groups WHERE body_region=ANY($1::text[])',[values]);
    if(valid.rowCount!==new Set(values).size) return res.status(400).json({error:'Неизвестная группа мышц.'});
    await db.query('UPDATE users SET goal=$2 WHERE id=$1',[req.account.id,[...new Set(values)].join(',')]);
    res.sendStatus(204);
  });
  router.put('/',express.json(),async (req,res)=>{
    const {display_name,weight_kg,height_cm,birth_date,gender,goal}=req.body ?? {};
    if ([display_name,gender,goal,birth_date].some(v=>typeof v!=='string' || v.length>120) ||
      [weight_kg,height_cm].some(v=>v!==null && !(typeof v==='number' && v>0 && v<1000)) ||
      (birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(birth_date))) return res.status(400).json({error:'Проверьте поля профиля.'});
    try {
      await db.query(`UPDATE users SET display_name=$2,weight_kg=$3,height_cm=$4,birth_date=$5,gender=$6,goal=$7 WHERE id=$1`,
        [req.account.id,display_name.trim(),weight_kg,height_cm,birth_date||null,gender,goal]);
      res.sendStatus(204);
    } catch(error) {
      if(error.code==='22008') return res.status(400).json({error:'Проверьте дату рождения.'});
      throw error;
    }
  });
  return router;
}
