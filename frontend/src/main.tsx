import {useEffect, useState, type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {Profile,Recommendations,type ProfileData} from './personal';
import {Calendar} from './calendar';
import {CustomExercise} from './custom';
import {ExercisePicker} from './exercise-picker';
import {Catalog} from './catalog';
import {usesCounterweight, describeWeight} from './load';
import {Overview} from './overview';
import './style.css';

export type Exercise = {id: number; name: string; description: string; regions:string[]; goals?:string[]; equipment: string[]; difficulty: 'beginner'|'intermediate'|'advanced'; muscles: string[]};
export type Workout = {id: number; name: string; workout_date: string; status?: string; duration_minutes: number | null;
  exercises: {completed?: boolean; name: string; exercise_id: number; sets: {completed?: boolean; reps: number; weight_kg: number | null}[]}[]};
type Plan = Pick<Workout,'id'|'name'|'exercises'>;
type DraftSet = {completed:boolean; key: number; reps: string; weight: string};
type DraftMove = { key: number; id: string; sets: DraftSet[]};
let nextKey = 0;
const newSet = (previous?: DraftSet): DraftSet => ({completed:false,key: ++nextKey, reps: previous?.reps ?? '10', weight: previous?.weight ?? ''});
const newMove = (id: string): DraftMove => ({key: ++nextKey, id, sets: [newSet()]});
const journal = '/api/local/workouts';

function request(url: string, options: RequestInit & {method: 'DELETE'}): Promise<void>;
function request<T>(url: string, options?: RequestInit): Promise<T>;
async function request<T>(url: string, options?: RequestInit): Promise<T | void> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Не удалось выполнить запрос. Проверьте подключение к серверу.');
  }
  return response.status === 204 ? undefined : response.json();
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Ошибка запроса';
function today() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
}

