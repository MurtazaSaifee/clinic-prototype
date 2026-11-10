import type { Knex } from 'knex';

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: { directory: './db/migrations', extension: 'ts', loadExtensions: ['.ts'] },
  seeds: { directory: './db/seeds', extension: 'ts', loadExtensions: ['.ts'] },
};

export default config;
