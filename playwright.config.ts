import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
// A separate API, database schema and web port keep end-to-end data out of dev accounts.
if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL em .env.');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!url.pathname.endsWith('_test')) throw new Error('O banco de testes deve terminar em _test.');
const schema = process.env.E2E_SCHEMA || 'e2e_' + randomUUID().replaceAll('-', '');
process.env.E2E_SCHEMA = schema;
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.E2E_DATABASE_URL = url.toString();
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60000,
  globalTeardown: './tests/teardown.ts',
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
      args: ['--no-sandbox'],
    },
  },
  webServer: [
    {
      command: 'node --import tsx scripts/e2e-database.ts && npm run dev -w @clara/api',
      url: 'http://localhost:3002/api/health',
      env: {
        DATABASE_URL: url.toString(),
        E2E_SCHEMA: schema,
        PORT: '3002',
        APP_ORIGIN: 'http://localhost:5174',
        MAIL_MODE: 'local',
      },
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -w @clara/web -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:3002' },
      reuseExistingServer: false,
    },
  ],
});
