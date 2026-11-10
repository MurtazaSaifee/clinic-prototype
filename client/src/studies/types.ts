export type Criterion =
  | { type: 'AGE_BETWEEN'; min?: number; max?: number }
  | { type: 'DIAGNOSIS'; icd10_prefixes: string[]; label: string };

export type CriterionResult = { criterion: Criterion; met: boolean; evidence: string };

export type Study = { id: number; name: string; description: string; criteria: Criterion[] };

export type Match = {
  patient: { id: number; name: string; date_of_birth: string; phone: string };
  reasons: CriterionResult[];
};
