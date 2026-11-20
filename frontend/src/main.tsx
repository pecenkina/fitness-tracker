import {useEffect, useState, type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {Calendar} from './calendar';
import {CustomExercise} from './custom';
import {Catalog} from './catalog';
import {Overview} from './overview';
import './style.css';

export type Exercise = {id: number; name: string; description: string; equipment: string[]; difficulty: 'beginner'|'intermediate'|'advanced'; muscles: string[]};
export type Workout = {id: number; name: string; workout_date: string; status?: string; duration_minutes: number | null;
  exercises: {completed?: boolean; name: string; exercise_id: number; sets: {reps: number; weight_kg: number | null}[]}[]};
type Plan = Pick<Workout,'id'|'name'|'exercises'>;
type DraftSet = {key: number; reps: string; weight: string};
type DraftMove = {completed:boolean; key: number; id: string; sets: DraftSet[]};
let nextKey = 0;
const newSet = (): DraftSet => ({key: ++nextKey, reps: '10', weight: ''});
const newMove = (id: string): DraftMove => ({completed:true,key: ++nextKey, id, sets: [newSet()]});
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
function Editor({mode,day,catalog, initial, template, selected, onClose, onSave}: {mode:Mode; day:string; template?: Plan; selected: number[]; initial?: Workout; catalog: Exercise[]; onClose: () => void; onSave: (id: number, mode:Mode, date:string) => void}) {
  const source = initial ?? template;
  const [moves, setMoves] = useState<DraftMove[]>(() => source ? source.exercises.map(m => ({completed:initial ? m.completed ?? true : false,key: ++nextKey, id: String(m.exercise_id),
    sets: m.sets.map(s => ({key: ++nextKey, reps: String(s.reps), weight: String(s.weight_kg ?? '')}))})) : (selected.length ? selected : [catalog[0].id]).map(id => newMove(String(id))));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = (move: DraftMove) => setMoves(items => items.map(item => item.key === move.key ? move : item));
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
          exercises: moves.map(move => ({completed:target==='schedule'?false:move.completed,exercise_id: Number(move.id), sets: move.sets.map(set =>
            ({reps: Number(set.reps), weight_kg: set.weight === '' ? null : Number(set.weight)}))}))})});
      onSave(result.id,target,String(fields.get('date') ?? day));
    } catch (err) {setError(message(err)); setSaving(false)}
  }
  return <form onSubmit={submit}><fieldset disabled={saving} className="plain">
    <button type="button" className="link" onClick={onClose}>← Назад</button>
    <h1>{mode==='plan' ? (template?'Редактирование плана':'Новый план') : mode==='schedule'?'Запланировать тренировку':initial?.status==='draft'?'Выполнение тренировки':initial ? 'Редактирование тренировки' : 'Новая тренировка'}</h1>
    <section className="card meta"><label>Название<input name="name" defaultValue={source?.name} required maxLength={120} placeholder="Например, силовая на ноги"/></label>
      {mode!=='plan' && <><label>Дата<input type="date" name="date" required defaultValue={initial?.workout_date ?? day}/></label>
      <label>Длительность, мин<input type="number" min="1" name="duration" defaultValue={initial?.duration_minutes ?? ''} placeholder="По желанию"/></label></>}</section>
    {moves.map((move, index) => <section className="card" key={move.key}>
      <div className="line"><h2>Упражнение {index+1}</h2>{moves.length > 1 && <button type="button" className="link" onClick={() => setMoves(moves.filter(m => m.key !== move.key))}>Убрать упражнение</button>}</div>
      {mode==='workout' && <label className="tick"><input type="checkbox" checked={move.completed} onChange={e=>change({...move,completed:e.target.checked})}/>Упражнение выполнено</label>}
      <label>Из каталога<select value={move.id} onChange={e => change({...move,id:e.target.value})}>
        {catalog.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {move.sets.map((set, i) => {
        function field(key: 'reps'|'weight', value: string) {
          change({...move, sets: move.sets.map(s => s.key === set.key ? {...s, [key]:value} : s)});
        }
        return <div key={set.key} className="set"><strong>#{i+1}</strong>
          <label>Повторы<input type="number" min="1" required value={set.reps} onChange={e => field('reps',e.target.value)}/></label>
          <label>Вес, кг<input type="number" min="0" max="99999.99" step="0.01" placeholder="—" value={set.weight} onChange={e => field('weight',e.target.value)}/></label>
          {move.sets.length > 1 && <button className="link remove" type="button" aria-label={'Убрать подход '+(i+1)} onClick={() => change({...move, sets:move.sets.filter(s => s.key !== set.key)})}>×</button>}
        </div>;
      })}
      <button className="link" type="button" disabled={move.sets.length >= 50} onClick={() => change({...move,sets:[...move.sets,newSet()]})}>+ Подход</button>
    </section>)}
    {mode==='workout' && !initial && <label className="tick"><input type="checkbox" name="save_plan"/>Также сохранить как план</label>}
    <div className="actions"><button type="button" disabled={moves.length >= 50} onClick={() => setMoves([...moves,newMove(String(catalog[0].id))])}>+ Упражнение</button>
      <button className="primary">{saving ? 'Сохраняем…' : mode==='plan'?'Сохранить план':mode==='schedule'?'Добавить в календарь':'Сохранить тренировку'}</button>
      {mode==='workout' && !initial && <button value="plan">Сохранить только план</button>}</div>
    {error && <p role="alert">{error}</p>}
  </fieldset></form>;
}

