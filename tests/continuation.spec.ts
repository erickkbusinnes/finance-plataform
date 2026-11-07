import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
const password = 'continuacao-segura-123';
async function bootstrap(page: Page, label: string) {
  const headers = { 'X-Clara-Client': 'web' };
  const email = `${label}-${process.env.E2E_SCHEMA}@example.com`;
  const registration = await page.request.post('/api/auth/register', {
    headers,
    data: { name: 'Teste evolução', email, password },
  });
  expect(registration.status()).toBe(201);
  const workspace = await (
    await page.request.post('/api/workspaces', {
      headers,
      data: { name: 'Evolução E2E', kind: 'personal' },
    })
  ).json();
  const root = `/api/workspaces/${workspace.id}`;
  const account = await (
    await page.request.post(root + '/accounts', {
      headers,
      data: { name: 'Conta teste', openingCents: 100000, date: '2026-10-01' },
    })
  ).json();
  const category = await (
    await page.request.post(root + '/categories', {
      headers,
      data: { name: 'Base E2E', kind: 'expense' },
    })
  ).json();
  return { headers, email, root, wid: workspace.id, account: account.id, category: category.id };
}
async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('consolidação ponta a ponta: cadastro editável, extrato, reembolso, filtros, metas e privacidade', async ({
  page,
}) => {
  const f = await bootstrap(page, 'core');
  await page.request.post(f.root + '/transactions', {
    headers: { ...f.headers, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      description: 'Despesa reembolsável E2E',
      kind: 'expense',
      amountCents: 1000,
      date: '2026-11-07',
      accountId: f.account,
      categoryId: f.category,
    },
  });
  await page.goto('/app/contas');
  await page.getByRole('button', { name: 'Editar conta', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Conta editada');
  await save(page);
  await expect(page.getByRole('heading', { name: 'Conta editada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Extrato', exact: true }).click();
  await page.getByLabel('Início do extrato').fill('2026-10-01');
  await page.getByLabel('Fim do extrato').fill('2026-11-30');
  await expect(page.getByRole('dialog').getByRole('table')).toContainText('Saldo inicial');
  await expect(page.getByRole('dialog')).toContainText('990,00');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Nova categoria', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Subcategoria E2E');
  await page
    .getByLabel('Categoria principal', { exact: true })
    .selectOption({ label: 'Base E2E (Despesa)' });
  await save(page);
  await page.getByRole('button', { name: 'Editar categoria Subcategoria E2E' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Subcategoria editada');
  await page.getByLabel('Arquivada', { exact: true }).check();
  await save(page);
  await expect(page.locator('.category-chips')).toContainText('Subcategoria editada');
  await expect(page.locator('.category-chips')).toContainText('Arquivada');
  await page.getByRole('button', { name: 'Editar categoria Base E2E' }).click();
  await page.getByLabel('Arquivada', { exact: true }).check();
  await save(page);
  await page.getByRole('link', { name: 'Movimentações', exact: true }).click();
  await page.getByLabel('Período', { exact: true }).fill('2026-11');
  await page.getByRole('button', { name: 'Detalhes de Despesa reembolsável E2E' }).click();
  await page.getByRole('button', { name: 'Registrar reembolso' }).click();
  await page.getByLabel('Valor (R$)', { exact: true }).fill('4,00');
  await page.getByLabel('Data', { exact: true }).fill('2026-11-07');
  await page.getByLabel('Tags (separadas por vírgula)').fill('Devolucao, teste');
  await save(page);
  await page.getByLabel('Filtrar tipo').selectOption('refund');
  await page.getByLabel('Filtrar tag').fill('devolucao');
  await page.getByLabel('Valor mínimo (R$)').fill('3,00');
  await page.getByLabel('Valor máximo (R$)').fill('5,00');
  await page.getByLabel('Ordenar movimentações').selectOption('amount_asc');
  await expect(page.getByRole('table')).toContainText('Reembolso: Despesa reembolsável E2E');
  await expect(page.getByRole('row')).toHaveCount(2);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Excel', exact: true }).click(),
  ]);
  const xlsx = unzipSync(await readFile((await download.path())!));
  const xml = Object.entries(xlsx)
    .filter(([key]) => key.endsWith('.xml'))
    .map(([, data]) => strFromU8(data))
    .join();
  expect(xml).toContain('Reembolso: Despesa reembolsável E2E');
  await page.getByRole('link', { name: 'Contas e carteiras', exact: true }).click();
  await page.getByRole('button', { name: 'Editar conta', exact: true }).click();
  await page.getByLabel('Arquivada', { exact: true }).check();
  await save(page);
  await expect(page.locator('.account-card')).toContainText('994,00');
  await page.getByRole('link', { name: 'Movimentações', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nova movimentação', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Contas e carteiras', exact: true }).click();
  await page.getByRole('button', { name: 'Editar conta', exact: true }).click();
  await page.getByLabel('Arquivada', { exact: true }).uncheck();
  await save(page);
  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await page
    .locator('.heading-actions')
    .getByRole('button', { name: 'Nova meta', exact: true })
    .click();
  await page.getByLabel('O que você quer realizar?').fill('Meta de evolução');
  await page.getByLabel('Valor objetivo (R$)').fill('200,00');
  await save(page);
  await page.getByRole('button', { name: 'Registrar progresso' }).click();
  await page.getByLabel('Valor reservado (R$)').fill('20,00');
  await save(page);
  await page.getByRole('button', { name: 'Histórico de aportes' }).click();
  await expect(page.getByRole('dialog').getByRole('table')).toContainText('20,00');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.getByLabel('Intervalo do dashboard').selectOption('3');
  await expect(
    page.getByRole('heading', { name: 'Comparação com o período anterior' }),
  ).toBeVisible();
  await expect(page.locator('.stat-card.expense')).toContainText('6,00');
  await page.getByRole('link', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Seu nome', { exact: true }).fill('Perfil atualizado');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.locator('.profile')).toContainText('Perfil atualizado');
  const [privacy] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Exportar meus dados (JSON)' }).click(),
  ]);
  const content = await readFile((await privacy.path())!, 'utf8');
  expect(JSON.parse(content).user.name).toBe('Perfil atualizado');
  expect(content).not.toMatch(/password_hash|token_hash/);
  await page.getByRole('button', { name: 'Excluir minha conta', exact: true }).click();
  await page.getByLabel('Confirme sua senha').fill(password);
  await page.getByLabel('Digite EXCLUIR MINHA CONTA').fill('EXCLUIR MINHA CONTA');
  await page.getByRole('button', { name: 'Excluir permanentemente' }).click();
  await expect(page).toHaveURL(/cadastro/);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});
test('cartões, faturas, estornos, dívidas e avaliações funcionam pela interface', async ({
  page,
}) => {
  const f = await bootstrap(page, 'planning');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/cartoes');
  await page.getByRole('button', { name: 'Novo cartão', exact: true }).click();
  await page.getByLabel('Nome do cartão').fill('Cartão E2E');
  await page.getByLabel('Limite (R$)', { exact: true }).fill('1.000,00');
  await page.getByLabel('Dia de fechamento').fill('25');
  await page.getByLabel('Dia de vencimento').fill('5');
  await save(page);
  await page.getByRole('button', { name: 'Registrar compra', exact: true }).click();
  await page.getByLabel('Descrição da compra').fill('Compra parcelada E2E');
  await page.getByLabel('Valor total da compra (R$)').fill('100,00');
  await page.getByLabel('Data da compra').fill('2026-10-24');
  await page.getByLabel('Número de parcelas').fill('3');
  await save(page);
  await expect(page.locator('.account-card')).toContainText('900,00');
  await page.getByRole('button', { name: 'Detalhes da fatura 2026-11-05' }).click();
  await expect(page.getByRole('dialog')).toContainText('1/3');
  await expect(page.getByRole('dialog')).toContainText('33,34');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Liquidar 2026-11-05', exact: true }).click();
  await page.getByLabel('Data do pagamento ou compensação').fill('2026-11-01');
  await page.getByLabel('Conta para pagamento').selectOption({ label: 'Conta teste' });
  await save(page);
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.getByLabel('Período', { exact: true }).fill('2026-11');
  await expect(page.locator('.stat-card.balance')).toContainText('966,66');
  await expect(page.locator('.stat-card.expense')).toContainText('33,34');
  await page.getByRole('link', { name: 'Cartões de crédito', exact: true }).click();
  await page.getByRole('button', { name: 'Estornar Compra parcelada E2E' }).click();
  await page.getByLabel('Valor do estorno (R$)').fill('100,00');
  await page.getByLabel('Data do estorno').fill('2026-11-07');
  await page.getByLabel('Motivo do estorno').fill('Devolução E2E');
  await save(page);
  await page.getByRole('button', { name: 'Liquidar 2026-12-05', exact: true }).click();
  await page.getByLabel('Data do pagamento ou compensação').fill('2026-11-26');
  await save(page);
  await page.getByRole('button', { name: 'Liquidar 2027-01-05', exact: true }).click();
  await page.getByLabel('Data do pagamento ou compensação').fill('2026-12-26');
  await save(page);
  await expect(page.locator('.account-card')).toContainText('Crédito já compensado: R$');
  await page.getByRole('button', { name: 'Reabrir 2027-01-05', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar reabertura' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Liquidar 2027-01-05', exact: true }).click();
  await page.getByLabel('Data do pagamento ou compensação').fill('2026-12-26');
  await save(page);
  await page.screenshot({ path: 'test-results/cards.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map(
      (v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }),
    ),
  ).toEqual([]);
  await page.getByRole('link', { name: 'Patrimônio e dívidas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova dívida', exact: true }).click();
  await page.getByLabel('Credor', { exact: true }).fill('Credor E2E');
  await page.getByLabel('Principal da dívida (R$)').fill('200,00');
  await page.getByLabel('Taxa mensal informada (%)').fill('1,50');
  await page.getByLabel('Data da dívida').fill('2026-11-01');
  await save(page);
  await page.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();
  await page.getByLabel('Amortização do principal (R$)').fill('50,00');
  await page.getByLabel('Juros pagos (R$)').fill('2,00');
  await page.getByLabel('Data do pagamento', { exact: true }).fill('2026-11-07');
  await page.getByLabel('Conta do pagamento').selectOption({ label: 'Conta teste' });
  await save(page);
  await expect(
    page
      .locator('.planning-card')
      .filter({ has: page.getByRole('heading', { name: 'Credor E2E' }) }),
  ).toContainText('150,00');
  await page.getByRole('button', { name: 'Histórico de pagamentos' }).click();
  await expect(page.getByRole('dialog').getByRole('table')).toContainText('50,00');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar bem ou investimento', exact: true }).click();
  await page.getByLabel('Nome do bem ou investimento').fill('Veículo E2E');
  await page.getByLabel('Classificação', { exact: true }).fill('Veículo');
  await page.getByLabel('Valor aplicado total (R$)').fill('5.000,00');
  await page.getByLabel('Valor atual total informado (R$)').fill('4.000,00');
  await page.getByLabel('Data da avaliação').fill('2026-11-07');
  await save(page);
  await page.getByRole('button', { name: 'Atualizar avaliação', exact: true }).click();
  await page.getByLabel('Valor atual total informado (R$)').fill('4.200,00');
  await page.getByLabel('Data da avaliação').fill('2026-11-08');
  await save(page);
  await expect(
    page
      .locator('.panel')
      .filter({ has: page.getByRole('heading', { name: 'Patrimônio líquido estimado' }) }),
  ).toContainText('4.998,00');
  await page.getByRole('button', { name: 'Histórico de avaliações', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('table')).toContainText('4.200,00');
  await expect(page.getByRole('dialog').getByRole('table')).toContainText('4.000,00');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.request.post(f.root + '/accounts', {
    headers: f.headers,
    data: {
      name: 'Investimento vinculado',
      type: 'investment',
      openingCents: 10000,
      date: '2026-11-01',
    },
  });
  await page.reload();
  await page.getByRole('button', { name: 'Adicionar bem ou investimento', exact: true }).click();
  await page.getByLabel('Nome do bem ou investimento').fill('Investimento E2E');
  await page.getByLabel('Tipo de patrimônio').selectOption('investment');
  await page.getByLabel('Classificação', { exact: true }).fill('Renda fixa');
  await page.getByLabel('Quantidade', { exact: true }).fill('1,25');
  await page.getByLabel('Valor aplicado total (R$)').fill('100,00');
  await page.getByLabel('Valor atual total informado (R$)').fill('120,00');
  await page.getByLabel('Data da avaliação').fill('2026-11-08');
  await page
    .getByLabel('Conta de investimento já cadastrada (opcional)')
    .selectOption({ label: 'Investimento vinculado' });
  await save(page);
  await expect(
    page
      .locator('.panel')
      .filter({ has: page.getByRole('heading', { name: 'Patrimônio líquido estimado' }) }),
  ).toContainText('5.118,00');
  await page.getByRole('button', { name: 'Histórico de pagamentos', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar pagamento', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar cancelamento', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('table')).toContainText('Cancelado');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(
    page
      .locator('.panel')
      .filter({ has: page.getByRole('heading', { name: 'Patrimônio líquido estimado' }) }),
  ).toContainText('5.120,00');
  await page.screenshot({ path: 'test-results/wealth.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map(
      (v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }),
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map(
      (v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }),
    ),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.getByRole('button', { name: 'Abrir menu financeiro' }).click();
  await page.getByRole('link', { name: 'Cartões de crédito', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.getByRole('button', { name: 'Editar cartão', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/cards-mobile.png', fullPage: true });

  expect(errors).toEqual([]);
});

test('comparação do dashboard mostra a diferença real com resultado anterior não zero', async ({
  page,
}) => {
  const f = await bootstrap(page, 'comparison');
  for (const row of [
    {
      description: 'Receita anterior',
      kind: 'income',
      amountCents: 50000,
      date: '2026-10-15',
      categoryId: null,
    },
    {
      description: 'Despesa atual',
      kind: 'expense',
      amountCents: 10000,
      date: '2026-11-07',
      categoryId: f.category,
    },
  ]) {
    const r = await page.request.post(f.root + '/transactions', {
      headers: { ...f.headers, 'Idempotency-Key': crypto.randomUUID() },
      data: { ...row, accountId: f.account },
    });
    expect(r.status()).toBe(201);
  }
  await page.goto('/app');
  await page.getByLabel('Período', { exact: true }).fill('2026-11');
  const result = page.locator('.comparison-grid>div').filter({ hasText: 'Resultado de caixa' });
  await expect(result).toContainText('500,00');
  await expect(result).toContainText('Variação: -R$\u00a0600,00');
  await expect(page.locator('.stat-card.result')).toContainText('-R$\u00a0100,00');
  await expect(page.locator('.stat-card.balance')).toContainText('1.400,00');
});
