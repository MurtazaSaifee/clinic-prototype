import { Router } from 'express';
import { z } from 'zod';
import { SEXES } from '../enums.ts';
import { HttpError, pageQuery, parse } from '../http.ts';
import { createPatient, findPatient, searchPatients, updatePatient } from './store.ts';

const required = (field: string) => z.string(`${field} is required`).trim().min(1, `${field} is required`);

const patientInput = z.object({
  first_name: required('First name'),
  last_name: required('Last name'),
  date_of_birth: required('Date of birth')
    .pipe(z.iso.date('Enter a valid date'))
    .refine((date) => date <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future'),
  sex: z.enum(SEXES, 'Choose female or male'),
  phone: z
    .string('Phone is required')
    .trim()
    .refine((phone) => phone.replace(/\D/g, '').length >= 7, 'Phone needs at least 7 digits'),
  // The form sends an empty string for a blank email; store that as null.
  email: z.preprocess((v) => (v === '' ? null : v), z.email('Enter a valid email').nullable().optional()),
});

const searchQuery = pageQuery.extend({ q: z.string().trim().default('') });
const idParam = z.object({ id: z.coerce.number().int().positive() });

export const patientRoutes = Router();

patientRoutes.get('/', async (req, res) => {
  const { q, page, page_size } = parse(searchQuery, req.query);
  res.json(await searchPatients(q, page, page_size));
});

patientRoutes.post('/', async (req, res) => {
  const input = parse(patientInput, req.body);
  res.status(201).json(await createPatient({ ...input, email: input.email ?? null }));
});

patientRoutes.get('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const patient = await findPatient(id);
  if (!patient) throw new HttpError(404, 'Patient not found');
  res.json(patient);
});

patientRoutes.patch('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const changes = parse(patientInput.partial(), req.body);
  const patient = await updatePatient(id, changes);
  if (!patient) throw new HttpError(404, 'Patient not found');
  res.json(patient);
});
