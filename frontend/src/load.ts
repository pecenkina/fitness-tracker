import type {Exercise} from './main';

export function usesCounterweight(exercise?: Exercise) {
  return exercise?.equipment.includes('Гравитрон') ?? false;
}

export function describeWeight(weight: number | null, exercise?: Exercise) {
  if (usesCounterweight(exercise)) return weight === null ? 'противовес не указан' : 'противовес ' + weight + ' кг';
  if (weight === null) return 'вес не указан';
  return weight === 0 ? 'свой вес' : weight + ' кг';
}
