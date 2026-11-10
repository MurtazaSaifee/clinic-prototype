import type { Criterion } from './types.ts';

export function describeCriterion(criterion: Criterion) {
  if (criterion.type === 'DIAGNOSIS') {
    return `${criterion.label} (diagnosis code starting ${criterion.icd10_prefixes.join(' or ')})`;
  }
  const { min, max } = criterion;
  if (min !== undefined && max !== undefined) return `Aged ${min} to ${max}`;
  if (min !== undefined) return `Aged ${min} or older`;
  if (max !== undefined) return `Aged ${max} or younger`;
  return 'Any age';
}
