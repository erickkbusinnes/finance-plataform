import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import pg from 'pg';
import { previewHtml } from './preview-viewer.mjs';

// Fixtures are created only in an explicitly separate test database, then erased.
if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL.');
const database = new URL(process.env.TEST_DATABASE_URL);
if (!database.pathname.endsWith('_test')) throw new Error('Use somente banco terminado em _test.');
const schema = 'html_' + randomUUID().replaceAll('-', '');
const admin = new pg.Pool({ connectionString: database.toString() });
await admin.query(`CREATE SCHEMA "${schema}"`);
database.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = database.toString();
process.env.NODE_ENV = 'development';
process.env.MAIL_MODE = 'disabled';
delete process.env.DEPLOYMENT_MODE;
const { pool } = await import('../apps/api/src/db.js');
const { migrate } = await import('../apps/api/src/migrate.js');
const { buildApp } = await import('../apps/api/src/app.js');
const app = await buildApp({ rateLimit: false, webRoot: path.resolve('apps/web/dist') });
let browser;
let cookie = '';
const now = new Date();
const month = now.toISOString().slice(0, 7);
function date(offset = 0, day = 1) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, day))
    .toISOString()
    .slice(0, 10);
}
async function request(method: 'GET' | 'POST', route: string, payload?: unknown) {
  const response = await app.inject({
    method,
    url: '/api' + route,
    headers: { 'x-clara-client': 'web', cookie, 'idempotency-key': randomUUID() },
    payload,
  });
  assert.ok(response.statusCode < 400, `${route}: ${response.statusCode} ${response.body}`);
  if (response.headers['set-cookie']) cookie = String(response.headers['set-cookie']).split(';')[0];
  return response.json();
}
try {
  await migrate();
  await request('POST', '/auth/register', {
    name: 'Marina Exemplo',
    email: 'visualizacao@example.invalid',
    password: randomUUID(),
  });
  const workspace = await request('POST', '/workspaces', {
    name: 'Pessoal · exemplo fictício',
    kind: 'personal',
  });
  const base = `/workspaces/${workspace.id}`;
  const account = await request('POST', base + '/accounts', {
    name: 'Conta do dia a dia',
    openingCents: 450000,
    date: date(-2),
  });
  const savings = await request('POST', base + '/accounts', {
    name: 'Reserva de segurança',
    type: 'savings',
    openingCents: 1250000,
    date: date(-2),
  });
  const investment = await request('POST', base + '/accounts', {
    name: 'Carteira de investimentos',
    type: 'investment',
    openingCents: 300000,
    date: date(-2),
  });
  const cats: Record<string, any> = {};
  for (const [name, kind, color] of [
    ['Renda', 'income', '#0b9e77'],
    ['Moradia', 'expense', '#6c7bd2'],
    ['Alimentação', 'expense', '#e7a24d'],
    ['Saúde', 'expense', '#55aab1'],
    ['Lazer', 'expense', '#a17bc7'],
    ['Tecnologia', 'expense', '#5979b4'],
  ])
    cats[name] = await request('POST', base + '/categories', { name, kind, color });
  cats.Mercado = await request('POST', base + '/categories', {
    name: 'Mercado',
    kind: 'expense',
    parentId: cats.Alimentação.id,
    color: '#e7a24d',
  });
  const transaction = (
    description: string,
    kind: string,
    amountCents: number,
    day: string,
    category: string,
    extra = {},
  ) =>
    request('POST', base + '/transactions', {
      description,
      kind,
      amountCents,
      date: day,
      accountId: account.id,
      categoryId: cats[category]?.id,
      tags: ['exemplo'],
      notes: 'Dados fictícios criados somente para esta visualização offline.',
      ...extra,
    });
  await transaction('Renda do mês anterior', 'income', 650000, date(-1, 3), 'Renda');
  await transaction('Despesas do mês anterior', 'expense', 210000, date(-1, 8), 'Moradia');
  await transaction('Salário · exemplo', 'income', 720000, date(0, 3), 'Renda');
  await transaction('Projeto extra · exemplo', 'income', 85000, date(0, 7), 'Renda');
  await transaction('Aluguel', 'expense', 180000, date(0, 5), 'Moradia');
  await transaction('Mercado da semana', 'expense', 23450, date(0, 6), 'Mercado');
  await transaction('Consulta e exames', 'expense', 25400, date(0, 8), 'Saúde');
  await transaction('Internet e serviços', 'expense', 18990, date(0, 9), 'Moradia');
  const refundable = await transaction(
    'Viagem de fim de semana',
    'expense',
    69700,
    date(0, 7),
    'Lazer',
  );
  await transaction('Reembolso da reserva', 'refund', 12000, date(0, 10), 'Lazer', {
    refundOf: refundable.id,
  });
  await transaction('Reserva do mês', 'transfer', 70000, date(0, 5), '', {
    destinationAccountId: savings.id,
  });
  for (const [name, targetCents, amountCents] of [
    ['Reserva de emergência', 2000000, 350000],
    ['Próxima viagem', 800000, 170000],
  ] as const) {
    const goal = await request('POST', base + '/goals', {
      name,
      targetCents,
      dueDate: date(8, 20),
    });
    await request('POST', base + `/goals/${goal.id}/contributions`, { amountCents });
    await request('POST', base + `/goals/${goal.id}/contributions`, { amountCents: 25000 });
  }
  await request('POST', base + '/budgets', {
    categoryId: cats.Alimentação.id,
    month,
    limitCents: 80000,
  });
  await request('POST', base + '/budgets', {
    categoryId: cats.Lazer.id,
    month,
    limitCents: 100000,
  });
  const card = await request('POST', base + '/cards', {
    name: 'Cartão pessoal · exemplo',
    limitCents: 800000,
    closingDay: 25,
    dueDay: 5,
  });
  const cardBase = base + `/cards/${card.id}`;
  const purchase = await request('POST', cardBase + '/purchases', {
    description: 'Notebook para projetos',
    amountCents: 240000,
    date: date(-1, 24),
    installments: 6,
    categoryId: cats.Tecnologia.id,
  });
  const statements = await request('GET', cardBase + '/statements');
  await request('POST', cardBase + `/statements/${statements[0].id}/settle`, {
    date: date(0, 1),
    accountId: account.id,
    expectedCashCents: 40000,
  });
  await request('POST', cardBase + `/purchases/${purchase.id}/refunds`, {
    date: date(0, 7),
    amountCents: 20000,
    reason: 'Ajuste de preço · exemplo fictício',
  });
  await request('POST', cardBase + '/purchases', {
    description: 'Compra mensal no cartão',
    amountCents: 15680,
    date: date(0, 4),
    installments: 1,
    categoryId: cats.Mercado.id,
  });
  const debt = await request('POST', base + '/debts', {
    creditor: 'Financiamento · exemplo',
    principalCents: 320000,
    date: date(-1, 1),
  });
  await request('POST', base + `/debts/${debt.id}/payments`, {
    principalCents: 10000,
    interestCents: 900,
    date: date(0, 5),
    accountId: account.id,
  });
  const holding = await request('POST', base + '/holdings', {
    name: 'Investimento manual · exemplo',
    kind: 'investment',
    subtype: 'Renda fixa manual',
    quantity: '12.5',
    appliedCents: 300000,
    valueCents: 309000,
    date: date(-1, 15),
    linkedAccountId: investment.id,
  });
  await request('POST', base + `/holdings/${holding.id}/valuations`, {
    date: date(0, 10),
    valueCents: 314900,
  });
  await request('POST', base + '/holdings', {
    name: 'Veículo · exemplo',
    kind: 'asset',
    subtype: 'Automóvel',
    quantity: '1',
    appliedCents: 3850000,
    valueCents: 4200000,
    date: date(0, 10),
  });
  const business = await request('POST', '/workspaces', {
    name: 'Empresa · exemplo fictício',
    kind: 'business',
  });
  const businessBase = `/workspaces/${business.id}`;
  const businessAccount = await request('POST', businessBase + '/accounts', {
    name: 'Conta da empresa · exemplo',
    openingCents: 2300000,
    date: date(-1),
  });
  await request('POST', businessBase + '/transactions', {
    description: 'Recebimento de projeto · exemplo',
    kind: 'income',
    amountCents: 1250000,
    date: date(0, 4),
    accountId: businessAccount.id,
  });
  await request('POST', businessBase + '/transactions', {
    description: 'Despesa operacional · exemplo',
    kind: 'expense',
    amountCents: 380000,
    date: date(0, 8),
    accountId: businessAccount.id,
  });

  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  process.env.APP_ORIGIN = origin;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  await context.addCookies([
    {
      name: 'clara_session',
      value: cookie.slice('clara_session='.length),
      url: origin,
      httpOnly: true,
    },
  ]);
  await context.addInitScript((wid) => {
    if (!localStorage.getItem('clara-workspace')) localStorage.setItem('clara-workspace', wid);
  }, workspace.id);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const screens: { id: string; title: string; path: string; parent?: string; html: string }[] = [];
  async function visit(route: string) {
    await page.goto(origin + route);
    await page.waitForLoadState('networkidle');
    if (await page.locator('input[type="month"]').count()) {
      await page.locator('input[type="month"]').first().fill(month);
      await page.waitForLoadState('networkidle');
    }
    if (route === '/app' || route === '/app/relatorios') {
      await page.getByLabel('Intervalo do dashboard', { exact: true }).selectOption('3');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1600);
    }
    assert.equal(await page.locator('.error').count(), 0, `Erro na tela ${route}`);
  }
  async function capture(id: string, title: string, route: string, parent?: string) {
    const html = await page.evaluate(() => {
      const original = document.getElementById('root')!;
      const clone = original.cloneNode(true) as HTMLElement;
      const sources = original.querySelectorAll('input,textarea,select');
      clone
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          'input,textarea,select',
        )
        .forEach((control, i) => {
          const source = sources[i] as HTMLInputElement;
          if (control.tagName === 'SELECT')
            Array.from((control as HTMLSelectElement).options).forEach((option) => {
              option.selected = option.value === source.value;
              if (option.selected) option.setAttribute('selected', '');
              else option.removeAttribute('selected');
            });
          else if (control.tagName === 'TEXTAREA') control.textContent = source.value;
          else control.setAttribute('value', source.type === 'password' ? '' : source.value);
          control.disabled = true;
          control.title = 'Exemplo para consulta. Alterações exigem a versão conectada.';
        });
      clone.querySelectorAll('script,iframe,object,embed').forEach((e) => e.remove());
      clone.querySelectorAll('*').forEach((el) =>
        Array.from(el.attributes)
          .filter((a) => a.name.startsWith('on'))
          .forEach((a) => el.removeAttribute(a.name)),
      );
      clone.querySelectorAll('form').forEach((el) => el.removeAttribute('action'));
      clone.querySelectorAll('.private-label').forEach((el) => {
        el.textContent = 'Dados fictícios';
      });
      clone.querySelectorAll('[download]').forEach((el) => {
        el.removeAttribute('href');
      });
      clone.querySelectorAll('img').forEach((el) => {
        if (!el.src.startsWith('data:')) el.remove();
      });
      return clone.innerHTML;
    });
    screens.push({ id, title, path: route, parent, html });
    console.log('Tela incluída:', title);
  }
  const routes = [
    ['inicio', 'Site · Início', '/'],
    ['funcionalidades', 'Site · Funcionalidades', '/funcionalidades'],
    ['solucoes', 'Site · Soluções', '/solucoes'],
    ['precos', 'Site · Planos', '/precos'],
    ['sobre', 'Site · Sobre', '/sobre'],
    ['contato', 'Site · Contato', '/contato'],
    ['termos', 'Site · Termos', '/termos'],
    ['privacidade', 'Site · Privacidade', '/privacidade'],
    ['entrar', 'Acesso · Entrar', '/entrar'],
    ['cadastro', 'Acesso · Cadastro', '/cadastro'],
    ['recuperar', 'Acesso · Recuperação indisponível offline', '/recuperar-senha'],
    ['painel', 'Painel · Visão geral', '/app'],
    ['movimentacoes', 'Painel · Movimentações', '/app/movimentacoes'],
    ['contas', 'Painel · Contas e categorias', '/app/contas'],
    ['cartoes', 'Painel · Cartões e faturas', '/app/cartoes'],
    ['patrimonio', 'Painel · Patrimônio e dívidas', '/app/patrimonio'],
    ['planejamento', 'Painel · Metas e orçamentos', '/app/planejamento'],
    ['relatorios', 'Painel · Relatórios', '/app/relatorios'],
    ['configuracoes', 'Painel · Perfil e privacidade', '/app/configuracoes'],
  ];
  for (const [id, title, route] of routes) {
    await visit(route);
    await capture(id, title, route);
  }
  await visit('/app');
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await capture('painel-escuro', 'Painel · Modo escuro', '/app', 'painel');
  await page.getByRole('button', { name: 'Ativar modo claro' }).click();
  const modals: [string, string, string, string, string, ((p: Page) => Promise<void>)?][] = [
    ['nova-conta', 'Formulário · Nova conta', '/app/contas', 'contas', 'Nova conta'],
    [
      'editar-conta',
      'Formulário · Editar e arquivar conta',
      '/app/contas',
      'contas',
      'Editar conta',
    ],
    [
      'nova-categoria',
      'Formulário · Categoria e subcategoria',
      '/app/contas',
      'contas',
      'Nova categoria',
    ],
    ['extrato', 'Consulta · Extrato com saldo', '/app/contas', 'contas', 'Extrato'],
    [
      'nova-movimentacao',
      'Formulário · Nova movimentação',
      '/app/movimentacoes',
      'movimentacoes',
      'Nova movimentação',
    ],
    [
      'detalhes',
      'Consulta · Histórico de movimentação',
      '/app/movimentacoes',
      'movimentacoes',
      'Detalhes de Viagem de fim de semana',
    ],
    [
      'reembolso',
      'Formulário · Reembolso e tags',
      '/app/movimentacoes',
      'movimentacoes',
      'Detalhes de Viagem de fim de semana',
      async (p) => {
        await p.getByRole('button', { name: 'Registrar reembolso' }).click();
      },
    ],
    ['novo-cartao', 'Formulário · Novo cartão', '/app/cartoes', 'cartoes', 'Novo cartão'],
    ['nova-compra', 'Formulário · Compra parcelada', '/app/cartoes', 'cartoes', 'Registrar compra'],
    [
      'fatura',
      'Consulta · Detalhes da fatura',
      '/app/cartoes',
      'cartoes',
      'Detalhes da fatura ' + date(0, 5),
    ],
    ['nova-divida', 'Formulário · Nova dívida', '/app/patrimonio', 'patrimonio', 'Nova dívida'],
    [
      'novo-bem',
      'Formulário · Bem e investimento manual',
      '/app/patrimonio',
      'patrimonio',
      'Adicionar bem ou investimento',
    ],
    [
      'historico-divida',
      'Consulta · Histórico de pagamentos',
      '/app/patrimonio',
      'patrimonio',
      'Histórico de pagamentos',
    ],
    [
      'historico-investimento',
      'Consulta · Histórico de avaliações',
      '/app/patrimonio',
      'patrimonio',
      'Histórico de avaliações',
    ],
    ['nova-meta', 'Formulário · Nova meta', '/app/planejamento', 'planejamento', 'Nova meta'],
    [
      'aporte',
      'Formulário · Aporte em meta',
      '/app/planejamento',
      'planejamento',
      'Registrar progresso',
    ],
    [
      'historico-meta',
      'Consulta · Histórico de aportes',
      '/app/planejamento',
      'planejamento',
      'Histórico de aportes',
    ],
    [
      'orcamento',
      'Formulário · Orçamento mensal',
      '/app/planejamento',
      'planejamento',
      'Definir limite',
    ],
  ];
  for (const [id, title, route, parent, button, after] of modals) {
    await visit(route);
    await page.getByRole('button', { name: button, exact: true }).first().click();
    if (after) await after(page);
    await page.getByRole('dialog').waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.error').count(), 0, title);
    await capture(id, title, route, parent);
  }
  await page.evaluate((wid) => localStorage.setItem('clara-workspace', wid), business.id);
  await visit('/app');
  assert.ok((await page.locator('body').innerText()).includes('GESTÃO FINANCEIRA EMPRESARIAL'));
  await capture('empresa', 'Painel · Ambiente empresarial de exemplo', '/app', 'painel');
  assert.deepEqual(errors, [], 'A captura não deve conter erros de JavaScript.');
  const index = await readFile('apps/web/dist/index.html', 'utf8');
  const stylesheet = index.match(/href="(\/assets\/[^\"]+\.css)"/)?.[1];
  assert.ok(stylesheet, 'Compile o frontend antes de exportar.');
  const css = await readFile(path.join('apps/web/dist', stylesheet), 'utf8');
  const html = previewHtml(screens, css, month);
  assert.doesNotMatch(html, /password_hash|token_hash|clara_session=|postgresql:\/\//);
  await mkdir('preview', { recursive: true });
  await writeFile('preview/Clara.html', html);
  console.log(
    `HTML offline criado: preview/Clara.html (${screens.length} telas, ${Buffer.byteLength(html)} bytes). Somente dados fictícios.`,
  );
} finally {
  await browser?.close();
  await app.close();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
