import 'dotenv/config';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const dbName = url.pathname.replace(/^\//, '');
url.pathname = '/postgres';

async function main() {
  const client = new Client({ connectionString: url.toString() });
  await client.connect();

  const res = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName],
  );

  if (res.rowCount && res.rowCount > 0) {
    console.log(`✅ Database "${dbName}" already exists`);
  } else {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✅ Database "${dbName}" created`);
  }

  await client.end();
}

main().catch((err) => {
  console.error('❌ Failed to create database:', err.message);
  process.exit(1);
});
