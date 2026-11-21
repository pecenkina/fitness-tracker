import {useRef,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Exercise} from './main';

export function CustomExercise({catalog, saved, disabled = false}: {
  catalog: Exercise[]; saved: (exercise: Exercise) => void; disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const options = (key: 'equipment'|'muscles') =>
    [...new Set(catalog.flatMap(item => item[key]))].sort((a,b) => a.localeCompare(b,'ru'));
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();e.stopPropagation();setBusy(true);setError('');
    try {
      const result=await fetch('/api/local/exercises',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});
      if(!result.ok) throw new Error((await result.json()).error);
      const exercise: Exercise = await result.json();
      dialog.current?.close();
      saved(exercise);
    }catch(err){setError(err instanceof Error ? err.message : 'Ошибка сохранения')}
    finally{setBusy(false)}
  }
  return <><button type="button" disabled={disabled} onClick={()=>dialog.current?.showModal()}>+ Своё упражнение</button>
    {createPortal(<dialog ref={dialog} className="custom-dialog" aria-label="Своё упражнение"
      onCancel={event=>{if(busy) event.preventDefault()}}
      onClose={()=>{dialog.current?.querySelector('form')?.reset();setError('')}}>
    <form onSubmit={submit}><fieldset className="plain" disabled={busy}><h2>Своё упражнение</h2>
    <label>Название упражнения<input name="name" required maxLength={120}/></label>
    <label>Описание<input name="description" maxLength={500}/></label>
    <label>Оборудование<select name="equipment" defaultValue="">
      <option value="">Не указано</option>
      {options('equipment').map(item=><option key={item} value={item}>{item}</option>)}
    </select></label>
    <label>Мышцы<select name="muscle"><option value="">Не указаны</option>{options('muscles').map(m=><option key={m}>{m}</option>)}</select></label>
    <label>Сложность<select name="difficulty"><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select></label>
    <div className="record-actions"><button className="primary">Сохранить упражнение</button><button type="button" onClick={()=>dialog.current?.close()}>Отмена</button></div>
    {error && <p role="alert">{error}</p>}</fieldset></form></dialog>, document.body)}</>;
}
