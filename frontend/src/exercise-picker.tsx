import {useEffect, useId, useRef, useState} from 'react';
import {normalize} from './catalog';
import type {Exercise} from './main';

export function ExercisePicker({catalog, value, onChange}: {
  catalog: Exercise[]; value: string; onChange: (id: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);
  const selected = catalog.find(item => String(item.id) === value);
  const search = normalize(query);
  const matches = catalog.filter(item => normalize(item.name).includes(search));

  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({block: 'nearest'});
  }, [open, active]);

  function close() {
    setOpen(false);
    setQuery('');
    setActive(-1);
  }

  function choose(item: Exercise) {
    onChange(String(item.id));
    close();
  }

  return <div className="exercise-picker">
    <label>Из каталога
      <input role="combobox" autoComplete="off" aria-autocomplete="list"
        aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && matches[active] ? listId + '-' + matches[active].id : undefined}
        placeholder="Поиск по названию" value={open ? query : selected?.name ?? ''}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={close}
        onChange={event => {setQuery(event.target.value); setActive(-1); setOpen(true)}}
        onKeyDown={event => {
          if (event.key === 'Escape') {event.preventDefault(); close()}
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive(event.key === 'ArrowDown' ? Math.min(active + 1, matches.length - 1)
              : active < 0 ? matches.length - 1 : Math.max(0, active - 1));
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (!open) setOpen(true);
            else if (matches[active < 0 ? 0 : active]) choose(matches[active < 0 ? 0 : active]);
          }
        }}/>
    </label>
    {open && <div className="exercise-options">
      <ul role="listbox" aria-label="Упражнения из каталога" id={listId} ref={list}>
        {matches.map((item, i) => <li key={item.id} id={listId + '-' + item.id} role="option"
          aria-selected={String(item.id) === value} className={i === active ? 'active' : ''}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>{item.name}</li>)}
      </ul>
      {!matches.length && <p role="status">Упражнений с таким названием нет</p>}
    </div>}
  </div>;
}
