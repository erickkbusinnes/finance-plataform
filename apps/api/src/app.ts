import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import { docsPage } from './docs.js';
import { z } from 'zod';
import { authRoutes } from './auth.js';
import { pool } from './db.js';
import { check } from './errors.js';
import { financeRoutes } from './finance.js';
export async function buildApp(options: { logger?: boolean; rateLimit?: boolean } = {}) {
  if (process.env.NODE_ENV === 'production') {
    check(!!process.env.APP_ORIGIN?.startsWith('https://'), 500, 'APP_ORIGIN deve usar HTTPS.');
    check(
      process.env.MAIL_MODE !== 'local' && !!process.env.SMTP_URL && !!process.env.MAIL_FROM,
      500,
      'Configure SMTP e remetente antes de iniciar em produção.',
    );
  }
  const app = Fastify({
    logger: options.logger
      ? {
          level: 'info',
          serializers: {
            req: (r) => ({ method: r.method, url: r.url?.split('?')[0] }),
            res: (r) => ({ statusCode: r.statusCode }),
          },
        }
      : false,
    bodyLimit: 65536,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cookie);
  await app.register(cors, {
    origin: process.env.APP_ORIGIN || 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Clara-Client', 'Idempotency-Key'],
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    max: options.rateLimit === false ? 100000 : 120,
    timeWindow: '1 minute',
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Clara API',
        version: '0.1.0',
        description:
          'API de gestão financeira. Sessão por cookie HttpOnly; operações de escrita exigem X-Clara-Client: web. Valores monetários em centavos de BRL.',
      },
      components: {
        securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'clara_session' } },
      },
    },
    transform: jsonSchemaTransform,
  });
  app.get('/api/docs/json', async () => app.swagger());
  app.get('/api/docs', async (_req, reply) =>
    reply.type('text/html; charset=utf-8').send(docsPage),
  );
  app.addHook('onRequest', async (req) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      check(req.headers['x-clara-client'] === 'web', 403, 'Cabeçalho de segurança ausente.');
      const origin = req.headers.origin;
      if (origin)
        check(
          origin === (process.env.APP_ORIGIN || 'http://localhost:5173'),
          403,
          'Origem não autorizada.',
        );
    }
  });
  app.setErrorHandler((error: any, _req, reply) => {
    if (error.validation)
      return reply.code(400).send({
        message: 'Revise os campos informados.',
        issues: error.validation.map((v: any) => ({ path: v.instancePath, message: v.message })),
      });
    if (error.code === '23505')
      return reply.code(409).send({ message: 'Já existe um registro com estes dados.' });
    if (error.statusCode && error.statusCode < 500)
      return reply.code(error.statusCode).send({ message: error.message });
    app.log.error({ code: error.code || 'INTERNAL', requestId: _req.id }, 'Falha interna');
    return reply
      .code(500)
      .send({ message: 'Não foi possível concluir a operação. Tente novamente.' });
  });
  await app.register(
    async (api) => {
      api.get('/health', async () => {
        await pool.query('SELECT 1');
        return { status: 'ok' };
      });
      await api.register(authRoutes);
      await api.register(financeRoutes);
      const typed = api.withTypeProvider<ZodTypeProvider>();
      typed.post(
        '/contact',
        {
          schema: {
            body: z.object({
              name: z.string().trim().min(2).max(100),
              email: z.email().max(254),
              message: z.string().trim().min(10).max(3000),
            }),
          },
          config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
        },
        async (req, reply) => {
          const b = req.body;
          await pool.query(
            'INSERT INTO contact_messages(id,name,email,message) VALUES($1,$2,$3,$4)',
            [randomUUID(), b.name, b.email, b.message],
          );
          return reply.code(201).send({ message: 'Mensagem registrada. Obrigado pelo contato.' });
        },
      );
    },
    { prefix: '/api' },
  );
  return app;
}