type Mode='workout'|'plan'|'schedule';
function Editor({mode,day,catalog, onCreateExercise, initial, template, selected, onClose, onSave}: {mode:Mode; day:string; onCreateExercise: (exercise: Exercise) => void; template?: Plan; selected: number[]; initial?: Workout; catalog: Exercise[]; onClose: () => void; onSave: (id: number, mode:Mode, date:string) => void}) {
  const source = initial ?? template;
  const [moves, setMoves] = useState<DraftMove[]>(() => source ? source.exercises.map(m => ({key: ++nextKey, id: String(m.exercise_id),
    sets: m.sets.map(s => ({completed:initial ? s.completed ?? m.completed ?? true : false,key: ++nextKey, reps: String(s.reps), weight: String(s.weight_kg ?? '')}))})) : (selected.length ? selected : [catalog[0].id]).map(id => newMove(String(id))));
  const [title,setTitle]=useState(source?.name ?? '');
  const [duration,setDuration]=useState(String(initial?.duration_minutes ?? ''));
  const allSets=moves.flatMap(m=>m.sets);
  const counted=mode==='workout'?allSets.filter(s=>s.completed):allSets;
  const exerciseById = new Map(catalog.map(item => [String(item.id), item]));
  const volume = moves.reduce((total, move) => {
    if (usesCounterweight(exerciseById.get(move.id))) return total;
    return total + move.sets.reduce((sum, set) => mode === 'workout' && !set.completed
      ? sum : sum + Number(set.reps) * Number(set.weight), 0);
  }, 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = (move: DraftMove) => setMoves(items => items.map(item => item.key === move.key ? move : item));
  function moveExercise(index: number, direction: -1 | 1) {
    const target = index + direction;
    setMoves(items => {
      if (target < 0 || target >= items.length) return items;
      const reordered = [...items];
      [reordered[index], reordered[target]] = [items[target], items[index]];
      return reordered;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const target=button?.value==='plan' ? 'plan' : mode;
    const base=target==='plan' ? '/api/local/plans' : journal;
    const id=target==='plan' ? (mode==='plan' ? template?.id : undefined) : initial?.id;
    const fields = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      const result = await request<{id: number}>(id ? base+'/'+id : base, {method: id ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({status:target==='schedule'?'draft':'completed',previous_status:initial?.status,save_as_plan:fields.has('save_plan'),name: fields.get('name'), workout_date: fields.get('date'),
          duration_minutes: fields.get('duration') ? Number(fields.get('duration')) : null,
          exercises: moves.map(move => ({exercise_id: Number(move.id), sets: move.sets.map(set =>
            ({completed:target==='workout' && set.completed,reps: Number(set.reps), weight_kg: set.weight === '' ? null : Number(set.weight)}))}))})});
      onSave(result.id,target,String(fields.get('date') ?? day));
    } catch (err) {setError(message(err)); setSaving(false)}
  }
  return <form onSubmit={submit}><fieldset disabled={saving} className="plain">
    <button type="button" className="link" onClick={onClose}>← Назад</button>
    <h1>{mode==='plan' ? (template?'Редактирование плана':'Новый план') : mode==='schedule'?'Запланировать тренировку':initial?.status==='draft'?'Выполнение тренировки':initial ? 'Редактирование тренировки' : 'Новая тренировка'}</h1>
    <p className="editor-sub">Запиши выполненные упражнения и подходы</p>
    <div className="entry-toolbar"><h2>{title || 'Запись тренировки'}</h2><button className="primary">{saving?'Сохраняем…':mode==='workout'?'Завершить и сохранить':mode==='plan'?'Сохранить план':'Добавить в календарь'}</button></div>
    <div className="entry-layout"><div>    <section className="card meta"><label>Название<input name="name" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={120} placeholder="Например, силовая на ноги"/></label>
      {mode!=='plan' && <><label>Дата<input type="date" name="date" required defaultValue={initial?.workout_date ?? day}/></label>
      <label>Длительность, мин<input type="number" min="1" name="duration" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="По желанию"/></label></>}</section>
    <div className="line"><h2>Упражнения</h2><span>{moves.length} упр. · {allSets.length} подх.</span>
      {mode === 'workout' && <button type="button" disabled={counted.length === allSets.length}
        onClick={() => setMoves(items => items.map(move => ({
          ...move, sets: move.sets.map(set => ({...set, completed: true}))
        })))}>Отметить все подходы выполненными</button>}
    </div>
    {moves.map((move, index) => {
      const exercise = exerciseById.get(move.id);
      const weightLabel = usesCounterweight(exercise) ? 'Противовес' : 'Вес';
      return <section className="card" key={move.key}>
      <div className="exercise-heading"><h2>{exercise?.name || "Упражнение "+(index+1)}</h2>
        {moves.length > 1 && <div className="actions">
          <button type="button" disabled={index === 0} onClick={() => moveExercise(index, -1)}>↑ Выше</button>
          <button type="button" disabled={index === moves.length - 1} onClick={() => moveExercise(index, 1)}>↓ Ниже</button>
          <button type="button" className="link" onClick={() => setMoves(moves.filter(m => m.key !== move.key))}>Убрать упражнение</button>
        </div>}
      </div>
      <ExercisePicker catalog={catalog} value={move.id} onChange={id => change({...move, id})}/>
      {usesCounterweight(exercise) && <p className="muted">Меньше противовес — меньше помощь. В общий объём входит только внешнее отягощение.</p>}
      <div className="set-head"><span>Подход</span><span>{weightLabel}</span><span>Повторы</span>{mode==='workout' && <span>Готово</span>}</div>
      {move.sets.map((set, i) => {
        function field(key: 'reps'|'weight', value: string) {
          change({...move, sets: move.sets.map(s => s.key === set.key ? {...s, [key]:value} : s)});
        }
        return <div key={set.key} className="set"><strong>#{i+1}</strong>
          <input aria-label={weightLabel+', кг — подход '+(i+1)} type="number" min="0" max="99999.99" step="0.01" placeholder="кг" value={set.weight} onChange={e=>field('weight',e.target.value)}/>
          <input aria-label={'Повторы — подход '+(i+1)} type="number" min="1" required value={set.reps} onChange={e=>field('reps',e.target.value)}/>
          {mode==='workout' ? <input className="done" type="checkbox" aria-label={'Выполнен подход '+(i+1)} checked={set.completed} onChange={e=>change({...move,sets:move.sets.map(s=>s.key===set.key?{...s,completed:e.target.checked}:s)})}/> : <span/>}
          {move.sets.length > 1 && <button className="link remove" type="button" aria-label={'Убрать подход '+(i+1)} onClick={() => change({...move, sets:move.sets.filter(s => s.key !== set.key)})}>×</button>}
        </div>;
      })}
      <button className="link" type="button" disabled={move.sets.length >= 50} onClick={() => change({...move,sets:[...move.sets,newSet(move.sets.at(-1))]})}>+ Подход</button>
    </section>})}
    {mode==='workout' && !initial && <label className="tick"><input type="checkbox" name="save_plan"/>Также сохранить как план</label>}
    <div className="actions"><button type="button" disabled={moves.length >= 50} onClick={() => setMoves([...moves,newMove(String(catalog[0].id))])}>+ Упражнение</button>

      <CustomExercise catalog={catalog} disabled={moves.length >= 50} saved={exercise => {
        onCreateExercise(exercise);
        setMoves(items => [...items, newMove(String(exercise.id))]);
      }}/>
      {mode==='workout' && !initial && <button value="plan">Сохранить только план</button>}</div>
    </div><section className="entry-side"><div className="card"><h2>Сводка тренировки</h2>
    {[['Упражнения',moves.length],['Подходы',mode==='workout'?counted.length+' / '+allSets.length:allSets.length],['Общий объём',volume.toLocaleString('ru-RU')+' кг'],['Длительность',duration?duration+' мин':'—']].map(([k,v])=><div className="summary-line" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
    <div className="card"><h3>Как работают записи?</h3><p>Фактическая тренировка сохраняется отдельно от шаблона плана.</p></div></section></div>
    {error && <p role="alert">{error}</p>}
  </fieldset></form>;
}

function App() {
  const [catalog,setCatalog] = useState<Exercise[]>([]);
  const addToCatalog = (exercise: Exercise) => setCatalog(items =>
    [...items, exercise].sort((a,b) => a.name.localeCompare(b.name,'ru')));
  const regions = [...new Set(catalog.flatMap(exercise => exercise.regions))].sort((a,b)=>a.localeCompare(b,'ru'));
  const [history,setHistory] = useState<Workout[]>([]);
  const [editor,setEditor] = useState(false);
  const [page,setPage] = useState<'overview'|'history'|'catalog'|'plans'|'profile'|'recommendations'>('overview');
  const [period,setPeriod]=useState('month');
  const [query,setQuery]=useState('');
  const [dateFilter,setDateFilter]=useState('');
  const [weekStart,setWeekStart]=useState(()=>{const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return d});
  const filteredHistory=history.filter(w=>(!dateFilter||w.workout_date===dateFilter)&&w.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  function shiftWeek(weeks:number){const d=new Date(weekStart);d.setDate(d.getDate()+7*weeks);setWeekStart(d);setDateFilter('')}
  const [profile,setProfile]=useState<ProfileData>({});
  const goal = profile.goal && regions.includes(profile.goal) ? profile.goal : '';
  const [mode,setMode]=useState<Mode>('workout');
  const [day,setDay]=useState(today);
  const [schedule,setSchedule]=useState<Workout[]>([]);
  const [plans,setPlans] = useState<Plan[]>([]);
  const [template,setTemplate] = useState<Plan>();
  const [selected,setSelected] = useState<number[]>([]);
  const [initial,setInitial] = useState<Workout>();
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [saved,setSaved] = useState<number>();
  const [revision,reload] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([request<Exercise[]>('/api/exercises'),request<Workout[]>(journal),request<Plan[]>('/api/local/plans'),request<Workout[]>(journal+'?status=draft'),request<ProfileData>('/api/local/profile')])
      .then(([items,rows,templates,drafts,person]) => {if(active){setCatalog(items);setHistory(rows);setPlans(templates);setSchedule(drafts);setProfile(person)}})
      .catch(err => {if(active)setError(message(err))})
      .finally(() => {if(active)setLoading(false)});
    return () => {active=false};
  },[revision]);
  function navigate(target: typeof page) {
    setEditor(false); setPage(target); setNotice('');
  }
  function edit(row?: Workout, plan?: Plan, next:Mode='workout') {
    setMode(next);
    setTemplate(plan);
    setInitial(row); setEditor(true); setNotice('');
  }
  async function savePlan(workout: Workout) {
    const name=window.prompt('Название плана',workout.name);
    if (name===null) return;
    setBusy(true);
    try {
      await request('/api/local/plans',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,workout_id:workout.id})});
      navigate('plans');setNotice('План сохранён.');reload(n=>n+1);
    } catch (err) {setNotice(message(err))}
    finally {setBusy(false)}
  }
  async function deletePlan(plan: Plan) {
    if (!window.confirm('Удалить план «'+plan.name+'»? Записанные тренировки сохранятся.')) return;
    setBusy(true);
    try {
      await request('/api/local/plans/'+plan.id,{method:'DELETE'});
      setPlans(items=>items.filter(item=>item.id!==plan.id));setNotice('План удалён.');
    } catch (err) {setNotice(message(err))}
    finally {setBusy(false)}
  }
  async function remove(row: Workout) {
    if (!window.confirm('Удалить тренировку «'+row.name+'» вместе со всеми подходами?')) return;
    setBusy(true);
    try {
      await request(journal+'/'+row.id+(row.status==='draft'?'?status=draft':''), {method:'DELETE'});
      setSchedule(items=>items.filter(w=>w.id!==row.id));
      setHistory(items => items.filter(w => w.id !== row.id)); setSaved(undefined);
      setNotice('Тренировка удалена.');
    } catch (err) {setNotice(message(err))}
    finally {setBusy(false)}
  }
  return <div className="shell"><aside><b className="brand"><i/>FORMA</b><span className="nav-label">Навигация</span><nav>
    <button aria-current={!editor && page==='overview' ? 'page' : undefined} onClick={() => navigate('overview')}><img src="/forma/overview.svg" alt=""/>Обзор</button>
    <button aria-current={!editor && page==='history' ? 'page' : undefined} onClick={() => navigate('history')}><img src="/forma/history.svg" alt=""/>Журнал тренировок</button>
    <button aria-current={!editor && page==='catalog' ? 'page' : undefined} onClick={() => navigate('catalog')}><img src="/forma/catalog.svg" alt=""/>Упражнения</button>
    <button aria-current={!editor && page==='recommendations'?'page':undefined} onClick={()=>navigate('recommendations')}><img src="/forma/recommendations.svg" alt=""/>Рекомендации</button>
    <button aria-current={!editor && page==='plans' ? 'page' : undefined} onClick={()=>navigate('plans')}><img src="/forma/plans.svg" alt=""/>Мои планы</button>
    </nav><small>Локальный профиль</small></aside><main>
    <div className="profile-access"><button aria-label="Профиль" title="Профиль" aria-current={!editor && page==='profile'?'page':undefined} onClick={()=>navigate('profile')}><img src="/forma/profile.svg" alt=""/></button></div>
    {editor ? <Editor onCreateExercise={addToCatalog} mode={mode} day={mode==='schedule'?day:today()} template={template} catalog={catalog} initial={initial} selected={page==='catalog'||page==='recommendations' ? selected : []} onClose={() => navigate(page)} onSave={(id,target,date) => {
      if(target==='schedule') setDay(date);
      if(target==='workout'){setQuery('');setDateFilter('')}
      if(page==='catalog') setSelected([]);
      setSaved(id);setEditor(false);setPage(target==='workout'?'history':'plans');setNotice(target==='plan'?'План сохранён.':target==='schedule'?'Занятие запланировано.':'Тренировка сохранена.');reload(n => n+1)}}/> :
      <><div className="line hero"><div><h1>{page==='profile'?'Профиль':page==='recommendations'?'Рекомендации':page==='plans' ? 'Мои планы' : page==='catalog' ? 'Каталог упражнений' : page==='overview' ? 'Обзор' : 'Журнал тренировок'}</h1>
      <p>{page==='profile'?'Личные параметры, цели и настройки аккаунта':page==='recommendations'?'Упражнения, подходящие под твою цель':page==='plans' ? 'Шаблоны, по которым удобно начинать тренировку' : page==='catalog' ? 'Найди упражнения по мышцам, сложности и оборудованию' : page==='overview' ? 'Аналитика тренировок и твой прогресс' : 'История занятий, достижения и подробности'}</p></div>
      </div>{(page==='overview' || page==='history') && <div className="entry-toolbar"><h2>{page==='overview'?(period==='month'?'Статистика за месяц':period==='7'?'Статистика за неделю':'Статистика за '+(period==='30'?'30 дней':'год')):'История занятий'}</h2>{page==='overview' && <div className="period">{[['7','7 дней'],['30','30 дней'],['year','Год']].map(([id,label])=><button key={id} aria-pressed={period===id} onClick={()=>setPeriod(period===id?'month':id)}>{label}</button>)}</div>}<button className="primary" disabled={loading || !!error || !catalog.length} onClick={() => edit()}>+ Добавить тренировку</button></div>}
      {notice && <p role="status">{notice}</p>}
      {loading ? <p>Загружаем журнал…</p> : error ? <p role="alert">{error} <button onClick={() => reload(n => n+1)}>Повторить</button></p> :
        <>{!catalog.length && <p>Каталог пуст. Для локального показа загрузите упражнения миграцией 002_catalog_ru.sql.</p>}
         {page==='profile'?<Profile data={profile} regions={regions} goal={goal} onSave={p=>{setProfile(p);setNotice('Профиль сохранён.')}}/>:page==='recommendations'?<Recommendations catalog={catalog} goal={goal} toProfile={()=>navigate('profile')} toPlan={ids=>{setSelected(ids);edit(undefined,undefined,'plan')}}/>:page==='plans' ? <div className="plans-layout"><section className="plan-list"><div className="line"><h2>Тренировочные планы</h2><button disabled={!catalog.length} onClick={()=>edit(undefined,undefined,'plan')}>+ Создать план</button></div>{!plans.length && <section className="card"><h2>Пока нет планов</h2>
           <p>Раскройте тренировку в журнале и выберите «Сохранить как план».</p>
           <button onClick={()=>navigate('history')}>Открыть журнал</button></section>}
           {plans.map(plan=><section className="card" key={plan.id}><h2>{plan.name}</h2>
             {plan.exercises.map((move,i)=><div className="record" key={i}><b>{move.name}</b>
             <ol>{move.sets.map((set,j)=><li key={j}>{set.reps} повт. · {describeWeight(set.weight_kg,catalog.find(e=>e.id===move.exercise_id))}</li>)}</ol></div>)}
             <div className="record-actions"><button className="primary" disabled={busy} onClick={()=>edit(undefined,plan)}>Начать тренировку</button>
             <button onClick={()=>edit(undefined,plan,'plan')}>Изменить план</button>
             <button className="danger" disabled={busy} onClick={()=>deletePlan(plan)}>Удалить план</button></div></section>)}</section><Calendar canSchedule={catalog.length>0} day={day} select={setDay} entries={schedule} plans={plans} onStart={row=>edit(row)} onCancel={remove}
          onSchedule={id=>edit(undefined,plans.find(p=>p.id===id),'schedule')}/></div> :
           page==='catalog' ? <><CustomExercise catalog={catalog} saved={exercise=>{addToCatalog(exercise);setNotice('Упражнение добавлено.')}}/><Catalog items={catalog} selected={selected} onSelect={setSelected} onStart={()=>edit()}/></> : page==='overview' ? <Overview period={period} history={history} catalog={catalog} month={today().slice(0,7)}
          openJournal={id => {setSaved(id);setQuery('');setDateFilter('');navigate('history')}}/> : <><div className="card history-filter"><h2>Все тренировки</h2><input aria-label="Поиск по названию тренировки" type="search" placeholder="Поиск по названию" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <section className="card"><div className="line"><h2>{weekStart.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</h2><div><button onClick={()=>shiftWeek(-1)} aria-label="Предыдущая неделя">‹</button> <button onClick={()=>shiftWeek(1)} aria-label="Следующая неделя">›</button></div></div>
        <div className="week-strip">{Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);const key=d.toLocaleDateString('sv-SE');return <button key={key} aria-pressed={key===dateFilter} onClick={()=>setDateFilter(dateFilter===key?'':key)}><small>{d.toLocaleDateString('ru-RU',{weekday:'short'})}</small><b>{d.getDate()}</b></button>})}</div></section>
        <div className="line"><h2>Последние записи</h2><span>Найдено: {filteredHistory.length}</span></div>
        {history.length>0 && !filteredHistory.length && <p>За выбранный день и по этому запросу записей нет.</p>}
        {!history.length && <section className="card"><h2>Пока нет тренировок</h2><p>Добавьте первую тренировку, чтобы записать упражнения и подходы.</p></section>}
        {filteredHistory.map(w => <details className="card" key={w.id} open={saved===w.id || undefined}><summary>
          <span className="date">{new Date(w.workout_date+'T12:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</span>
          <strong>{w.name}</strong><span>Упражнений: {w.exercises.length}{w.duration_minutes && ' · '+w.duration_minutes+' мин'}</span></summary>
          {w.exercises.map((m,i) => <section key={i} className="record"><h3>{m.name}</h3><ol>{m.sets.map((s,j) =>
            <li key={j}>{(s.completed ?? m.completed)===false?'Пропущен':'Выполнен'} · {s.reps} повт. · {describeWeight(s.weight_kg,catalog.find(e=>e.id===m.exercise_id))}</li>)}</ol></section>)}
        <div className="record-actions"><button disabled={busy} onClick={()=>savePlan(w)}>Сохранить как план</button><button disabled={busy} onClick={() => edit(w)}>Изменить</button>
          <button disabled={busy} className="danger" onClick={() => remove(w)}>Удалить</button></div>
        </details>)}</>}</>}</>}
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
