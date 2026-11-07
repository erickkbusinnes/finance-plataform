import {
  accountSchema,
  budgetSchema,
  categorySchema,
  cents,
  dateOnly,
  goalSchema,
  transactionFilters,
  transactionSchema,
  workspaceSchema,
} from '@clara/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authenticate } from './auth.js';
import { validateParent } from './core.js';
import { atomic, integer, pool } from './db.js';
import { check } from './errors.js';
import {
  audit,
  authorize,
  entity,
  entries,
  lock,
  moneyRows,
  protectManaged,
  validateReferences,
  ws,
} from './ledger.js';
import { transactionOrder, transactionSelect, transactionWhere as where } from './queries.js';
const period = z
  .object({ from: dateOnly, to: dateOnly })
  .refine((v) => v.from <= v.to, 'Período inválido');
export async function financeRoutes(base: FastifyInstance) {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);
  app.get(
    '/workspaces',
    async (req) =>
      (
        await pool.query(
          'SELECT w.id,w.name,w.kind,m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY w.created_at',
          [req.userId],
        )
      ).rows,
  );
  app.post('/workspaces', { schema: { body: workspaceSchema } }, async (req, reply) => {
    const id = randomUUID();
    await atomic(async (c) => {
      await c.query('INSERT INTO workspaces(id,name,kind) VALUES($1,$2,$3)', [
        id,
        req.body.name,
        req.body.kind,
      ]);
      await c.query(
        "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",
        [id, req.userId],
      );
      await audit(c, id, req.userId, 'workspace.create', id, null, req.body);
    });
    return reply.code(201).send({ id, ...req.body, role: 'owner' });
  });
  app.get('/workspaces/:wid/accounts', { schema: { params: ws } }, async (req) => {
    const wid = await authorize(req);
    return moneyRows(
      (
        await pool.query(
          `SELECT a.id,a.name,a.type,a.version,a.archived_at AS "archivedAt",COALESCE(sum(e.amount_cents) FILTER(WHERE t.voided_at IS NULL),0) AS "balanceCents" FROM financial_accounts a LEFT JOIN transaction_entries e ON e.account_id=a.id LEFT JOIN transactions t ON t.id=e.transaction_id WHERE a.workspace_id=$1 GROUP BY a.id ORDER BY a.created_at`,
          [wid],
        )
      ).rows,
      ['balanceCents'],
    );
  });
  app.post(
    '/workspaces/:wid/accounts',
    { schema: { params: ws, body: accountSchema } },
    async (req, reply) => {
      const wid = await authorize(req, true);
      const id = randomUUID();
      await atomic(async (c) => {
        await lock(c, wid);
        await c.query(
          'INSERT INTO financial_accounts(id,workspace_id,name,type) VALUES($1,$2,$3,$4)',
          [id, wid, req.body.name, req.body.type],
        );
        if (req.body.openingCents !== 0) {
          const tid = randomUUID();
          await c.query(
            "INSERT INTO transactions(id,workspace_id,description,kind,amount_cents,date,account_id,idempotency_key) VALUES($1,$2,'Saldo inicial','opening',$3,$4,$5,$6)",
            [tid, wid, Math.abs(req.body.openingCents), req.body.date, id, randomUUID()],
          );
          await c.query(
            'INSERT INTO transaction_entries(id,workspace_id,transaction_id,account_id,amount_cents) VALUES($1,$2,$3,$4,$5)',
            [randomUUID(), wid, tid, id, req.body.openingCents],
          );
        }
        await audit(c, wid, req.userId, 'account.create', id, null, req.body);
      });
      return reply.code(201).send({ id });
    },
  );
  app.get(
    '/workspaces/:wid/categories',
    { schema: { params: ws } },
    async (req) =>
      (
        await pool.query(
          'SELECT id,name,kind,color,version,parent_id AS "parentId",archived_at AS "archivedAt" FROM categories WHERE workspace_id=$1 ORDER BY name',
          [await authorize(req)],
        )
      ).rows,
  );
  app.post(
    '/workspaces/:wid/categories',
    { schema: { params: ws, body: categorySchema } },
    async (req, reply) => {
      const wid = await authorize(req, true),
        id = randomUUID();
      await atomic(async (c) => {
        await lock(c, wid);
        await validateParent(c, wid, id, req.body.parentId || null, req.body.kind);
        await c.query(
          'INSERT INTO categories(id,workspace_id,name,kind,color,parent_id) VALUES($1,$2,$3,$4,$5,$6)',
          [id, wid, req.body.name, req.body.kind, req.body.color, req.body.parentId || null],
        );
        await audit(c, wid, req.userId, 'category.create', id, null, req.body);
      });
      return reply.code(201).send({ id });
    },
  );
  const filters = transactionFilters;
  app.get(
    '/workspaces/:wid/transactions',
    { schema: { params: ws, querystring: filters } },
    async (req) => {
      const w = where(await authorize(req), req.query);
      const rows = (
        await pool.query(
          `${transactionSelect} WHERE ${w.sql} ORDER BY ${transactionOrder[req.query.sort]} LIMIT 25 OFFSET $11`,
          [...w.values, (req.query.page - 1) * 25],
        )
      ).rows;
      const total = integer(
        (await pool.query(`SELECT count(*) FROM transactions t WHERE ${w.sql}`, w.values)).rows[0]
          .count,
      );
      return { items: moneyRows(rows, ['amountCents']), total, page: req.query.page };
    },
  );
  app.get(
    '/workspaces/:wid/export.csv',
    { schema: { params: ws, querystring: filters } },
    async (req, reply) => {
      const w = where(await authorize(req), req.query);
      const rows = (
        await pool.query(
          `${transactionSelect} WHERE ${w.sql} ORDER BY ${transactionOrder[req.query.sort]} LIMIT 10001`,
          w.values,
        )
      ).rows;
      check(rows.length <= 10000, 400, 'Limite de 10.000 linhas. Reduza o período.');
      const escape = (v: unknown) =>
        '"' +
        String(v ?? '')
          .replace(/^[=+\-@\t\r]/, "'$&")
          .replace(/"/g, '""') +
        '"';
      const csv = [
        'Data;Descrição;Tipo;Valor em centavos;Conta;Destino;Categoria;Tags;Observações;Reembolso de;Origem do registro',
        ...rows.map((r) =>
          [
            r.date,
            r.description,
            r.kind,
            r.amountCents,
            r.accountName,
            r.destinationName,
            r.categoryName,
            r.tags.join(', '),
            r.notes,
            r.refundOf,
            r.sourceType,
          ]
            .map(escape)
            .join(';'),
        ),
      ].join('\r\n');
      return reply
        .type('text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="clara-movimentacoes.csv"')
        .send('\uFEFF' + csv);
    },
  );
  app.post(
    '/workspaces/:wid/transactions',
    {
      schema: {
        params: ws,
        body: transactionSchema,
        headers: z.object({ 'idempotency-key': z.uuid() }),
      },
    },
    async (req, reply) => {
      const wid = await authorize(req, true);
      const result = await atomic(async (c) => {
        await lock(c, wid);
        const prior = (
          await c.query('SELECT * FROM transactions WHERE workspace_id=$1 AND idempotency_key=$2', [
            wid,
            req.headers['idempotency-key'],
          ])
        ).rows[0];
        if (prior) {
          const b = req.body;
          check(
            prior.description === b.description &&
              prior.kind === b.kind &&
              integer(prior.amount_cents) === b.amountCents &&
              prior.date === b.date &&
              prior.account_id === b.accountId &&
              (prior.destination_account_id ?? null) === (b.destinationAccountId ?? null) &&
              (prior.category_id ?? null) === (b.categoryId ?? null) &&
              prior.notes === b.notes &&
              JSON.stringify(prior.tags) === JSON.stringify(b.tags) &&
              (prior.refund_of || null) === (b.refundOf || null),
            409,
            'Chave já usada com outros dados.',
          );
          return { id: prior.id, replayed: true };
        }
        await validateReferences(c, wid, req.body);
        const id = randomUUID(),
          b = req.body;
        await c.query(
          'INSERT INTO transactions(id,workspace_id,description,kind,amount_cents,date,account_id,destination_account_id,category_id,notes,idempotency_key,tags,refund_of) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
          [
            id,
            wid,
            b.description,
            b.kind,
            b.amountCents,
            b.date,
            b.accountId,
            b.destinationAccountId || null,
            b.categoryId || null,
            b.notes,
            req.headers['idempotency-key'],
            b.tags,
            b.refundOf || null,
          ],
        );
        await entries(c, wid, id, b);
        await audit(c, wid, req.userId, 'transaction.create', id, null, b);
        return { id, replayed: false };
      });
      return reply.code(result.replayed ? 200 : 201).send(result);
    },
  );
  app.put(
    '/workspaces/:wid/transactions/:id',
    {
      schema: {
        params: entity,
        body: transactionSchema.safeExtend({ version: z.number().int().positive() }),
      },
    },
    async (req) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        await lock(c, wid);
        const before = (
          await c.query(
            "SELECT * FROM transactions WHERE workspace_id=$1 AND id=$2 AND voided_at IS NULL AND kind<>'opening' FOR UPDATE",
            [wid, req.params.id],
          )
        ).rows[0];
        check(before, 404, 'Movimentação não encontrada.');
        check(
          before.version === req.body.version,
          409,
          'Esta movimentação foi alterada. Atualize e tente novamente.',
        );
        await protectManaged(c, wid, before);
        await validateReferences(c, wid, req.body, before);
        const b = req.body;
        await c.query(
          'UPDATE transactions SET description=$3,kind=$4,amount_cents=$5,date=$6,account_id=$7,destination_account_id=$8,category_id=$9,notes=$10,tags=$11,refund_of=$12,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2',
          [
            wid,
            req.params.id,
            b.description,
            b.kind,
            b.amountCents,
            b.date,
            b.accountId,
            b.destinationAccountId || null,
            b.categoryId || null,
            b.notes,
            b.tags,
            b.refundOf || null,
          ],
        );
        await c.query('DELETE FROM transaction_entries WHERE transaction_id=$1', [req.params.id]);
        await entries(c, wid, req.params.id, b);
        await audit(c, wid, req.userId, 'transaction.update', req.params.id, before, b);
      });
      return { ok: true };
    },
  );
  app.delete(
    '/workspaces/:wid/transactions/:id',
    { schema: { params: entity, body: z.object({ version: z.number().int().positive() }) } },
    async (req) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        await lock(c, wid);
        const before = (
          await c.query(
            "SELECT * FROM transactions WHERE workspace_id=$1 AND id=$2 AND voided_at IS NULL AND kind<>'opening' FOR UPDATE",
            [wid, req.params.id],
          )
        ).rows[0];
        check(before, 404, 'Movimentação não encontrada.');
        check(
          before.version === req.body.version,
          409,
          'Registro alterado. Atualize antes de cancelar.',
        );
        await protectManaged(c, wid, before);
        await c.query(
          'UPDATE transactions SET voided_at=now(),updated_at=now(),version=version+1 WHERE id=$1',
          [req.params.id],
        );
        await audit(c, wid, req.userId, 'transaction.void', req.params.id, before, null);
      });
      return { ok: true };
    },
  );
  app.get(
    '/workspaces/:wid/transactions/:id/history',
    { schema: { params: entity } },
    async (req) => {
      const wid = await authorize(req);
      return (
        await pool.query(
          'SELECT action,created_at AS "createdAt",before_data AS before,after_data AS after FROM audit_logs WHERE workspace_id=$1 AND entity_id=$2 ORDER BY created_at DESC',
          [wid, req.params.id],
        )
      ).rows;
    },
  );
  app.get(
    '/workspaces/:wid/summary',
    { schema: { params: ws, querystring: period } },
    async (req) => {
      const wid = await authorize(req),
        b = req.query;
      // Repeatable-read prevents mixed snapshots while concurrent writes occur.
      return atomic(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const totals = (
          await c.query(
            `SELECT COALESCE(sum(amount_cents) FILTER(WHERE kind='income'),0) AS income,COALESCE(sum(amount_cents) FILTER(WHERE kind='expense'),0)-COALESCE(sum(amount_cents) FILTER(WHERE kind='refund'),0) AS expense,COALESCE(sum(amount_cents) FILTER(WHERE kind='expense'),0) AS gross,COALESCE(sum(amount_cents) FILTER(WHERE kind='refund'),0) AS refunds FROM transactions WHERE workspace_id=$1 AND voided_at IS NULL AND date BETWEEN $2 AND $3`,
            [wid, b.from, b.to],
          )
        ).rows[0];
        const balance = integer(
          (
            await c.query(
              'SELECT COALESCE(sum(e.amount_cents),0) AS balance FROM transaction_entries e JOIN transactions t ON t.id=e.transaction_id WHERE e.workspace_id=$1 AND t.voided_at IS NULL',
              [wid],
            )
          ).rows[0].balance,
        );
        const monthly = moneyRows(
          (
            await c.query(
              `SELECT to_char(date,'YYYY-MM') AS month,COALESCE(sum(amount_cents) FILTER(WHERE kind='income'),0) AS "incomeCents",COALESCE(sum(amount_cents) FILTER(WHERE kind='expense'),0)-COALESCE(sum(amount_cents) FILTER(WHERE kind='refund'),0) AS "expenseCents" FROM transactions WHERE workspace_id=$1 AND voided_at IS NULL AND kind IN ('income','expense','refund') AND date BETWEEN $2 AND $3 GROUP BY 1 ORDER BY 1`,
              [wid, b.from, b.to],
            )
          ).rows,
          ['incomeCents', 'expenseCents'],
        );
        const categories = moneyRows(
          (
            await c.query(
              `SELECT COALESCE(c.name,'Sem categoria') AS name,COALESCE(c.color,'#94a3b8') AS color,sum(t.amount_cents) AS "amountCents" FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE t.workspace_id=$1 AND t.voided_at IS NULL AND t.kind='expense' AND t.date BETWEEN $2 AND $3 GROUP BY c.id ORDER BY 3 DESC`,
              [wid, b.from, b.to],
            )
          ).rows,
          ['amountCents'],
        );
        const fromDate = new Date(b.from + 'T12:00:00Z'),
          toDate = new Date(b.to + 'T12:00:00Z');
        const lastDay = new Date(
          Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 0),
        ).getUTCDate();
        const days = Math.round((+toDate - +fromDate) / 86400000) + 1;
        const previousTo = new Date(+fromDate - 86400000);
        const previousFrom =
          fromDate.getUTCDate() === 1 &&
          toDate.getUTCDate() === lastDay &&
          b.from.slice(0, 7) === b.to.slice(0, 7)
            ? new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() - 1, 1, 12))
            : new Date(+fromDate - days * 86400000);
        const pf = previousFrom.toISOString().slice(0, 10),
          pt = previousTo.toISOString().slice(0, 10);
        const old = (
          await c.query(
            "SELECT COALESCE(sum(amount_cents) FILTER(WHERE kind='income'),0) AS income,COALESCE(sum(amount_cents) FILTER(WHERE kind='expense'),0)-COALESCE(sum(amount_cents) FILTER(WHERE kind='refund'),0) AS expense FROM transactions WHERE workspace_id=$1 AND voided_at IS NULL AND date BETWEEN $2 AND $3",
            [wid, pf, pt],
          )
        ).rows[0];
        return {
          balanceCents: balance,
          grossExpenseCents: integer(totals.gross),
          refundCents: integer(totals.refunds),
          previous: {
            from: pf,
            to: pt,
            incomeCents: integer(old.income),
            expenseCents: integer(old.expense),
            resultCents: integer(BigInt(old.income) - BigInt(old.expense)),
          },
          incomeCents: integer(totals.income),
          expenseCents: integer(totals.expense),
          resultCents: integer(BigInt(totals.income) - BigInt(totals.expense)),
          change: {
            incomeCents: integer(BigInt(totals.income) - BigInt(old.income)),
            expenseCents: integer(BigInt(totals.expense) - BigInt(old.expense)),
            resultCents: integer(
              BigInt(totals.income) -
                BigInt(totals.expense) -
                BigInt(old.income) +
                BigInt(old.expense),
            ),
          },
          monthly,
          categories,
        };
      });
    },
  );
  app.get(
    '/workspaces/:wid/budgets',
    { schema: { params: ws, querystring: z.object({ month: budgetSchema.shape.month }) } },
    async (req) => {
      const wid = await authorize(req);
      return moneyRows(
        (
          await pool.query(
            `SELECT b.id,b.category_id AS "categoryId",c.name AS "categoryName",to_char(b.month,'YYYY-MM') AS month,b.limit_cents AS "limitCents",COALESCE((SELECT sum(CASE WHEN t.kind='refund' THEN -t.amount_cents ELSE t.amount_cents END) FROM transactions t WHERE t.workspace_id=b.workspace_id AND (t.category_id=b.category_id OR t.category_id IN (SELECT id FROM categories WHERE workspace_id=b.workspace_id AND parent_id=b.category_id)) AND t.kind IN ('expense','refund') AND t.voided_at IS NULL AND t.date>=b.month AND t.date<b.month+interval '1 month'),0) AS "spentCents" FROM budgets b JOIN categories c ON c.id=b.category_id WHERE b.workspace_id=$1 AND b.month=$2 ORDER BY c.name`,
            [wid, req.query.month + '-01'],
          )
        ).rows,
        ['limitCents', 'spentCents'],
      );
    },
  );
  app.post(
    '/workspaces/:wid/budgets',
    { schema: { params: ws, body: budgetSchema } },
    async (req, reply) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        check(
          (
            await c.query(
              "SELECT 1 FROM categories WHERE workspace_id=$1 AND id=$2 AND kind='expense' AND archived_at IS NULL",
              [wid, req.body.categoryId],
            )
          ).rowCount,
          400,
          'Escolha uma categoria de despesa deste ambiente.',
        );
        const id = randomUUID();
        await c.query(
          'INSERT INTO budgets(id,workspace_id,category_id,month,limit_cents) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,category_id,month) DO UPDATE SET limit_cents=EXCLUDED.limit_cents',
          [id, wid, req.body.categoryId, req.body.month + '-01', req.body.limitCents],
        );
        await audit(c, wid, req.userId, 'budget.save', id, null, req.body);
      });
      return reply.code(201).send({ ok: true });
    },
  );
  app.get('/workspaces/:wid/goals', { schema: { params: ws } }, async (req) =>
    moneyRows(
      (
        await pool.query(
          `SELECT g.id,g.name,g.target_cents AS "targetCents",g.due_date AS "dueDate",COALESCE(sum(c.amount_cents),0) AS "contributedCents" FROM goals g LEFT JOIN goal_contributions c ON c.goal_id=g.id WHERE g.workspace_id=$1 GROUP BY g.id ORDER BY g.created_at`,
          [await authorize(req)],
        )
      ).rows,
      ['targetCents', 'contributedCents'],
    ),
  );
  app.post(
    '/workspaces/:wid/goals',
    { schema: { params: ws, body: goalSchema } },
    async (req, reply) => {
      const wid = await authorize(req, true),
        id = randomUUID();
      await atomic(async (c) => {
        await c.query(
          'INSERT INTO goals(id,workspace_id,name,target_cents,due_date) VALUES($1,$2,$3,$4,$5)',
          [id, wid, req.body.name, req.body.targetCents, req.body.dueDate || null],
        );
        await audit(c, wid, req.userId, 'goal.create', id, null, req.body);
      });
      return reply.code(201).send({ id });
    },
  );
  app.post(
    '/workspaces/:wid/goals/:id/contributions',
    {
      schema: {
        params: entity,
        body: z.object({ amountCents: cents }),
        headers: z.object({ 'idempotency-key': z.uuid() }),
      },
    },
    async (req, reply) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        await lock(c, wid);
        check(
          (
            await c.query('SELECT 1 FROM goals WHERE workspace_id=$1 AND id=$2', [
              wid,
              req.params.id,
            ])
          ).rowCount,
          404,
          'Meta não encontrada.',
        );
        const prior = (
          await c.query(
            'SELECT * FROM goal_contributions WHERE workspace_id=$1 AND idempotency_key=$2',
            [wid, req.headers['idempotency-key']],
          )
        ).rows[0];
        if (prior) {
          check(
            prior.goal_id === req.params.id && integer(prior.amount_cents) === req.body.amountCents,
            409,
            'Chave já utilizada com outros dados.',
          );
          return;
        }
        const id = randomUUID();
        await c.query(
          'INSERT INTO goal_contributions(id,workspace_id,goal_id,amount_cents,idempotency_key) VALUES($1,$2,$3,$4,$5)',
          [id, wid, req.params.id, req.body.amountCents, req.headers['idempotency-key']],
        );
        await audit(c, wid, req.userId, 'goal.contribute', req.params.id, null, req.body);
      });
      return reply.code(201).send({ ok: true });
    },
  );
}
