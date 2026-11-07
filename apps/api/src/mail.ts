import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { PoolClient } from 'pg';
import { pool } from './db.js';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function queueAuthMail(
  userId: string,
  email: string,
  purpose: 'verify' | 'reset',
  client?: PoolClient,
) {
  const token = randomBytes(32).toString('hex');
  // Recoverable outbound message and hashed one-use credential are committed together.
  const c = client || (await pool.connect());
  try {
    if (!client) await c.query('BEGIN');
    await c.query(
      "INSERT INTO auth_tokens(id,user_id,token_hash,purpose,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",
      [randomUUID(), userId, hash(token), purpose],
    );
    await c.query(
      'INSERT INTO mail_outbox(id,user_id,kind,recipient,token) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), userId, purpose, email, token],
    );
    if (!client) await c.query('COMMIT');
  } catch (e) {
    if (!client) await c.query('ROLLBACK');
    throw e;
  } finally {
    if (!client) c.release();
  }
}
export async function deliverMail() {
  const local = process.env.MAIL_MODE === 'local' && process.env.NODE_ENV !== 'production';
  if (!local && !process.env.SMTP_URL) return;
  const transport = local ? null : nodemailer.createTransport(process.env.SMTP_URL!);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows } = await c.query(
      'SELECT * FROM mail_outbox WHERE delivered_at IS NULL ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED',
    );
    for (const row of rows) {
      const url = `${process.env.APP_ORIGIN || 'http://localhost:5173'}/${row.kind === 'verify' ? 'verificar-email' : 'redefinir-senha'}?token=${row.token}`;
      const text = `${row.kind === 'verify' ? 'Confirme seu e-mail' : 'Redefina sua senha'} na Clara: ${url}\nEste link é pessoal, de uso único e expira em 1 hora.`;
      if (local) {
        const dir = path.resolve('../../.local/mail');
        await mkdir(dir, { recursive: true, mode: 0o700 });
        await writeFile(path.join(dir, `${row.id}.txt`), `Para: ${row.recipient}\n${text}`, {
          mode: 0o600,
        });
      } else
        await transport!.sendMail({
          from: process.env.MAIL_FROM,
          to: row.recipient,
          subject:
            row.kind === 'verify' ? 'Confirme seu e-mail na Clara' : 'Recuperação de senha — Clara',
          text,
        });
      await c.query('UPDATE mail_outbox SET delivered_at=now(),token=NULL WHERE id=$1', [row.id]);
    }
    await c.query('COMMIT');
  } catch {
    await c.query('ROLLBACK'); /* Retries on next tick, without logging message/token. */
  } finally {
    c.release();
  }
}
