import { db } from '../db.ts';
import type { StaffRole } from '../enums.ts';

export type Staff = { id: number; name: string; role: StaffRole };

export function listStaff(): Promise<Staff[]> {
  return db('staff').select('id', 'name', 'role').orderBy('id');
}

export function findStaff(id: number): Promise<Staff | undefined> {
  return db('staff').select('id', 'name', 'role').where({ id }).first();
}
