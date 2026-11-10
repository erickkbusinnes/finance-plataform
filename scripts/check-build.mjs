import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import pg from 'pg';

if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL.');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!url.pathname.endsWith('_test')) throw new Error('O banco de testes deve terminar em _test.');
const schema = 'build_' + randomUUID().replaceAll('-', '');
const admin = new pg.Pool({ connectionString: url.toString() });
let child;
try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    PORT: '3003',
    MAIL_MODE: 'disabled',
    DEPLOYMENT_MODE: 'preview',
    RENDER_EXTERNAL_URL: 'https://build.clara.example',
  };
  delete env.APP_ORIGIN;
  let announced = false;
  child = spawn(process.execPath, ['scripts/start-cloud.mjs'], {
    env,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  child.stdout.on('data', (chunk) => {
    if (chunk.toString().includes('Server listening at')) announced = true;
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) break;
    try {
      if (!announced) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      const response = await fetch('http://127.0.0.1:3003/api/health');
      if (response.ok && (await response.json()).status === 'ok') {
        ready = true;
        break;
      }
    } catch {
      /* The process is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'A API compilada não iniciou na porta 3003.');
  assert.equal(
    Number((await admin.query(`SELECT count(*) FROM "${schema}".schema_migrations`)).rows[0].count),
    4,
  );
  const migration = spawnSync(process.execPath, ['dist/migrate.js'], {
    cwd: 'apps/api',
    env,
    stdio: 'pipe',
  });
  assert.equal(migration.status, 0, 'Migração compilada deve poder rodar novamente.');
  const site = await fetch('http://127.0.0.1:3003/cadastro');
  assert.equal(site.status, 200);
  assert.match(site.headers.get('content-type'), /text\/html/);
  const html = await site.text();
  const assetPath = html.match(/src="([^\"]+\.js)"/)[1];
  const asset = await fetch('http://127.0.0.1:3003' + assetPath);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  for (const path of ['/api/missing', '/.env', '/assets/missing.js']) {
    assert.equal((await fetch('http://127.0.0.1:3003' + path)).status, 404);
  }
  let cookie;
  async function request(path, body) {
    return fetch('http://127.0.0.1:3003/api' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Clara-Client': 'web',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(path.endsWith('/purchases') ? { 'Idempotency-Key': randomUUID() } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  assert.equal((await request('/auth/me')).status, 401);
  assert.deepEqual(await (await request('/config')).json(), { preview: true, mailEnabled: false });
  const registration = await request('/auth/register', {
    name: 'Teste artefato compilado',
    email: `${schema}@example.com`,
    password: 'fixture-build-test-only-123',
  });
  assert.equal(registration.status, 201);
  assert.match(registration.headers.get('set-cookie'), /; Secure/);
  cookie = registration.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/auth/me')).status, 200);
  assert.equal(
    (await request('/auth/forgot-password', { email: `${schema}@example.com` })).status,
    503,
  );
  assert.equal((await request('/auth/resend-verification', {})).status, 503);
  assert.equal((await request('/auth/verify-email', { token: '0'.repeat(64) })).status, 503);
  assert.equal(
    (
      await request('/auth/reset-password', {
        token: '0'.repeat(64),
        password: 'fixture-disabled-mail-123',
      })
    ).status,
    503,
  );
  assert.equal(
    Number((await admin.query(`SELECT count(*) FROM "${schema}".auth_tokens`)).rows[0].count),
    0,
  );
  assert.equal(
    Number((await admin.query(`SELECT count(*) FROM "${schema}".mail_outbox`)).rows[0].count),
    0,
  );
  const w = await (
    await request('/workspaces', { name: 'Build isolado', kind: 'personal' })
  ).json();
  const card = await (
    await request(`/workspaces/${w.id}/cards`, {
      name: 'Cartão build',
      limitCents: 10000,
      closingDay: 25,
      dueDay: 5,
    })
  ).json();
  assert.equal(
    (
      await request(`/workspaces/${w.id}/cards/${card.id}/purchases`, {
        description: 'Compra build',
        amountCents: 1000,
        date: '2026-11-07',
        installments: 3,
      })
    ).status,
    201,
  );
  const statements = await (
    await request(`/workspaces/${w.id}/cards/${card.id}/statements`)
  ).json();
  assert.deepEqual(
    statements.map((statement) => statement.totalCents),
    [334, 333, 333],
  );
  const filters = '?from=2026-11-01&to=2026-11-30';
  const pdf = await request(`/workspaces/${w.id}/export.pdf${filters}`);
  assert.equal(pdf.status, 200);
  assert.match(Buffer.from(await pdf.arrayBuffer()).toString('ascii', 0, 8), /^%PDF-/);
  const xlsx = await request(`/workspaces/${w.id}/export.xlsx${filters}`);
  assert.equal(xlsx.status, 200);
  assert.equal(Buffer.from(await xlsx.arrayBuffer()).toString('ascii', 0, 2), 'PK');
  assert.equal((await request('/docs/json')).status, 200);
  console.log(
    'Build de hospedagem verificado: início em produção, migração compilada repetível, web e API na mesma origem, cookie Secure, demonstração sem prometer e-mail, PostgreSQL, parcelas exatas, PDF, Excel e OpenAPI. Dados isolados.',
  );
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
