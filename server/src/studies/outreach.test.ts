import request from 'supertest';
import { app } from '../app.ts';
import { db } from '../db.ts';
import { CONTACT_OUTCOMES } from '../enums.ts';
import { statusAfterCall } from './outreach.ts';

// A study of its own, so the counts and order here can't be disturbed by studies.test.ts running alongside.
let studyId: number;
const candidateIds: Record<string, number> = {};

beforeAll(async () => {
  [{ id: studyId }] = await db('clinical_studies')
    .insert({ name: 'OUTREACH-TEST', description: 'Test study', criteria: JSON.stringify([{ type: 'AGE_BETWEEN', min: 18 }]) })
    .returning('id');

  const add = async (key: string, patientId: number, status: string, calls: [string, string][] = []) => {
    const [{ id }] = await db('study_candidates')
      .insert({ patient_id: patientId, study_id: studyId, status, match_reasons: JSON.stringify([]), reviewed_by: 1 })
      .returning('id');
    for (const [outcome, attemptedAt] of calls) {
      await db('contact_attempts').insert({ candidate_id: id, staff_id: 3, outcome, attempted_at: attemptedAt });
    }
    candidateIds[key] = id;
  };

  await add('calledRecently', 1, 'PENDING_CONTACT', [['NO_ANSWER', '2026-01-09T10:00:00Z']]);
  await add('neverCalled', 2, 'PENDING_CONTACT');
  await add('calledLongAgo', 3, 'PENDING_CONTACT', [['VOICEMAIL', '2026-01-01T09:00:00Z'], ['NO_ANSWER', '2026-01-02T09:00:00Z']]);
  await add('reached', 4, 'PENDING_CONSENT', [['REACHED', '2026-01-03T09:00:00Z']]);
  await add('toDecline', 5, 'PENDING_CONSENT', [['REACHED', '2026-01-03T09:00:00Z']]);
  await add('consented', 6, 'CONSENTED', [['REACHED', '2026-01-03T09:00:00Z']]);
  for (const key of ['noAnswer', 'voicemail', 'wrongNumber', 'willReach']) {
    await add(key, 10 + Object.keys(candidateIds).length, 'PENDING_CONTACT');
  }
});

afterAll(() => db.destroy());

const callList = (query = '') => request(app).get(`/api/studies/${studyId}/candidates?page_size=100${query}`);
const logCall = (key: string, outcome: string, notes?: string, staffId: string | null = '5') => {
  const req = request(app).post(`/api/candidates/${candidateIds[key]}/contact-attempts`);
  return (staffId ? req.set('X-Staff-Id', staffId) : req).send({ outcome, notes });
};
const decideConsent = (key: string, status: string) => request(app).patch(`/api/candidates/${candidateIds[key]}`).send({ status });

test.each(CONTACT_OUTCOMES)('a %s call leads to the right status', (outcome) => {
  expect(statusAfterCall(outcome)).toBe(outcome === 'REACHED' ? 'PENDING_CONSENT' : 'PENDING_CONTACT');
});

