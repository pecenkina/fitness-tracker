import {useState} from 'react';
import type {Workout} from './main';

export function Calendar({canSchedule,day,select,entries,plans,onSchedule,onStart,onCancel}:{
  canSchedule:boolean; day:string; select:(date:string)=>void; entries:Workout[]; plans:{id:number;name:string}[];
  onSchedule:(id:number)=>void; onStart:(row:Workout)=>void; onCancel:(row:Workout)=>void;
}) {
  const [plan,setPlan]=useState('');
  const [year,month]=day.split('-').map(Number);
  const date=new Date(year,month-1,1);
  const offset=(date.getDay()+6)%7;
  const days=new Date(year,month,0).getDate();
  const key=(y:number,m:number,d:number)=>[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
  function shift(delta:number){const next=new Date(year,month-1+delta,1);select(key(next.getFullYear(),next.getMonth()+1,1))}
  const monday=new Date();
  monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
  const sunday=new Date(monday);
  sunday.setDate(monday.getDate()+6);
  const dateKey=(d:Date)=>key(d.getFullYear(),d.getMonth()+1,d.getDate());
  const week=entries.filter(w=>w.workout_date>=dateKey(monday) && w.workout_date<=dateKey(sunday))
    .sort((a,b)=>a.workout_date.localeCompare(b.workout_date) || a.id-b.id);
  return <section className="card plan-calendar" aria-label="Календарь тренировок"><h2>На этой неделе</h2>
    {week.map(w=><button className="week-entry" key={w.id} onClick={()=>select(w.workout_date)}>
      <strong>{w.name}</strong><span>{new Date(w.workout_date+'T12:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'short'})}</span>
    </button>)}
    {!week.length && <p className="muted">На этой неделе занятий пока нет.</p>}
    <details className="date-picker"><summary>Выбрать дату</summary><div className="line"><h2>{date.toLocaleDateString('ru-RU',{year:'numeric',month:'long'})}</h2>
    <div><button aria-label="Предыдущий месяц" onClick={()=>shift(-1)}>‹</button> <button aria-label="Следующий месяц" onClick={()=>shift(1)}>›</button></div></div>
    <div className="month">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=><b key={d}>{d}</b>)}
      {Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}
      {Array.from({length:days},(_,i)=>{const value=key(year,month,i+1);const count=entries.filter(w=>w.workout_date===value).length;
        return <button key={value} aria-label={value+' · запланировано: '+count} aria-pressed={day===value} onClick={()=>select(value)}>{i+1}{count>0 && <small>{count}</small>}</button>})}</div></details>
    <h3>Расписание на {new Date(day+'T12:00').toLocaleDateString('ru-RU')}</h3>
    {entries.filter(w=>w.workout_date===day).map(w=><div className="data-row" key={w.id}><b>{w.name}</b><div>
      <button onClick={()=>onStart(w)}>Отметить выполнение</button> <button onClick={()=>onCancel(w)}>Отменить занятие</button></div></div>)}
    {!entries.some(w=>w.workout_date===day) && <p>На этот день занятий нет.</p>}
    <label>Шаблон<select value={plan} onChange={e=>setPlan(e.target.value)}><option value="">Без шаблона</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <button className="primary" disabled={!canSchedule} onClick={()=>onSchedule(Number(plan))}>Запланировать тренировку</button></section>;
}
