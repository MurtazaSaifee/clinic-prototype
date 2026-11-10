import { Router } from 'express';
import { z } from 'zod';
import { HttpError, pageQuery, parse, requireStaff } from '../http.ts';
import { findResult, listResults, markReviewed } from './store.ts';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const listQuery = pageQuery.extend({
  reviewed: z.enum(['true', 'false'], 'reviewed must be true or false').default('false').transform((v) => v === 'true'),
});

export const testResultRoutes = Router();

testResultRoutes.get('/', async (req, res) => {
  const { reviewed, page, page_size } = parse(listQuery, req.query);
  res.json(await listResults(reviewed, page, page_size));
});

testResultRoutes.post('/:id/review', async (req, res) => {
  const staff = await requireStaff(req);
  const { id } = parse(idParam, req.params);
  const existing = await findResult(id);
  if (!existing) throw new HttpError(404, 'Test result not found');
  if (!(await markReviewed(id, staff.id))) throw new HttpError(409, 'This result was already reviewed');
  res.json(await findResult(id));
});
