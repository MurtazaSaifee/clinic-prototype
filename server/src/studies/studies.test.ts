import request from 'supertest';
import { app } from '../app.ts';
import { db } from '../db.ts';

afterAll(() => db.destroy());

type Match = { patient: { id: number; name: string }; reasons: { met: boolean; evidence: string }[] };

async function allMatches(): Promise<{ total: number; data: Match[] }> {
  return (await request(app).get('/api/studies/1/matches?page_size=100')).body;
}

const decide = (patient_id: number, eligible: boolean, staffId: string | null = '1') => {
  const req = request(app).post('/api/studies/1/candidates');
  return (staffId ? req.set('X-Staff-Id', staffId) : req).send({ patient_id, eligible });
};

// An independent answer from SQL: E11 patients aged 18 to 75 today with no candidate row.
async function expectedMatchIds(): Promise<number[]> {
  const rows = await db('patients as p')
    .distinct('p.id')
    .join('diagnoses as d', 'd.patient_id', 'p.id')
    .where('d.icd10_code', 'like', 'E11%')
    .whereRaw(`date_part('year', age((now() at time zone 'UTC')::date, p.date_of_birth)) between 18 and 75`)
    .whereNotExists(db('study_candidates as c').whereRaw('c.patient_id = p.id'));
  return rows.map((r) => r.id).sort((a, b) => a - b);
}

// toContainEqual, not toEqual: outreach.test.ts adds a study of its own while this file runs.
test('GET /api/studies lists GLUCO-STEP with its parsed criteria', async () => {
  const res = await request(app).get('/api/studies');
  expect(res.body).toContainEqual(
    {
      id: 1,
      name: 'GLUCO-STEP',
      description: expect.any(String),
      criteria: [
        { type: 'AGE_BETWEEN', min: 18, max: 75 },
        { type: 'DIAGNOSIS', icd10_prefixes: ['E11'], label: 'Type 2 diabetes' },
      ],
    },
  );
});

describe('GET /api/studies/:id/matches', () => {
  test('lists exactly the unchecked patients who meet every criterion, each with its evidence', async () => {
    const { total, data } = await allMatches();
    expect(total).toBeGreaterThan(0);
    expect(data.map((m) => m.patient.id).sort((a, b) => a - b)).toEqual(await expectedMatchIds());
    for (const match of data) {
      expect(match.reasons).toHaveLength(2);
      expect(match.reasons.every((r) => r.met)).toBe(true);
      expect(match.reasons[0].evidence).toMatch(/^Age \d+ \(18 to 75 required\)$/);
      expect(match.reasons[1].evidence).toMatch(/^E11/);
    }
  });

  test('leaves out type 1 only, over-75 and already checked patients', async () => {
    const ids = new Set((await allMatches()).data.map((m) => m.patient.id));
    const type1Only = await db('diagnoses').select('patient_id').where('icd10_code', 'like', 'E10%');
    const over75 = await db('patients as p')
      .select('p.id')
      .join('diagnoses as d', 'd.patient_id', 'p.id')
      .where('d.icd10_code', 'like', 'E11%')
      .whereRaw(`date_part('year', age((now() at time zone 'UTC')::date, p.date_of_birth)) > 75`);
    const checked = await db('study_candidates').select('patient_id');

    expect(type1Only.length).toBeGreaterThan(0);
    expect(over75.length).toBeGreaterThan(0);
    expect(checked.length).toBeGreaterThan(0);
    for (const { patient_id } of [...type1Only, ...checked]) expect(ids.has(patient_id)).toBe(false);
    for (const { id } of over75) expect(ids.has(id)).toBe(false);
  });

  test('pages the list with the usual envelope', async () => {
    const { total, data } = await allMatches();
    expect(total).toBeGreaterThanOrEqual(4);
    const res = await request(app).get('/api/studies/1/matches?page=2&page_size=2');
    expect(res.body).toMatchObject({ page: 2, page_size: 2, total });
    expect(res.body.data.map((m: Match) => m.patient.id)).toEqual(data.slice(2, 4).map((m) => m.patient.id));
  });

  test('an unknown study is 404', async () => {
    expect((await request(app).get('/api/studies/999/matches')).status).toBe(404);
  });
});

describe('POST /api/studies/:id/candidates', () => {
  test('eligible saves PENDING_CONTACT with the reasons shown, stamps the reviewer, and removes the match; a repeat is 409', async () => {
    const { data } = await allMatches();
    const shown = data[0];

    const res = await decide(shown.patient.id, true, '2');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ patient_id: shown.patient.id, study_id: 1, status: 'PENDING_CONTACT', reviewed_by: 2 });
    expect(res.body.match_reasons).toEqual(shown.reasons);

    const after = await allMatches();
    expect(after.data.map((m) => m.patient.id)).not.toContain(shown.patient.id);

    const again = await decide(shown.patient.id, false);
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: 'This patient was already checked for this study' });
  });

  test('not eligible saves NOT_ELIGIBLE and also leaves the list', async () => {
    const shown = (await allMatches()).data[0];
    const res = await decide(shown.patient.id, false);
    expect(res.body).toMatchObject({ status: 'NOT_ELIGIBLE' });
    expect((await allMatches()).data.map((m) => m.patient.id)).not.toContain(shown.patient.id);
  });

  test('a patient who does not meet the criteria cannot be marked eligible', async () => {
    const [{ patient_id }] = await db('diagnoses').select('patient_id').where('icd10_code', 'like', 'E10%');
    const res = await decide(patient_id, true);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'This patient no longer meets every criterion' });
  });

  test('needs X-Staff-Id, a known patient and a known study', async () => {
    expect((await decide(1, true, null)).body).toEqual({ error: 'X-Staff-Id header is required' });
    expect((await decide(99999, true)).body.details).toEqual({ patient_id: ['Unknown patient'] });
    const res = await request(app).post('/api/studies/999/candidates').set('X-Staff-Id', '1').send({ patient_id: 1, eligible: true });
    expect(res.status).toBe(404);
  });
});
