import { Pool, QueryResultRow } from 'pg';

// Single shared connection pool used by both api-service and ws-service.
// NOTE: the entry point must load dotenv (import 'dotenv/config') BEFORE
// importing this file, because the Pool is created at import-time and reads
// process.env.DATABASE_URL right here.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
  process.exit(1);
});

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return pool.query<T>(text, params);
}
