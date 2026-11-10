import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
const publicPages = new Set([
  '/',
  '/entrar',
  '/cadastro',
  '/recuperar-senha',
  '/verificar-email',
  '/redefinir-senha',
  '/funcionalidades',
  '/solucoes',
  '/precos',
  '/sobre',
  '/contato',
  '/termos',
  '/privacidade',
]);
const csp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export async function serveWeb(app: FastifyInstance, root: string) {
  // Only files discovered inside the build are addressable. No request is resolved on disk.
  const files = new Map<string, { body: Buffer; type: string; immutable: boolean }>();
  async function scan(dir: string, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_') || entry.isSymbolicLink())
        continue;
      const key = prefix + '/' + entry.name;
      if (entry.isDirectory()) await scan(path.join(dir, entry.name), key);
      else if (entry.isFile() && types[path.extname(entry.name)]) {
        files.set(key, {
          body: await readFile(path.join(dir, entry.name)),
          type: types[path.extname(entry.name)],
          immutable: key.startsWith('/assets/') && /-[\w-]{8,}\./.test(entry.name),
        });
      }
    }
  }
  await scan(root);
  if (!files.has('/index.html')) throw new Error('Build web ausente. Execute npm run build.');
  app.setNotFoundHandler(async (req, reply) => {
    const raw = req.raw.url?.split('?')[0] || '/';
    let pathname;
    try {
      pathname = decodeURIComponent(raw);
    } catch {
      return reply.code(404).send({ message: 'Caminho inválido.' });
    }
    if (
      !['GET', 'HEAD'].includes(req.method) ||
      /[\\\0]/.test(pathname) ||
      pathname.split('/').some((part) => part.startsWith('.')) ||
      pathname === '/api' ||
      pathname.startsWith('/api/')
    )
      return reply.code(404).send({ message: 'Caminho não encontrado.' });
    const file =
      files.get(pathname) ||
      (publicPages.has(pathname) || pathname === '/app' || pathname.startsWith('/app/')
        ? files.get('/index.html')
        : undefined);
    if (!file) return reply.code(404).send({ message: 'Caminho não encontrado.' });
    return reply
      .header('Content-Security-Policy', csp)
      .header('Cache-Control', file.immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
      .type(file.type)
      .send(req.method === 'HEAD' ? undefined : file.body);
  });
}
