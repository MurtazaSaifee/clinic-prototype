import { db, paginate } from '../db.ts';
import type { Sex } from '../enums.ts';

export type Patient = {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: Sex;
  phone: string;
  email: string | null;
};

export type PatientInput = Omit<Patient, 'id'>;

const COLUMNS = ['id', 'first_name', 'last_name', 'date_of_birth', 'sex', 'phone', 'email'];

// Escape LIKE wildcards so a typed % or _ matches literally.
function contains(text: string) {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

export function searchPatients(q: string, page: number, pageSize: number) {
  const query = db('patients').select(COLUMNS).orderBy(['last_name', 'first_name', 'id']);
  const digits = q.replace(/\D/g, '');

  if (/\p{L}/u.test(q)) {
    const [last, first] = q.split(',').map((part) => part.trim());
    if (first !== undefined) {
      query.whereILike('last_name', contains(last)).whereILike('first_name', contains(first));
    } else {
      query.where((w) => w.whereILike('first_name', contains(last)).orWhereILike('last_name', contains(last)));
    }
  } else if (digits) {
    // Phones are stored as typed, so compare digits only on both sides.
    query.whereRaw(`regexp_replace(phone, '\\D', '', 'g') LIKE ?`, [contains(digits)]);
  }

  return paginate<Patient>(query, page, pageSize);
}

export function findPatient(id: number): Promise<Patient | undefined> {
  return db('patients').select(COLUMNS).where({ id }).first();
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  const [patient] = await db('patients').insert(input).returning(COLUMNS);
  return patient;
}

export async function updatePatient(id: number, changes: Partial<PatientInput>): Promise<Patient | undefined> {
  const [patient] = await db('patients')
    .where({ id })
    .update({ ...changes, updated_at: db.fn.now() })
    .returning(COLUMNS);
  return patient;
}
