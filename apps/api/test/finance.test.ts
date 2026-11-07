import { parseMoney, transactionSchema } from '@clara/shared';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
before(async () => {
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
test('conversão monetária exata e validação de datas', () => {
  assert.equal(parseMoney('1.234,56'), 123456);
  assert.equal(parseMoney('0,01'), 1);
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
test('sessões podem ser encerradas e logout revoga o acesso', async () => {
  assert.ok((await call('GET', '/auth/sessions')).json().some((s: any) => s.current));
  assert.equal((await call('POST', '/auth/logout', {})).statusCode, 200);
  assert.equal((await call('GET', '/auth/me')).statusCode, 401);
});
