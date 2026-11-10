import knex from 'knex';
import type { Knex } from 'knex';
import pg from 'pg';
import config from '../knexfile.ts';

// Return DATE columns as 'YYYY-MM-DD' strings so time zones can't shift a birthday by a day.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

export const db = knex(config);

export async function paginate<T>(query: Knex.QueryBuilder, page: number, pageSize: number) {
  // Postgres won't count(*) alongside ORDER BY, so the count runs on a stripped copy.
  const counted = await query.clone().clearSelect().clearOrder().count({ total: '*' }).first();
  const data: T[] = await query.clone().limit(pageSize).offset((page - 1) * pageSize);
  return { data, page, page_size: pageSize, total: Number(counted?.total ?? 0) };
}
