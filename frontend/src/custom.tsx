import {useState,type FormEvent} from 'react';
export function CustomExercise({muscles,equipment,saved}:{muscles:string[];equipment:string[];saved:()=>void}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');
    try {
      const result=await fetch('/api/local/exercises',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});
      if(!result.ok) throw new Error((await result.json()).error);
      setOpen(false);saved();
    }catch(err){setError(err instanceof Error ? err.message : 'Ошибка сохранения')}
    finally{setBusy(false)}
  }
  if(!open) return <button onClick={()=>setOpen(true)}>+ Своё упражнение</button>;
  return <form className="card" onSubmit={submit}><fieldset className="plain" disabled={busy}><h2>Своё упражнение</h2>
    <label>Название упражнения<input name="name" required maxLength={120}/></label>
    <label>Описание<input name="description" maxLength={500}/></label>
    <label>Оборудование<select name="equipment" defaultValue="">
      <option value="">Не указано</option>
      {equipment.map(item=><option key={item} value={item}>{item}</option>)}
    </select></label>
    <label>Мышцы<select name="muscle"><option value="">Не указаны</option>{muscles.map(m=><option key={m}>{m}</option>)}</select></label>
    <label>Сложность<select name="difficulty"><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select></label>
    <div className="record-actions"><button className="primary">Сохранить упражнение</button><button type="button" onClick={()=>setOpen(false)}>Отмена</button></div>
    {error && <p role="alert">{error}</p>}</fieldset></form>;
}
