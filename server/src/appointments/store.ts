import { db } from '../db.ts';
import type { AppointmentStatus } from '../enums.ts';

export type BoardVisit = {
  id: number;
  scheduled_at: string;
  status: AppointmentStatus;
  reason: string;
  patient: { id: number; name: string; phone: string };
  physician: { id: number; name: string };
  open_task_count: number;
};

export type NewAppointment = { patient_id: number; physician_id: number; scheduled_at: string; reason: string };

function boardQuery() {
  return db('appointments as a')
    .join('patients as p', 'p.id', 'a.patient_id')
    .join('staff as s', 's.id', 'a.physician_id')
    .select(
      'a.id',
      'a.scheduled_at',
      'a.status',
      'a.reason',
      'p.id as patient_id',
      db.raw(`p.first_name || ' ' || p.last_name as patient_name`),
      'p.phone as patient_phone',
      's.id as physician_id',
      's.name as physician_name',
      db.raw(
        `(SELECT count(*)::int FROM checkout_tasks t
          WHERE t.appointment_id = a.id AND t.completed_at IS NULL) as open_task_count`,
      ),
    );
}

type BoardRow = {
  id: number;
  scheduled_at: Date;
  status: AppointmentStatus;
  reason: string;
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  physician_id: number;
  physician_name: string;
  open_task_count: number;
};

function toBoardVisit(row: BoardRow): BoardVisit {
  return {
    id: row.id,
    scheduled_at: row.scheduled_at.toISOString(),
    status: row.status,
    reason: row.reason,
    patient: { id: row.patient_id, name: row.patient_name, phone: row.patient_phone },
    physician: { id: row.physician_id, name: row.physician_name },
    open_task_count: row.open_task_count,
  };
}

// The clinic runs on UTC, so a date's visits are those from 00:00Z up to the next day's 00:00Z.
export async function listVisitsOn(date: string): Promise<BoardVisit[]> {
  const start = new Date(`${date}T00:00:00Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows: BoardRow[] = await boardQuery()
    .where('a.scheduled_at', '>=', start)
    .andWhere('a.scheduled_at', '<', end)
    .orderBy(['a.scheduled_at', 's.name', 'a.id']);
  return rows.map(toBoardVisit);
}

export async function findVisit(id: number): Promise<BoardVisit | undefined> {
  const row: BoardRow | undefined = await boardQuery().where('a.id', id).first();
  return row && toBoardVisit(row);
}

// Returns null when the physician already has an active visit in that slot.
// The partial unique index decides, so two people booking at once can't both win.
export async function bookAppointment(input: NewAppointment): Promise<BoardVisit | null> {
  try {
    const [{ id }] = await db('appointments').insert(input).returning('id');
    return (await findVisit(id))!;
  } catch (err) {
    const pgError = err as { code?: string; constraint?: string };
    if (pgError.code === '23505' && pgError.constraint === 'appointments_physician_slot_unique') return null;
    throw err;
  }
}

// Only updates if the visit is still in `from`, so a change made by someone else in between isn't overwritten.
export async function moveStatus(id: number, from: AppointmentStatus, to: AppointmentStatus) {
  const updated = await db('appointments')
    .where({ id, status: from })
    .update({ status: to, updated_at: db.fn.now() });
  return updated === 1;
}
