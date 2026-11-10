import { db, paginate } from './db.ts';

afterAll(() => db.destroy());

test('paginate returns one page plus the total', async () => {
  const query = db('patients').select('id').orderBy('id');
  const result = await paginate<{ id: number }>(query, 2, 25);
  expect(result.total).toBe(120);
  expect(result.page).toBe(2);
  expect(result.page_size).toBe(25);
  expect(result.data.map((p) => p.id)).toEqual(Array.from({ length: 25 }, (_, i) => i + 26));
});
