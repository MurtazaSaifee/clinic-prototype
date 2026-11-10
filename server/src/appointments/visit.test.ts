import request from 'supertest';
import { app } from '../app.ts';
import { db } from '../db.ts';

afterAll(() => db.destroy());

// Each test books its own visit in April 2032, which no seed row or other test file touches.
let nextSlot = 0;
async function visitIn(status: 'CHECKED_IN' | 'READY_FOR_DOCTOR' | 'READY_FOR_CHECKOUT') {
  const hour = 8 + Math.floor(nextSlot / 2);
  const minutes = nextSlot % 2 ? '30' : '00';
  nextSlot += 1;
  const booked = await request(app)
    .post('/api/appointments')
    .send({ patient_id: 2, physician_id: 1, scheduled_at: `2032-04-05T${String(hour).padStart(2, '0')}:${minutes}:00Z`, reason: 'Headaches' });
  for (const step of ['CHECKED_IN', 'READY_FOR_DOCTOR', 'READY_FOR_CHECKOUT']) {
    await move(booked.body.id, step);
    if (step === status) break;
  }
  return booked.body.id as number;
}

const move = (id: number, status: string) => request(app).post(`/api/appointments/${id}/status`).send({ status });
const addTask = (id: number, description: string) =>
  request(app).post(`/api/appointments/${id}/checkout-tasks`).send({ description });
const tick = (taskId: number, completed: boolean, staffId: string | null = '5') => {
  const req = request(app).patch(`/api/checkout-tasks/${taskId}`);
  return (staffId ? req.set('X-Staff-Id', staffId) : req).send({ completed });
};

describe('GET /api/appointments/:id', () => {
  test('returns the visit with patient, vitals, notes, diagnoses and tasks', async () => {
    const id = await visitIn('CHECKED_IN');
    const res = await request(app).get(`/api/appointments/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: 'CHECKED_IN',
      reason: 'Headaches',
      patient: { id: 2, name: expect.any(String), date_of_birth: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      physician: { id: 1 },
      heart_rate: null,
      nurse_notes: null,
      checkout_tasks: [],
    });
    expect(res.body.diagnoses.length).toBeGreaterThan(0);
    expect(res.body.diagnoses[0]).toEqual({
      id: expect.any(Number),
      icd10_code: expect.any(String),
      description: expect.any(String),
      diagnosed_on: expect.any(String),
    });
  });

  test('an unknown visit is 404', async () => {
    expect((await request(app).get('/api/appointments/99999')).status).toBe(404);
  });
});

describe('PATCH /api/appointments/:id', () => {
  test('saves vitals and nurse notes', async () => {
    const id = await visitIn('CHECKED_IN');
    const vitals = { height_cm: 171.5, weight_kg: 68.2, bp_systolic: 128, bp_diastolic: 82, heart_rate: 74 };
    const res = await request(app)
      .patch(`/api/appointments/${id}`)
      .send({ ...vitals, nurse_notes: '  Pain 3/10.  ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...vitals, nurse_notes: 'Pain 3/10.', doctor_notes: null });
  });

  test('rejects out-of-range vitals with a message per field', async () => {
    const id = await visitIn('CHECKED_IN');
    const res = await request(app)
      .patch(`/api/appointments/${id}`)
      .send({ heart_rate: 300, bp_systolic: 1200, height_cm: 10, weight_kg: 'heavy' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual({
      heart_rate: ['Heart rate must be 20 to 250 bpm'],
      bp_systolic: ['Systolic must be 60 to 260 mmHg'],
      height_cm: ['Height must be 50 to 250 cm'],
      weight_kg: ['Weight must be a number'],
    });
    expect((await request(app).patch(`/api/appointments/${id}`).send({ heart_rate: 72.5 })).body.details).toEqual({
      heart_rate: ['Heart rate must be a whole number'],
    });
  });

  test('rejects a diastolic pressure at or above systolic', async () => {
    const id = await visitIn('CHECKED_IN');
    const res = await request(app).patch(`/api/appointments/${id}`).send({ bp_systolic: 80, bp_diastolic: 90 });
    expect(res.body.details).toEqual({ bp_diastolic: ['Diastolic must be lower than systolic'] });
  });

  test('a blank note is stored as null, and an unknown visit is 404', async () => {
    const id = await visitIn('READY_FOR_DOCTOR');
    const res = await request(app).patch(`/api/appointments/${id}`).send({ doctor_notes: '   ' });
    expect(res.body.doctor_notes).toBeNull();
    expect((await request(app).patch('/api/appointments/99999').send({ heart_rate: 70 })).status).toBe(404);
  });
});

describe('checkout tasks', () => {
  test('adding a task returns 201 with an open task', async () => {
    const id = await visitIn('READY_FOR_DOCTOR');
    const res = await addTask(id, 'Book follow-up in 2 weeks');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(Number), description: 'Book follow-up in 2 weeks', completed_at: null, completed_by: null });
    expect((await addTask(id, ' ')).body.details).toEqual({ description: ['Describe the task'] });
    expect((await addTask(99999, 'x')).status).toBe(404);
  });

  test('ticking a task stamps the staff member from X-Staff-Id; unticking clears it', async () => {
    const id = await visitIn('READY_FOR_CHECKOUT');
    const task = (await addTask(id, 'Blood draw for HbA1c')).body;

    const done = await tick(task.id, true, '5');
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ completed_by: { id: 5, name: expect.any(String) } });
    expect(Date.now() - new Date(done.body.completed_at).getTime()).toBeLessThan(60_000);

    const undone = await tick(task.id, false);
    expect(undone.body).toMatchObject({ completed_at: null, completed_by: null });
  });

  test('ticking needs X-Staff-Id, and an unknown task is 404', async () => {
    const id = await visitIn('READY_FOR_CHECKOUT');
    const task = (await addTask(id, 'Print care plan')).body;
    const res = await tick(task.id, true, null);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'X-Staff-Id header is required' });
    expect((await tick(99999, true)).status).toBe(404);
  });
});

describe('checking out', () => {
  test('is refused while any task is open and allowed once all are done', async () => {
    const id = await visitIn('READY_FOR_CHECKOUT');
    const first = (await addTask(id, 'Book follow-up')).body;
    const second = (await addTask(id, 'Blood draw')).body;

    const blocked = await move(id, 'CHECKED_OUT');
    expect(blocked.status).toBe(409);
    expect(blocked.body).toEqual({ error: '2 checkout tasks still open' });

    await tick(first.id, true);
    expect((await move(id, 'CHECKED_OUT')).body).toEqual({ error: '1 checkout task still open' });

    await tick(second.id, true);
    const res = await move(id, 'CHECKED_OUT');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CHECKED_OUT', open_task_count: 0 });
  });

  test('a visit with no tasks checks out straight away', async () => {
    const id = await visitIn('READY_FOR_CHECKOUT');
    expect((await move(id, 'CHECKED_OUT')).status).toBe(200);
  });
});
