import request from 'supertest';
import { app } from './app.ts';
import { db } from './db.ts';

afterAll(() => db.destroy());

test('GET /api/health reports the database is reachable', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});

test('GET /api/patients returns seeded patients sorted by last name', async () => {
  const res = await request(app).get('/api/patients');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(50);
  const lastNames = res.body.map((p: { last_name: string }) => p.last_name);
  expect(lastNames).toEqual([...lastNames].sort((a, b) => a.localeCompare(b)));
  expect(res.body[0].date_of_birth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
