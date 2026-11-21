import {api} from './session';
import {useState,type FormEvent} from 'react';
import {recommend} from './recommendations';
import type {Exercise, Workout} from './main';
export type ProfileData={display_name?:string;weight_kg?:number;height_cm?:number;birth_date?:string;gender?:string;goal?:string};
function GoalFields({regions,goals}:{regions:string[];goals:string[]}) {
  return <fieldset className="goal-options"><legend>Целевые группы мышц</legend>{regions.map(region=>
    <label key={region}><input type="checkbox" name="goal" value={region} defaultChecked={goals.includes(region)}/>{region}</label>)}</fieldset>;
}
export function Profile({data,regions,goals,onSave}:{data:ProfileData;regions:string[];goals:string[];onSave:(p:ProfileData)=>void}){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    const values:Record<string,FormDataEntryValue>={...Object.fromEntries(form),goal:form.getAll('goal').join(',')};
    const profile={...values,weight_kg:values.weight_kg?Number(values.weight_kg):null,height_cm:values.height_cm?Number(values.height_cm):null};
    setBusy(true);setError('');
    try{const res=await api('/api/local/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});
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
    <GoalFields regions={regions} goals={goals}/></div></section>
    <section className="card"><h2>Фитнес-сервисы</h2><h3>Подключение браслета</h3><p>Не подключено</p><p>Все тренировки доступны вручную.</p></section></div>
    {error && <p role="alert">{error}</p>}</form>;
}
export function Recommendations({catalog,history,regions,goals,onGoals,toPlan}:{
  catalog:Exercise[];history:Workout[];regions:string[];goals:string[];
  onGoals:(values:string[])=>Promise<void>;toPlan:(ids:number[])=>void
}){
  const [chosen,setChosen]=useState<number[]>([]),[muscle,setMuscle]=useState(''),[level,setLevel]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function selectGoals(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values=new FormData(event.currentTarget).getAll('goal').map(String);
    if (!values.length) {setError('Выбери хотя бы одну группу мышц.');return}
    setBusy(true);setError('');
    try {await onGoals(values)} catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить цели.')} finally{setBusy(false)}
  }
  if (!goals.length) return <form className="card" onSubmit={selectGoals}><h2>Какие мышцы хочешь тренировать?</h2>
    <GoalFields regions={regions} goals={goals}/><button className="primary" disabled={busy}>Показать рекомендации</button>
    {error && <p role="alert">{error}</p>}</form>;
  const candidates = recommend(catalog,history,goals);
  const items=candidates.filter(({exercise:e})=> (!muscle||e.muscles.includes(muscle)) && (!level||e.difficulty===level));
  return <><section className="goal-card"><small>ЦЕЛЕВЫЕ ГРУППЫ МЫШЦ</small><h2>{goals.join(' · ')}</h2></section>
    <div className="line"><h2>Рекомендуемые упражнения</h2><div className="filters-inline"><select aria-label="Группа мышц" value={muscle} onChange={e=>setMuscle(e.target.value)}><option value="">Все мышцы</option>{[...new Set(candidates.flatMap(row=>row.exercise.muscles))].map(m=><option key={m}>{m}</option>)}</select>
    <select aria-label="Уровень сложности" value={level} onChange={e=>setLevel(e.target.value)}><option value="">Любой уровень</option><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select></div></div>
    <div className="entry-layout"><div>{items.map(({exercise:e,reason})=><article className="card line" key={e.id}><div><small>{reason}</small><h3>{e.name}</h3><p>{e.muscles.join(' · ')}</p></div><button aria-pressed={chosen.includes(e.id)} onClick={()=>setChosen(chosen.includes(e.id)?chosen.filter(id=>id!==e.id):[...chosen,e.id])}>{chosen.includes(e.id)?'Убрать':'+ В план'}</button></article>)}
    {!items.length && <p>В каталоге пока нет упражнений по этим условиям.</p>}</div>
    <section className="card"><h2>Собери свой план</h2><p>Выбрано упражнений: {chosen.length}</p><button className="primary" disabled={!chosen.length} onClick={()=>toPlan(chosen)}>Создать план</button></section></div></>;
}
