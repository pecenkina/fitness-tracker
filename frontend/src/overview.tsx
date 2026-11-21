import {useState} from 'react';
import {usesCounterweight} from './load';
import type {Exercise, Workout} from './main';

const format = (value: number) => value.toLocaleString('ru-RU', {maximumFractionDigits:2});
const swatches = ['#34875b','#82bc98','#b3d3bd','#b5a0d0','#578980','#7b8574'];
const dayLabel = (date: string) => new Date(date+'T12:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'});

function Trend({points,label}: {label:string; points: [string,number][]}) {
  if (!points.length) return <p className="empty">Укажите вес в подходах, чтобы увидеть динамику.</p>;
  const peak = Math.max(1,...points.map(([,kg]) => kg));
  const day = (date: string) => Date.parse(date+'T00:00Z')/86400000;
  const first = day(points[0][0]), last = day(points[points.length-1][0]);
  const x = (date: string) => first === last ? 172 : 40+(day(date)-first)/(last-first)*270;
  const y = (kg: number) => 120-kg/peak*90;
  return <><svg viewBox="0 0 330 150" className="trend" role="img" aria-label={label+': '+points.map(([d,v])=>dayLabel(d)+' — '+format(v)+' кг').join(', ')}>
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
  const dailyBest = new Map<number, Map<string,number>>();
  const dailyLoad = new Map<string, {sum: number; count: number}>();
  const repetitions = new Map<number, {name: string; total: number}>();
  let minutes: number|null=null, volume: number|null=null, maxKg: number|null=null;
  const exercises = new Map(catalog.map(e=>[e.id,e]));
  for(const workout of rows) {
    if(workout.duration_minutes!==null) minutes=(minutes??0)+workout.duration_minutes;
    for(const move of workout.exercises) {
      if(move.completed===false) continue;
      const exercise=exercises.get(move.exercise_id);
      const assisted=usesCounterweight(exercise);
      const groups=exercise?.muscles;
      const targets=groups?.length ? groups : ['Не указано'];
      for(const set of move.sets) {
        if(set.completed===false) continue;
        const previousTotal = repetitions.get(move.exercise_id)?.total ?? 0;
        repetitions.set(move.exercise_id, {name: move.name, total: previousTotal + set.reps});
        if(set.weight_kg===null) continue;
        const kg=set.weight_kg, work=kg*set.reps;
        const dates=dailyBest.get(move.exercise_id)??new Map<string,number>();
        const previous = dates.get(workout.workout_date) ?? kg;
        dates.set(workout.workout_date, assisted ? Math.min(previous,kg) : Math.max(previous,kg));
        dailyBest.set(move.exercise_id,dates);
        if (assisted) continue;
        if (kg > 0) {
          const day = dailyLoad.get(workout.workout_date) ?? {sum: 0, count: 0};
          dailyLoad.set(workout.workout_date, {sum: day.sum + kg, count: day.count + 1});
        }
        volume=(volume??0)+work;
        maxKg=Math.max(maxKg??0,kg);
        for(const group of targets) muscleVolumes.set(group,(muscleVolumes.get(group)??0)+work/targets.length);
      }
    }
  }
  const options=catalog.filter(e=>dailyBest.has(e.id));
  const chosen = options.find(e => String(e.id) === choice);
  const trendLabel = !chosen ? 'Средний вес выполненного подхода с отягощением по дням, кг'
    : usesCounterweight(chosen) ? 'Минимальный противовес по датам, кг' : 'Максимальный вес по датам, кг';
  const points: [string, number][] = chosen ? Array.from(dailyBest.get(chosen.id) ?? [])
    : Array.from(dailyLoad, ([date, load]) => [date, load.sum / load.count]);
  points.sort(([a], [b]) => a.localeCompare(b));

  const frequency = new Map<number, {name: string; count: number}>();
  for (const workout of history) {
    if (!workout.workout_date.startsWith(month)) continue;
    const seen = new Set<number>();
    for (const move of workout.exercises) {
      if (seen.has(move.exercise_id) || !move.sets.some(set => set.completed ?? move.completed ?? true)) continue;
      seen.add(move.exercise_id);
      const count = frequency.get(move.exercise_id)?.count ?? 0;
      frequency.set(move.exercise_id, {name: move.name, count: count + 1});
    }
  }
  const popular = [...frequency.entries()].sort(([, a], [, b]) =>
    b.count - a.count || a.name.localeCompare(b.name, 'ru')).slice(0, 5);
  const topReps = [...repetitions.entries()].sort(([,a],[,b]) =>
    b.total - a.total || a.name.localeCompare(b.name,'ru')).slice(0,5);
  const muscleRows=[...muscleVolumes].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  let angle=0;
  const stops=muscleRows.map(([,v],i)=>{const start=angle;angle+=v/(volume||1)*360;return swatches[i%swatches.length]+' '+start+'deg '+angle+'deg'});
  const top=options.filter(e=>!usesCounterweight(e)).map(e=>({name:e.name,kg:Math.max(...dailyBest.get(e.id)!.values())})).sort((a,b)=>b.kg-a.kg).slice(0,3);
  const stats=[['Тренировки',format(rows.length)],['Общий объём',volume===null?'—':format(volume)+' кг'],
    ['Время занятий',minutes===null?'—':format(minutes)+' мин'],['Макс. вес',maxKg===null?'—':format(maxKg)+' кг']];
  return <><div className="stats">{stats.map(([label,value])=><section className="tile" key={label}><span>{label}</span><strong>{value}</strong></section>)}</div>
    <div className="dashboard"><section className="card"><h2>Прогресс рабочего веса</h2>
      <p className="muted">{trendLabel}</p>
      {!!options.length && <select aria-label="Упражнение для графика" value={chosen?.id ?? ''} onChange={e=>setChoice(e.target.value)}><option value="">Все упражнения</option>{options.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>}
      <Trend points={points} label={trendLabel}/></section>
    <section className="card"><h2>Нагрузка по мышцам</h2><p className="muted">Доля тренировочного объёма</p>
      {muscleRows.length ? <div className="allocation"><div aria-hidden="true" className="ring" style={{background:'conic-gradient('+stops.join(',')+')'}}/>
      <ul>{muscleRows.map(([name,v],i)=><li key={name}><i style={{background:swatches[i%swatches.length]}}/>{name} <b>{format(v/(volume||1)*100)}%</b></li>)}</ul></div> : <p className="empty">Для расчёта нужен хотя бы один подход с отягощением.</p>}</section>
    <section className="card"><div className="line"><h2>Последние тренировки</h2><button className="link" onClick={()=>openJournal()}>Все записи →</button></div>
      {history.slice(0,3).map(w=><button key={w.id} className="data-row" onClick={()=>openJournal(w.id)}><b>{w.name}</b><span>{dayLabel(w.workout_date)} →</span></button>)}
      {!history.length && <p className="empty">Здесь появится первая сохранённая тренировка.</p>}</section>
    <section className="card"><h2>Популярные упражнения за месяц</h2>
      <p className="muted">Число тренировок за {new Date(month + '-01T12:00').toLocaleDateString('ru-RU', {month: 'long', year: 'numeric'})}</p>
      {popular.map(([id, item]) => <div className="data-row" key={id}><span>{item.name}</span><b>{item.count}</b></div>)}
      {!popular.length && <p className="empty">В этом месяце пока нет выполненных подходов.</p>}
    </section>
    <section className="card"><h2>Топ упражнений по повторениям</h2>
      <p className="muted">Сумма повторений в выполненных подходах за выбранный период</p>
      {topReps.map(([id,item])=><div className="data-row" key={id}><span>{item.name}</span><b>{format(item.total)} повт.</b></div>)}
      {!topReps.length && <p className="empty">За этот период пока нет выполненных подходов.</p>}</section>
    <section className="card"><h2>Топ упражнений</h2><p className="muted">По максимальному весу за период</p>
      {top.map(e=><div className="data-row" key={e.name}><span>{e.name}</span><b>{format(e.kg)} кг</b></div>)}
      {!top.length && <p className="empty">Пока нет подходов с указанным весом.</p>}</section></div></>;
}
