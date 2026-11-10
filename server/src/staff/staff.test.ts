import request from 'supertest';
import { app } from '../app.ts';
import { db } from '../db.ts';

afterAll(() => db.destroy());

test('GET /api/staff lists every staff member with their role', async () => {
  const res = await request(app).get('/api/staff');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(5);
  expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'name', 'role']);
  const roles = res.body.map((s: { role: string }) => s.role).sort();
  expect(roles).toEqual(['NURSE', 'NURSE', 'PHYSICIAN', 'PHYSICIAN', 'RECEPTIONIST']);
});
