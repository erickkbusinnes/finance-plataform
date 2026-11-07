import { money, parseMoney, transactionSchema } from '@clara/shared';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import pg from 'pg';
// Each run owns a fresh schema in an explicitly configured test database.
if (!process.env.TEST_DATABASE_URL)
  throw new Error('Configure TEST_DATABASE_URL. Nunca utilize o banco de produção.');
const testUrl = new URL(process.env.TEST_DATABASE_URL);
if (!testUrl.pathname.endsWith('_test'))
  throw new Error('O nome do banco de teste deve terminar em _test.');
const schema = 'test_' + randomUUID().replaceAll('-', '');
const admin = new pg.Pool({ connectionString: testUrl.toString() });
await admin.query(`CREATE SCHEMA "${schema}"`);
testUrl.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = testUrl.toString();
const { pool } = await import('../src/db.js');
const { migrate } = await import('../src/migrate.js');
const { buildApp } = await import('../src/app.js');
const app = await buildApp({ rateLimit: false });
let cookie = '',
  otherCookie = '',
  wid = '',
  otherWid = '',
  accountA = '',
  accountB = '',
  category = '',
  income = '',
  transactionId = '';
const headers = (auth = cookie) => ({ 'x-clara-client': 'web', ...(auth ? { cookie: auth } : {}) });
async function call(method: string, url: string, payload?: any, extra: any = {}, auth = cookie) {
  return app.inject({
    method: method as any,
    url: '/api' + url,
    payload,
    headers: { ...headers(auth), ...extra },
  });
}
const route = (suffix: string) => `/workspaces/${wid}${suffix}`;
const txn = (overrides: any = {}) => ({
  description: 'Registro de teste',
  kind: 'expense',
  amountCents: 1234,
  date: '2026-11-07',
  accountId: accountA,
  categoryId: category,
  ...overrides,
});
const summary = async () =>
  (await call('GET', route('/summary?from=2026-11-01&to=2026-11-30'))).json();
