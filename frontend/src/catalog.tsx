import {useState} from 'react';
import type {Exercise} from './main';

const levels = {beginner:'Начальный', intermediate:'Средний', advanced:'Продвинутый'};
export const normalize = (value: string) => value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё','е');

function Filter({label, value, options, onChange}: {
  label:string; value:string; options:string[]; onChange:(value:string)=>void;
}) {
  return <label>{label}<select value={value} onChange={event=>onChange(event.target.value)}>
    <option value="">Все</option>{options.map(option=><option key={option}>{option}</option>)}
  </select></label>;
}

export function Catalog({items, selected, onSelect, onStart}: {
  items: Exercise[]; selected:number[]; onSelect:(ids:number[])=>void; onStart:()=>void;
}) {
  const [search,setSearch]=useState('');
  const [muscle,setMuscle]=useState('');
  const [equipment,setEquipment]=useState('');
  const [level,setLevel]=useState('');
  const visible=items.filter(item=>normalize(item.name).includes(normalize(search)) &&
    (!muscle || item.muscles.includes(muscle)) && (!equipment || item.equipment.includes(equipment)) &&
    (!level || levels[item.difficulty]===level));
  const options=(key:'muscles'|'equipment')=>Array.from(new Set(items.flatMap(e=>e[key]))).sort((a,b)=>a.localeCompare(b,'ru'));
  function reset() {setSearch('');setMuscle('');setEquipment('');setLevel('')}
  return <><section className="card catalog-filters">
    <label>Поиск по названию<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Например, жим"/></label>
    <Filter label="Группа мышц" value={muscle} options={options('muscles')} onChange={setMuscle}/>
    <Filter label="Оборудование" value={equipment} options={options('equipment')} onChange={setEquipment}/>
    <Filter label="Сложность" value={level} options={Object.values(levels)} onChange={setLevel}/>
    <button type="button" className="link" disabled={!search && !muscle && !equipment && !level} onClick={reset}>Сбросить фильтры</button>
  </section><div className="line selection"><p aria-live="polite">Найдено упражнений: {visible.length} · Выбрано: {selected.length}</p>
    <button className="primary" disabled={!selected.length} onClick={onStart}>Создать тренировку</button></div>
  {visible.length===0 && items.length>0 && <p>По этим условиям ничего не найдено. Попробуйте изменить фильтры.</p>}
  <div className="catalog-grid">{visible.map(item=>{
    const checked=selected.includes(item.id);
    return <article key={item.id} className={'card exercise-card'+(checked?' selected':'')}>
      <h2>{item.name}</h2>{item.source==='custom' && <small>Пользовательское</small>}<p>{item.description}</p><dl>
        <dt>Мышцы</dt><dd>{item.muscles.join(', ') || 'Не указаны'}</dd>
        <dt>Оборудование</dt><dd>{item.equipment.join(', ') || 'Не указано'}</dd>
        <dt>Сложность</dt><dd>{levels[item.difficulty]}</dd></dl>
      <button aria-pressed={checked} disabled={!checked && selected.length>=50} onClick={()=>onSelect(checked ? selected.filter(id=>id!==item.id) : [...selected,item.id])}>
        {checked?'Убрать из тренировки':'+ В тренировку'}</button></article>;
  })}</div></>;
}
