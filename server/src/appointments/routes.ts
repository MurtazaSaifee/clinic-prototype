import { Router } from 'express';
import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '../enums.ts';
import { HttpError, parse } from '../http.ts';
import { findPatient } from '../patients/store.ts';
import { findStaff } from '../staff/store.ts';
import { canMove } from './status.ts';
import { bookAppointment, findVisit, listVisitsOn, moveStatus } from './store.ts';

const dateQuery = z.object({
  date: z.iso.date('Enter a date as YYYY-MM-DD').default(() => new Date().toISOString().slice(0, 10)),
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

appointmentRoutes.post('/:id/status', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { status } = parse(statusBody, req.body);
  const visit = await findVisit(id);
  if (!visit) throw new HttpError(404, 'Visit not found');
  if (!canMove(visit.status, status) || !(await moveStatus(id, visit.status, status))) {
    throw new HttpError(409, `Can't move a visit from ${visit.status} to ${status}`);
  }
  res.json(await findVisit(id));
});
