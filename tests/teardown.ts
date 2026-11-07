import pg from 'pg';
export default async function teardown() {
  const schema = process.env.E2E_SCHEMA;
  if (!schema || !/^e2e_[a-f0-9]{32}$/.test(schema)) throw new Error('Schema de teste inválido');
  const p = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await p.query(`DROP SCHEMA "${schema}" CASCADE`);
  await p.end();
}
