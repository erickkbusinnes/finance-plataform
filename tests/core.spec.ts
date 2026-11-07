import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
const email = `${process.env.E2E_SCHEMA}@example.com`,
  password = 'uma-senha-segura-123';
test('jornada real: cadastro, contas, transações, transferência, planejamento e persistência', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Suas finanças');
  await page.getByRole('link', { name: 'Criar minha conta', exact: true }).click();
  await page.getByLabel('Como podemos chamar você?').fill('Ana E2E');
  await page.getByLabel('Seu e-mail').fill(email);
  await page.getByLabel('Sua senha').fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Um espaço');
  await page.getByRole('button', { name: 'Criar meu ambiente' }).click();
  await page.getByRole('button', { name: 'Adicionar minha conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Banco principal');
  await page.getByLabel('Saldo inicial (R$)').fill('1.000,00');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.stat-card.balance')).toContainText('1.000,00');
  await page.getByRole('link', { name: 'Contas e carteiras', exact: true }).click();
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByLabel('Nome da conta').fill('Carteira');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nova categoria', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Mercado');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Movimentações', exact: true }).click();
  await page.getByRole('button', { name: 'Nova movimentação', exact: true }).click();
  await page.getByLabel('Descrição', { exact: true }).fill('Compra no mercado');
  await page.getByLabel('Valor (R$)').fill('125,90');
  await page.getByLabel('Conta', { exact: true }).selectOption({ label: 'Banco principal' });
  await page.getByLabel('Categoria', { exact: true }).selectOption({ label: 'Mercado' });
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('table')).toContainText('Compra no mercado');
  await page.getByRole('button', { name: 'Nova movimentação', exact: true }).click();
  await page.getByRole('button', { name: 'Receita', exact: true }).click();
  await page.getByLabel('Descrição', { exact: true }).fill('Projeto entregue');
  await page.getByLabel('Valor (R$)').fill('500,00');
  await page.getByLabel('Conta', { exact: true }).selectOption({ label: 'Banco principal' });
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nova movimentação', exact: true }).click();
  await page.getByRole('button', { name: 'Transferência', exact: true }).click();
  await page.getByLabel('Descrição', { exact: true }).fill('Reserva na carteira');
  await page.getByLabel('Valor (R$)').fill('200,00');
  await page.getByLabel('Conta de origem').selectOption({ label: 'Banco principal' });
  await page.getByLabel('Conta de destino').selectOption({ label: 'Carteira' });
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Buscar movimentações').fill('Compra');
  await expect(page.getByRole('row')).toHaveCount(2);
  await page.getByLabel('Buscar movimentações').fill('');
  await expect(page.getByRole('row')).toHaveCount(4);
  await page.getByRole('button', { name: 'Detalhes de Compra no mercado' }).click();
  await page.getByRole('button', { name: 'Editar registro' }).click();
  await page.getByLabel('Valor (R$)').fill('100,00');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.stat-card.balance')).toContainText('1.400,00');
  await expect(page.locator('.stat-card.income')).toContainText('500,00');
  await expect(page.locator('.stat-card.expense')).toContainText('100,00');
  await expect(page.locator('.chart')).toBeVisible();
  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await page.getByRole('button', { name: 'Definir limite' }).click();
  await page.getByLabel('Categoria de despesa').selectOption({ label: 'Mercado' });
  await page.getByLabel('Limite (R$)').fill('300,00');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '10000');
  await page
    .locator('.heading-actions')
    .getByRole('button', { name: 'Nova meta', exact: true })
    .click();
  await page.getByLabel('O que você quer realizar?').fill('Reserva de emergência');
  await page.getByLabel('Valor objetivo (R$)').fill('5.000,00');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar progresso' }).click();
  await page.getByLabel('Valor reservado (R$)').fill('200,00');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('.goal-card')).toContainText('200,00');
  await page.getByRole('button', { name: 'Minhas finanças Ambiente pessoal' }).click();
  await page.getByRole('button', { name: 'Criar ambiente', exact: true }).click();
  await page.getByLabel('Nome do ambiente').fill('Minha empresa');
  await page.getByLabel('Tipo de ambiente').selectOption('business');
  await page.getByRole('button', { name: 'Criar ambiente', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.workspace-switch').click();
  await page.getByRole('button', { name: 'Minha empresa', exact: true }).click();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.stat-card.balance')).toContainText('0,00');
  await page.locator('.workspace-switch').click();
  await page.getByRole('button', { name: 'Minhas finanças', exact: true }).click();
  await expect(page.locator('.stat-card.balance')).toContainText('1.400,00');
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/entrar/);
  await page.getByLabel('Seu e-mail').fill(email);
  await page.getByLabel('Sua senha').fill(password);
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.locator('.stat-card.balance')).toContainText('1.400,00');
  await expect(page.locator('.recharts-pie-sector').first()).toBeVisible();
  const light = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    light.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, message: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.screenshot({ path: 'test-results/dashboard-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations).toEqual([]);
});
test('mobile: navegação, cadastro e formulário em 390px sem transbordamento', async ({ page }) => {
  const mobileEmail = `mobile-${process.env.E2E_SCHEMA}@example.com`;
  const headers = { 'X-Clara-Client': 'web' };
  const registration = await page.request.post('/api/auth/register', {
    headers,
    data: { name: 'Mobile E2E', email: mobileEmail, password },
  });
  expect(registration.status()).toBe(201);
  const workspace = await (
    await page.request.post('/api/workspaces', {
      headers,
      data: { name: 'Teste móvel', kind: 'personal' },
    })
  ).json();
  expect(
    (
      await page.request.post(`/api/workspaces/${workspace.id}/accounts`, {
        headers,
        data: { name: 'Conta E2E', openingCents: 140000, date: '2026-11-01' },
      })
    ).status(),
  ).toBe(201);
  await page.context().clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
  await page.goto('/entrar');
  await page.getByLabel('Seu e-mail').fill(mobileEmail);
  await page.getByLabel('Sua senha').fill(password);
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.locator('.stat-card.balance')).toContainText('1.400,00');
  await page.getByRole('button', { name: 'Abrir menu financeiro' }).click();
  await page.getByRole('link', { name: 'Contas e carteiras', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Contas e carteiras', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'test-results/accounts-mobile.png', fullPage: true });
});
test('site público: páginas disponíveis e contato persistido', async ({ page }) => {
  for (const path of [
    '/funcionalidades',
    '/solucoes',
    '/precos',
    '/sobre',
    '/privacidade',
    '/termos',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.goto('/contato');
  await page.getByLabel('Seu nome').fill('Teste contato');
  await page.getByLabel('E-mail', { exact: true }).fill('contato@example.com');
  await page.getByLabel('Mensagem').fill('Uma mensagem de teste para verificar o formulário.');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByRole('status')).toContainText('registrada');
});

test('acessibilidade do site público', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
