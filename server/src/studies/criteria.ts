import { z } from 'zod';

const ageBetween = z
  .object({
    type: z.literal('AGE_BETWEEN'),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(0).optional(),
  })
  .refine((c) => c.min === undefined || c.max === undefined || c.min <= c.max, {
    message: 'min must not be above max',
    path: ['max'],
  });

const diagnosis = z.object({
  type: z.literal('DIAGNOSIS'),
  icd10_prefixes: z.array(z.string().trim().min(1)).min(1),
  label: z.string().trim().min(1),
});

export const criterionSchema = z.discriminatedUnion('type', [ageBetween, diagnosis]);
export const criteriaSchema = z.array(criterionSchema).min(1);

export type Criterion = z.infer<typeof criterionSchema>;
export type CriterionResult = { criterion: Criterion; met: boolean; evidence: string };
export type DiagnosisFact = { icd10_code: string; description: string; diagnosed_on: string };

// Whole years between two YYYY-MM-DD dates; a birthday on `today` counts.
export function ageOn(dateOfBirth: string, today: string) {
  const years = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return today.slice(5) < dateOfBirth.slice(5) ? years - 1 : years;
}

function ageRange(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${min} to ${max} required`;
  if (min !== undefined) return `${min} or older required`;
  if (max !== undefined) return `${max} or younger required`;
  return 'any age';
}

function evaluateOne(criterion: Criterion, dateOfBirth: string, diagnoses: DiagnosisFact[], today: string): CriterionResult {
  if (criterion.type === 'AGE_BETWEEN') {
    const age = ageOn(dateOfBirth, today);
    const met = (criterion.min === undefined || age >= criterion.min) && (criterion.max === undefined || age <= criterion.max);
    return { criterion, met, evidence: `Age ${age} (${ageRange(criterion.min, criterion.max)})` };
  }

  const prefixes = criterion.icd10_prefixes.map((p) => p.toUpperCase());
  const found = diagnoses.filter((d) => prefixes.some((p) => d.icd10_code.toUpperCase().startsWith(p)));
  if (found.length === 0) {
    return { criterion, met: false, evidence: `No diagnosis starting ${prefixes.join(' or ')}` };
  }
  const evidence = found.map((d) => `${d.icd10_code} ${d.description}, diagnosed ${d.diagnosed_on}`).join('; ');
  return { criterion, met: true, evidence };
}

// Pure: `today` is passed in so results don't depend on the calendar, and the same output
// is both the match decision and the "why" shown to staff.
export function evaluate(
  criteria: Criterion[],
  patient: { date_of_birth: string },
  diagnoses: DiagnosisFact[],
  today: string,
): CriterionResult[] {
  return criteria.map((criterion) => evaluateOne(criterion, patient.date_of_birth, diagnoses, today));
}

export function meetsAll(results: CriterionResult[]) {
  return results.every((r) => r.met);
}
