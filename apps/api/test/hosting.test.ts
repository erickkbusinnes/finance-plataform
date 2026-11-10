import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Fastify from 'fastify';
import { validateRuntime } from '../src/runtime.js';
import { serveWeb } from '../src/web.js';

test('hospedagem mantém HTTPS obrigatório e SMTP obrigatório fora da demonstração explícita', () => {
  const keys = ['NODE_ENV', 'APP_ORIGIN', 'DEPLOYMENT_MODE', 'MAIL_MODE', 'SMTP_URL', 'MAIL_FROM'];
  const saved = keys.map((key) => process.env[key]);
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_URL;
    delete process.env.MAIL_FROM;
    delete process.env.DEPLOYMENT_MODE;
    process.env.APP_ORIGIN = 'https://clara.example';
    process.env.MAIL_MODE = 'disabled';
    assert.throws(validateRuntime, /Configure SMTP/);
    process.env.DEPLOYMENT_MODE = 'preview';
    assert.doesNotThrow(validateRuntime);
    for (const origin of [
      'http://clara.example',
      'https://clara.example/',
      'https://user:pw@clara.example',
      'https://clara.example/path',
      'https://clara.example?x=1',
    ]) {
      process.env.APP_ORIGIN = origin;
      assert.throws(validateRuntime, /HTTPS/);
    }
    process.env.APP_ORIGIN = 'https://clara.example';
    process.env.MAIL_MODE = 'local';
    assert.throws(validateRuntime, /MAIL_MODE=disabled/);
    delete process.env.DEPLOYMENT_MODE;
    process.env.MAIL_MODE = 'smtp';
    process.env.SMTP_URL = 'smtps://example.invalid';
    process.env.MAIL_FROM = 'clara@example.invalid';
    assert.doesNotThrow(validateRuntime);
  } finally {
    keys.forEach((key, i) =>
      saved[i] === undefined ? delete process.env[key] : (process.env[key] = saved[i]),
    );
  }
});

test('site compilado serve SPA e assets; API, arquivos privados e travessia nunca recebem HTML', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'clara-web-'));
  const app = Fastify();
  try {
    await mkdir(path.join(root, 'assets'));
    await writeFile(path.join(root, 'index.html'), '<h1>Clara</h1>');
    await writeFile(path.join(root, 'assets/app-abcdefgh.js'), 'console.log("Clara")');
    await writeFile(path.join(root, '.env'), 'fixture-private-do-not-serve');
    await writeFile(path.join(root, 'assets/source.js.map'), '{}');
    await symlink(path.join(root, '.env'), path.join(root, 'private.txt'));
    app.get('/api/health', async () => ({ status: 'ok' }));
    await serveWeb(app, root);
    for (const url of ['/', '/cadastro', '/app/contas', '/entrar?next=app']) {
      const r = await app.inject({ url });
      assert.equal(r.statusCode, 200, url);
      assert.equal(r.body, '<h1>Clara</h1>');
      assert.match(String(r.headers['content-type']), /text\/html/);
      assert.equal(r.headers['cache-control'], 'no-cache');
      assert.match(String(r.headers['content-security-policy']), /frame-ancestors 'none'/);
    }
    const asset = await app.inject({ url: '/assets/app-abcdefgh.js' });
    assert.match(String(asset.headers['content-type']), /javascript/);
    assert.match(String(asset.headers['cache-control']), /immutable/);
    assert.equal((await app.inject({ method: 'HEAD', url: '/' })).body, '');
    assert.deepEqual((await app.inject({ url: '/api/health' })).json(), { status: 'ok' });
    for (const url of [
      '/api/missing',
      '/api',
      '/.env',
      '/%2eenv',
      '/assets/%2e%2e/.env',
      '/app/%2e%2e/.env',
      '/private.txt',
      '/assets/missing.js',
      '/assets/source.js.map',
      '/app/..%5c.env',
      '/app/%00',
    ]) {
      const r = await app.inject({ url });
      assert.equal(r.statusCode, 404, url);
      assert.doesNotMatch(r.body, /<h1>|fixture-private/);
    }
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
