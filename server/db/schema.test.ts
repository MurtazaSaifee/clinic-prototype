import { db } from '../src/db.ts';

// A slot the seed never uses, so this test can't collide with seeded visits.
const SLOT = '2030-01-07T09:00:00Z';

afterAll(async () => {
  await db('appointments').where({ scheduled_at: SLOT }).del();
  await db.destroy();
});

test('a physician cannot be double-booked unless the first visit is cancelled', async () => {
  const patient = await db('patients').first('id');
  const physician = await db('staff').where({ role: 'PHYSICIAN' }).first('id');
  const booking = { patient_id: patient.id, physician_id: physician.id, scheduled_at: SLOT, reason: 'Annual physical' };

  const [first] = await db('appointments').insert(booking).returning('id');
  await expect(db('appointments').insert(booking)).rejects.toMatchObject({
    code: '23505',
    constraint: 'appointments_physician_slot_unique',
  });

  await db('appointments').where({ id: first.id }).update({ status: 'CANCELLED' });
  await expect(db('appointments').insert(booking)).resolves.toBeDefined();
});