function App() {
  const [catalog,setCatalog] = useState<Exercise[]>([]);
  const [history,setHistory] = useState<Workout[]>([]);
  const [editor,setEditor] = useState(false);
  const [page,setPage] = useState<'overview'|'history'|'catalog'|'plans'>('overview');
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
    Promise.all([request<Exercise[]>('/api/exercises'),request<Workout[]>(journal),request<Plan[]>('/api/local/plans'),request<Workout[]>(journal+'?status=draft')])
      .then(([items,rows,templates,drafts]) => {if(active){setCatalog(items);setHistory(rows);setPlans(templates);setSchedule(drafts)}})
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
  return <div className="shell"><aside><b className="brand">FORMA</b><nav>
    <button aria-current={!editor && page==='overview' ? 'page' : undefined} onClick={() => navigate('overview')}>Обзор</button>
    <button aria-current={!editor && page==='history' ? 'page' : undefined} onClick={() => navigate('history')}>Журнал тренировок</button>
    <button aria-current={!editor && page==='catalog' ? 'page' : undefined} onClick={() => navigate('catalog')}>Упражнения</button>
    <button aria-current={!editor && page==='plans' ? 'page' : undefined} onClick={()=>navigate('plans')}>Мои планы</button>
    </nav><small>Локальный профиль</small></aside><main>
    {editor ? <Editor mode={mode} day={mode==='schedule'?day:today()} template={template} catalog={catalog} initial={initial} selected={page==='catalog' ? selected : []} onClose={() => navigate(page)} onSave={(id,target,date) => {
      if(target==='schedule') setDay(date);
      if(page==='catalog') setSelected([]);
      setSaved(id);setEditor(false);setPage(target==='workout'?'history':'plans');setNotice(target==='plan'?'План сохранён.':target==='schedule'?'Занятие запланировано.':'Тренировка сохранена.');reload(n => n+1)}}/> :
      <><div className="line hero"><div><h1>{page==='plans' ? 'Мои планы' : page==='catalog' ? 'Каталог упражнений' : page==='overview' ? 'Обзор' : 'Журнал тренировок'}</h1>
      <p>{page==='plans' ? 'Шаблоны для повторяющихся тренировок' : page==='catalog' ? 'Выберите упражнения для своей тренировки' : page==='overview' ? 'Статистика за текущий месяц' : 'История занятий и подходов'}</p></div>
      {(page==='overview' || page==='history') && <button className="primary" disabled={loading || !!error || !catalog.length} onClick={() => edit()}>+ Добавить тренировку</button>}</div>
      {notice && <p role="status">{notice}</p>}
      {loading ? <p>Загружаем журнал…</p> : error ? <p role="alert">{error} <button onClick={() => reload(n => n+1)}>Повторить</button></p> :
        <>{!catalog.length && <p>Каталог пуст. Для локального показа загрузите упражнения миграцией 002_catalog_ru.sql.</p>}
         {page==='plans' ? <div className="plans-layout"><section className="plan-list"><div className="line"><h2>Тренировочные планы</h2><button disabled={!catalog.length} onClick={()=>edit(undefined,undefined,'plan')}>+ Создать план</button></div>{!plans.length && <section className="card"><h2>Пока нет планов</h2>
           <p>Раскройте тренировку в журнале и выберите «Сохранить как план».</p>
           <button onClick={()=>navigate('history')}>Открыть журнал</button></section>}
           {plans.map(plan=><section className="card" key={plan.id}><h2>{plan.name}</h2>
             {plan.exercises.map((move,i)=><div className="record" key={i}><b>{move.name}</b>
             <ol>{move.sets.map((set,j)=><li key={j}>{set.reps} повт. · {set.weight_kg===null?'вес не указан':set.weight_kg+' кг'}</li>)}</ol></div>)}
             <div className="record-actions"><button className="primary" disabled={busy} onClick={()=>edit(undefined,plan)}>Начать тренировку</button>
             <button onClick={()=>edit(undefined,plan,'plan')}>Изменить план</button>
             <button className="danger" disabled={busy} onClick={()=>deletePlan(plan)}>Удалить план</button></div></section>)}</section><Calendar canSchedule={catalog.length>0} day={day} select={setDay} entries={schedule} plans={plans} onStart={row=>edit(row)} onCancel={remove}
          onSchedule={id=>edit(undefined,plans.find(p=>p.id===id),'schedule')}/></div> :
           page==='catalog' ? <><CustomExercise muscles={[...new Set(catalog.flatMap(e=>e.muscles))]} saved={()=>{setNotice('Упражнение добавлено.');reload(n=>n+1)}}/><Catalog items={catalog} selected={selected} onSelect={setSelected} onStart={()=>edit()}/></> : page==='overview' ? <Overview history={history} catalog={catalog} month={today().slice(0,7)}
          openJournal={id => {setSaved(id);navigate('history')}}/> : <>{!history.length && <section className="card"><h2>Пока нет тренировок</h2><p>Добавьте первую тренировку, чтобы записать упражнения и подходы.</p></section>}
        {history.map(w => <details className="card" key={w.id} open={saved===w.id || undefined}><summary>
          <span className="date">{new Date(w.workout_date+'T12:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</span>
          <strong>{w.name}</strong><span>Упражнений: {w.exercises.length}{w.duration_minutes && ' · '+w.duration_minutes+' мин'}</span></summary>
          {w.exercises.map((m,i) => <section key={i} className="record"><h3>{m.name} · {m.completed===false?'Пропущено':'Выполнено'}</h3><ol>{m.sets.map((s,j) =>
            <li key={j}>{s.reps} повт. · {s.weight_kg === null ? 'вес не указан' : s.weight_kg === 0 ? 'свой вес' : s.weight_kg+' кг'}</li>)}</ol></section>)}
        <div className="record-actions"><button disabled={busy} onClick={()=>savePlan(w)}>Сохранить как план</button><button disabled={busy} onClick={() => edit(w)}>Изменить</button>
          <button disabled={busy} className="danger" onClick={() => remove(w)}>Удалить</button></div>
        </details>)}</>}</>}</>}
  </main></div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
