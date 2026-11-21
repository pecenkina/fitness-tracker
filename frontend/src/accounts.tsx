import {useState,useEffect,type FormEvent,type ReactNode} from 'react';
import {api,type Account} from './session';

type Remembered=Pick<Account,'id'|'email'>;
function remembered():Remembered[]{
  try{return JSON.parse(localStorage.getItem('forma.accounts') || '[]')}catch{return []}
}
export function Accounts({children}:{children:(user:Account,choose:(forget?:boolean)=>void,registered:boolean)=>ReactNode}){
  const [user,setUser]=useState<Account>();
  const [registered,setRegistered]=useState(false);
  const [list,setList]=useState(remembered);
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [email,setEmail]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(true);
  function activate(account:Account, afterRegistration=false){
    setRegistered(afterRegistration);
    sessionStorage.setItem('forma.active',String(account.id));
    const next=[{id:account.id,email:account.email},...remembered().filter(x=>x.id!==account.id)];
    localStorage.setItem('forma.accounts',JSON.stringify(next));
    setList(next);setUser(account);setError('');
  }
  function choose(forget=false){
    if(forget && user){
      const next=remembered().filter(a=>a.id!==user.id);
      localStorage.setItem('forma.accounts',JSON.stringify(next));setList(next);
    }
    setUser(undefined);setError('');setEmail('');setMode('login');sessionStorage.removeItem('forma.active')}
  async function resume(id:string){
    setBusy(true);setError('');
    try{
      const res=await api('/api/auth/me',{},id);
      if(res.ok) activate(await res.json());
      else {choose();setEmail(remembered().find(x=>String(x.id)===id)?.email ?? '')}
    }catch{setError('Сервер недоступен. Повторите вход.')}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    const id=sessionStorage.getItem('forma.active') || (location.hash.startsWith('#share=') && remembered().length>1 ? '' : String(remembered()[0]?.id ?? ''));
    if(id) void resume(id);else setBusy(false);
    const expired=()=>choose();
    window.addEventListener('forma-login',expired);
    return ()=>window.removeEventListener('forma-login',expired);
  },[]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const password=new FormData(e.currentTarget).get('password');
    setBusy(true);setError('');
    try{
      const res=await api('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const data=await res.json();if(!res.ok) throw Error(data.error);
      activate(data,mode==='register');
    }catch(err){setError(err instanceof Error?err.message:'Ошибка входа')}
    finally{setBusy(false)}
  }
  if(user) return children(user,choose,registered);
  return <main className="account-page"><section className="card"><b className="brand"><i/>FORMA</b><h1>{mode==='register'?'Регистрация':'Вход'}</h1>
    {location.hash.startsWith('#share=') && <p>Войдите в аккаунт, в который хотите добавить тренировку.</p>}
    {list.length>0 && <div><h3>Аккаунты на устройстве</h3>{list.map(a=><button key={a.id} disabled={busy} onClick={()=>resume(String(a.id))}>{a.email}</button>)}</div>}
    <form onSubmit={submit}><label>Электронная почта<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label>
    <label>Пароль<input key={mode} name="password" required type="password" minLength={mode==='register'?10:1} maxLength={256} autoComplete={mode==='register'?'new-password':'current-password'}/></label>
    {mode==='register' && <small>Минимум 10 символов</small>}
    <div className="record-actions"><button className="primary" disabled={busy}>{mode==='register'?'Зарегистрироваться':'Войти'}</button>
    <button type="button" disabled={busy} onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'Создать аккаунт':'Уже есть аккаунт'}</button></div></form>
    {error && <p role="alert">{error}</p>}</section></main>;
}

type Submission={id:number;name:string;description:string;muscle:string;equipment:string;difficulty:string};
export function Moderation({refresh}:{refresh:()=>void}){
  const [rows,setRows]=useState<Submission[]>([]);
  const [error,setError]=useState('');
  const [revision,reload]=useState(0);
  useEffect(()=>{api('/api/local/moderation').then(async r=>{
    if(!r.ok) throw Error('Не удалось загрузить очередь.');
    setRows(await r.json());
  }).catch(e=>setError(e.message))},[revision]);
  async function decide(id:number,decision:string){
    try{
      const r=await api('/api/local/moderation/'+id+'/'+decision,{method:'POST'});
      if(!r.ok)throw Error((await r.json()).error);
      setError('');reload(n=>n+1);refresh();
    }catch(e){setError(e instanceof Error?e.message:'Ошибка')}
  }
  return <section className="card"><h2>Модерация упражнений</h2>{!rows.length && <p>Очередь пуста.</p>}
    {rows.map(s=><article key={s.id}><h3>{s.name}</h3><p>{s.description}</p><p>{[s.muscle,s.equipment,({beginner:'Начальный',intermediate:'Средний',advanced:'Продвинутый'})[s.difficulty]].filter(Boolean).join(' · ')}</p>
    <button onClick={()=>decide(s.id,'approve')}>Одобрить</button> <button onClick={()=>decide(s.id,'reject')}>Отклонить</button></article>)}
    {error && <p role="alert">{error}</p>}</section>;
}
