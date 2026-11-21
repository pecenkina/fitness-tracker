import express from 'express';
import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const derive = promisify(scrypt);
const digest = token => createHash('sha256').update(token).digest('hex');
const lifetime = 30 * 24 * 60 * 60 * 1000;
const cookieName = id => 'forma_session_' + id;
const cookieOptions = {httpOnly:true, sameSite:'strict', path:'/api', secure:process.env.COOKIE_SECURE === 'true'};

export function requireAccount(db) {
  return async (req,res,next) => {
    const id = req.get('X-Forma-Account');
    const token = /^[1-9]\d{0,9}$/.test(id) && (req.headers.cookie ?? '').split(';')
      .map(part=>part.trim()).find(part=>part.startsWith(cookieName(id)+'='))?.split('=')[1];
    const user = token && (await db.query(
      'SELECT u.id,u.email,u.moderator FROM sessions s JOIN users u ON u.id=s.user_id WHERE digest=$1 AND u.id::text=$2 AND expires_at>now()',
      [digest(token),id])).rows[0];
    if (!user) return res.status(401).json({error:'Войдите в аккаунт.'});
    req.account=user;
    req.sessionDigest=digest(token);
    res.set('Cache-Control','no-store');
    next();
  };
}

export function accounts(db) {
  const router=express.Router();
  router.use(express.json({limit:'4kb'}));
  for (const action of ['register','login']) {
    router.post('/'+action,async (req,res)=>{
      const email=req.body?.email?.trim?.().toLowerCase();
      const password=req.body?.password;
      if(typeof email!=='string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 ||
         typeof password!=='string' || password.length>256 || !password.length || (action==='register' && password.length<10))
        return res.status(400).json({error:'Проверьте почту и пароль. Для нового аккаунта нужно минимум 10 символов.'});
      let user;
      if(action==='register'){
        const salt=randomBytes(16).toString('hex');
        const hash=(await derive(password,salt,64)).toString('hex');
        const result=await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id,email,moderator',
          [email,salt+':'+hash]);
        if(!result.rowCount) return res.status(409).json({error:'Этот адрес уже зарегистрирован.'});
        user=result.rows[0];
      }else{
        user=(await db.query('SELECT id,email,moderator,password_hash FROM users WHERE lower(email)=$1',[email])).rows[0];
        const [salt,expected]=String(user?.password_hash ?? '').split(':');
        const actual=await derive(password,salt || 'unknown-account',64);
        if(!expected || expected.length!==128 || !timingSafeEqual(actual,Buffer.from(expected,'hex')))
          return res.status(401).json({error:'Проверьте почту и пароль.'});
        delete user.password_hash;
      }
      const token=randomBytes(32).toString('hex');
      await db.query("INSERT INTO sessions VALUES ($1,$2,now()+interval '30 days')",[digest(token),user.id]);
      res.cookie(cookieName(user.id),token,{...cookieOptions,maxAge:lifetime}).set('Cache-Control','no-store').json(user);
    });
  }
  router.use(requireAccount(db));
  router.get('/me',(req,res)=>res.json(req.account));
  router.post('/logout',async(req,res)=>{
    await db.query('DELETE FROM sessions WHERE digest=$1',[req.sessionDigest]);
    res.clearCookie(cookieName(req.account.id),cookieOptions).sendStatus(204);
  });
  return router;
}
