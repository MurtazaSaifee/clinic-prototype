import { db, paginate } from '../db.ts';
import { CANDIDATE_STATUSES } from '../enums.ts';
import type { CandidateStatus, ContactOutcome } from '../enums.ts';
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

export type CallListRow = {
  id: number;
  status: CandidateStatus;
  patient: { id: number; name: string; phone: string };
  match_reasons: CriterionResult[];
  attempt_count: number;
  last_attempt: { outcome: ContactOutcome; attempted_at: string; staff_name: string } | null;
};

type CallListDbRow = {
  id: number;
  status: CandidateStatus;
  match_reasons: CriterionResult[];
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  attempt_count: number;
  last_outcome: ContactOutcome | null;
  last_attempted_at: Date | null;
  last_staff_name: string | null;
};

function callListQuery() {
  return db('study_candidates as c')
    .join('patients as p', 'p.id', 'c.patient_id')
    .joinRaw(
      `LEFT JOIN LATERAL (
         SELECT a.outcome, a.attempted_at, s.name AS staff_name
         FROM contact_attempts a JOIN staff s ON s.id = a.staff_id
         WHERE a.candidate_id = c.id
         ORDER BY a.attempted_at DESC, a.id DESC
         LIMIT 1
       ) last ON true`,
    )
    .select(
      'c.id',
      'c.status',
      'c.match_reasons',
      'p.id as patient_id',
      db.raw(`p.first_name || ' ' || p.last_name as patient_name`),
      'p.phone as patient_phone',
      db.raw('(SELECT count(*)::int FROM contact_attempts a WHERE a.candidate_id = c.id) as attempt_count'),
      'last.outcome as last_outcome',
      'last.attempted_at as last_attempted_at',
      'last.staff_name as last_staff_name',
    );
}

function toCallListRow(row: CallListDbRow): CallListRow {
  return {
    id: row.id,
    status: row.status,
    patient: { id: row.patient_id, name: row.patient_name, phone: row.patient_phone },
    match_reasons: row.match_reasons,
    attempt_count: row.attempt_count,
    last_attempt:
      row.last_outcome === null
        ? null
        : { outcome: row.last_outcome, attempted_at: row.last_attempted_at!.toISOString(), staff_name: row.last_staff_name! },
  };
}

// Never-called candidates first, then whoever has waited longest since their last call.
export async function listCandidates(studyId: number, status: CandidateStatus, page: number, pageSize: number) {
  const query = callListQuery()
    .where({ 'c.study_id': studyId, 'c.status': status })
    .orderByRaw('last.attempted_at ASC NULLS FIRST, c.id');
  const result = await paginate<CallListDbRow>(query, page, pageSize);
  return { ...result, data: result.data.map(toCallListRow) };
}

export async function countCandidatesByStatus(studyId: number): Promise<Record<CandidateStatus, number>> {
  const rows: { status: CandidateStatus; total: string }[] = await db('study_candidates')
    .select('status')
    .count({ total: '*' })
    .where({ study_id: studyId })
    .groupBy('status');
  const counts = Object.fromEntries(CANDIDATE_STATUSES.map((s) => [s, 0])) as Record<CandidateStatus, number>;
  for (const row of rows) counts[row.status] = Number(row.total);
  return counts;
}

export async function findCallListRow(id: number): Promise<CallListRow | undefined> {
  const row = await callListQuery().where('c.id', id).first();
  return row && toCallListRow(row);
}

// Records the call and, in the same transaction, moves the candidate on if the call reached them.
// Returns false (and records nothing) if the candidate had already left PENDING_CONTACT.
export async function logContactAttempt(
  candidateId: number,
  attempt: { staff_id: number; outcome: ContactOutcome; notes: string | null },
  nextStatus: CandidateStatus,
) {
  return db.transaction(async (trx) => {
    const updated = await trx('study_candidates')
      .where({ id: candidateId, status: 'PENDING_CONTACT' })
      .update({ status: nextStatus, updated_at: trx.fn.now() });
    if (updated === 0) return false;
    await trx('contact_attempts').insert({ ...attempt, candidate_id: candidateId });
    return true;
  });
}

export async function recordConsent(candidateId: number, status: CandidateStatus) {
  const updated = await db('study_candidates')
    .where({ id: candidateId, status: 'PENDING_CONSENT' })
    .update({ status, updated_at: db.fn.now() });
  return updated === 1;
}
