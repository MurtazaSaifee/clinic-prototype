import { Router } from 'express';
import { listPatients } from './store.ts';

export const patientRoutes = Router();

patientRoutes.get('/', async (req, res) => {
  res.json(await listPatients());
});
