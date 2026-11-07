import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomic, pool } from './db.js';
export async function migrate() {
  const dir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../database/migrations',
  );
  await atomic(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(71423590)');
    await c.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const name of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
      if ((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount)
        continue;
      await c.query(await readFile(path.join(dir, name), 'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    }
  });
}
if (process.argv[1]?.endsWith('migrate.ts')) {
  await migrate();
  console.log('Migrações aplicadas.');
  await pool.end();
}
