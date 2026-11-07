import { registerSchema } from '@clara/shared';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { authenticate } from './auth.js';
import { atomic } from './db.js';
import { check } from './errors.js';
import { queueAuthMail } from './mail.js';
export async function privacyRoutes(base: FastifyInstance) {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);
  app.patch(
    '/auth/profile',
    {
      schema: {
        body: z.object({
          name: registerSchema.shape.name,
          email: registerSchema.shape.email,
          currentPassword: z.string().max(128).optional(),
        }),
      },
    },
    async (req) =>
      atomic(async (c) => {
        const u = (await c.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.userId]))
          .rows[0];
        check(u, 401, 'Sessão inválida.');
        if (u.email !== req.body.email) {
          check(
            !!req.body.currentPassword &&
              (await argon2.verify(u.password_hash, req.body.currentPassword)),
            400,
            'Confirme sua senha atual para alterar o e-mail.',
          );
          await c.query('DELETE FROM auth_tokens WHERE user_id=$1', [u.id]);
          await c.query('DELETE FROM mail_outbox WHERE user_id=$1 AND delivered_at IS NULL', [
            u.id,
          ]);
          await c.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2', [u.id, req.sessionId]);
        }
        const row = (
          await c.query(
            'UPDATE users SET name=$2,email=$3,email_verified=CASE WHEN email=$3 THEN email_verified ELSE false END WHERE id=$1 RETURNING id,name,email,email_verified AS "emailVerified"',
            [u.id, req.body.name, req.body.email],
          )
        ).rows[0];
        if (u.email !== row.email) await queueAuthMail(u.id, row.email, 'verify', c);
        return row;
      }),
  );
  app.get(
    '/auth/export',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const result = await atomic(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const user = (
          await c.query('SELECT id,name,email,email_verified,created_at FROM users WHERE id=$1', [
            req.userId,
          ])
        ).rows[0];
        const memberships = (
          await c.query('SELECT workspace_id,role FROM workspace_members WHERE user_id=$1', [
            req.userId,
          ])
        ).rows;
        const ids = memberships.map((m) => m.workspace_id);
        const workspaces = (
          await c.query('SELECT * FROM workspaces WHERE id=ANY($1::uuid[])', [ids])
        ).rows;
        const data: Record<string, unknown> = {};
        const tables = [
          'financial_accounts',
          'categories',
          'transactions',
          'transaction_entries',
          'budgets',
          'goals',
          'goal_contributions',
          'audit_logs',
          'credit_cards',
          'card_purchases',
          'card_statements',
          'card_installments',
          'card_refunds',
          'card_credit_entries',
          'debts',
          'debt_payments',
          'holdings',
          'holding_valuations',
        ];
        for (const table of tables) {
          if (!(await c.query('SELECT to_regclass($1) AS name', [table])).rows[0].name) continue;
          const rows = (
            await c.query(`SELECT * FROM ${table} WHERE workspace_id=ANY($1::uuid[]) LIMIT 10001`, [
              ids,
            ])
          ).rows;
          check(
            rows.length <= 10000,
            413,
            'Exportação excede 10.000 registros por entidade. Solicite uma exportação administrativa segura.',
          );
          data[table] = rows;
        }
        return {
          exportedAt: new Date().toISOString(),
          currency: 'BRL',
          monetaryUnit: 'integer_cents',
          user,
          memberships,
          workspaces,
          data,
        };
      });
      return reply
        .header('Cache-Control', 'private, no-store')
        .header('Content-Disposition', 'attachment; filename="clara-dados.json"')
        .send(result);
    },
  );
  app.delete(
    '/auth/account',
    {
      schema: {
        body: z.object({
          password: z.string().min(1).max(128),
          confirmation: z.literal('EXCLUIR MINHA CONTA'),
        }),
      },
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const mailIds = await atomic(async (c) => {
        const u = (await c.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.userId]))
          .rows[0];
        check(
          u && (await argon2.verify(u.password_hash, req.body.password)),
          400,
          'Senha incorreta.',
        );
        const own = (
          await c.query(
            "SELECT workspace_id FROM workspace_members WHERE user_id=$1 AND role='owner' ORDER BY workspace_id",
            [req.userId],
          )
        ).rows.map((r) => r.workspace_id);
        for (const id of own) {
          await c.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [id]);
          check(
            !(
              await c.query(
                'SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id<>$2',
                [id, req.userId],
              )
            ).rowCount,
            409,
            'Há ambientes compartilhados sob sua propriedade. Transfira a propriedade antes de excluir a conta.',
          );
        }
        const mail = (
          await c.query('SELECT id FROM mail_outbox WHERE user_id=$1', [req.userId])
        ).rows.map((r) => r.id);
        await c.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])', [own]);
        await c.query('DELETE FROM users WHERE id=$1', [req.userId]);
        return mail;
      });
      if (process.env.NODE_ENV !== 'production')
        for (const id of mailIds)
          await rm(path.resolve('../../.local/mail', id + '.txt'), { force: true });
      reply.clearCookie('clara_session', { path: '/' });
      return { ok: true };
    },
  );
}
