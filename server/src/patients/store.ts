import { db } from '../db.ts';

export function listPatients() {
  return db('patients')
    .select('id', 'first_name', 'last_name', 'date_of_birth', 'sex')
    .orderBy(['last_name', 'first_name']);
}
