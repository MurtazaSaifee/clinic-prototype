import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { findStaff, type Staff } from './staff/store.ts';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(400, 'Invalid input', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

export async function requireStaff(req: Request): Promise<Staff> {
  const header = req.get('X-Staff-Id');
  if (!header) throw new HttpError(400, 'X-Staff-Id header is required');
  if (!/^\d+$/.test(header)) throw new HttpError(400, 'X-Staff-Id must be a number');
  const staff = await findStaff(Number(header));
  if (!staff) throw new HttpError(400, `Unknown staff id ${header}`);
  return staff;
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof HttpError) {
    const body = err.details === undefined ? { error: err.message } : { error: err.message, details: err.details };
    res.status(err.status).json(body);
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
