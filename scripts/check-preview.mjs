import assert from 'node:assert/strict';
import { mkdtemp, copyFile, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const directory = await mkdtemp(path.join(tmpdir(), 'Clara HTML independente '));
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const file = path.join(directory, 'Clara.html');
  await copyFile('preview/Clara.html', file);
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  const errors = [],
    network = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  // Managed Chromium blocks file:// by policy. Render the copied file's contents
  // in a blank document with the network disabled instead of bypassing that policy.
  await page.setContent(await readFile(file, 'utf8'));
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  const screens = await page
    .locator('#offline-screen option')
    .evaluateAll((options) => options.map((o) => ({ id: o.value, title: o.textContent })));
  assert.equal(screens.length, 39);
  for (const { id, title } of screens) {
    await page.evaluate((id) => {
      location.hash = id;
    }, id);
    await page.waitForFunction((title) => document.title === title + ' · Clara offline', title);
    assert.ok(await page.locator('#offline-root').innerText(), title);
    assert.equal(await page.locator('#offline-root .error').count(), 0, title);
    assert.equal(
      await page
        .locator(
          '#offline-root input:not(:disabled),#offline-root select:not(:disabled),#offline-root textarea:not(:disabled)',
        )
        .count(),
      0,
      title,
    );
    if (await page.locator('#offline-root dialog').count()) {
      assert.equal(await page.getByRole('dialog').isVisible(), true, title);
      await page.getByRole('button', { name: 'Fechar', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('#offline-root dialog'));
    }
  }
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await page.getByRole('link', { name: 'Contas e carteiras', exact: true }).click();
  await page.getByRole('button', { name: 'Nova conta', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').isVisible(), true);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  assert.equal(await page.locator('#offline-toast').isVisible(), true);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  const charts = await page.locator('.recharts-surface').evaluateAll((es) =>
    es.map((el) => ({
      width: el.getBoundingClientRect().width,
      paths: el.querySelectorAll('path').length,
    })),
  );
  assert.equal(charts.length, 2);
  assert.ok(
    charts.every((chart) => chart.width > 0 && chart.paths > 0),
    'Os gráficos precisam estar visíveis e conter os dados capturados.',
  );
  await page.locator('#offline-toast').evaluate((el) => {
    el.hidden = true;
  });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/clara-html-painel.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['inicio', 'painel', 'cartoes', 'patrimonio', 'configuracoes']) {
    await page.evaluate((id) => {
      location.hash = id;
    }, id);
    await page.waitForFunction((id) => document.getElementById('offline-screen').value === id, id);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Sem transbordamento: ${id}`,
    );
  }
  await page.getByRole('button', { name: 'Abrir menu financeiro' }).click();
  assert.ok(await page.locator('.sidebar').evaluate((el) => el.classList.contains('is-open')));
  assert.deepEqual(errors, []);
  assert.deepEqual(network, [], 'O HTML não deve tentar acessar internet ou API.');
  console.log(
    'HTML verificado: conteúdo do arquivo independente copiado para outra pasta, 39 telas, navegação, formulários bloqueados com aviso, diálogos, tema, mobile e zero chamadas de rede. Chromium gerenciado não permite file://; conteúdo testado com setContent e rede desabilitada.',
  );
} finally {
  await browser.close();
  await rm(directory, { recursive: true, force: true });
}
