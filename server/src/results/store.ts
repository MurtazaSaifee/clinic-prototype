import { db, paginate } from '../db.ts';

export type TestResult = {
  id: number;
  test_name: string;
  result: string;
  is_abnormal: boolean;
  resulted_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
  patient: { id: number; name: string };
};

type TestResultRow = Omit<TestResult, 'patient' | 'resulted_at' | 'reviewed_at'> & {
  resulted_at: Date;
  reviewed_at: Date | null;
  patient_id: number;
  patient_name: string;
};

function resultsQuery() {
  return db('test_results as r')
    .join('patients as p', 'p.id', 'r.patient_id')
    .select(
      'r.id',
      'r.test_name',
      'r.result',
      'r.is_abnormal',
      'r.resulted_at',
      'r.reviewed_at',
      'r.reviewed_by',
      'p.id as patient_id',
      db.raw(`p.first_name || ' ' || p.last_name as patient_name`),
    );
}

function toTestResult({ patient_id, patient_name, resulted_at, reviewed_at, ...rest }: TestResultRow): TestResult {
  return {
    ...rest,
    resulted_at: resulted_at.toISOString(),
    reviewed_at: reviewed_at?.toISOString() ?? null,
    patient: { id: patient_id, name: patient_name },
  };
}

// Abnormal first, then the longest-waiting, so nothing urgent sits under routine results.
export async function listResults(reviewed: boolean, page: number, pageSize: number) {
  const query = resultsQuery()
    .modify((q) => (reviewed ? q.whereNotNull('r.reviewed_at') : q.whereNull('r.reviewed_at')))
    .orderBy([{ column: 'r.is_abnormal', order: 'desc' }, { column: 'r.resulted_at', order: 'asc' }, { column: 'r.id' }]);
  const result = await paginate<TestResultRow>(query, page, pageSize);
  return { ...result, data: result.data.map(toTestResult) };
}

export async function findResult(id: number): Promise<TestResult | undefined> {
  const row = await resultsQuery().where('r.id', id).first();
  return row && toTestResult(row);
}

// Returns false if someone already reviewed it; the first review is the one kept.
export async function markReviewed(id: number, staffId: number) {
  const updated = await db('test_results')
    .where({ id })
    .whereNull('reviewed_at')
    .update({ reviewed_at: db.fn.now(), reviewed_by: staffId });
  return updated === 1;
}
