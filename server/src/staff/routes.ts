import { Router } from 'express';
import { listStaff } from './store.ts';

export const staffRoutes = Router();

staffRoutes.get('/', async (req, res) => {
  res.json(await listStaff());
});
