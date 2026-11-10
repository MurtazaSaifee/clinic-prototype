import type { Knex } from 'knex';
import { SEXES } from '../../src/enums.ts';

export async function up(knex: Knex) {
  await knex.schema.createTable('patients', (t) => {
    t.increments('id');
    t.text('first_name').notNullable();
    t.text('last_name').notNullable();
    t.date('date_of_birth').notNullable();
    t.enu('sex', SEXES).notNullable();
    t.text('phone').notNullable();
    t.text('email');
    t.timestamps(true, true);
    t.index(['last_name', 'first_name']);
  });
}

export async function down(knex: Knex) {
  await knex.schema.dropTable('patients');
}
