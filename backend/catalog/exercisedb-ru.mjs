// Русские тексты редактируются отдельно от данных поставщика.
const cards = new Map([
  ['EIeI8Vf', {
    name: 'Жим штанги лёжа',
    instructions: [
      'Лягте на скамью и поставьте стопы на пол.',
      'Возьмитесь за гриф прямым хватом немного шире плеч.',
      'Удерживайте корпус устойчиво, а кисти на одной линии с предплечьями.',
      'Выжмите штангу вверх, сохраняя устойчивое положение корпуса.',
      'Держите кисти над предплечьями и двигайтесь по комфортной для плеч траектории.',
      'Плавно опустите штангу в исходное положение перед следующим повторением.'
    ]
  }]
]);

const muscles = new Map(Object.entries({
  pectorals: 'Грудные мышцы', triceps: 'Трицепсы', deltoids: 'Дельтовидные мышцы',
  biceps: 'Бицепсы', quads: 'Квадрицепсы', glutes: 'Ягодичные мышцы',
  hamstrings: 'Мышцы задней поверхности бедра', calves: 'Икроножные мышцы',
  lats: 'Широчайшие мышцы спины', abs: 'Мышцы живота'
}));
const regions = new Map(Object.entries({
  chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', waist: 'Талия',
  'upper arms': 'Плечевая часть рук', 'lower arms': 'Предплечья',
  'upper legs': 'Бёдра', 'lower legs': 'Голени'
}));
const equipment = new Map(Object.entries({
  barbell: 'Штанга', dumbbell: 'Гантели', kettlebell: 'Гиря',
  'body weight': 'Собственный вес', cable: 'Блочный тренажёр', band: 'Резиновая лента'
}));

// null позволяет интерфейсу явно отметить отсутствующий перевод.
function labels(terms, dictionary) {
  return terms.map(key => ({ key, ru: dictionary.get(key) ?? null }));
}

export function localizeExercise(exercise) {
  const card = cards.get(exercise.exerciseId);
  return {
    source: 'ExerciseDB by AscendAPI',
    sourceKey: exercise.exerciseId,
    name: { en: exercise.name, ru: card?.name ?? null },
    instructions: { en: [...exercise.instructions], ru: card ? [...card.instructions] : null },
    targetMuscles: labels(exercise.targetMuscles, muscles),
    secondaryMuscles: labels(exercise.secondaryMuscles, muscles),
    bodyParts: labels(exercise.bodyParts, regions),
    equipment: labels(exercise.equipments, equipment),
    gifUrl: exercise.gifUrl
  };
}
