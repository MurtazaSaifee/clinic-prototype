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
// Checking out also requires no open tasks in the same statement, so a task added meanwhile can't slip past.
export async function moveStatus(id: number, from: AppointmentStatus, to: AppointmentStatus) {
  const query = db('appointments').where({ id, status: from });
  if (to === 'CHECKED_OUT') {
    query.whereNotExists(openTasks().where('t.appointment_id', id));
  }
  const updated = await query.update({ status: to, updated_at: db.fn.now() });
  return updated === 1;
}

function openTasks() {
  return db('checkout_tasks as t').whereNull('t.completed_at');
}

export async function countOpenTasks(appointmentId: number) {
  const row = await openTasks().where('t.appointment_id', appointmentId).count({ open: '*' }).first();
  return Number(row?.open ?? 0);
}

export type Vitals = {
  height_cm: number | null;
  weight_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
};

export type VisitChanges = Partial<Vitals & { reason: string; nurse_notes: string | null; doctor_notes: string | null }>;

export type CheckoutTask = {
  id: number;
  description: string;
  completed_at: string | null;
  completed_by: { id: number; name: string } | null;
};

export type VisitDetail = Omit<BoardVisit, 'patient' | 'open_task_count'> &
  Vitals & {
    nurse_notes: string | null;
    doctor_notes: string | null;
    patient: { id: number; name: string; phone: string; date_of_birth: string; sex: string };
    diagnoses: { id: number; icd10_code: string; description: string; diagnosed_on: string }[];
    checkout_tasks: CheckoutTask[];
  };

function tasksQuery() {
  return db('checkout_tasks as t')
    .leftJoin('staff as s', 's.id', 't.completed_by')
    .select('t.id', 't.description', 't.completed_at', 's.id as staff_id', 's.name as staff_name')
    .orderBy('t.id');
}

type TaskRow = { id: number; description: string; completed_at: Date | null; staff_id: number | null; staff_name: string | null };

function toTask(row: TaskRow): CheckoutTask {
  return {
    id: row.id,
    description: row.description,
    completed_at: row.completed_at?.toISOString() ?? null,
    completed_by: row.staff_id === null ? null : { id: row.staff_id, name: row.staff_name! },
  };
}

export async function findVisitDetail(id: number): Promise<VisitDetail | undefined> {
  const visit = await db('appointments as a')
    .join('patients as p', 'p.id', 'a.patient_id')
    .join('staff as s', 's.id', 'a.physician_id')
    .select(
      'a.*',
      db.raw(`p.first_name || ' ' || p.last_name as patient_name`),
      'p.phone as patient_phone',
      'p.date_of_birth as patient_date_of_birth',
      'p.sex as patient_sex',
      's.name as physician_name',
    )
    .where('a.id', id)
    .first();
  if (!visit) return undefined;

  const [diagnoses, tasks] = await Promise.all([
    db('diagnoses')
      .select('id', 'icd10_code', 'description', 'diagnosed_on')
      .where({ patient_id: visit.patient_id })
      .orderBy('diagnosed_on', 'desc'),
    tasksQuery().where('t.appointment_id', id),
  ]);

  return {
    id: visit.id,
    scheduled_at: visit.scheduled_at.toISOString(),
    status: visit.status,
    reason: visit.reason,
    physician: { id: visit.physician_id, name: visit.physician_name },
    patient: {
      id: visit.patient_id,
      name: visit.patient_name,
      phone: visit.patient_phone,
      date_of_birth: visit.patient_date_of_birth,
      sex: visit.patient_sex,
    },
    height_cm: visit.height_cm,
    weight_kg: visit.weight_kg,
    bp_systolic: visit.bp_systolic,
    bp_diastolic: visit.bp_diastolic,
    heart_rate: visit.heart_rate,
    nurse_notes: visit.nurse_notes,
    doctor_notes: visit.doctor_notes,
    diagnoses,
    checkout_tasks: tasks.map(toTask),
  };
}

export async function updateVisit(id: number, changes: VisitChanges) {
  const updated = await db('appointments')
    .where({ id })
    .update({ ...changes, updated_at: db.fn.now() });
  return updated === 1;
}

export async function addCheckoutTask(appointmentId: number, description: string): Promise<CheckoutTask> {
  const [{ id }] = await db('checkout_tasks').insert({ appointment_id: appointmentId, description }).returning('id');
  return toTask(await tasksQuery().where('t.id', id).first());
}

// Ticking records who and when; unticking clears both, so a stale "done by" can't linger.
export async function setTaskCompleted(id: number, staffId: number | null): Promise<CheckoutTask | undefined> {
  const updated = await db('checkout_tasks')
    .where({ id })
    .update(staffId === null ? { completed_at: null, completed_by: null } : { completed_at: db.fn.now(), completed_by: staffId });
  if (updated === 0) return undefined;
  return toTask(await tasksQuery().where('t.id', id).first());
}
