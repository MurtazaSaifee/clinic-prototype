import request from 'supertest';
import { app } from '../app.ts';
import { db } from '../db.ts';
import { moveStatus } from './store.ts';

afterAll(() => db.destroy());

const today = new Date().toISOString().slice(0, 10);

// Each booking test uses its own slot in March 2032, which no seed row or other test file touches.
const visit = (scheduled_at: string, physician_id = 1) => ({
  patient_id: 1,
  physician_id,
  scheduled_at,
  reason: 'Annual check-up',
});

const book = (body: object) => request(app).post('/api/appointments').send(body);
const move = (id: number, status: string) => request(app).post(`/api/appointments/${id}/status`).send({ status });

describe('GET /api/appointments', () => {
  test("lists the day's visits in time order with patient, physician and open tasks", async () => {
    const res = await request(app).get('/api/appointments').query({ date: today });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(10);

    const times = res.body.map((v: { scheduled_at: string }) => v.scheduled_at);
    expect(times).toEqual([...times].sort());
    expect(times.every((t: string) => t.startsWith(today))).toBe(true);

    expect(res.body[0]).toEqual({
      id: expect.any(Number),
      scheduled_at: expect.any(String),
      status: expect.any(String),
      reason: expect.any(String),
      patient: { id: expect.any(Number), name: expect.any(String), phone: expect.any(String) },
      physician: { id: expect.any(Number), name: expect.any(String) },
      open_task_count: expect.any(Number),
    });
    // The seed gives waiting visits open tasks and checked-out visits only completed ones.
    const count = (status: string) =>
      res.body.filter((v: { status: string }) => v.status === status).map((v: { open_task_count: number }) => v.open_task_count);
    expect(count('READY_FOR_CHECKOUT').some((n: number) => n > 0)).toBe(true);
    expect(count('CHECKED_OUT').length).toBeGreaterThan(0);
    expect(count('CHECKED_OUT').every((n: number) => n === 0)).toBe(true);
  });

  test('a day with no visits is an empty list, and a bad date is 400', async () => {
    expect((await request(app).get('/api/appointments?date=2031-06-01')).body).toEqual([]);
    expect((await request(app).get('/api/appointments?date=tomorrow')).status).toBe(400);
  });
});

describe('POST /api/appointments', () => {
  test('books a SCHEDULED visit that then shows on that day', async () => {
    const res = await book(visit('2032-03-07T09:00:00Z'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'SCHEDULED', scheduled_at: '2032-03-07T09:00:00.000Z', patient: { id: 1 } });

    const day = await request(app).get('/api/appointments?date=2032-03-07');
    expect(day.body.map((v: { id: number }) => v.id)).toContain(res.body.id);
  });

  test('a second visit for the same physician and slot is 409; another physician is fine', async () => {
    expect((await book(visit('2032-03-08T09:00:00Z'))).status).toBe(201);
    const clash = await book(visit('2032-03-08T09:00:00Z'));
    expect(clash.status).toBe(409);
    expect(clash.body).toEqual({ error: 'That physician already has a visit at this time' });
    expect((await book(visit('2032-03-08T09:00:00Z', 2))).status).toBe(201);
  });

  test.each(['CANCELLED', 'NO_SHOW'])('a %s visit frees its slot', async (status) => {
    const slot = status === 'CANCELLED' ? '2032-03-09T10:00:00Z' : '2032-03-09T10:30:00Z';
    const first = await book(visit(slot));
    expect((await move(first.body.id, status)).status).toBe(200);
    expect((await book(visit(slot))).status).toBe(201);
  });

  test.each(['2032-03-10T09:15:00Z', '2032-03-10T09:00:30Z'])('rejects %s, which is not on a slot', async (time) => {
    const res = await book(visit(time));
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual({ scheduled_at: ['Visits start on the hour or half past'] });
  });

  test('rejects a non-physician, an unknown patient and a blank reason', async () => {
    const nurse = await book(visit('2032-03-11T09:00:00Z', 3));
    expect(nurse.status).toBe(400);
    expect(nurse.body.details).toEqual({ physician_id: ['Choose a physician'] });

    const stranger = await book({ ...visit('2032-03-11T09:00:00Z'), patient_id: 99999 });
    expect(stranger.body.details).toEqual({ patient_id: ['Unknown patient'] });

    const blank = await book({ ...visit('2032-03-11T09:00:00Z'), reason: '  ' });
    expect(blank.body.details).toEqual({ reason: ['Reason is required'] });
  });
});

describe('POST /api/appointments/:id/status', () => {
  test('checks in a scheduled visit', async () => {
    const booked = await book(visit('2032-03-14T09:00:00Z'));
    const res = await move(booked.body.id, 'CHECKED_IN');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: booked.body.id, status: 'CHECKED_IN' });
  });

  test('a move the rules do not allow is 409 and changes nothing', async () => {
    const booked = await book(visit('2032-03-14T09:30:00Z'));
    await move(booked.body.id, 'CHECKED_IN');
    const res = await move(booked.body.id, 'CANCELLED');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Can't move a visit from CHECKED_IN to CANCELLED" });
    expect((await move(booked.body.id, 'READY_FOR_DOCTOR')).status).toBe(200);
  });

  test('moveStatus does nothing if the visit already left the status it was moved from', async () => {
    const booked = await book(visit('2032-03-14T10:00:00Z'));
    expect(await moveStatus(booked.body.id, 'SCHEDULED', 'CHECKED_IN')).toBe(true);
    expect(await moveStatus(booked.body.id, 'SCHEDULED', 'CANCELLED')).toBe(false);
    const day = await request(app).get('/api/appointments?date=2032-03-14');
    expect(day.body.find((v: { id: number }) => v.id === booked.body.id).status).toBe('CHECKED_IN');
  });

  test('an unknown visit is 404 and an unknown status is 400', async () => {
    expect((await move(99999, 'CHECKED_IN')).status).toBe(404);
    expect((await move(1, 'LOST')).status).toBe(400);
  });
});
