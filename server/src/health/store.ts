import { db } from '../db.ts';

export async function ping() {
  await db.raw('SELECT 1');
}
