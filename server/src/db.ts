import knex from 'knex';
import pg from 'pg';
import config from '../knexfile.ts';

// Return DATE columns as 'YYYY-MM-DD' strings so time zones can't shift a birthday by a day.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

export const db = knex(config);
