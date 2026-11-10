import request from 'supertest';
import { app } from '../app.ts';
import { db } from '../db.ts';

afterAll(() => db.destroy());

const newPatient = {
  first_name: 'Wilhelmina',
  last_name: 'Quigleyson',
  date_of_birth: '1961-03-14',
  sex: 'FEMALE',
  phone: '(555) 012-3456',
  email: '',
};

// Runs before anything in this file creates a patient, so the seed's 120 still holds.
test('lists 25 patients per page sorted by last name, with the total', async () => {
  const first = await request(app).get('/api/patients');
  expect(first.status).toBe(200);
  expect(first.body).toMatchObject({ page: 1, page_size: 25, total: 120 });
  expect(first.body.data).toHaveLength(25);
  expect(Object.keys(first.body.data[0]).sort()).toEqual(
    ['date_of_birth', 'email', 'first_name', 'id', 'last_name', 'phone', 'sex'],
  );

  const last = await request(app).get('/api/patients?page=5');
  expect(last.body.data).toHaveLength(20);
  const names = [...first.body.data, ...last.body.data].map((p: { last_name: string }) => p.last_name);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

describe('search', () => {
  let patient: { id: number; first_name: string; last_name: string };

  beforeAll(async () => {
    patient = (await request(app).get('/api/patients/1')).body;
  });

  async function search(q: string) {
    const res = await request(app).get('/api/patients').query({ q, page_size: 100 });
    expect(res.status).toBe(200);
    return res.body.data.map((p: { id: number }) => p.id);
  }

  test('matches first name and last name, ignoring case', async () => {
    expect(await search(patient.first_name.toLowerCase())).toContain(1);
    expect(await search(patient.last_name.toUpperCase())).toContain(1);
  });

  test('"last, first" narrows a shared last name to the right first name', async () => {
    const bart = (await request(app).post('/api/patients').send({ ...newPatient, first_name: 'Bartholomew' })).body;
    const wil = (await request(app).post('/api/patients').send(newPatient)).body;
    const ids = await search('quigleyson, bart');
    expect(ids).toContain(bart.id);
    expect(ids).not.toContain(wil.id);
  });

  test('matches phone digits however they are typed', async () => {
    const created = (await request(app).post('/api/patients').send(newPatient)).body;
    expect(await search('555 01')).toContain(created.id);
    expect(await search('55501')).toContain(created.id);
    expect(await search('(555) 012-3456')).toContain(created.id);
    expect(await search('555 99')).not.toContain(created.id);
  });

  test('treats % in the search as a literal character, not a wildcard', async () => {
    expect(await search(`${patient.last_name.slice(0, 2)}%`)).toEqual([]);
  });
});

describe('create', () => {
  test('returns 201 with the new patient, storing a blank email as null', async () => {
    const res = await request(app).post('/api/patients').send(newPatient);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ...newPatient, id: expect.any(Number), email: null });
  });

  test('rejects bad fields with a message per field', async () => {
    const res = await request(app).post('/api/patients').send({
      first_name: ' ',
      last_name: 'Smith',
      date_of_birth: '2999-01-01',
      sex: 'OTHER',
      phone: '12-34',
      email: 'not-an-email',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
    expect(Object.keys(res.body.details).sort()).toEqual(['date_of_birth', 'email', 'first_name', 'phone', 'sex']);
    expect(res.body.details.date_of_birth).toEqual(['Date of birth cannot be in the future']);
  });
});

describe('get and edit', () => {
  test('PATCH changes only the fields sent', async () => {
    const created = (await request(app).post('/api/patients').send(newPatient)).body;
    const res = await request(app).patch(`/api/patients/${created.id}`).send({ phone: '555-777-8888' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...created, phone: '555-777-8888' });
    expect((await request(app).get(`/api/patients/${created.id}`)).body.phone).toBe('555-777-8888');
  });

  test('a missing date of birth says it is required', async () => {
    const res = await request(app).post('/api/patients').send({ ...newPatient, date_of_birth: '' });
    expect(res.body.details).toEqual({ date_of_birth: ['Date of birth is required'] });
  });

  test('PATCH validates the fields it is sent', async () => {
    const res = await request(app).patch('/api/patients/1').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details)).toEqual(['email']);
  });

  test('unknown patient is 404 on GET and PATCH', async () => {
    expect((await request(app).get('/api/patients/99999')).status).toBe(404);
    const res = await request(app).patch('/api/patients/99999').send({ phone: '555-777-8888' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Patient not found' });
  });
});
