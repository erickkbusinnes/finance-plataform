import { buildApp } from './app.js';
import { pool } from './db.js';
import { deliverMail } from './mail.js';
const app = await buildApp({ logger: true });
await app.listen({ port: Number(process.env.PORT || 3001), host: '0.0.0.0' });
const flushMail = () =>
  deliverMail().catch(() =>
    app.log.warn(
      { code: 'MAIL_UNAVAILABLE' },
      'Envio de e-mail indisponível; será tentado novamente.',
    ),
  );
const mailTimer = setInterval(() => {
  void flushMail();
}, 10000);
mailTimer.unref();
void flushMail();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    clearInterval(mailTimer);
    await app.close();
    await pool.end();
    process.exit(0);
  });
