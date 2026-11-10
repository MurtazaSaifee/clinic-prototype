import request from 'supertest';
import { app } from '../app.ts';
import { db } from '../db.ts';

const ids: Record<string, number> = {};

// Dated in 2020, before any seeded result, so these lead their group in oldest-first order.
beforeAll(async () => {
  const rows = [
    ['normalOld', false, '2020-01-01T09:00:00Z'],
    ['normalNew', false, '2020-01-03T09:00:00Z'],
    ['abnormalNew', true, '2020-01-02T09:00:00Z'],
    ['abnormalOld', true, '2020-01-01T09:00:00Z'],
    ['toReview', true, '2020-01-05T09:00:00Z'],
  ] as const;
  for (const [key, isAbnormal, resultedAt] of rows) {
    const [{ id }] = await db('test_results')
      .insert({ patient_id: 1, test_name: `Test ${key}`, result: '1.0', is_abnormal: isAbnormal, resulted_at: resultedAt })
      .returning('id');
    ids[key] = id;
  }
});

afterAll(() => db.destroy());

const inbox = (query = '') => request(app).get(`/api/test-results?page_size=100${query}`);
const review = (id: number, staffId: string | null = '1') => {
  const req = request(app).post(`/api/test-results/${id}/review`);
  return staffId ? req.set('X-Staff-Id', staffId) : req;
};

describe('GET /api/test-results', () => {
  test('lists unreviewed results, abnormal first, then oldest first, with the patient', async () => {
    const res = await inbox();
    expect(res.status).toBe(200);
    const list: { id: number; is_abnormal: boolean; reviewed_at: string | null }[] = res.body.data;
    expect(list.every((r) => r.reviewed_at === null)).toBe(true);

    // Every abnormal result comes before every normal one.
    const firstNormal = list.findIndex((r) => !r.is_abnormal);
    expect(list.slice(firstNormal).every((r) => !r.is_abnormal)).toBe(true);

    const order = (key: string) => list.findIndex((r) => r.id === ids[key]);
    expect(order('abnormalOld')).toBe(0);
    expect(order('abnormalNew')).toBe(1);
    expect(order('normalOld')).toBe(firstNormal);
    expect(order('normalNew')).toBe(firstNormal + 1);

    expect(list[0]).toEqual({
      id: ids.abnormalOld,
      test_name: 'Test abnormalOld',
      result: '1.0',
      is_abnormal: true,
      resulted_at: '2020-01-01T09:00:00.000Z',
      reviewed_at: null,
      reviewed_by: null,
      patient: { id: 1, name: expect.any(String) },
    });
  });

  test('is paged, and reviewed=true lists only reviewed results', async () => {
    const page = await request(app).get('/api/test-results?page_size=2&page=2');
    expect(page.body).toMatchObject({ page: 2, page_size: 2, total: expect.any(Number) });
    expect(page.body.data).toHaveLength(2);

    const reviewed = await inbox('&reviewed=true');
    expect(reviewed.body.total).toBeGreaterThan(0);
    expect(reviewed.body.data.every((r: { reviewed_at: string | null }) => r.reviewed_at !== null)).toBe(true);
    expect((await inbox('&reviewed=maybe')).status).toBe(400);
  });
});

describe('POST /api/test-results/:id/review', () => {
  test('stamps who reviewed it and when, and removes it from the inbox', async () => {
    const before = Date.now();
    const res = await review(ids.toReview, '2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: ids.toReview, reviewed_by: 2 });
    expect(new Date(res.body.reviewed_at).getTime()).toBeGreaterThanOrEqual(before - 1000);

    const list = await inbox();
    expect(list.body.data.map((r: { id: number }) => r.id)).not.toContain(ids.toReview);
  });

  test('a second review is refused and keeps the first reviewer', async () => {
    const res = await review(ids.toReview, '1');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'This result was already reviewed' });
    expect(await db('test_results').where({ id: ids.toReview }).first('reviewed_by')).toEqual({ reviewed_by: 2 });
  });

  test('needs X-Staff-Id; an unknown result is 404', async () => {
    expect((await review(ids.normalOld, null)).status).toBe(400);
    expect(await db('test_results').where({ id: ids.normalOld }).first('reviewed_at')).toEqual({ reviewed_at: null });
    expect((await review(99999)).status).toBe(404);
  });
});
