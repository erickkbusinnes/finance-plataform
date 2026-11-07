import { writeFile } from 'node:fs/promises';
const origin = process.env.PUBLIC_SITE_URL;
if (origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.pathname !== '/')
    throw new Error('PUBLIC_SITE_URL deve ser uma origem HTTPS.');
  const paths = [
    '/',
    '/funcionalidades',
    '/solucoes',
    '/precos',
    '/sobre',
    '/contato',
    '/privacidade',
    '/termos',
  ];
  await writeFile(
    'apps/web/dist/sitemap.xml',
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      paths.map((path) => `<url><loc>${url.origin}${path}</loc></url>`).join('') +
      '</urlset>',
  );
  await writeFile(
    'apps/web/dist/robots.txt',
    `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /verificar-email\nDisallow: /redefinir-senha\nSitemap: ${url.origin}/sitemap.xml\n`,
  );
}
