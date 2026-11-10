import type { Knex } from 'knex';
import { faker } from '@faker-js/faker';

export async function seed(knex: Knex) {
  await knex('patients').del();

  // Fixed seed and reference date so every run, on any day or machine, produces the same patients.
  faker.seed(42);
  faker.setDefaultRefDate('2026-11-10T00:00:00Z');
  const patients = Array.from({ length: 50 }, () => {
    const sex = faker.person.sex() as 'female' | 'male';
    return {
      first_name: faker.person.firstName(sex),
      last_name: faker.person.lastName(),
      date_of_birth: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }).toISOString().slice(0, 10),
      sex,
      phone: faker.phone.number({ style: 'national' }),
      email: faker.internet.email(),
    };
  });
  await knex('patients').insert(patients);
}
