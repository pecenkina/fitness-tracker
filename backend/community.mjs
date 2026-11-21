import express from 'express';
import {randomUUID} from 'node:crypto';

export function community(db){
  const router=express.Router();
  router.get('/moderation',async(req,res)=>{
    if(!req.account.moderator) return res.sendStatus(403);
    const rows=await db.query("SELECT id,name,description,equipment,muscle,difficulty FROM exercise_submissions WHERE status='pending' ORDER BY id");
    res.json(rows.rows);
  });
  router.post('/moderation/:id/:decision',async(req,res)=>{
    if(!req.account.moderator) return res.sendStatus(403);
    const {id,decision}=req.params;
    if(!/^\d{1,9}$/.test(id) || !['approve','reject'].includes(decision)) return res.sendStatus(400);
    const client=await db.connect();
    try{
      await client.query('BEGIN');
      const result=await client.query(`UPDATE exercise_submissions SET status=$2 WHERE id=$1 AND status='pending' RETURNING *`,
        [id,decision==='approve'?'approved':'rejected']);
      if(!result.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Заявка уже обработана.'})}
      if(decision==='approve'){
        const {name,description,equipment,muscle,difficulty}=result.rows[0];
        const move=await client.query(`INSERT INTO exercises(name,description,equipment,difficulty,source,source_key)
          VALUES($1,$2,$3,$4,'custom',$5) RETURNING id`,
          [name,description,equipment?[equipment]:[],difficulty,name.toLocaleLowerCase('ru').replaceAll('ё','е')]);
        await client.query('INSERT INTO exercise_muscles SELECT $1,id FROM muscle_groups WHERE name=$2',[move.rows[0].id,muscle]);
      }
      await client.query('COMMIT');
      res.sendStatus(204);
    }catch(error){
      await client.query('ROLLBACK');
      if(error.code==='23505') return res.status(409).json({error:'Упражнение уже опубликовано. Можно отклонить дубликат.'});
      throw error;
    }finally{client.release()}
  });
  router.post('/workouts/:id/share',async(req,res)=>{
    const result=await db.query(`INSERT INTO workout_shares(token,workout_id)
      SELECT $1,id FROM workouts WHERE id::text=$2 AND user_id=$3 AND status='completed'
      ON CONFLICT(workout_id) DO UPDATE SET workout_id=excluded.workout_id RETURNING token`,
      [randomUUID(),req.params.id,req.account.id]);
    if(!result.rowCount) return res.status(404).json({error:'Тренировка не найдена.'});
    res.json(result.rows[0]);
  });
  router.post('/shares/:token/import',async(req,res)=>{
    const result=await db.query(`WITH source AS (
      SELECT w.*,s.token FROM workout_shares s JOIN workouts w ON w.id=s.workout_id WHERE s.token::text=$1
    ), receipt AS (
      INSERT INTO workout_imports SELECT token,$2 FROM source WHERE user_id<>$2 ON CONFLICT DO NOTHING RETURNING token
    ), copy AS (
      INSERT INTO workouts(user_id,name,workout_date,duration_minutes,status)
      SELECT $2,name,CURRENT_DATE,duration_minutes,'draft' FROM source JOIN receipt USING(token) RETURNING id
    ), moves AS (
      SELECT e.* FROM workout_exercises e JOIN source ON source.id=e.workout_id
    ), inserted AS (
      INSERT INTO workout_exercises(workout_id,exercise_id,position,completed)
      SELECT copy.id,m.exercise_id,m.position,false FROM copy CROSS JOIN moves m RETURNING id,position
    ), sets AS (
      INSERT INTO workout_sets(workout_exercise_id,position,reps,weight_kg,completed)
      SELECT i.id,s.position,s.reps,s.weight_kg,false FROM inserted i JOIN moves m USING(position)
      JOIN workout_sets s ON s.workout_exercise_id=m.id
    ) SELECT user_id=$2 AS own, EXISTS(SELECT FROM copy) AS added FROM source`,[req.params.token,req.account.id]);
    if(!result.rowCount) return res.status(404).json({error:'Ссылка недействительна или тренировка удалена.'});
    res.json(result.rows[0]);
  });
  return router;
}
