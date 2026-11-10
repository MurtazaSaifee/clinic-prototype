import { Router } from 'express';
import { ping } from './store.ts';

export const healthRoutes = Router();

healthRoutes.get('/', async (req, res) => {
  await ping();
  res.json({ ok: true });
});
