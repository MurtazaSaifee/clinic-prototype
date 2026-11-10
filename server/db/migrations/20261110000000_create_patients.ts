import type { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.createTable('patients', (t) => {
    t.increments('id');
    t.text('first_name').notNullable();
    t.text('last_name').notNullable();
    t.date('date_of_birth').notNullable();
    t.enu('sex', ['female', 'male']).notNullable();
    t.text('phone');
    t.text('email');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex) {
  await knex.schema.dropTable('patients');
}
