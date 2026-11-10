import request from 'supertest';
import { app } from '../app.ts';
import { db } from '../db.ts';

afterAll(() => db.destroy());

test('GET /api/health reports the database is reachable', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});
