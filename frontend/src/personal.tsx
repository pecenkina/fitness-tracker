import {useState,type FormEvent} from 'react';
import type {Exercise} from './main';
export type ProfileData={display_name?:string;weight_kg?:number;height_cm?:number;birth_date?:string;gender?:string;goal?:string};
export function Profile({data,regions,goal,onSave}:{data:ProfileData;regions:string[];goal:string;onSave:(p:ProfileData)=>void}){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));
    const profile={...values,weight_kg:values.weight_kg?Number(values.weight_kg):null,height_cm:values.height_cm?Number(values.height_cm):null};
    setBusy(true);setError('');
    try{const res=await fetch('/api/local/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});
      if(!res.ok)throw new Error((await res.json()).error);
      onSave({...data,...values,weight_kg:profile.weight_kg??undefined,height_cm:profile.height_cm??undefined});
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить профиль.')}finally{setBusy(false)}
  }
  return <form onSubmit={submit}><div className="card line"><h2>{data.display_name||'Мой профиль'}</h2><button className="primary" disabled={busy}>Сохранить изменения</button></div>
    <div className="entry-layout"><section className="card"><h2>Личные данные</h2><div className="personal-fields">
    <label>Имя<input name="display_name" maxLength={120} defaultValue={data.display_name??''}/></label>
    <label>Вес, кг<input name="weight_kg" type="number" min=".01" max="999.99" step=".01" defaultValue={data.weight_kg??''}/></label>
    <label>Рост, см<input name="height_cm" type="number" min=".01" max="999.99" step=".01" defaultValue={data.height_cm??''}/></label>
    <label>Дата рождения<input name="birth_date" type="date" defaultValue={data.birth_date??''}/></label>
    <label>Пол<select name="gender" defaultValue={data.gender??''}><option value="">Не указано</option><option>Женский</option><option>Мужской</option></select></label>
    <label>Целевая группа мышц<select name="goal" defaultValue={goal}><option value="">Не выбрана</option>{regions.map(region=><option key={region}>{region}</option>)}</select></label></div></section>
    <section className="card"><h2>Фитнес-сервисы</h2><h3>Подключение браслета</h3><p>Не подключено</p><p>Все тренировки доступны вручную.</p></section></div>
    {error && <p role="alert">{error}</p>}</form>;
}
export function Recommendations({catalog,goal,toProfile,toPlan}:{catalog:Exercise[];goal?:string;toProfile:()=>void;toPlan:(ids:number[])=>void}){
  const [chosen,setChosen]=useState<number[]>([]),[muscle,setMuscle]=useState(''),[level,setLevel]=useState('');
  const candidates = goal ? catalog.filter(e=>e.regions.includes(goal)) : catalog;
  const items=candidates.filter(e=> (!muscle||e.muscles.includes(muscle)) && (!level||e.difficulty===level));
  return <><section className="goal-card"><small>ТВОЯ ЦЕЛЬ</small><h2>{goal || 'Выбери группу мышц'}</h2><button onClick={toProfile}>Изменить цель</button></section>
    <div className="line"><h2>Рекомендуемые упражнения</h2><div className="filters-inline"><select aria-label="Группа мышц" value={muscle} onChange={e=>setMuscle(e.target.value)}><option value="">Все мышцы</option>{[...new Set(candidates.flatMap(e=>e.muscles))].map(m=><option key={m}>{m}</option>)}</select>
    <select aria-label="Уровень сложности" value={level} onChange={e=>setLevel(e.target.value)}><option value="">Любой уровень</option><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select></div></div>
    <div className="entry-layout"><div>{items.map(e=><article className="card line" key={e.id}><div><h3>{e.name}</h3><p>{e.muscles.join(' · ')}</p></div><button aria-pressed={chosen.includes(e.id)} onClick={()=>setChosen(chosen.includes(e.id)?chosen.filter(id=>id!==e.id):[...chosen,e.id])}>{chosen.includes(e.id)?'Убрать':'+ В план'}</button></article>)}
    {!items.length && <p>В каталоге пока нет упражнений по этим условиям.</p>}</div>
    <section className="card"><h2>Собери свой план</h2><p>Выбрано упражнений: {chosen.length}</p><button className="primary" disabled={!chosen.length} onClick={()=>toPlan(chosen)}>Создать план</button></section></div></>;
}
