import { db } from '../db.ts';
import type { CandidateStatus } from '../enums.ts';
import { criteriaSchema } from './criteria.ts';
import type { Criterion, CriterionResult, DiagnosisFact } from './criteria.ts';

export type Study = { id: number; name: string; description: string; criteria: Criterion[] };

export type ScreenedPatient = {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  diagnoses: DiagnosisFact[];
};

// Criteria are parsed on the way out too, so a bad row fails loudly instead of matching wrongly.
function toStudy(row: { id: number; name: string; description: string; criteria: unknown }): Study {
  return { ...row, criteria: criteriaSchema.parse(row.criteria) };
}

export async function listStudies(): Promise<Study[]> {
  const rows = await db('clinical_studies').select('id', 'name', 'description', 'criteria').orderBy('id');
  return rows.map(toStudy);
}

export async function findStudy(id: number): Promise<Study | undefined> {
  const row = await db('clinical_studies').select('id', 'name', 'description', 'criteria').where({ id }).first();
  return row && toStudy(row);
}

async function withDiagnoses(patients: Omit<ScreenedPatient, 'diagnoses'>[]): Promise<ScreenedPatient[]> {
  const rows = await db('diagnoses')
    .select('patient_id', 'icd10_code', 'description', 'diagnosed_on')
    .whereIn('patient_id', patients.map((p) => p.id))
    .orderBy(['patient_id', 'diagnosed_on']);
  const byPatient = new Map<number, DiagnosisFact[]>();
  for (const { patient_id, ...diagnosis } of rows) {
    byPatient.set(patient_id, [...(byPatient.get(patient_id) ?? []), diagnosis]);
  }
  return patients.map((p) => ({ ...p, diagnoses: byPatient.get(p.id) ?? [] }));
}

const PATIENT_COLUMNS = ['p.id', 'p.first_name', 'p.last_name', 'p.date_of_birth', 'p.phone'];

// Everyone nobody has checked for this study yet. Matching happens in code (spec section 8).
export async function unscreenedPatients(studyId: number): Promise<ScreenedPatient[]> {
  const patients = await db('patients as p')
    .select(PATIENT_COLUMNS)
    .whereNotExists(db('study_candidates as c').whereRaw('c.patient_id = p.id').andWhere('c.study_id', studyId))
    .orderBy(['p.last_name', 'p.first_name', 'p.id']);
  return withDiagnoses(patients);
}

export async function findScreenedPatient(id: number): Promise<ScreenedPatient | undefined> {
  const patient = await db('patients as p').select(PATIENT_COLUMNS).where('p.id', id).first();
  return patient && (await withDiagnoses([patient]))[0];
}

export type NewCandidate = {
  study_id: number;
  patient_id: number;
  status: CandidateStatus;
  match_reasons: CriterionResult[];
  reviewed_by: number;
};

// Returns null when this patient was already checked for the study (unique patient_id, study_id).
export async function createCandidate(input: NewCandidate) {
  try {
    const [candidate] = await db('study_candidates')
      .insert({ ...input, match_reasons: JSON.stringify(input.match_reasons) })
      .returning(['id', 'study_id', 'patient_id', 'status', 'match_reasons', 'reviewed_by', 'reviewed_at']);
    return candidate;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return null;
    throw err;
  }
}
