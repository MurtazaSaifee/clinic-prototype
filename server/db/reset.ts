// Drops and recreates the database, runs every migration, then loads synthetic data.
import knex from 'knex';
import config from '../knexfile.ts';

const url = new URL(process.env.DATABASE_URL!);
const dbName = url.pathname.slice(1);

// Connect to the default 'postgres' database, since you can't drop the one you're connected to.
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
const admin = knex({ client: 'pg', connection: adminUrl.toString() });
await admin.raw('DROP DATABASE IF EXISTS ?? WITH (FORCE)', [dbName]);
await admin.raw('CREATE DATABASE ??', [dbName]);
await admin.destroy();

const db = knex(config);
await db.migrate.latest();
await db.seed.run();
await db.destroy();
console.log(`Database "${dbName}" reset and seeded.`);
