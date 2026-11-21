// Run once, with the same database connection settings as the journal server.
import pg from 'pg';
const email=process.argv[2]?.trim().toLowerCase();
if(!email) throw Error('Укажите email зарегистрированного владельца прежнего журнала.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try {
  await client.query('BEGIN');
  const legacy=(await client.query("SELECT * FROM users WHERE email='journal-demo@fitness.invalid' AND password_hash='!local-journal-demo' FOR UPDATE")).rows[0];
  const owner=(await client.query('SELECT id FROM users WHERE lower(email)=$1 FOR UPDATE',[email])).rows[0];
  if(!legacy || !owner || owner.id===legacy.id) throw Error('Проверьте наличие старого журнала и зарегистрированного получателя.');
  await client.query('UPDATE workouts SET user_id=$1 WHERE user_id=$2',[owner.id,legacy.id]);
  await client.query('UPDATE plans SET user_id=$1 WHERE user_id=$2',[owner.id,legacy.id]);
  await client.query(`UPDATE users u SET display_name=coalesce(nullif(u.display_name,''),l.display_name),
    goal=coalesce(nullif(u.goal,''),l.goal),gender=coalesce(nullif(u.gender,''),l.gender),
    birth_date=coalesce(u.birth_date,l.birth_date),height_cm=coalesce(u.height_cm,l.height_cm),
    weight_kg=coalesce(u.weight_kg,l.weight_kg) FROM users l WHERE u.id=$1 AND l.id=$2`,[owner.id,legacy.id]);
  await client.query('DELETE FROM users WHERE id=$1',[legacy.id]);
  await client.query('COMMIT');
  console.log('Журнал и планы перенесены в аккаунт '+email);
}catch(error){await client.query('ROLLBACK');throw error}finally{await client.end()}