const legacy = {
  user: randomUUID(),
  workspace: randomUUID(),
  account: randomUUID(),
  transaction: randomUUID(),
};
before(async () => {
  // Upgrade a populated version-1 schema rather than testing only empty installations.
  await pool.query(
    await readFile(
      new URL('../../../database/migrations/001_foundation.sql', import.meta.url),
      'utf8',
    ),
  );
  await pool.query(
    'CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())',
  );
  await pool.query('INSERT INTO schema_migrations(name) VALUES($1)', ['001_foundation.sql']);
  await pool.query('INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)', [
    legacy.user,
    'Usuário legado de teste',
    'legacy@example.com',
    'fixture-not-used-for-authentication',
  ]);
  await pool.query('INSERT INTO workspaces(id,name,kind) VALUES($1,$2,$3)', [
    legacy.workspace,
    'Ambiente legado de teste',
    'personal',
  ]);
  await pool.query(
    "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",
    [legacy.workspace, legacy.user],
  );
  await pool.query(
    "INSERT INTO financial_accounts(id,workspace_id,name,type) VALUES($1,$2,'Conta legada','checking')",
    [legacy.account, legacy.workspace],
  );
  await pool.query(
    "INSERT INTO transactions(id,workspace_id,description,kind,amount_cents,date,account_id,idempotency_key) VALUES($1,$2,'Abertura legada','opening',12345,'2026-11-01',$3,$4)",
    [legacy.transaction, legacy.workspace, legacy.account, randomUUID()],
  );
  await pool.query(
    'INSERT INTO transaction_entries(id,workspace_id,transaction_id,account_id,amount_cents) VALUES($1,$2,$3,$4,12345)',
    [randomUUID(), legacy.workspace, legacy.transaction, legacy.account],
  );
  await migrate();
  await migrate();
  await app.ready();
});
after(async () => {
  await app.close();
  await pool.end();
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
});
test('migrações preservam dados financeiros preexistentes e são repetíveis', async () => {
  const a = (await pool.query('SELECT * FROM financial_accounts WHERE id=$1', [legacy.account]))
    .rows[0];
  assert.equal(a.name, 'Conta legada');
  assert.equal(a.archived_at, null);
  assert.equal(a.version, 1);
  assert.equal(
    (
      await pool.query(
        'SELECT sum(amount_cents) AS total FROM transaction_entries WHERE account_id=$1',
        [legacy.account],
      )
    ).rows[0].total,
    '12345',
  );
  const t = (
    await pool.query('SELECT tags,refund_of FROM transactions WHERE id=$1', [legacy.transaction])
  ).rows[0];
  assert.deepEqual(t.tags, []);
  assert.equal(t.refund_of, null);
  assert.equal((await pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count, '4');
});
test('conversão monetária exata e validação de datas', () => {
  assert.equal(parseMoney('1.234,56'), 123456);
  assert.equal(parseMoney('0,01'), 1);
  assert.equal(money(Number.MAX_SAFE_INTEGER), 'R$\u00a090.071.992.547.409,91');
  assert.equal(money(-1), '-R$\u00a00,01');
  assert.throws(() => money(Number.MAX_SAFE_INTEGER + 1));
  assert.equal(parseMoney('-0,09'), -9);
  assert.throws(() => parseMoney('1,001'));
  assert.throws(() => parseMoney('12.34'));
  assert.throws(() => parseMoney('1..000'));
  assert.equal(parseMoney('1.000'), 100000);
  assert.throws(() => parseMoney('NaN'));
  assert.throws(() => parseMoney('100000000000,00'));
  assert.equal(transactionSchema.safeParse(txn({ date: '2026-02-30' })).success, false);
});
test('saúde do banco e documentação OpenAPI', async () => {
  assert.equal((await call('GET', '/health')).statusCode, 200);
  const r = await call('GET', '/docs/json');
  assert.equal(r.statusCode, 200);
  assert.ok(r.json().paths['/api/workspaces/{wid}/transactions']);
});
test('rotas protegidas e proteção contra CSRF', async () => {
  assert.equal((await call('GET', '/workspaces', undefined, {}, '')).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'a@a.com', password: '123456789012' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'POST',
        '/auth/login',
        { email: 'a@a.com', password: '123456789012' },
        { origin: 'https://evil.test' },
      )
    ).statusCode,
    403,
  );
});
test('cadastro persiste hash Argon2 e cookie protegido', async () => {
  const r = await call('POST', '/auth/register', {
    name: 'Ana Teste',
    email: 'ANA@example.com',
    password: 'uma-senha-forte-123',
  });
  assert.equal(r.statusCode, 201, r.body);
  cookie = String(r.headers['set-cookie']).split(';')[0];
  assert.match(String(r.headers['set-cookie']), /HttpOnly/);
  assert.match(String(r.headers['set-cookie']), /SameSite=Lax/);
  const row = (await pool.query('SELECT * FROM users WHERE email=$1', ['ana@example.com'])).rows[0];
  assert.match(row.password_hash, /argon2id/);
  assert.equal(r.json().password_hash, undefined);
  assert.equal(
    (await call('POST', '/auth/login', { email: 'ana@example.com', password: 'senha-errada-123' }))
      .statusCode,
    401,
  );
});
test('dois ambientes e dois usuários têm isolamento', async () => {
  const r = await call('POST', '/workspaces', { name: 'Pessoal', kind: 'personal' });
  assert.equal(r.statusCode, 201, r.body);
  wid = r.json().id;
  otherWid = (await call('POST', '/workspaces', { name: 'Empresa', kind: 'business' })).json().id;
  const other = await call('POST', '/auth/register', {
    name: 'Outro Usuário',
    email: 'outro@example.com',
    password: 'outra-senha-forte-123',
  });
  otherCookie = String(other.headers['set-cookie']).split(';')[0];
  assert.equal((await call('GET', route('/accounts'), undefined, {}, otherCookie)).statusCode, 404);
  assert.equal(
    (await call('POST', route('/categories'), { name: 'Ataque', kind: 'expense' }, {}, otherCookie))
      .statusCode,
    404,
  );
  assert.equal((await call('GET', '/workspaces', undefined, {}, otherCookie)).json().length, 0);
});
test('contas: saldo inicial gera trilha sem virar receita', async () => {
  const a = await call('POST', route('/accounts'), {
    name: 'Banco',
    type: 'checking',
    openingCents: 100000,
    date: '2026-11-01',
  });
  assert.equal(a.statusCode, 201, a.body);
  accountA = a.json().id;
  accountB = (
    await call('POST', route('/accounts'), {
      name: 'Carteira',
      type: 'cash',
      openingCents: 0,
      date: '2026-11-01',
    })
  ).json().id;
  const s = await summary();
  assert.equal(s.balanceCents, 100000);
  assert.equal(s.incomeCents, 0);
  assert.equal(s.expenseCents, 0);
  assert.equal(
    (await call('GET', route('/transactions?from=2026-11-01&to=2026-11-30'))).json().total,
    0,
  );
});
test('categorias validadas e duplicadas rejeitadas', async () => {
  const r = await call('POST', route('/categories'), {
    name: 'Alimentação',
    kind: 'expense',
    color: '#10b981',
  });
  assert.equal(r.statusCode, 201);
  category = r.json().id;
  income = (await call('POST', route('/categories'), { name: 'Salário', kind: 'income' })).json()
    .id;
  assert.equal(
    (await call('POST', route('/categories'), { name: 'Alimentação', kind: 'expense' })).statusCode,
    409,
  );
});
test('receitas e despesas atualizam saldo e indicadores', async () => {
  const r = await call('POST', route('/transactions'), txn(), { 'idempotency-key': randomUUID() });
  assert.equal(r.statusCode, 201, r.body);
  transactionId = r.json().id;
  assert.equal(
    (
      await call(
        'POST',
        route('/transactions'),
        txn({ kind: 'income', amountCents: 250000, categoryId: income, description: 'Salário' }),
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    201,
  );
  const s = await summary();
  assert.equal(s.balanceCents, 348766);
  assert.equal(s.incomeCents, 250000);
  assert.equal(s.expenseCents, 1234);
  assert.equal(s.resultCents, 248766);
  assert.equal(s.categories[0].amountCents, 1234);
});
test('transferência concorrente é atômica e idempotente', async () => {
  const key = randomUUID();
  const b = txn({
    kind: 'transfer',
    categoryId: null,
    amountCents: 10000,
    destinationAccountId: accountB,
  });
  const out = await Promise.all(
    Array.from({ length: 8 }, () =>
      call('POST', route('/transactions'), b, { 'idempotency-key': key }),
    ),
  );
  assert.equal(out.filter((r) => r.statusCode === 201).length, 1);
  assert.equal(out.filter((r) => r.statusCode === 200).length, 7);
  const accounts = (await call('GET', route('/accounts'))).json();
  assert.equal(accounts.find((a: any) => a.id === accountB).balanceCents, 10000);
  assert.equal((await summary()).balanceCents, 348766);
  assert.equal((await summary()).expenseCents, 1234);
  assert.equal(
    (
      await call(
        'POST',
        route('/transactions'),
        { ...b, amountCents: 9 },
        { 'idempotency-key': key },
      )
    ).statusCode,
    409,
  );
});
test('valores inválidos e transferências para mesma conta rejeitados', async () => {
  for (const b of [
    txn({ amountCents: 0 }),
    txn({ amountCents: -1 }),
    txn({ amountCents: 1.2 }),
    txn({ date: '2026-02-30' }),
    txn({ kind: 'transfer', destinationAccountId: accountA, categoryId: null }),
    txn({ kind: 'transfer', destinationAccountId: accountB }),
    txn({ categoryId: income }),
  ])
    assert.equal(
      (await call('POST', route('/transactions'), b, { 'idempotency-key': randomUUID() }))
        .statusCode,
      400,
    );
});
test('referência a outra empresa falha sem deixar gravações parciais', async () => {
  const alien = (
    await call('POST', `/workspaces/${otherWid}/accounts`, {
      name: 'Conta empresa',
      date: '2026-11-01',
    })
  ).json().id;
  const before = (await pool.query('SELECT count(*) FROM transaction_entries')).rows[0].count;
  assert.equal(
    (
      await call(
        'POST',
        route('/transactions'),
        txn({ kind: 'transfer', destinationAccountId: alien, categoryId: null }),
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (await pool.query('SELECT count(*) FROM transaction_entries')).rows[0].count,
    before,
  );
  assert.equal(
    (await call('GET', `/workspaces/${otherWid}/summary?from=2026-11-01&to=2026-11-30`)).json()
      .balanceCents,
    0,
  );
});
test('edição com versão e auditoria, conflito de concorrência', async () => {
  const r = await call('PUT', route(`/transactions/${transactionId}`), {
    ...txn({ amountCents: 2000 }),
    version: 1,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await summary()).expenseCents, 2000);
  assert.equal(
    (await call('PUT', route(`/transactions/${transactionId}`), { ...txn(), version: 1 }))
      .statusCode,
    409,
  );
  assert.equal(
    (await call('GET', route(`/transactions/${transactionId}/history`))).json().length,
    2,
  );
});
test('cancelamento preserva histórico e reverte cálculo de saldo', async () => {
  assert.equal(
    (await call('DELETE', route(`/transactions/${transactionId}`), { version: 2 })).statusCode,
    200,
  );
  assert.equal((await summary()).expenseCents, 0);
  assert.equal((await summary()).balanceCents, 350000);
  assert.equal(
    (await call('GET', route(`/transactions/${transactionId}/history`))).json().length,
    3,
  );
});
test('saldo negativo é explícito, não bloqueia registro de dívida de caixa', async () => {
  const a = (
    await call('POST', route('/accounts'), {
      name: 'Cheque especial',
      openingCents: -1000,
      date: '2026-11-01',
    })
  ).json().id;
  const list = (await call('GET', route('/accounts'))).json();
  assert.equal(list.find((v: any) => v.id === a).balanceCents, -1000);
});
test('orçamento usa despesas do mês e isola categorias', async () => {
  assert.equal(
    (
      await call('POST', route('/budgets'), {
        categoryId: category,
        month: '2026-11',
        limitCents: 1000,
      })
    ).statusCode,
    201,
  );
  await call('POST', route('/transactions'), txn({ amountCents: 1500 }), {
    'idempotency-key': randomUUID(),
  });
  const b = (await call('GET', route('/budgets?month=2026-11'))).json();
  assert.equal(b[0].spentCents, 1500);
  assert.equal(
    (await call('POST', route('/budgets'), { categoryId: income, month: '2026-11', limitCents: 1 }))
      .statusCode,
    400,
  );
  await call('POST', route('/budgets'), {
    categoryId: category,
    month: '2026-11',
    limitCents: 2000,
  });
  assert.equal((await call('GET', route('/budgets?month=2026-11'))).json().length, 1);
});
test('metas: aporte idempotente não cria dinheiro na conta', async () => {
  const id = (await call('POST', route('/goals'), { name: 'Reserva', targetCents: 100000 })).json()
    .id;
  const before = (await summary()).balanceCents,
    key = randomUUID();
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await call(
          'POST',
          route(`/goals/${id}/contributions`),
          { amountCents: 10000 },
          { 'idempotency-key': key },
        )
      ).statusCode,
      201,
    );
  assert.equal((await call('GET', route('/goals'))).json()[0].contributedCents, 10000);
  assert.equal((await summary()).balanceCents, before);
});
test('busca, filtros e CSV refletem registros reais', async () => {
  const found = await call(
    'GET',
    route('/transactions?from=2026-11-01&to=2026-11-30&kind=income&search=Sal%C3%A1rio'),
  );
  assert.equal(found.json().total, 1);
  const csv = await call('GET', route('/export.csv?from=2026-11-01&to=2026-11-30&kind=income'));
  assert.equal(csv.statusCode, 200, csv.body);
  assert.match(csv.body, /Salário/);
  assert.doesNotMatch(csv.body, /Registro de teste/);
  assert.equal(
    (await call('GET', route('/transactions?from=2026-12-01&to=2026-11-01'))).statusCode,
    400,
  );
});
test('visualizador consulta mas não altera dados', async () => {
  const user = (await pool.query('SELECT id FROM users WHERE email=$1', ['outro@example.com']))
    .rows[0];
  await pool.query(
    "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'viewer')",
    [wid, user.id],
  );
  assert.equal((await call('GET', route('/accounts'), undefined, {}, otherCookie)).statusCode, 200);
  assert.equal(
    (
      await call(
        'POST',
        route('/accounts'),
        { name: 'Sem permissão', date: '2026-11-01' },
        {},
        otherCookie,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await call('DELETE', route(`/transactions/${transactionId}`), { version: 3 }, {}, otherCookie))
      .statusCode,
    403,
  );
});
test('verificação de e-mail é de uso único', async () => {
  const row = (
    await pool.query(
      "SELECT * FROM mail_outbox WHERE recipient='ana@example.com' AND kind='verify'",
    )
  ).rows[0];
  assert.equal((await call('POST', '/auth/verify-email', { token: row.token })).statusCode, 200);
  assert.equal((await call('GET', '/auth/me')).json().emailVerified, true);
  assert.equal((await call('POST', '/auth/verify-email', { token: row.token })).statusCode, 400);
});
test('recuperação invalida sessões, token é de uso único e dados persistem', async () => {
  assert.equal(
    (await call('POST', '/auth/forgot-password', { email: 'ana@example.com' })).statusCode,
    200,
  );
  const row = (
    await pool.query("SELECT * FROM mail_outbox WHERE recipient='ana@example.com' AND kind='reset'")
  ).rows[0];
  assert.equal(
    (
      await call('POST', '/auth/reset-password', {
        token: row.token,
        password: 'nova-senha-forte-123',
      })
    ).statusCode,
    200,
  );
  assert.equal((await call('GET', '/auth/me')).statusCode, 401);
  assert.equal(
    (
      await call('POST', '/auth/reset-password', {
        token: row.token,
        password: 'nova-senha-forte-123',
      })
    ).statusCode,
    400,
  );
  const r = await call('POST', '/auth/login', {
    email: 'ana@example.com',
    password: 'nova-senha-forte-123',
  });
  assert.equal(r.statusCode, 200);
  cookie = String(r.headers['set-cookie']).split(';')[0];
  assert.equal((await call('GET', '/workspaces')).json().length, 2);
  assert.equal((await call('GET', route('/accounts'))).json().length, 3);
});
async function coreFixture() {
  const w = (
    await call('POST', '/workspaces', { name: 'Consolidação teste', kind: 'personal' })
  ).json().id;
  const root = `/workspaces/${w}`;
  const a = (
    await call('POST', root + '/accounts', {
      name: 'Conta núcleo',
      date: '2026-10-01',
      openingCents: 10000,
    })
  ).json().id;
  const cat = (await call('POST', root + '/categories', { name: 'Base', kind: 'expense' })).json()
    .id;
  return { w, root, a, cat };
}
test('contas: edição/arquivamento não alteram saldo, versão e novas operações protegidas', async () => {
  const { root, a, cat } = await coreFixture();
  let row = (await call('GET', root + '/accounts')).json()[0];
  assert.equal(
    (
      await call('PATCH', root + '/accounts/' + a, {
        name: 'Renomeada',
        type: 'cash',
        archived: true,
        version: row.version,
      })
    ).statusCode,
    200,
  );
  row = (await call('GET', root + '/accounts')).json()[0];
  assert.equal(row.name, 'Renomeada');
  assert.equal(row.balanceCents, 10000);
  assert.ok(row.archivedAt);
  assert.equal(
    (
      await call('POST', root + '/transactions', txn({ accountId: a, categoryId: cat }), {
        'idempotency-key': randomUUID(),
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call('PATCH', root + '/accounts/' + a, {
        name: 'Conflito',
        type: 'cash',
        archived: false,
        version: 1,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call('PATCH', root + '/accounts/' + a, {
        name: 'Renomeada',
        type: 'cash',
        archived: false,
        version: row.version,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call('POST', root + '/transactions', txn({ accountId: a, categoryId: cat }), {
        'idempotency-key': randomUUID(),
      })
    ).statusCode,
    201,
  );
});
test('subcategorias: tipo, hierarquia, ciclos e arquivamento preservam integridade', async () => {
  const { root, cat } = await coreFixture();
  const child = (
    await call('POST', root + '/categories', { name: 'Filha', kind: 'expense', parentId: cat })
  ).json().id;
  assert.ok(child);
  assert.equal(
    (
      await call('POST', root + '/categories', {
        name: 'Tipo errado',
        kind: 'income',
        parentId: cat,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await call('POST', root + '/categories', { name: 'Neta', kind: 'expense', parentId: child }))
      .statusCode,
    400,
  );
  assert.equal(
    (
      await call('PATCH', root + '/categories/' + cat, {
        name: 'Base',
        kind: 'expense',
        color: '#10b981',
        archived: true,
        version: 1,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call('PATCH', root + '/categories/' + cat, {
        name: 'Base',
        kind: 'expense',
        color: '#10b981',
        parentId: child,
        archived: false,
        version: 1,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call('PATCH', root + '/categories/' + child, {
        name: 'Filha editada',
        kind: 'expense',
        color: '#112233',
        parentId: cat,
        archived: true,
        version: 1,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call('PATCH', root + '/categories/' + cat, {
        name: 'Base',
        kind: 'expense',
        color: '#10b981',
        archived: true,
        version: 1,
      })
    ).statusCode,
    200,
  );
});
test('extrato: abertura, evolução, paginação e cancelamento em snapshot consistente', async () => {
  const { root, a, cat } = await coreFixture();
  for (let i = 0; i < 27; i++)
    assert.equal(
      (
        await call(
          'POST',
          root + '/transactions',
          txn({ description: `Extrato ${i}`, accountId: a, categoryId: cat, amountCents: 10 }),
          { 'idempotency-key': randomUUID() },
        )
      ).statusCode,
      201,
    );
  const p1 = (
    await call('GET', root + `/accounts/${a}/statement?from=2026-11-01&to=2026-11-30`)
  ).json();
  assert.equal(p1.openingCents, 10000);
  assert.equal(p1.closingCents, 9730);
  assert.equal(p1.total, 27);
  assert.equal(p1.items[0].balanceCents, 9990);
  const p2 = (
    await call('GET', root + `/accounts/${a}/statement?from=2026-11-01&to=2026-11-30&page=2`)
  ).json();
  assert.equal(p2.items[0].balanceCents, 9740);
  assert.equal(p2.items[1].balanceCents, 9730);
  assert.equal(
    (
      await call(
        'GET',
        root + `/accounts/${a}/statement?from=2026-11-01&to=2026-11-30`,
        undefined,
        {},
        otherCookie,
      )
    ).statusCode,
    404,
  );
});
test('reembolsos: limite concorrente, saldo positivo e despesa líquida sem virar receita', async () => {
  const { root, a, cat } = await coreFixture();
  const source = (
    await call(
      'POST',
      root + '/transactions',
      txn({ accountId: a, categoryId: cat, amountCents: 1000 }),
      { 'idempotency-key': randomUUID() },
    )
  ).json().id;
  const b = txn({
    kind: 'refund',
    refundOf: source,
    accountId: a,
    categoryId: cat,
    amountCents: 700,
  });
  const out = await Promise.all([
    call('POST', root + '/transactions', b, { 'idempotency-key': randomUUID() }),
    call('POST', root + '/transactions', b, { 'idempotency-key': randomUUID() }),
  ]);
  assert.equal(out.filter((r) => r.statusCode === 201).length, 1);
  assert.equal(out.filter((r) => r.statusCode === 409).length, 1);
  const s = (await call('GET', root + '/summary?from=2026-11-01&to=2026-11-30')).json();
  assert.equal(s.expenseCents, 300);
  assert.equal(s.refundCents, 700);
  assert.equal(s.incomeCents, 0);
  assert.equal(s.balanceCents, 9700);
  assert.equal(
    (await call('DELETE', root + '/transactions/' + source, { version: 1 })).statusCode,
    409,
  );
  assert.equal(
    (
      await call(
        'POST',
        root + '/transactions',
        { ...b, date: '2026-11-01' },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(
        'POST',
        root + '/transactions',
        { ...b, refundOf: transactionId },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    400,
  );
  const refund = out.find((r) => r.statusCode === 201)!.json().id;
  assert.equal(
    (await call('DELETE', root + '/transactions/' + refund, { version: 1 })).statusCode,
    200,
  );
  assert.equal(
    (await call('DELETE', root + '/transactions/' + source, { version: 1 })).statusCode,
    200,
  );
});
test('tags, faixa de valores, ordenação e categoria principal abrangem subcategorias', async () => {
  const { root, a, cat } = await coreFixture();
  const child = (
    await call('POST', root + '/categories', { name: 'Sub', kind: 'expense', parentId: cat })
  ).json().id;
  for (const amountCents of [100, 200, 300])
    await call(
      'POST',
      root + '/transactions',
      txn({ accountId: a, categoryId: child, amountCents, tags: ['Viagem', 'viagem', 'hotel'] }),
      { 'idempotency-key': randomUUID() },
    );
  const r = (
    await call(
      'GET',
      root +
        `/transactions?from=2026-11-01&to=2026-11-30&tag=viagem&minCents=150&maxCents=300&sort=amount_desc&categoryId=${cat}`,
    )
  ).json();
  assert.equal(r.total, 2);
  assert.equal(r.items[0].amountCents, 300);
  assert.deepEqual(r.items[0].tags, ['viagem', 'hotel']);
  assert.equal(
    (
      await call(
        'GET',
        root + '/transactions?from=2026-11-01&to=2026-11-30&minCents=100&maxCents=1',
      )
    ).statusCode,
    400,
  );
  assert.equal((await call('GET', root + '/tags')).json().length, 2);
});
test('comparação mensal usa mês calendário e reembolso de mês anterior permanece caixa', async () => {
  const { root, a, cat } = await coreFixture();
  const id = (
    await call(
      'POST',
      root + '/transactions',
      txn({ accountId: a, categoryId: cat, date: '2026-10-10', amountCents: 1000 }),
      { 'idempotency-key': randomUUID() },
    )
  ).json().id;
  await call(
    'POST',
    root + '/transactions',
    txn({ kind: 'refund', refundOf: id, accountId: a, categoryId: cat, amountCents: 500 }),
    { 'idempotency-key': randomUUID() },
  );
  const s = (await call('GET', root + '/summary?from=2026-11-01&to=2026-11-30')).json();
  assert.equal(s.previous.from, '2026-10-01');
  assert.equal(s.previous.to, '2026-10-31');
  assert.equal(s.previous.expenseCents, 1000);
  assert.equal(s.expenseCents, -500);
  assert.equal(s.resultCents, 500);
  assert.equal(s.change.resultCents, 1500);
  assert.equal(s.categories.length, 0);
});
test('histórico de metas preserva cada aporte e acumulado sem misturar ambientes', async () => {
  const { root } = await coreFixture();
  const g = (
    await call('POST', root + '/goals', { name: 'Meta histórico', targetCents: 1000 })
  ).json().id;
  for (const amountCents of [10, 20, 30])
    await call(
      'POST',
      root + `/goals/${g}/contributions`,
      { amountCents },
      { 'idempotency-key': randomUUID() },
    );
  const h = (await call('GET', root + `/goals/${g}/contributions`)).json();
  assert.equal(h.total, 3);
  assert.equal(h.items[0].accumulatedCents, 60);
  assert.equal(h.items[2].accumulatedCents, 10);
  assert.equal(
    (await call('GET', `/workspaces/${otherWid}/goals/${g}/contributions`)).statusCode,
    404,
  );
});
test('perfil e privacidade: reautenticação, exportação sem segredos e exclusão efetiva', async () => {
  const r = await call('POST', '/auth/register', {
    name: 'Privacidade',
    email: 'privacy@example.com',
    password: 'privacidade-segura-123',
  });
  const auth = String(r.headers['set-cookie']).split(';')[0];
  const userId = r.json().id;
  const p = (method: string, url: string, b?: any) => call(method, url, b, {}, auth);
  const w = (await p('POST', '/workspaces', { name: 'Privado', kind: 'personal' })).json().id;
  assert.equal(
    (await p('PATCH', '/auth/profile', { name: 'Novo nome', email: 'novo@example.com' }))
      .statusCode,
    400,
  );
  assert.equal(
    (
      await p('PATCH', '/auth/profile', {
        name: 'Novo nome',
        email: 'novo@example.com',
        currentPassword: 'privacidade-segura-123',
      })
    ).statusCode,
    200,
  );
  assert.equal((await p('GET', '/auth/me')).json().name, 'Novo nome');
  const e = await p('GET', '/auth/export');
  assert.equal(e.statusCode, 200);
  assert.equal(e.json().workspaces.length, 1);
  assert.equal(e.json().workspaces[0].id, w);
  assert.doesNotMatch(e.body, /password_hash|token_hash|privacidade-segura/);
  assert.equal(
    (
      await p('DELETE', '/auth/account', {
        password: 'errada',
        confirmation: 'EXCLUIR MINHA CONTA',
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await p('DELETE', '/auth/account', {
        password: 'privacidade-segura-123',
        confirmation: 'EXCLUIR MINHA CONTA',
      })
    ).statusCode,
    200,
  );
  assert.equal((await p('GET', '/auth/me')).statusCode, 401);
  assert.equal((await pool.query('SELECT 1 FROM users WHERE id=$1', [userId])).rowCount, 0);
  assert.equal((await pool.query('SELECT 1 FROM workspaces WHERE id=$1', [w])).rowCount, 0);
});
test('visualizador não pode editar ou arquivar cadastros', async () => {
  assert.equal(
    (
      await call(
        'PATCH',
        route('/accounts/' + accountA),
        { name: 'Ataque', type: 'cash', archived: true, version: 1 },
        {},
        otherCookie,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'PATCH',
        route('/categories/' + category),
        { name: 'Ataque', kind: 'expense', color: '#000000', archived: true, version: 1 },
        {},
        otherCookie,
      )
    ).statusCode,
    403,
  );
});

async function cardFixture() {
  const f = await coreFixture();
  const card = (
    await call('POST', f.root + '/cards', {
      name: 'Cartão teste',
      limitCents: 100000,
      closingDay: 25,
      dueDay: 5,
    })
  ).json().id;
  return { ...f, card, cardRoot: f.root + '/cards/' + card };
}
test('parcelamento exato e ciclos: fechamento inclusivo, virada de ano e fevereiro', async () => {
  const { splitInstallments, statementDates } = await import('@clara/shared/planning');
  assert.deepEqual(splitInstallments(10000, 3), [3334, 3333, 3333]);
  assert.deepEqual(splitInstallments(1, 1), [1]);
  assert.throws(() => splitInstallments(1, 2));
  assert.deepEqual(statementDates('2026-11-25', 25, 5), {
    closingDate: '2026-11-25',
    dueDate: '2026-12-05',
  });
  assert.deepEqual(statementDates('2026-11-26', 25, 5), {
    closingDate: '2026-12-25',
    dueDate: '2027-01-05',
  });
  assert.deepEqual(statementDates('2024-02-29', 31, 5), {
    closingDate: '2024-02-29',
    dueDate: '2024-03-05',
  });
  assert.deepEqual(statementDates('2026-01-31', 31, 10, 1), {
    closingDate: '2026-02-28',
    dueDate: '2026-03-10',
  });
});
test('cartões: compras concorrentes idempotentes, parcelas somam total e não alteram caixa', async () => {
  const { root, cardRoot, card } = await cardFixture();
  const b = { description: 'Notebook', amountCents: 10000, date: '2026-11-24', installments: 3 },
    key = randomUUID();
  const out = await Promise.all(
    Array.from({ length: 5 }, () =>
      call('POST', cardRoot + '/purchases', b, { 'idempotency-key': key }),
    ),
  );
  assert.equal(out.filter((r) => r.statusCode === 201).length, 1);
  assert.equal(out.filter((r) => r.statusCode === 200).length, 4);
  const statements = (await call('GET', cardRoot + '/statements')).json();
  assert.deepEqual(
    statements.map((s: any) => s.totalCents),
    [3334, 3333, 3333],
  );
  assert.deepEqual(
    statements.map((s: any) => s.dueDate),
    ['2026-12-05', '2027-01-05', '2027-02-05'],
  );
  const sum = (await call('GET', root + '/summary?from=2026-11-01&to=2026-11-30')).json();
  assert.equal(sum.expenseCents, 0);
  assert.equal(sum.balanceCents, 10000);
  const row = (await call('GET', root + '/cards')).json().find((c: any) => c.id === card);
  assert.equal(row.usedCents, 10000);
  assert.equal(row.availableCents, 90000);
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + '/purchases',
        { ...b, amountCents: 100001 },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + '/purchases',
        { ...b, amountCents: 99 },
        { 'idempotency-key': key },
      )
    ).statusCode,
    409,
  );
  assert.equal((await call('GET', cardRoot + '/purchases')).json().total, 1);
});
test('faturas: pagamento único, conta autorizada, ordem, fechamento e proteção contra edição direta', async () => {
  const { root, a, cardRoot } = await cardFixture();
  await call(
    'POST',
    cardRoot + '/purchases',
    { description: 'Compra parcelada', amountCents: 10000, date: '2026-11-24', installments: 3 },
    { 'idempotency-key': randomUUID() },
  );
  const statements = (await call('GET', cardRoot + '/statements')).json(),
    s = statements[0];
  const pay = { date: '2026-11-26', accountId: a, expectedCashCents: 3334 };
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + `/statements/${statements[1].id}/settle`,
        { ...pay, date: '2026-12-26', expectedCashCents: 3333 },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + `/statements/${s.id}/settle`,
        { ...pay, date: '2026-11-24' },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + `/statements/${s.id}/settle`,
        { ...pay, accountId: accountA },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + `/statements/${s.id}/settle`,
        { ...pay, expectedCashCents: 1 },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    409,
  );
  const key = randomUUID(),
    out = await Promise.all(
      Array.from({ length: 5 }, () =>
        call('POST', cardRoot + `/statements/${s.id}/settle`, pay, { 'idempotency-key': key }),
      ),
    );
  assert.ok(
    out.every((r) => r.statusCode === 200),
    out.map((r) => r.body).join(),
  );
  assert.equal(out.filter((r) => !r.json().replayed).length, 1);
  const summary = (await call('GET', root + '/summary?from=2026-11-01&to=2026-11-30')).json();
  assert.equal(summary.expenseCents, 3334);
  assert.equal(summary.balanceCents, 6666);
  const t = (await call('GET', root + '/transactions?from=2026-11-01&to=2026-11-30')).json()
    .items[0];
  assert.equal(t.sourceType, 'card_payment');
  assert.equal(
    (await call('DELETE', root + '/transactions/' + t.id, { version: 1 })).statusCode,
    409,
  );
  assert.equal((await call('POST', cardRoot + `/statements/${s.id}/reopen`, {})).statusCode, 200);
  assert.equal(
    (await call('GET', root + '/summary?from=2026-11-01&to=2026-11-30')).json().balanceCents,
    10000,
  );
});
test('estorno depois do pagamento: crédito futuro, compensação e reabertura sem dinheiro fictício', async () => {
  const { root, a, cardRoot } = await cardFixture();
  const p = (
    await call(
      'POST',
      cardRoot + '/purchases',
      { description: 'Compra estornada', amountCents: 9000, date: '2026-11-24', installments: 3 },
      { 'idempotency-key': randomUUID() },
    )
  ).json().id;
  let ss = (await call('GET', cardRoot + '/statements')).json();
  await call(
    'POST',
    cardRoot + `/statements/${ss[0].id}/settle`,
    { date: '2026-11-26', accountId: a, expectedCashCents: 3000 },
    { 'idempotency-key': randomUUID() },
  );
  const refund = { amountCents: 9000, date: '2026-11-27', reason: 'Devolução integral' },
    key = randomUUID();
  assert.equal(
    (await call('POST', cardRoot + `/purchases/${p}/refunds`, refund, { 'idempotency-key': key }))
      .statusCode,
    201,
  );
  assert.equal(
    (await call('POST', cardRoot + `/purchases/${p}/refunds`, refund, { 'idempotency-key': key }))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + `/purchases/${p}/refunds`,
        { ...refund, amountCents: 1 },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    409,
  );
  ss = (await call('GET', cardRoot + '/statements')).json();
  assert.equal(ss[0].totalCents, 3000);
  assert.equal(ss[1].totalCents, -6000);
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + `/statements/${ss[1].id}/settle`,
        { date: '2026-12-26', expectedCashCents: 0 },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + `/statements/${ss[2].id}/settle`,
        { date: '2027-01-26', expectedCashCents: 0 },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    200,
  );
  const cards = (await call('GET', root + '/cards')).json();
  assert.equal(cards[0].creditCents, 3000);
  assert.equal(cards[0].usedCents, 0);
  assert.equal(
    (await call('GET', root + '/summary?from=2026-11-01&to=2027-01-31')).json().balanceCents,
    7000,
  );
  assert.equal((await call('GET', root + '/net-worth')).json().netWorthCents, 10000);
  assert.equal(
    (await call('POST', cardRoot + `/statements/${ss[1].id}/reopen`, {})).statusCode,
    409,
  );
  assert.equal(
    (await call('POST', cardRoot + `/statements/${ss[2].id}/reopen`, {})).statusCode,
    200,
  );
  assert.equal((await call('GET', root + '/cards')).json()[0].creditCents, 6000);
});
test('cartão arquivado, limites, datas e escopo são verificados no servidor', async () => {
  const { root, cardRoot, card } = await cardFixture();
  const b = { description: 'Compra', amountCents: 1000, date: '2026-11-24', installments: 1 };
  await call('POST', cardRoot + '/purchases', b, { 'idempotency-key': randomUUID() });
  const edit = {
    name: 'Cartão atualizado',
    limitCents: 100000,
    closingDay: 25,
    dueDay: 5,
    version: 1,
    archived: true,
  };
  assert.equal((await call('PATCH', cardRoot, edit)).statusCode, 200);
  assert.equal(
    (await call('POST', cardRoot + '/purchases', b, { 'idempotency-key': randomUUID() }))
      .statusCode,
    409,
  );
  assert.equal(
    (await call('PATCH', cardRoot, { ...edit, version: 2, closingDay: 20 })).statusCode,
    409,
  );
  assert.equal(
    (await call('PATCH', cardRoot, { ...edit, version: 2, limitCents: 1 })).statusCode,
    409,
  );
  assert.equal(
    (await call('GET', `/workspaces/${otherWid}/cards/${card}/statements`)).statusCode,
    404,
  );
  assert.equal(
    (await call('POST', root + '/cards', { ...edit, name: 'Inválido', closingDay: 0 })).statusCode,
    400,
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + '/purchases',
        { ...b, amountCents: 1, installments: 2 },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    400,
  );
});
test('dívidas: amortização e juros geram uma saída e cancelamento reverte tudo', async () => {
  const { root, a } = await coreFixture();
  const id = (
    await call('POST', root + '/debts', {
      creditor: 'Credor teste',
      principalCents: 10000,
      monthlyInterestBps: 150,
      date: '2026-11-01',
      dueDate: '2027-01-01',
    })
  ).json().id;
  const b = { principalCents: 3000, interestCents: 100, date: '2026-11-07', accountId: a },
    key = randomUUID();
  const p = await call('POST', root + `/debts/${id}/payments`, b, { 'idempotency-key': key });
  assert.equal(p.statusCode, 201, p.body);
  assert.equal(
    (await call('POST', root + `/debts/${id}/payments`, b, { 'idempotency-key': key })).statusCode,
    200,
  );
  assert.equal((await call('GET', root + '/debts')).json()[0].outstandingCents, 7000);
  const sum = (await call('GET', root + '/summary?from=2026-11-01&to=2026-11-30')).json();
  assert.equal(sum.balanceCents, 6900);
  assert.equal(sum.expenseCents, 3100);
  assert.equal((await call('GET', root + '/net-worth')).json().netWorthCents, -100);
  const tx = (await call('GET', root + '/transactions?from=2026-11-01&to=2026-11-30')).json()
    .items[0];
  assert.equal(
    (await call('DELETE', root + '/transactions/' + tx.id, { version: 1 })).statusCode,
    409,
  );
  assert.equal(
    (await call('POST', root + `/debts/${id}/payments/${p.json().id}/void`, {})).statusCode,
    200,
  );
  assert.equal((await call('GET', root + '/debts')).json()[0].outstandingCents, 10000);
  assert.equal((await call('GET', root + '/accounts')).json()[0].balanceCents, 10000);
  assert.equal(
    (await call('GET', root + `/debts/${id}/payments`)).json().items[0].voidedAt !== null,
    true,
  );
});
test('dívidas: pagamentos concorrentes não excedem principal e referências externas falham', async () => {
  const { root, a } = await coreFixture();
  const id = (
    await call('POST', root + '/debts', {
      creditor: 'Concorrência',
      principalCents: 10000,
      date: '2026-11-01',
    })
  ).json().id;
  const b = { principalCents: 6000, interestCents: 0, date: '2026-11-07', accountId: a };
  assert.equal(
    (
      await call(
        'POST',
        root + `/debts/${id}/payments`,
        { ...b, accountId: accountA },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(
        'POST',
        root + `/debts/${id}/payments`,
        { ...b, date: '2026-10-30' },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    400,
  );
  const out = await Promise.all([
    call('POST', root + `/debts/${id}/payments`, b, { 'idempotency-key': randomUUID() }),
    call('POST', root + `/debts/${id}/payments`, b, { 'idempotency-key': randomUUID() }),
  ]);
  assert.equal(out.filter((r) => r.statusCode === 201).length, 1);
  assert.equal(out.filter((r) => r.statusCode === 409).length, 1);
  assert.equal((await call('GET', root + '/debts')).json()[0].outstandingCents, 4000);
});
test('patrimônio: quantidades decimais, avaliações datadas e vínculo evitam dupla contagem', async () => {
  const { root } = await coreFixture();
  const a = (
    await call('POST', root + '/accounts', {
      name: 'Conta investimento',
      type: 'investment',
      openingCents: 5000,
      date: '2026-11-01',
    })
  ).json().id;
  const h = {
    name: 'Renda fixa manual',
    kind: 'investment',
    subtype: 'Renda fixa',
    quantity: '1.00000001',
    appliedCents: 5000,
    valueCents: 6000,
    date: '2026-11-07',
    linkedAccountId: a,
  };
  const created = await call('POST', root + '/holdings', h);
  assert.equal(created.statusCode, 201, created.body);
  const id = created.json().id;
  assert.equal((await call('GET', root + '/net-worth')).json().netWorthCents, 16000);
  assert.equal((await call('POST', root + '/holdings', h)).statusCode, 409);
  assert.equal(
    (
      await call('PATCH', root + '/accounts/' + a, {
        name: 'Mudança',
        type: 'cash',
        archived: false,
        version: 1,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call('POST', root + `/holdings/${id}/valuations`, {
        valueCents: 7000,
        date: '2026-11-10',
      })
    ).statusCode,
    201,
  );
  await call('POST', root + `/holdings/${id}/valuations`, {
    valueCents: 99999,
    date: '2026-10-01',
  });
  const row = (await call('GET', root + '/holdings')).json()[0];
  assert.equal(row.valueCents, 7000);
  assert.equal(row.quantity, '1.00000001');
  assert.equal((await call('GET', root + `/holdings/${id}/valuations`)).json().total, 3);
  assert.equal((await call('GET', root + '/net-worth')).json().netWorthCents, 17000);
  assert.equal(
    (await call('GET', `/workspaces/${otherWid}/holdings/${id}/valuations`)).statusCode,
    404,
  );
  assert.equal(
    (await call('POST', root + '/holdings', { ...h, linkedAccountId: accountA })).statusCode,
    400,
  );
  assert.equal(
    (await call('POST', root + '/holdings', { ...h, linkedAccountId: null, quantity: '0' }))
      .statusCode,
    400,
  );
});
test('bens e avaliações manuais não movimentam dinheiro nem expõem dados de outros usuários', async () => {
  const { root, a } = await coreFixture();
  await call('POST', root + '/holdings', {
    name: 'Veículo manual',
    kind: 'asset',
    subtype: 'Veículo',
    quantity: '1',
    appliedCents: 1000000,
    valueCents: 800000,
    date: '2026-11-07',
  });
  assert.equal((await call('GET', root + '/net-worth')).json().netWorthCents, 810000);
  assert.equal(
    (await call('GET', root + '/accounts')).json().find((x: any) => x.id === a).balanceCents,
    10000,
  );
  assert.equal((await call('GET', root + '/holdings', undefined, {}, otherCookie)).statusCode, 404);
  assert.equal((await call('GET', root + '/debts', undefined, {}, otherCookie)).statusCode, 404);
  assert.equal((await call('GET', root + '/cards', undefined, {}, otherCookie)).statusCode, 404);
});
test('relatórios PDF e Excel contêm dados filtrados e centavos exatos sem fórmulas injetadas', async () => {
  const { root, a, cat } = await coreFixture();
  for (const description of ['Registro selecionado', '=HYPERLINK("evil")'])
    await call(
      'POST',
      root + '/transactions',
      txn({ description, accountId: a, categoryId: cat, amountCents: 12345, tags: ['relatorio'] }),
      { 'idempotency-key': randomUUID() },
    );
  const query = '?from=2026-11-01&to=2026-11-30&tag=relatorio&search=Registro';
  const xlsx = await call('GET', root + '/export.xlsx' + query);
  assert.equal(xlsx.statusCode, 200, xlsx.body.slice(0, 100));
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(xlsx.rawPayload);
  const xml = Object.entries(files)
    .filter(([n]) => n.endsWith('.xml'))
    .map(([, b]) => strFromU8(b))
    .join('\n');
  assert.match(xml, /Registro selecionado/);
  assert.match(xml, /12345/);
  assert.doesNotMatch(xml, /HYPERLINK/);
  const all = await call('GET', root + '/export.xlsx?from=2026-11-01&to=2026-11-30');
  const allFiles = unzipSync(all.rawPayload);
  const allXml = Object.entries(allFiles)
    .filter(([n]) => n.endsWith('.xml'))
    .map(([, b]) => strFromU8(b))
    .join('\n');
  assert.match(allXml, /HYPERLINK/);
  assert.doesNotMatch(allXml, /<f(?:\s|>)/);
  const pdf = await call('GET', root + '/export.pdf' + query);
  assert.equal(pdf.statusCode, 200, pdf.body.slice(0, 100));
  assert.match(pdf.rawPayload.toString('ascii', 0, 8), /^%PDF-/);
  assert.ok(pdf.rawPayload.length > 1000);
  const { inflateSync } = await import('node:zlib');
  let text = '';
  const raw = pdf.rawPayload.toString('latin1');
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const decoded = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      text += [...decoded.matchAll(/<([a-f0-9]+)>/gi)]
        .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
        .join('');
    } catch {}
  }
  assert.match(text, /Registro selecionado/);
  assert.doesNotMatch(text, /HYPERLINK/);
  assert.equal(
    (await call('GET', root + '/export.pdf' + query, undefined, {}, otherCookie)).statusCode,
    404,
  );
});

test('exclusão de conta preenchida remove cadastros, reembolsos e metas com integridade', async () => {
  const registered = await call('POST', '/auth/register', {
    name: 'Excluir preenchida',
    email: 'delete-filled@example.com',
    password: 'exclusao-preenchida-123',
  });
  const auth = String(registered.headers['set-cookie']).split(';')[0],
    uid = registered.json().id;
  const p = (m: string, u: string, b?: any, extra: any = {}) => call(m, u, b, extra, auth);
  const w = (await p('POST', '/workspaces', { name: 'Dados a excluir', kind: 'personal' })).json()
      .id,
    root = '/workspaces/' + w;
  const a = (
    await p('POST', root + '/accounts', {
      name: 'Conta a excluir',
      openingCents: 100000,
      date: '2026-11-01',
    })
  ).json().id;
  const cat = (
    await p('POST', root + '/categories', { name: 'Base excluir', kind: 'expense' })
  ).json().id;
  await p('POST', root + '/categories', { name: 'Filha excluir', kind: 'expense', parentId: cat });
  const source = (
    await p(
      'POST',
      root + '/transactions',
      txn({ accountId: a, categoryId: cat, amountCents: 1000 }),
      { 'idempotency-key': randomUUID() },
    )
  ).json().id;
  await p(
    'POST',
    root + '/transactions',
    txn({ kind: 'refund', refundOf: source, accountId: a, categoryId: cat, amountCents: 400 }),
    { 'idempotency-key': randomUUID() },
  );
  const g = (await p('POST', root + '/goals', { name: 'Meta excluir', targetCents: 10000 })).json()
    .id;
  await p(
    'POST',
    root + `/goals/${g}/contributions`,
    { amountCents: 100 },
    { 'idempotency-key': randomUUID() },
  );
  const r = await p('DELETE', '/auth/account', {
    password: 'exclusao-preenchida-123',
    confirmation: 'EXCLUIR MINHA CONTA',
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await p('GET', '/auth/me')).statusCode, 401);
  assert.equal((await pool.query('SELECT 1 FROM users WHERE id=$1', [uid])).rowCount, 0);
  assert.equal((await pool.query('SELECT 1 FROM workspaces WHERE id=$1', [w])).rowCount, 0);
});
test('compras retroativas e estornos não criam lacunas antes de faturas liquidadas', async () => {
  const { cardRoot, root, a } = await cardFixture();
  const p = (
    await call(
      'POST',
      cardRoot + '/purchases',
      { description: 'Compra calendário', amountCents: 1000, date: '2026-11-24', installments: 1 },
      { 'idempotency-key': randomUUID() },
    )
  ).json().id;
  let ss = (await call('GET', cardRoot + '/statements')).json();
  await call(
    'POST',
    cardRoot + `/statements/${ss[0].id}/settle`,
    { date: '2026-11-26', accountId: a, expectedCashCents: 1000 },
    { 'idempotency-key': randomUUID() },
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + '/purchases',
        { description: 'Retroativa', amountCents: 1000, date: '2026-10-10', installments: 1 },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    409,
  );
  const second = await call(
    'POST',
    cardRoot + '/purchases',
    { description: 'Compra adiante', amountCents: 1000, date: '2027-01-10', installments: 1 },
    { 'idempotency-key': randomUUID() },
  );
  assert.equal(second.statusCode, 201, second.body);
  ss = (await call('GET', cardRoot + '/statements')).json();
  await call(
    'POST',
    cardRoot + `/statements/${ss[1].id}/settle`,
    { date: '2027-01-26', accountId: a, expectedCashCents: 1000 },
    { 'idempotency-key': randomUUID() },
  );
  assert.equal(
    (
      await call(
        'POST',
        cardRoot + `/purchases/${p}/refunds`,
        { amountCents: 1000, date: '2026-12-01', reason: 'Crédito após liquidação' },
        { 'idempotency-key': randomUUID() },
      )
    ).statusCode,
    201,
  );
  ss = (await call('GET', cardRoot + '/statements')).json();
  assert.equal(ss.length, 3);
  assert.equal(ss[2].dueDate, '2027-03-05');
  assert.equal(ss[2].totalCents, -1000);
  assert.equal((await call('GET', root + '/net-worth')).statusCode, 200);
});
test('limitação de tentativas de login continua ativa', async () => {
  const guarded = await buildApp({ rateLimit: true });
  try {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await guarded.inject({
            method: 'POST',
            url: '/api/auth/login',
            headers: { 'x-clara-client': 'web' },
            payload: { email: 'inexistente@example.com', password: 'senha-inexistente-123' },
          })
        ).statusCode,
        401,
      );
    assert.equal(
      (
        await guarded.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: { 'x-clara-client': 'web' },
          payload: { email: 'inexistente@example.com', password: 'senha-inexistente-123' },
        })
      ).statusCode,
      429,
    );
  } finally {
    await guarded.close();
  }
});

test('privacidade apaga também faturas, créditos, dívidas e investimentos sem afetar terceiros', async () => {
  const r = await call('POST', '/auth/register', {
    name: 'Privacidade planejamento',
    email: 'delete-planning@example.com',
    password: 'planejamento-privado-123',
  });
  const auth = String(r.headers['set-cookie']).split(';')[0];
  const p = (m: string, url: string, b?: any, key?: string) =>
    call(m, url, b, key ? { 'idempotency-key': key } : {}, auth);
  const root =
    '/workspaces/' +
    (await p('POST', '/workspaces', { name: 'Planejamento privado', kind: 'personal' })).json().id;
  const a = (
    await p('POST', root + '/accounts', {
      name: 'Conta privada',
      openingCents: 10000,
      date: '2026-11-01',
    })
  ).json().id;
  const inv = (
    await p('POST', root + '/accounts', {
      name: 'Investimento privado',
      type: 'investment',
      date: '2026-11-01',
    })
  ).json().id;
  const card = (
      await p('POST', root + '/cards', {
        name: 'Cartão privado',
        limitCents: 10000,
        closingDay: 25,
        dueDay: 5,
      })
    ).json().id,
    cr = root + '/cards/' + card;
  const purchase = (
    await p(
      'POST',
      cr + '/purchases',
      { description: 'Compra privada', amountCents: 1000, date: '2026-11-24', installments: 1 },
      randomUUID(),
    )
  ).json().id;
  const statement = (await p('GET', cr + '/statements')).json()[0];
  assert.equal(
    (
      await p(
        'POST',
        cr + `/statements/${statement.id}/settle`,
        { date: '2026-11-26', accountId: a, expectedCashCents: 1000 },
        randomUUID(),
      )
    ).statusCode,
    200,
  );
  await p(
    'POST',
    cr + `/purchases/${purchase}/refunds`,
    { amountCents: 1000, date: '2026-11-27', reason: 'Estorno privado' },
    randomUUID(),
  );
  const statement2 = (await p('GET', cr + '/statements')).json()[1];
  await p(
    'POST',
    cr + `/statements/${statement2.id}/settle`,
    { date: '2026-12-26', expectedCashCents: 0 },
    randomUUID(),
  );
  const debt = (
    await p('POST', root + '/debts', {
      creditor: 'Credor privado',
      principalCents: 1000,
      date: '2026-11-01',
    })
  ).json().id;
  await p(
    'POST',
    root + `/debts/${debt}/payments`,
    { principalCents: 100, interestCents: 10, date: '2026-11-07', accountId: a },
    randomUUID(),
  );
  await p('POST', root + '/holdings', {
    name: 'Posição privada',
    kind: 'investment',
    subtype: 'Manual',
    quantity: '1',
    appliedCents: 0,
    valueCents: 100,
    date: '2026-11-07',
    linkedAccountId: inv,
  });
  const exported = await p('GET', '/auth/export');
  assert.equal(exported.statusCode, 200);
  assert.equal(exported.json().workspaces.length, 1);
  assert.equal(exported.json().data.card_purchases.length, 1);
  assert.equal(exported.json().data.card_credit_entries.length, 1);
  assert.equal(exported.json().data.debt_payments.length, 1);
  assert.equal(exported.json().data.holdings.length, 1);
  assert.doesNotMatch(exported.body, /password_hash|token_hash|planejamento-privado-123/);
  const othersBefore = (await call('GET', route('/accounts'))).body;
  const deletion = await p('DELETE', '/auth/account', {
    password: 'planejamento-privado-123',
    confirmation: 'EXCLUIR MINHA CONTA',
  });
  assert.equal(deletion.statusCode, 200, deletion.body);
  assert.equal((await p('GET', '/auth/me')).statusCode, 401);
  assert.equal((await call('GET', route('/accounts'))).body, othersBefore);
});
test('exclusão bloqueia perda de ambiente compartilhado e não remove dados parcialmente', async () => {
  const r = await call('POST', '/auth/register', {
    name: 'Titular compartilhado',
    email: 'shared-owner@example.com',
    password: 'titular-compartilhado-123',
  });
  const auth = String(r.headers['set-cookie']).split(';')[0];
  const w = (
    await call('POST', '/workspaces', { name: 'Compartilhado', kind: 'business' }, {}, auth)
  ).json().id;
  const other = (await pool.query("SELECT id FROM users WHERE email='outro@example.com'")).rows[0]
    .id;
  await pool.query(
    "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'viewer')",
    [w, other],
  );
  assert.equal(
    (
      await call(
        'DELETE',
        '/auth/account',
        { password: 'titular-compartilhado-123', confirmation: 'EXCLUIR MINHA CONTA' },
        {},
        auth,
      )
    ).statusCode,
    409,
  );
  assert.equal((await call('GET', '/auth/me', undefined, {}, auth)).statusCode, 200);
  assert.equal((await pool.query('SELECT 1 FROM workspaces WHERE id=$1', [w])).rowCount, 1);
});
test('visualizadores não podem criar cartões, dívidas ou avaliações em ambientes acessíveis', async () => {
  assert.equal(
    (
      await call(
        'POST',
        route('/cards'),
        { name: 'Sem permissão', limitCents: 10000, closingDay: 25, dueDay: 5 },
        {},
        otherCookie,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'POST',
        route('/debts'),
        { creditor: 'Sem permissão', principalCents: 100, date: '2026-11-01' },
        {},
        otherCookie,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'POST',
        route('/holdings'),
        {
          name: 'Sem permissão',
          kind: 'asset',
          subtype: 'Manual',
          quantity: '1',
          appliedCents: 0,
          valueCents: 100,
          date: '2026-11-01',
        },
        {},
        otherCookie,
      )
    ).statusCode,
    403,
  );
});

test('sessões podem ser encerradas e logout revoga o acesso', async () => {
  assert.ok((await call('GET', '/auth/sessions')).json().some((s: any) => s.current));
  assert.equal((await call('POST', '/auth/logout', {})).statusCode, 200);
  assert.equal((await call('GET', '/auth/me')).statusCode, 401);
});
