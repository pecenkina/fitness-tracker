import {useEffect, useState, type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

type Exercise = {id: number; name: string};
type Workout = {id: number; name: string; workout_date: string; duration_minutes: number | null;
  exercises: {name: string; exercise_id: number; sets: {reps: number; weight_kg: number | null}[]}[]};
type DraftSet = {key: number; reps: string; weight: string};
type DraftMove = {key: number; id: string; sets: DraftSet[]};
let nextKey = 0;
const newSet = (): DraftSet => ({key: ++nextKey, reps: '10', weight: ''});
const newMove = (id: string): DraftMove => ({key: ++nextKey, id, sets: [newSet()]});
const journal = '/api/local/workouts';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Не удалось выполнить запрос. Проверьте подключение к серверу.');
  }
  return response.json();
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Ошибка запроса';
function today() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
}

function Editor({catalog, onClose, onSave}: {catalog: Exercise[]; onClose: () => void; onSave: (id: number) => void}) {
  const [moves, setMoves] = useState(() => [newMove(String(catalog[0].id))]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = (move: DraftMove) => setMoves(items => items.map(item => item.key === move.key ? move : item));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      const result = await request<{id: number}>(journal, {method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({name: fields.get('name'), workout_date: fields.get('date'),
          duration_minutes: fields.get('duration') ? Number(fields.get('duration')) : null,
          exercises: moves.map(move => ({exercise_id: Number(move.id), sets: move.sets.map(set =>
            ({reps: Number(set.reps), weight_kg: set.weight === '' ? null : Number(set.weight)}))}))})});
      onSave(result.id);
    } catch (err) {setError(message(err)); setSaving(false)}
  }
  return <form onSubmit={submit}><fieldset disabled={saving} className="plain">
    <button type="button" className="link" onClick={onClose}>← В историю</button>
    <h1>Новая тренировка</h1>
    <section className="card meta"><label>Название<input name="name" required maxLength={120} placeholder="Например, силовая на ноги"/></label>
      <label>Дата<input type="date" name="date" required defaultValue={today()}/></label>
      <label>Длительность, мин<input type="number" min="1" name="duration" placeholder="По желанию"/></label></section>
    {moves.map((move, index) => <section className="card" key={move.key}>
      <div className="line"><h2>Упражнение {index+1}</h2>{moves.length > 1 && <button type="button" className="link" onClick={() => setMoves(moves.filter(m => m.key !== move.key))}>Убрать упражнение</button>}</div>
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
    <div className="actions"><button type="button" disabled={moves.length >= 50} onClick={() => setMoves([...moves,newMove(String(catalog[0].id))])}>+ Упражнение</button>
      <button className="primary">{saving ? 'Сохраняем…' : 'Сохранить тренировку'}</button></div>
    {error && <p role="alert">{error}</p>}
  </fieldset></form>;
}

function App() {
  const [catalog,setCatalog] = useState<Exercise[]>([]);
  const [history,setHistory] = useState<Workout[]>([]);
  const [editor,setEditor] = useState(false);
  const [saved,setSaved] = useState<number>();
  const [revision,reload] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([request<Exercise[]>('/api/exercises'),request<Workout[]>(journal)])
      .then(([items,rows]) => {if(active){setCatalog(items);setHistory(rows)}})
      .catch(err => {if(active)setError(message(err))})
      .finally(() => {if(active)setLoading(false)});
    return () => {active=false};
  },[revision]);
  return <><header><div><b>Дневник тренировок</b><span>Локальный профиль</span></div></header><main>
    {editor ? <Editor catalog={catalog} onClose={() => setEditor(false)} onSave={id => {setSaved(id);setEditor(false);reload(n => n+1)}}/> :
      <><div className="line hero"><h1>История тренировок</h1><button className="primary" disabled={loading || !!error || !catalog.length} onClick={() => setEditor(true)}>+ Добавить тренировку</button></div>
      {saved && <p role="status">Тренировка сохранена.</p>}
      {loading ? <p>Загружаем журнал…</p> : error ? <p role="alert">{error} <button onClick={() => reload(n => n+1)}>Повторить</button></p> :
        <>{!catalog.length && <p>Каталог пуст. Для локального показа загрузите упражнения миграцией 002_catalog_ru.sql.</p>}
        {!history.length && <section className="card"><h2>Пока нет тренировок</h2><p>Добавьте первую тренировку, чтобы записать упражнения и подходы.</p></section>}
        {history.map(w => <details className="card" key={w.id} open={saved===w.id || undefined}><summary>
          <span className="date">{new Date(w.workout_date+'T12:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</span>
          <strong>{w.name}</strong><span>Упражнений: {w.exercises.length}{w.duration_minutes && ' · '+w.duration_minutes+' мин'}</span></summary>
          {w.exercises.map((m,i) => <section key={i} className="record"><h3>{m.name}</h3><ol>{m.sets.map((s,j) =>
            <li key={j}>{s.reps} повт. · {s.weight_kg === null ? 'вес не указан' : s.weight_kg === 0 ? 'свой вес' : s.weight_kg+' кг'}</li>)}</ol></section>)}
        </details>)}</>}</>}
  </main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
