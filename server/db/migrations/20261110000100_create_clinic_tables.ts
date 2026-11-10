import type { Knex } from 'knex';
import { APPOINTMENT_STATUSES, CANDIDATE_STATUSES, CONTACT_OUTCOMES, STAFF_ROLES } from '../../src/enums.ts';

export async function up(knex: Knex) {
  await knex.schema.createTable('staff', (t) => {
    t.increments('id');
    t.text('name').notNullable();
    t.enu('role', STAFF_ROLES).notNullable();
  });

  await knex.schema.createTable('appointments', (t) => {
    t.increments('id');
    t.integer('patient_id').notNullable().references('patients.id');
    t.integer('physician_id').notNullable().references('staff.id');
    t.timestamp('scheduled_at', { useTz: true }).notNullable();
    t.text('reason').notNullable();
    t.enu('status', APPOINTMENT_STATUSES).notNullable().defaultTo('SCHEDULED');
    t.float('height_cm');
    t.float('weight_kg');
    t.integer('bp_systolic');
    t.integer('bp_diastolic');
    t.integer('heart_rate');
    t.text('nurse_notes');
    t.text('doctor_notes');
    t.timestamps(true, true);
    t.index(['scheduled_at']);
  });

  // A physician can't be double-booked, but cancelled and no-show visits free the slot.
  await knex.raw(`
    CREATE UNIQUE INDEX appointments_physician_slot_unique
    ON appointments (physician_id, scheduled_at)
    WHERE status NOT IN ('CANCELLED', 'NO_SHOW')
  `);

  await knex.schema.createTable('checkout_tasks', (t) => {
    t.increments('id');
    t.integer('appointment_id').notNullable().references('appointments.id').onDelete('CASCADE');
    t.text('description').notNullable();
    t.timestamp('completed_at', { useTz: true });
    t.integer('completed_by').references('staff.id');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('diagnoses', (t) => {
    t.increments('id');
    t.integer('patient_id').notNullable().references('patients.id');
    t.text('icd10_code').notNullable();
    t.text('description').notNullable();
    t.date('diagnosed_on').notNullable();
    t.index(['patient_id']);
  });

  await knex.schema.createTable('test_results', (t) => {
    t.increments('id');
    t.integer('patient_id').notNullable().references('patients.id');
    t.integer('appointment_id').references('appointments.id');
    t.text('test_name').notNullable();
    t.text('result').notNullable();
    t.boolean('is_abnormal').notNullable().defaultTo(false);
    t.timestamp('resulted_at', { useTz: true }).notNullable();
    t.timestamp('reviewed_at', { useTz: true });
    t.integer('reviewed_by').references('staff.id');
  });

  await knex.schema.createTable('clinical_studies', (t) => {
    t.increments('id');
    t.text('name').notNullable();
    t.text('description').notNullable();
    t.jsonb('criteria').notNullable();
  });

  await knex.schema.createTable('study_candidates', (t) => {
    t.increments('id');
    t.integer('patient_id').notNullable().references('patients.id');
    t.integer('study_id').notNullable().references('clinical_studies.id');
    t.enu('status', CANDIDATE_STATUSES).notNullable();
    t.jsonb('match_reasons').notNullable();
    t.integer('reviewed_by').notNullable().references('staff.id');
    t.timestamp('reviewed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['patient_id', 'study_id']);
  });

  await knex.schema.createTable('contact_attempts', (t) => {
    t.increments('id');
    t.integer('candidate_id').notNullable().references('study_candidates.id').onDelete('CASCADE');
    t.integer('staff_id').notNullable().references('staff.id');
    t.timestamp('attempted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.enu('outcome', CONTACT_OUTCOMES).notNullable();
    t.text('notes');
  });
}

export async function down(knex: Knex) {
  for (const table of [
    'contact_attempts',
    'study_candidates',
    'clinical_studies',
    'test_results',
    'diagnoses',
    'checkout_tasks',
    'appointments',
    'staff',
  ]) {
    await knex.schema.dropTable(table);
  }
}
