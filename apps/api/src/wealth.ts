import {
  debtPaymentSchema,
  debtSchema,
  holdingSchema,
  valuationSchema,
} from '@clara/shared/planning';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authenticate } from './auth.js';
import { cardPosition } from './cards.js';
import { atomic, integer, pool } from './db.js';
import { check } from './errors.js';
import { audit, authorize, entity, lock, managedExpense, moneyRows, ws } from './ledger.js';
const keyed = z.object({ 'idempotency-key': z.uuid() });
const pages = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) });
export async function wealthRoutes(base: FastifyInstance) {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);
  app.get('/workspaces/:wid/debts', { schema: { params: ws } }, async (req) =>
    moneyRows(
      (
        await pool.query(
          'SELECT d.id,d.creditor,d.principal_cents AS "principalCents",d.monthly_interest_bps AS "monthlyInterestBps",d.date,d.due_date AS "dueDate",d.principal_cents-COALESCE((SELECT sum(p.principal_cents) FROM debt_payments p WHERE p.debt_id=d.id AND p.voided_at IS NULL),0) AS "outstandingCents" FROM debts d WHERE d.workspace_id=$1 ORDER BY d.created_at DESC',
          [await authorize(req)],
        )
      ).rows,
      ['principalCents', 'outstandingCents'],
    ),
  );
  app.post(
    '/workspaces/:wid/debts',
    { schema: { params: ws, body: debtSchema } },
    async (req, reply) => {
      const wid = await authorize(req, true),
        b = req.body,
        id = randomUUID();
      await atomic(async (c) => {
        await c.query(
          'INSERT INTO debts(id,workspace_id,creditor,principal_cents,monthly_interest_bps,date,due_date) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [id, wid, b.creditor, b.principalCents, b.monthlyInterestBps, b.date, b.dueDate || null],
        );
        await audit(c, wid, req.userId, 'debt.create', id, null, b);
      });
      return reply.code(201).send({ id });
    },
  );
  app.get(
    '/workspaces/:wid/debts/:id/payments',
    { schema: { params: entity, querystring: pages } },
    async (req) => {
      const wid = await authorize(req);
      return atomic(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        check(
          (
            await c.query('SELECT 1 FROM debts WHERE workspace_id=$1 AND id=$2', [
              wid,
              req.params.id,
            ])
          ).rowCount,
          404,
          'Dívida não encontrada.',
        );
        const total = integer(
          (
            await c.query(
              'SELECT count(*) FROM debt_payments WHERE workspace_id=$1 AND debt_id=$2',
              [wid, req.params.id],
            )
          ).rows[0].count,
        );
        return {
          items: moneyRows(
            (
              await c.query(
                'SELECT id,date,principal_cents AS "principalCents",interest_cents AS "interestCents",voided_at AS "voidedAt" FROM debt_payments WHERE workspace_id=$1 AND debt_id=$2 ORDER BY date DESC,created_at DESC,id DESC LIMIT 25 OFFSET $3',
                [wid, req.params.id, (req.query.page - 1) * 25],
              )
            ).rows,
            ['principalCents', 'interestCents'],
          ),
          total,
          page: req.query.page,
        };
      });
    },
  );
  app.post(
    '/workspaces/:wid/debts/:id/payments',
    { schema: { params: entity, body: debtPaymentSchema, headers: keyed } },
    async (req, reply) => {
      const wid = await authorize(req, true),
        b = req.body;
      const result = await atomic(async (c) => {
        await lock(c, wid);
        const debt = (
          await c.query('SELECT * FROM debts WHERE workspace_id=$1 AND id=$2', [wid, req.params.id])
        ).rows[0];
        check(debt, 404, 'Dívida não encontrada.');
        const prior = (
          await c.query(
            'SELECT p.*,t.account_id FROM debt_payments p JOIN transactions t ON t.id=p.transaction_id WHERE p.workspace_id=$1 AND p.idempotency_key=$2',
            [wid, req.headers['idempotency-key']],
          )
        ).rows[0];
        if (prior) {
          check(
            prior.debt_id === debt.id &&
              integer(prior.principal_cents) === b.principalCents &&
              integer(prior.interest_cents) === b.interestCents &&
              prior.date === b.date &&
              prior.account_id === b.accountId,
            409,
            'Chave já utilizada com outro pagamento.',
          );
          return { id: prior.id, replayed: true };
        }
        check(b.date >= debt.date, 400, 'Pagamento anterior à dívida.');
        const paid = BigInt(
          (
            await c.query(
              'SELECT COALESCE(sum(principal_cents),0) AS total FROM debt_payments WHERE workspace_id=$1 AND debt_id=$2 AND voided_at IS NULL',
              [wid, debt.id],
            )
          ).rows[0].total,
        );
        check(
          paid + BigInt(b.principalCents) <= BigInt(debt.principal_cents),
          409,
          'Amortização excede o principal pendente.',
        );
        const tid = await managedExpense(c, wid, req.userId, {
          description: `Pagamento dívida · ${debt.creditor}`,
          amountCents: b.principalCents + b.interestCents,
          date: b.date,
          accountId: b.accountId,
          sourceType: 'debt_payment',
          key: req.headers['idempotency-key'],
        });
        const id = randomUUID();
        await c.query(
          'INSERT INTO debt_payments(id,workspace_id,debt_id,principal_cents,interest_cents,date,transaction_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            id,
            wid,
            debt.id,
            b.principalCents,
            b.interestCents,
            b.date,
            tid,
            req.headers['idempotency-key'],
          ],
        );
        await audit(c, wid, req.userId, 'debt.payment', id, null, b);
        return { id, replayed: false };
      });
      return reply.code(result.replayed ? 200 : 201).send(result);
    },
  );
  app.post(
    '/workspaces/:wid/debts/:id/payments/:pid/void',
    { schema: { params: entity.extend({ pid: z.uuid() }) } },
    async (req) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        await lock(c, wid);
        const p = (
          await c.query(
            'SELECT * FROM debt_payments WHERE workspace_id=$1 AND debt_id=$2 AND id=$3 FOR UPDATE',
            [wid, req.params.id, req.params.pid],
          )
        ).rows[0];
        check(p && !p.voided_at, 409, 'Pagamento não encontrado ou já cancelado.');
        await c.query('UPDATE debt_payments SET voided_at=now() WHERE id=$1', [p.id]);
        await c.query(
          'UPDATE transactions SET voided_at=now(),updated_at=now(),version=version+1 WHERE id=$1',
          [p.transaction_id],
        );
        await audit(c, wid, req.userId, 'debt.payment.void', p.id, p, null);
        await audit(c, wid, req.userId, 'transaction.void', p.transaction_id, null, {
          reason: 'Cancelamento de pagamento de dívida',
        });
      });
      return { ok: true };
    },
  );
  app.get('/workspaces/:wid/holdings', { schema: { params: ws } }, async (req) =>
    moneyRows(
      (
        await pool.query(
          'SELECT h.id,h.name,h.kind,h.subtype,h.quantity::text,h.applied_cents AS "appliedCents",h.linked_account_id AS "linkedAccountId",v.value_cents AS "valueCents",v.date AS "valuationDate" FROM holdings h JOIN LATERAL (SELECT value_cents,date FROM holding_valuations WHERE holding_id=h.id ORDER BY date DESC,created_at DESC,id DESC LIMIT 1) v ON true WHERE h.workspace_id=$1 ORDER BY h.created_at DESC',
          [await authorize(req)],
        )
      ).rows,
      ['appliedCents', 'valueCents'],
    ),
  );
  app.post(
    '/workspaces/:wid/holdings',
    { schema: { params: ws, body: holdingSchema } },
    async (req, reply) => {
      const wid = await authorize(req, true),
        b = req.body,
        id = randomUUID();
      await atomic(async (c) => {
        await lock(c, wid);
        if (b.linkedAccountId)
          check(
            b.kind === 'investment' &&
              (
                await c.query(
                  "SELECT 1 FROM financial_accounts WHERE workspace_id=$1 AND id=$2 AND type='investment' AND archived_at IS NULL",
                  [wid, b.linkedAccountId],
                )
              ).rowCount,
            400,
            'Vincule somente uma conta de investimento ativa deste ambiente.',
          );
        await c.query(
          'INSERT INTO holdings(id,workspace_id,name,kind,subtype,quantity,applied_cents,linked_account_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            id,
            wid,
            b.name,
            b.kind,
            b.subtype,
            b.quantity,
            b.appliedCents,
            b.linkedAccountId || null,
          ],
        );
        await c.query(
          'INSERT INTO holding_valuations(id,workspace_id,holding_id,value_cents,date) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), wid, id, b.valueCents, b.date],
        );
        await audit(c, wid, req.userId, 'holding.create', id, null, b);
      });
      return reply.code(201).send({ id });
    },
  );
  app.post(
    '/workspaces/:wid/holdings/:id/valuations',
    { schema: { params: entity, body: valuationSchema } },
    async (req, reply) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        await lock(c, wid);
        check(
          (
            await c.query('SELECT 1 FROM holdings WHERE workspace_id=$1 AND id=$2', [
              wid,
              req.params.id,
            ])
          ).rowCount,
          404,
          'Bem ou investimento não encontrado.',
        );
        const id = randomUUID();
        await c.query(
          'INSERT INTO holding_valuations(id,workspace_id,holding_id,value_cents,date) VALUES($1,$2,$3,$4,$5)',
          [id, wid, req.params.id, req.body.valueCents, req.body.date],
        );
        await audit(c, wid, req.userId, 'holding.valuation', req.params.id, null, req.body);
      });
      return reply.code(201).send({ ok: true });
    },
  );
  app.get(
    '/workspaces/:wid/holdings/:id/valuations',
    { schema: { params: entity, querystring: pages } },
    async (req) => {
      const wid = await authorize(req);
      return atomic(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        check(
          (
            await c.query('SELECT 1 FROM holdings WHERE workspace_id=$1 AND id=$2', [
              wid,
              req.params.id,
            ])
          ).rowCount,
          404,
          'Bem ou investimento não encontrado.',
        );
        const total = integer(
          (
            await c.query(
              'SELECT count(*) FROM holding_valuations WHERE workspace_id=$1 AND holding_id=$2',
              [wid, req.params.id],
            )
          ).rows[0].count,
        );
        return {
          items: moneyRows(
            (
              await c.query(
                'SELECT id,date,created_at AS "createdAt",value_cents AS "valueCents" FROM holding_valuations WHERE workspace_id=$1 AND holding_id=$2 ORDER BY date DESC,created_at DESC,id DESC LIMIT 25 OFFSET $3',
                [wid, req.params.id, (req.query.page - 1) * 25],
              )
            ).rows,
            ['valueCents'],
          ),
          total,
          page: req.query.page,
        };
      });
    },
  );
  app.get('/workspaces/:wid/net-worth', { schema: { params: ws } }, async (req) => {
    const wid = await authorize(req);
    return atomic(async (c) => {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const cash = BigInt(
        (
          await c.query(
            'SELECT COALESCE(sum(e.amount_cents),0) AS total FROM transaction_entries e JOIN transactions t ON t.id=e.transaction_id WHERE e.workspace_id=$1 AND t.voided_at IS NULL AND NOT EXISTS(SELECT 1 FROM holdings h WHERE h.workspace_id=$1 AND h.linked_account_id=e.account_id)',
            [wid],
          )
        ).rows[0].total,
      );
      const holdings = BigInt(
        (
          await c.query(
            'SELECT COALESCE(sum(v.value_cents),0) AS total FROM holdings h JOIN LATERAL(SELECT value_cents FROM holding_valuations WHERE holding_id=h.id ORDER BY date DESC,created_at DESC,id DESC LIMIT 1) v ON true WHERE h.workspace_id=$1',
            [wid],
          )
        ).rows[0].total,
      );
      const debts = BigInt(
        (
          await c.query(
            'SELECT COALESCE(sum(principal_cents),0)-COALESCE((SELECT sum(principal_cents) FROM debt_payments WHERE workspace_id=$1 AND voided_at IS NULL),0) AS total FROM debts WHERE workspace_id=$1',
            [wid],
          )
        ).rows[0].total,
      );
      const cards = BigInt((await cardPosition(c, wid)).net);
      return {
        accountCents: integer(cash),
        holdingCents: integer(holdings),
        debtCents: integer(debts),
        cardNetCents: integer(cards),
        netWorthCents: integer(cash + holdings - debts - cards),
      };
    });
  });
}
