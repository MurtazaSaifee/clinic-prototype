import { Router } from 'express';
import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '../enums.ts';
import { HttpError, parse, requireStaff } from '../http.ts';
import { findPatient } from '../patients/store.ts';
import { findStaff } from '../staff/store.ts';
import { todayIso } from '../today.ts';
import { canMove } from './status.ts';
import {
  addCheckoutTask,
  bookAppointment,
  countOpenTasks,
  findVisit,
  findVisitDetail,
  listVisitsOn,
  moveStatus,
  setTaskCompleted,
  updateVisit,
} from './store.ts';

const dateQuery = z.object({
  date: z.iso.date('Enter a date as YYYY-MM-DD').default(todayIso),
});

const newAppointment = z.object({
  patient_id: z.number('Choose a patient').int().positive(),
  physician_id: z.number('Choose a physician').int().positive(),
  scheduled_at: z.iso
    .datetime('Choose a date and time')
    .refine((value) => {
      const time = new Date(value);
      return time.getUTCMinutes() % 30 === 0 && time.getUTCSeconds() === 0 && time.getUTCMilliseconds() === 0;
    }, 'Visits start on the hour or half past'),
  reason: z.string('Reason is required').trim().min(1, 'Reason is required'),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });
const statusBody = z.object({ status: z.enum(APPOINTMENT_STATUSES) });

// Ranges wide enough for any adult patient, narrow enough to catch a typo (e.g. 1200 for 120).
const measure = (label: string, min: number, max: number, unit: string, int = true) => {
  const base = z.number(`${label} must be a number`);
  return (int ? base.int(`${label} must be a whole number`) : base)
    .min(min, `${label} must be ${min} to ${max} ${unit}`)
    .max(max, `${label} must be ${min} to ${max} ${unit}`)
    .nullable();
};
const notes = z.string().trim().max(5000).nullable().transform((v) => v || null);

const visitChanges = z
  .object({
    reason: z.string().trim().min(1, 'Reason is required'),
    height_cm: measure('Height', 50, 250, 'cm', false),
    weight_kg: measure('Weight', 20, 400, 'kg', false),
    bp_systolic: measure('Systolic', 60, 260, 'mmHg'),
    bp_diastolic: measure('Diastolic', 30, 160, 'mmHg'),
    heart_rate: measure('Heart rate', 20, 250, 'bpm'),
    nurse_notes: notes,
    doctor_notes: notes,
  })
  .partial()
  .refine(
    (v) => v.bp_systolic == null || v.bp_diastolic == null || v.bp_systolic > v.bp_diastolic,
    { message: 'Diastolic must be lower than systolic', path: ['bp_diastolic'] },
  );

const taskBody = z.object({ description: z.string('Describe the task').trim().min(1, 'Describe the task').max(500) });
const completedBody = z.object({ completed: z.boolean() });

function openTasksMessage(count: number) {
  return `${count} checkout ${count === 1 ? 'task' : 'tasks'} still open`;
}

export const appointmentRoutes = Router();

appointmentRoutes.get('/', async (req, res) => {
  const { date } = parse(dateQuery, req.query);
  res.json(await listVisitsOn(date));
});

appointmentRoutes.post('/', async (req, res) => {
  const input = parse(newAppointment, req.body);
  const [patient, physician] = await Promise.all([findPatient(input.patient_id), findStaff(input.physician_id)]);
  if (!patient) throw new HttpError(400, 'Invalid input', { patient_id: ['Unknown patient'] });
  if (physician?.role !== 'PHYSICIAN') {
    throw new HttpError(400, 'Invalid input', { physician_id: ['Choose a physician'] });
  }

  const visit = await bookAppointment(input);
  if (!visit) throw new HttpError(409, 'That physician already has a visit at this time');
  res.status(201).json(visit);
});

appointmentRoutes.get('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const visit = await findVisitDetail(id);
  if (!visit) throw new HttpError(404, 'Visit not found');
  res.json(visit);
});

appointmentRoutes.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const changes = parse(visitChanges, req.body);
  if (!(await updateVisit(id, changes))) throw new HttpError(404, 'Visit not found');
  res.json(await findVisitDetail(id));
});

appointmentRoutes.post('/:id/status', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { status } = parse(statusBody, req.body);
  const visit = await findVisit(id);
  if (!visit) throw new HttpError(404, 'Visit not found');
  if (!canMove(visit.status, status)) {
    throw new HttpError(409, `Can't move a visit from ${visit.status} to ${status}`);
  }
  if (!(await moveStatus(id, visit.status, status))) {
    const open = status === 'CHECKED_OUT' ? await countOpenTasks(id) : 0;
    throw new HttpError(409, open > 0 ? openTasksMessage(open) : 'This visit was just changed by someone else');
  }
  res.json(await findVisit(id));
});

appointmentRoutes.post('/:id/checkout-tasks', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { description } = parse(taskBody, req.body);
  if (!(await findVisit(id))) throw new HttpError(404, 'Visit not found');
  res.status(201).json(await addCheckoutTask(id, description));
});

export const checkoutTaskRoutes = Router();

checkoutTaskRoutes.patch('/:id', async (req, res) => {
  const staff = await requireStaff(req);
  const { id } = parse(idParam, req.params);
  const { completed } = parse(completedBody, req.body);
  const task = await setTaskCompleted(id, completed ? staff.id : null);
  if (!task) throw new HttpError(404, 'Task not found');
  res.json(task);
});
