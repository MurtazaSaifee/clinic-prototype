import express from 'express';
import request from 'supertest';
import { db } from './db.ts';
import { errorHandler, pageQuery, parse, requireStaff } from './http.ts';

afterAll(() => db.destroy());

// No real write route exists yet, so a throwaway app runs the helpers through the real error handler.
const testApp = express();
testApp.get('/whoami', async (req, res) => res.json(await requireStaff(req)));
testApp.get('/paged', async (req, res) => res.json(parse(pageQuery, req.query)));
testApp.use(errorHandler);

describe('requireStaff', () => {
  test('returns the staff member named by X-Staff-Id', async () => {
    const res = await request(testApp).get('/whoami').set('X-Staff-Id', '1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1, name: expect.any(String), role: 'PHYSICIAN' });
  });

  test.each([
    ['missing', undefined, 'X-Staff-Id header is required'],
    ['non-numeric', 'abc', 'X-Staff-Id must be a number'],
    ['unknown', '9999', 'Unknown staff id 9999'],
  ])('rejects a %s X-Staff-Id with 400', async (_, header, error) => {
    const req = request(testApp).get('/whoami');
    const res = header === undefined ? await req : await req.set('X-Staff-Id', header);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
  });
});

describe('pageQuery', () => {
  test('defaults to page 1 of 25', async () => {
    const res = await request(testApp).get('/paged');
    expect(res.body).toEqual({ page: 1, page_size: 25 });
  });

  test('rejects page_size over 100 with field details', async () => {
    const res = await request(testApp).get('/paged?page_size=101');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid input', details: { page_size: [expect.any(String)] } });
  });
});
