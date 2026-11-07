import { loginSchema, registerSchema } from '@clara/shared';
import argon2 from 'argon2';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { atomic, pool } from './db.js';
import { AppError, check } from './errors.js';
import { hash, queueAuthMail } from './mail.js';
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    sessionId: string;
  }
}
const sessionCookie = 'clara_session';
const publicUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  emailVerified: u.email_verified,
});
export async function authenticate(req: FastifyRequest) {
  const token = req.cookies[sessionCookie];
  check(token, 401, 'Entre na sua conta para continuar.');
  const { rows } = await pool.query(
    'SELECT id,user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()',
    [hash(token)],
  );
  check(rows[0], 401, 'Sua sessão expirou. Entre novamente.');
  req.userId = rows[0].user_id;
  req.sessionId = rows[0].id;
}
export async function authRoutes(base: FastifyInstance) {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const setSession = async (userId: string, reply: any) => {
    const token = randomBytes(32).toString('hex');
    await pool.query(
      "INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
      [randomUUID(), userId, hash(token)],
    );
    reply.setCookie(sessionCookie, token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 604800,
    });
  };
  app.post(
    '/auth/register',
    { schema: { body: registerSchema }, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const b = req.body;
      const pw = await argon2.hash(b.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      const user = await atomic(async (c) => {
        let u;
        try {
          u = (
            await c.query(
              'INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING *',
              [randomUUID(), b.name, b.email, pw],
            )
          ).rows[0];
        } catch (e: any) {
          if (e.code === '23505')
            throw new AppError(
              409,
              'Não foi possível cadastrar este e-mail. Tente entrar ou recuperar a senha.',
            );
          throw e;
        }
        await queueAuthMail(u.id, u.email, 'verify', c);
        return u;
      });
      await setSession(user.id, reply);
      return reply.code(201).send(publicUser(user));
    },
  );
  app.post(
    '/auth/login',
    { schema: { body: loginSchema }, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const u = (await pool.query('SELECT * FROM users WHERE email=$1', [req.body.email])).rows[0];
      // Always perform expensive verification to reduce account enumeration by timing.
      const fallback =
        '$argon2id$v=19$m=19456,t=2,p=1$eHl6eHl6eHl6eHl6eHl6eA$1sUOQxg4QIfTVuKgN0L4PxIN9AuN/hxGKBxJ/dCjY6E';
      const ok = await argon2
        .verify(u?.password_hash || fallback, req.body.password)
        .catch(() => false);
      check(u && ok, 401, 'E-mail ou senha incorretos.');
      await setSession(u.id, reply);
      return publicUser(u);
    },
  );
  app.get('/auth/me', { preHandler: authenticate }, async (req) =>
    publicUser((await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])).rows[0]),
  );
  app.post('/auth/logout', { preHandler: authenticate }, async (req, reply) => {
    await pool.query('DELETE FROM sessions WHERE id=$1', [req.sessionId]);
    reply.clearCookie(sessionCookie, { path: '/' });
    return { ok: true };
  });
  app.get(
    '/auth/sessions',
    { preHandler: authenticate },
    async (req) =>
      (
        await pool.query(
          'SELECT id,created_at AS "createdAt",expires_at AS "expiresAt",id=$2 AS current FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC',
          [req.userId, req.sessionId],
        )
      ).rows,
  );
  app.delete(
    '/auth/sessions/:id',
    { preHandler: authenticate, schema: { params: z.object({ id: z.uuid() }) } },
    async (req) => {
      await pool.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2', [
        req.params.id,
        req.userId,
      ]);
      return { ok: true };
    },
  );
  app.post(
    '/auth/forgot-password',
    {
      schema: { body: z.object({ email: z.email().transform((s) => s.toLowerCase()) }) },
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (req) => {
      const u = (await pool.query('SELECT id,email FROM users WHERE email=$1', [req.body.email]))
        .rows[0];
      if (u) await queueAuthMail(u.id, u.email, 'reset');
      return { message: 'Se houver uma conta, enviaremos as instruções de recuperação.' };
    },
  );
  app.post(
    '/auth/resend-verification',
    { preHandler: authenticate, config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (req) => {
      const u = (await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])).rows[0];
      if (!u.email_verified) await queueAuthMail(u.id, u.email, 'verify');
      return { ok: true };
    },
  );
  app.post(
    '/auth/verify-email',
    { schema: { body: z.object({ token: z.string().length(64) }) } },
    async (req) => {
      await atomic(async (c) => {
        const { rows } = await c.query(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='verify' AND expires_at>now() RETURNING user_id",
          [hash(req.body.token)],
        );
        check(rows[0], 400, 'Link inválido ou expirado.');
        await c.query('UPDATE users SET email_verified=true WHERE id=$1', [rows[0].user_id]);
      });
      return { ok: true };
    },
  );
  app.post(
    '/auth/reset-password',
    {
      schema: {
        body: z.object({ token: z.string().length(64), password: registerSchema.shape.password }),
      },
    },
    async (req) => {
      const pw = await argon2.hash(req.body.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      await atomic(async (c) => {
        const { rows } = await c.query(
          "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='reset' AND expires_at>now() RETURNING user_id",
          [hash(req.body.token)],
        );
        check(rows[0], 400, 'Link inválido ou expirado.');
        const id = rows[0].user_id;
        await c.query('UPDATE users SET password_hash=$1 WHERE id=$2', [pw, id]);
        await c.query('DELETE FROM sessions WHERE user_id=$1', [id]);
        await c.query("DELETE FROM auth_tokens WHERE user_id=$1 AND purpose='reset'", [id]);
      });
      return { ok: true };
    },
  );
  app.post(
    '/auth/change-password',
    {
      preHandler: authenticate,
      schema: {
        body: z.object({
          currentPassword: z.string().max(128),
          password: registerSchema.shape.password,
        }),
      },
    },
    async (req) => {
      const u = (await pool.query('SELECT * FROM users WHERE id=$1', [req.userId])).rows[0];
      check(
        await argon2.verify(u.password_hash, req.body.currentPassword),
        400,
        'Senha atual incorreta.',
      );
      const pw = await argon2.hash(req.body.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      await atomic(async (c) => {
        await c.query('UPDATE users SET password_hash=$1 WHERE id=$2', [pw, req.userId]);
        await c.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2', [
          req.userId,
          req.sessionId,
        ]);
      });
      return { ok: true };
    },
  );
}
