import type { PoolClient } from 'pg';
import pg from 'pg';
export const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Configure DATABASE_URL em .env. Consulte .env.example.');
export const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
pg.types.setTypeParser(1082, (v: string) => v); // SQL date stays date-only.
export function integer(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Montante excedeu a precisão suportada');
  return result;
}
export async function atomic<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
