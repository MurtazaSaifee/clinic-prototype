import { db, paginate } from './db.ts';

afterAll(() => db.destroy());

// Uses staff, which no test writes to, so the totals hold while other files run in parallel.
test('paginate returns one page plus the total', async () => {
  const query = db('staff').select('id').orderBy('id');
  const result = await paginate<{ id: number }>(query, 2, 2);
  expect(result).toEqual({ data: [{ id: 3 }, { id: 4 }], page: 2, page_size: 2, total: 5 });
});
