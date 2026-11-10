import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const env = { ...process.env, NODE_ENV: 'production', SERVE_WEB: 'true' };
env.APP_ORIGIN ||= env.RENDER_EXTERNAL_URL;
let origin;
try {
  origin = new URL(env.APP_ORIGIN);
} catch {
  /* Validated below. */
}
if (!origin || origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN)
  throw new Error('Configure APP_ORIGIN com a origem HTTPS pública, sem barra final.');
if (!env.DATABASE_URL) throw new Error('Configure DATABASE_URL no painel da hospedagem.');

let child;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child?.kill(signal));
const cwd = fileURLToPath(new URL('../apps/api/', import.meta.url));
function run(entry) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [entry], { cwd, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal === 'SIGTERM' ? 143 : 1)));
  });
}
const migrated = await run('dist/migrate.js');
if (migrated !== 0) process.exit(migrated);
process.exit(await run('dist/server.js'));