describe('GET /api/studies/:id/candidates', () => {
  // Runs first in this file, before any call is logged.
  test('defaults to who needs a call: never-called first, then the longest wait since the last call', async () => {
    const res = await callList();
    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: { id: number }) => c.id);
    expect(ids.slice(0, 1)).toEqual([candidateIds.neverCalled]);
    expect(ids.slice(-2)).toEqual([candidateIds.calledLongAgo, candidateIds.calledRecently]);
    expect(res.body.data.every((c: { status: string }) => c.status === 'PENDING_CONTACT')).toBe(true);

    const longAgo = res.body.data.find((c: { id: number }) => c.id === candidateIds.calledLongAgo);
    expect(longAgo).toMatchObject({
      patient: { id: 3, name: expect.any(String), phone: expect.any(String) },
      match_reasons: [],
      attempt_count: 2,
      last_attempt: { outcome: 'NO_ANSWER', attempted_at: '2026-01-02T09:00:00.000Z', staff_name: 'Priya Shah' },
    });
    expect(res.body.data.find((c: { id: number }) => c.id === candidateIds.neverCalled).last_attempt).toBeNull();
  });

  test('returns the paging envelope with a count for every status', async () => {
    const res = await callList();
    expect(res.body).toMatchObject({ page: 1, page_size: 100, total: 7 });
    expect(res.body.counts).toEqual({ NOT_ELIGIBLE: 0, PENDING_CONTACT: 7, PENDING_CONSENT: 2, CONSENTED: 1, DECLINED: 0 });
  });

  test('filters by status, and rejects an unknown one', async () => {
    const res = await callList('&status=PENDING_CONSENT');
    expect(res.body.data.map((c: { id: number }) => c.id).sort()).toEqual([candidateIds.reached, candidateIds.toDecline].sort());
    expect((await callList('&status=LOST')).status).toBe(400);
    expect((await request(app).get('/api/studies/999/candidates')).status).toBe(404);
  });
});

describe('POST /api/candidates/:id/contact-attempts', () => {
  test.each([
    ['noAnswer', 'NO_ANSWER'],
    ['voicemail', 'VOICEMAIL'],
    ['wrongNumber', 'WRONG_NUMBER'],
  ])('%s keeps the patient on the call list and adds an attempt by the caller', async (key, outcome) => {
    const res = await logCall(key, outcome, '  Tried mobile  ');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING_CONTACT',
      attempt_count: 1,
      last_attempt: { outcome, staff_name: 'Lena Novak' },
    });
    const [saved] = await db('contact_attempts').where({ candidate_id: candidateIds[key] }).select('notes', 'staff_id');
    expect(saved).toEqual({ notes: 'Tried mobile', staff_id: 5 });
  });

  test('REACHED moves the patient to awaiting consent', async () => {
    const res = await logCall('willReach', 'REACHED');
    expect(res.body).toMatchObject({ status: 'PENDING_CONSENT', attempt_count: 1, last_attempt: { outcome: 'REACHED' } });
  });

  test('a call can only be logged while the patient needs one, and nothing is recorded otherwise', async () => {
    const res = await logCall('reached', 'NO_ANSWER');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Calls can only be logged while the patient needs a call (status is PENDING_CONSENT)' });
    expect(await db('contact_attempts').where({ candidate_id: candidateIds.reached }).count({ n: '*' }).first()).toEqual({ n: '1' });
  });

  test('needs X-Staff-Id and a known outcome; an unknown candidate is 404', async () => {
    expect((await logCall('neverCalled', 'NO_ANSWER', undefined, null)).status).toBe(400);
    expect((await logCall('neverCalled', 'BUSY')).body.details).toEqual({ outcome: ['Choose how the call went'] });
    const res = await request(app).post('/api/candidates/99999/contact-attempts').set('X-Staff-Id', '5').send({ outcome: 'REACHED' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/candidates/:id (consent)', () => {
  test('records CONSENTED or DECLINED once the patient was reached', async () => {
    const yes = await decideConsent('reached', 'CONSENTED');
    expect(yes.status).toBe(200);
    expect(yes.body.status).toBe('CONSENTED');
    expect((await decideConsent('toDecline', 'DECLINED')).body.status).toBe('DECLINED');
  });

  test('is refused before the patient is reached or after a decision', async () => {
    const early = await decideConsent('neverCalled', 'CONSENTED');
    expect(early.status).toBe(409);
    expect(early.body).toEqual({ error: 'Consent can only be recorded after the patient is reached (status is PENDING_CONTACT)' });
    expect((await decideConsent('consented', 'DECLINED')).status).toBe(409);
  });

  test('only accepts CONSENTED or DECLINED', async () => {
    const res = await decideConsent('willReach', 'PENDING_CONTACT');
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual({ status: ['Choose CONSENTED or DECLINED'] });
  });
});
