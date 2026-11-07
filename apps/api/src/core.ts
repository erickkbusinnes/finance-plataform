import { accountUpdateSchema, categoryUpdateSchema, dateOnly } from '@clara/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { authenticate } from './auth.js';
import { atomic, integer, pool } from './db.js';
import { check } from './errors.js';
import { audit, authorize, entity, lock, moneyRows, ws } from './ledger.js';
export async function validateParent(
  c: PoolClient,
  wid: string,
  id: string | null,
  parentId: string | null,
  kind: string,
) {
  if (!parentId) return;
  check(parentId !== id, 400, 'Uma categoria não pode ser sua própria mãe.');
  check(
    (
      await c.query(
        'SELECT 1 FROM categories WHERE workspace_id=$1 AND id=$2 AND kind=$3 AND parent_id IS NULL AND archived_at IS NULL',
        [wid, parentId, kind],
      )
    ).rowCount,
    400,
    'Escolha uma categoria principal ativa do mesmo tipo.',
  );
  if (id)
    check(
      !(await c.query('SELECT 1 FROM categories WHERE workspace_id=$1 AND parent_id=$2', [wid, id]))
        .rowCount,
      409,
      'Uma categoria com subcategorias não pode se tornar subcategoria.',
    );
}
export async function coreRoutes(base: FastifyInstance) {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);
  app.patch(
    '/workspaces/:wid/accounts/:id',
    { schema: { params: entity, body: accountUpdateSchema } },
    async (req) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        await lock(c, wid);
        const before = (
          await c.query(
            'SELECT * FROM financial_accounts WHERE workspace_id=$1 AND id=$2 FOR UPDATE',
            [wid, req.params.id],
          )
        ).rows[0];
        check(before, 404, 'Conta não encontrada.');
        check(
          before.version === req.body.version,
          409,
          'Conta alterada. Atualize antes de salvar.',
        );
        if (before.type !== req.body.type)
          check(
            !(
              await c.query(
                'SELECT 1 FROM holdings WHERE workspace_id=$1 AND linked_account_id=$2',
                [wid, req.params.id],
              )
            ).rowCount,
            409,
            'Conta vinculada a investimento não pode mudar de tipo.',
          );
        await c.query(
          'UPDATE financial_accounts SET name=$3,type=$4,archived_at=CASE WHEN $5 THEN COALESCE(archived_at,now()) ELSE NULL END,version=version+1 WHERE workspace_id=$1 AND id=$2',
          [wid, req.params.id, req.body.name, req.body.type, req.body.archived],
        );
        await audit(
          c,
          wid,
          req.userId,
          req.body.archived ? 'account.archive' : 'account.update',
          req.params.id,
          before,
          req.body,
        );
      });
      return { ok: true };
    },
  );
  app.patch(
    '/workspaces/:wid/categories/:id',
    { schema: { params: entity, body: categoryUpdateSchema } },
    async (req) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        await lock(c, wid);
        const before = (
          await c.query('SELECT * FROM categories WHERE workspace_id=$1 AND id=$2 FOR UPDATE', [
            wid,
            req.params.id,
          ])
        ).rows[0];
        check(before, 404, 'Categoria não encontrada.');
        check(
          before.version === req.body.version,
          409,
          'Categoria alterada. Atualize antes de salvar.',
        );
        if (before.kind !== req.body.kind)
          check(
            !(
              await c.query(
                'SELECT 1 FROM transactions WHERE workspace_id=$1 AND category_id=$2 UNION ALL SELECT 1 FROM budgets WHERE workspace_id=$1 AND category_id=$2 UNION ALL SELECT 1 FROM categories WHERE workspace_id=$1 AND parent_id=$2 UNION ALL SELECT 1 FROM card_purchases WHERE workspace_id=$1 AND category_id=$2',
                [wid, req.params.id],
              )
            ).rowCount,
            409,
            'O tipo de uma categoria em uso não pode ser alterado.',
          );
        await validateParent(c, wid, req.params.id, req.body.parentId || null, req.body.kind);
        if (req.body.archived)
          check(
            !(
              await c.query(
                'SELECT 1 FROM categories WHERE workspace_id=$1 AND parent_id=$2 AND archived_at IS NULL',
                [wid, req.params.id],
              )
            ).rowCount,
            409,
            'Arquive as subcategorias antes da categoria principal.',
          );
        await c.query(
          'UPDATE categories SET name=$3,kind=$4,color=$5,parent_id=$6,archived_at=CASE WHEN $7 THEN COALESCE(archived_at,now()) ELSE NULL END,version=version+1 WHERE workspace_id=$1 AND id=$2',
          [
            wid,
            req.params.id,
            req.body.name,
            req.body.kind,
            req.body.color,
            req.body.parentId || null,
            req.body.archived,
          ],
        );
        await audit(
          c,
          wid,
          req.userId,
          req.body.archived ? 'category.archive' : 'category.update',
          req.params.id,
          before,
          req.body,
        );
      });
      return { ok: true };
    },
  );
  app.get(
    '/workspaces/:wid/accounts/:id/statement',
    {
      schema: {
        params: entity,
        querystring: z
          .object({
            from: dateOnly,
            to: dateOnly,
            page: z.coerce.number().int().min(1).max(100000).default(1),
          })
          .refine((b) => b.from <= b.to, 'Período inválido'),
      },
    },
    async (req) => {
      const wid = await authorize(req),
        b = req.query;
      return atomic(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        check(
          (
            await c.query('SELECT 1 FROM financial_accounts WHERE workspace_id=$1 AND id=$2', [
              wid,
              req.params.id,
            ])
          ).rowCount,
          404,
          'Conta não encontrada.',
        );
        const opening = integer(
          (
            await c.query(
              'SELECT COALESCE(sum(e.amount_cents),0) AS total FROM transaction_entries e JOIN transactions t ON t.id=e.transaction_id WHERE e.workspace_id=$1 AND e.account_id=$2 AND t.voided_at IS NULL AND t.date<$3',
              [wid, req.params.id, b.from],
            )
          ).rows[0].total,
        );
        const aggregate = (
          await c.query(
            'SELECT count(*) AS count,COALESCE(sum(e.amount_cents),0) AS total FROM transaction_entries e JOIN transactions t ON t.id=e.transaction_id WHERE e.workspace_id=$1 AND e.account_id=$2 AND t.voided_at IS NULL AND t.date BETWEEN $3 AND $4',
            [wid, req.params.id, b.from, b.to],
          )
        ).rows[0];
        const rows = (
          await c.query(
            `SELECT t.id,t.description,t.kind,t.date,e.amount_cents AS "amountCents",$5::bigint+sum(e.amount_cents) OVER(ORDER BY t.date,t.created_at,t.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "balanceCents" FROM transaction_entries e JOIN transactions t ON t.id=e.transaction_id WHERE e.workspace_id=$1 AND e.account_id=$2 AND t.voided_at IS NULL AND t.date BETWEEN $3 AND $4 ORDER BY t.date,t.created_at,t.id LIMIT 25 OFFSET $6`,
            [wid, req.params.id, b.from, b.to, opening, (b.page - 1) * 25],
          )
        ).rows;
        return {
          openingCents: opening,
          closingCents: integer(BigInt(opening) + BigInt(aggregate.total)),
          total: integer(aggregate.count),
          page: b.page,
          items: moneyRows(rows, ['amountCents', 'balanceCents']),
        };
      });
    },
  );
  app.get(
    '/workspaces/:wid/goals/:id/contributions',
    {
      schema: {
        params: entity,
        querystring: z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }),
      },
    },
    async (req) => {
      const wid = await authorize(req);
      return atomic(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
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
        const total = integer(
          (
            await c.query(
              'SELECT count(*) FROM goal_contributions WHERE workspace_id=$1 AND goal_id=$2',
              [wid, req.params.id],
            )
          ).rows[0].count,
        );
        const rows = (
          await c.query(
            'SELECT id,created_at AS "createdAt",amount_cents AS "amountCents",sum(amount_cents) OVER(ORDER BY created_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "accumulatedCents" FROM goal_contributions WHERE workspace_id=$1 AND goal_id=$2 ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $3',
            [wid, req.params.id, (req.query.page - 1) * 25],
          )
        ).rows;
        return {
          items: moneyRows(rows, ['amountCents', 'accumulatedCents']),
          total,
          page: req.query.page,
        };
      });
    },
  );
  app.get('/workspaces/:wid/tags', { schema: { params: ws } }, async (req) =>
    (
      await pool.query(
        'SELECT DISTINCT unnest(tags) AS name FROM transactions WHERE workspace_id=$1 AND voided_at IS NULL ORDER BY name',
        [await authorize(req)],
      )
    ).rows.map((r) => r.name),
  );
}
