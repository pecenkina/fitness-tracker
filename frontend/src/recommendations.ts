import type {Exercise, Workout} from './main';

export function recommend(catalog: Exercise[], history: Workout[], goals: string[]) {
  const byId = new Map(catalog.map(e => [e.id, e]));
  const load = new Map<string, number>(catalog.flatMap(e => e.regions.map(region => [region, 0] as const)));
  let sessions = 0;
  // The journal returns the newest completed workouts first.
  for (const workout of history) {
    let counted = false;
    for (const move of workout.exercises) {
      const regions = byId.get(move.exercise_id)?.regions;
      if (!regions?.length) continue;
      const sets = move.sets.filter(set => set.completed ?? move.completed ?? true).length;
      if (!sets) continue;
      counted = true;
      for (const region of regions) load.set(region, (load.get(region) ?? 0) + sets / regions.length);
    }
    if (counted && ++sessions === 6) break;
  }
  const average = [...load.values()].reduce((sum, value) => sum + value, 0) / (load.size || 1);
  const targets = catalog.filter(e => e.regions.some(r => goals.includes(r)));
  const other = [...load.keys()].filter(r => !goals.includes(r) && load.get(r)! < average)
    .sort((a,b) => load.get(a)! - load.get(b)!);
  const seen = new Set(targets.map(e => e.id));
  const groups = other.map(region => catalog.filter(e => e.regions.includes(region) && !seen.has(e.id)));
  const rows: {exercise: Exercise; reason: string}[] = [];
  // Alternate goal exercises with underworked regions, rotating across tied groups.
  for (let i = 0; i < Math.max(targets.length, ...groups.map(g => g.length)); i++) {
    if (targets[i]) rows.push({exercise: targets[i], reason: 'По твоей цели'});
    groups.forEach((group, index) => {
      const e = group[i];
      if (e && !seen.has(e.id)) {
        rows.push({exercise:e, reason:'Для баланса · '+other[index]});
        seen.add(e.id);
      }
    });
  }
  return rows;
}
