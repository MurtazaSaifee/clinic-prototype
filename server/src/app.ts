import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';

export const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  await db.raw('SELECT 1');
  res.json({ ok: true });
});

app.get('/api/patients', async (req, res) => {
  const patients = await db('patients')
    .select('id', 'first_name', 'last_name', 'date_of_birth', 'sex')
    .orderBy(['last_name', 'first_name']);
  res.json(patients);
});

// Express 5 forwards rejected promises here, so routes don't need try/catch.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
