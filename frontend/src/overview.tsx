import {useState} from 'react';
import type {Exercise, Workout} from './main';

const format = (value: number) => value.toLocaleString('ru-RU', {maximumFractionDigits:2});
const swatches = ['#34875b','#82bc98','#b3d3bd','#b5a0d0','#578980','#7b8574'];
const dayLabel = (date: string) => new Date(date+'T12:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});

function Trend({points}: {points: [string,number][]}) {
  if (!points.length) return <p className="empty">Укажите вес в подходах, чтобы увидеть динамику.</p>;
  const peak = Math.max(1,...points.map(([,kg]) => kg));
  const day = (date: string) => Date.parse(date+'T00:00Z')/86400000;
  const first = day(points[0][0]), last = day(points[points.length-1][0]);
  const x = (date: string) => first === last ? 172 : 40+(day(date)-first)/(last-first)*270;
  const y = (kg: number) => 120-kg/peak*90;
  return <><svg viewBox="0 0 330 150" className="trend" role="img" aria-label={'Максимальный вес по дням: '+points.map(([d,v])=>dayLabel(d)+' — '+v+' кг').join(', ')}>
    {[0,.5,1].map(f => <g key={f}><line x1="40" x2="310" y1={y(peak*f)} y2={y(peak*f)} stroke="#dde7e0"/>
      <text x="34" y={y(peak*f)+3} textAnchor="end">{format(peak*f)}</text></g>)}
    <polyline points={points.map(([d,v]) => x(d)+','+y(v)).join(' ')} fill="none" stroke="#33885a" strokeWidth="2.4"/>
    {points.map(([d,v]) => <circle key={d} cx={x(d)} cy={y(v)} r="4" fill="#33885a"><title>{dayLabel(d)} · {format(v)} кг</title></circle>)}
    <text x={x(points[0][0])} y="141" textAnchor="middle">{dayLabel(points[0][0])}</text>
    {last!==first && <text x="310" y="141" textAnchor="middle">{dayLabel(points[points.length-1][0])}</text>}</svg></>;
}

export function Overview({history,catalog,month,period,openJournal}: {period:string; history: Workout[]; catalog: Exercise[]; month: string; openJournal: (id?: number)=>void}) {
  const [choice,setChoice] = useState('');
  const end=new Date();const start=new Date(end);
  start.setDate(start.getDate()-(period==='7'?6:period==='30'?29:364));
  const rows=history.filter(w=>period==='month' ? w.workout_date.startsWith(month) :
    w.workout_date>=start.toLocaleDateString('sv-SE') && w.workout_date<=end.toLocaleDateString('sv-SE'));
  const muscleVolumes = new Map<string,number>();
  const maxima = new Map<number, Map<string,number>>();
  let minutes: number|null=null, volume: number|null=null, maxKg: number|null=null;
  const muscles = new Map(catalog.map(e=>[e.id,e.muscles]));
  for(const workout of rows) {
    if(workout.duration_minutes!==null) minutes=(minutes??0)+workout.duration_minutes;
    for(const move of workout.exercises) {
      if(move.completed===false) continue;
      const groups=muscles.get(move.exercise_id);
      const targets=groups?.length ? groups : ['Не указано'];
      for(const set of move.sets) {
        if(set.completed===false || set.weight_kg===null) continue;
        const kg=set.weight_kg, work=kg*set.reps;
        volume=(volume??0)+work;
        maxKg=Math.max(maxKg??0,kg);
        const dates=maxima.get(move.exercise_id)??new Map<string,number>();
        dates.set(workout.workout_date, Math.max(dates.get(workout.workout_date)??0,kg));
        maxima.set(move.exercise_id,dates);
        for(const group of targets) muscleVolumes.set(group,(muscleVolumes.get(group)??0)+work/targets.length);
      }
    }
  }
  const options=catalog.filter(e=>maxima.has(e.id));
  const chosen=options.some(e=>String(e.id)===choice) ? Number(choice) : options[0]?.id;
  const points=Array.from(maxima.get(chosen)??[]).sort(([a],[b])=>a.localeCompare(b));
  const muscleRows=[...muscleVolumes].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  let angle=0;
  const stops=muscleRows.map(([,v],i)=>{const start=angle;angle+=v/(volume||1)*360;return swatches[i%swatches.length]+' '+start+'deg '+angle+'deg'});
  const top=options.map(e=>({name:e.name,kg:Math.max(...maxima.get(e.id)!.values())})).sort((a,b)=>b.kg-a.kg).slice(0,3);
  const stats=[['Тренировки',format(rows.length)],['Общий объём',volume===null?'—':format(volume)+' кг'],
    ['Время занятий',minutes===null?'—':format(minutes)+' мин'],['Макс. вес',maxKg===null?'—':format(maxKg)+' кг']];
  return <><div className="stats">{stats.map(([label,value])=><section className="tile" key={label}><span>{label}</span><strong>{value}</strong></section>)}</div>
    <div className="dashboard"><section className="card"><h2>Прогресс рабочего веса</h2>
      <p className="muted">Максимальный вес по датам, кг</p>
      {!!options.length && <select aria-label="Упражнение для графика" value={chosen} onChange={e=>setChoice(e.target.value)}>{options.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>}
      <Trend points={points}/></section>
    <section className="card"><h2>Нагрузка по мышцам</h2><p className="muted">Доля тренировочного объёма</p>
      {muscleRows.length ? <div className="allocation"><div aria-hidden="true" className="ring" style={{background:'conic-gradient('+stops.join(',')+')'}}/>
      <ul>{muscleRows.map(([name,v],i)=><li key={name}><i style={{background:swatches[i%swatches.length]}}/>{name} <b>{format(v/(volume||1)*100)}%</b></li>)}</ul></div> : <p className="empty">Для расчёта нужен хотя бы один подход с отягощением.</p>}</section>
    <section className="card"><div className="line"><h2>Последние тренировки</h2><button className="link" onClick={()=>openJournal()}>Все записи →</button></div>
      {history.slice(0,3).map(w=><button key={w.id} className="data-row" onClick={()=>openJournal(w.id)}><b>{w.name}</b><span>{dayLabel(w.workout_date)} →</span></button>)}
      {!history.length && <p className="empty">Здесь появится первая сохранённая тренировка.</p>}</section>
    <section className="card"><h2>Топ упражнений</h2><p className="muted">По максимальному весу за период</p>
      {top.map(e=><div className="data-row" key={e.name}><span>{e.name}</span><b>{format(e.kg)} кг</b></div>)}
      {!top.length && <p className="empty">Пока нет подходов с указанным весом.</p>}</section></div></>;
}
