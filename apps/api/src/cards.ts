import {
  cardRefundSchema,
  cardSchema,
  purchaseSchema,
  settlementSchema,
  splitInstallments,
  statementDates,
} from '@clara/shared/planning';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { authenticate } from './auth.js';
import { atomic, integer } from './db.js';
import { check } from './errors.js';
import { audit, authorize, entity, lock, managedExpense, moneyRows, ws } from './ledger.js';
const keyed = z.object({ 'idempotency-key': z.uuid() });
const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) });
const cardParams = entity.extend({ sid: z.uuid() }),
  purchaseParams = entity.extend({ pid: z.uuid() });
export const statementTotal = `COALESCE((SELECT sum(i.amount_cents) FROM card_installments i WHERE i.statement_id=s.id),0)-COALESCE((SELECT sum(r.amount_cents) FROM card_refunds r WHERE r.statement_id=s.id),0)`;
async function getCard(c: PoolClient, wid: string, id: string) {
  const row = (
    await c.query('SELECT * FROM credit_cards WHERE workspace_id=$1 AND id=$2', [wid, id])
  ).rows[0];
  check(row, 404, 'Cartão não encontrado.');
  return row;
}
export async function cardPosition(c: PoolClient, wid: string, id?: string) {
  const { rows } = await c.query(
    `SELECT COALESCE((SELECT sum(i.amount_cents) FROM card_installments i JOIN card_statements s ON s.id=i.statement_id WHERE s.workspace_id=$1 AND ($2::uuid IS NULL OR s.card_id=$2) AND s.settled_at IS NULL),0)-COALESCE((SELECT sum(r.amount_cents) FROM card_refunds r JOIN card_statements s ON s.id=r.statement_id WHERE s.workspace_id=$1 AND ($2::uuid IS NULL OR s.card_id=$2) AND s.settled_at IS NULL),0)-COALESCE((SELECT sum(amount_cents) FROM card_credit_entries WHERE workspace_id=$1 AND ($2::uuid IS NULL OR card_id=$2)),0) AS net,COALESCE((SELECT sum(amount_cents) FROM card_credit_entries WHERE workspace_id=$1 AND ($2::uuid IS NULL OR card_id=$2)),0) AS credit`,
    [wid, id || null],
  );
  return { net: integer(rows[0].net), credit: integer(rows[0].credit) };
}
async function ensureStatement(
  c: PoolClient,
  wid: string,
  cardId: string,
  dates: { closingDate: string; dueDate: string },
) {
  check(
    dates.dueDate.length === 10,
    400,
    'Parcelamento ultrapassa o intervalo de datas suportado.',
  );
  return (
    await c.query(
      'INSERT INTO card_statements(id,workspace_id,card_id,due_date,closing_date) VALUES($1,$2,$3,$4,$5) ON CONFLICT(card_id,due_date) DO UPDATE SET card_id=EXCLUDED.card_id RETURNING *',
      [randomUUID(), wid, cardId, dates.dueDate, dates.closingDate],
    )
  ).rows[0];
}
export async function cardRoutes(base: FastifyInstance) {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);
  app.get('/workspaces/:wid/cards', { schema: { params: ws } }, async (req) => {
    const wid = await authorize(req);
    return atomic(async (c) => {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const rows = (
        await c.query(
          'SELECT id,name,limit_cents AS "limitCents",closing_day AS "closingDay",due_day AS "dueDay",version,archived_at AS "archivedAt" FROM credit_cards WHERE workspace_id=$1 ORDER BY created_at',
          [wid],
        )
      ).rows;
      for (const row of rows) {
        const pos = await cardPosition(c, wid, row.id);
        row.limitCents = integer(row.limitCents);
        row.usedCents = Math.max(0, pos.net);
        row.creditCents = pos.credit;
        row.availableCents = Math.max(0, integer(BigInt(row.limitCents) - BigInt(pos.net)));
      }
      return rows;
    });
  });
  app.post(
    '/workspaces/:wid/cards',
    { schema: { params: ws, body: cardSchema } },
    async (req, reply) => {
      const wid = await authorize(req, true),
        id = randomUUID(),
        b = req.body;
      await atomic(async (c) => {
        await c.query(
          'INSERT INTO credit_cards(id,workspace_id,name,limit_cents,closing_day,due_day) VALUES($1,$2,$3,$4,$5,$6)',
          [id, wid, b.name, b.limitCents, b.closingDay, b.dueDay],
        );
        await audit(c, wid, req.userId, 'card.create', id, null, b);
      });
      return reply.code(201).send({ id });
    },
  );
  app.patch(
    '/workspaces/:wid/cards/:id',
    {
      schema: {
        params: entity,
        body: cardSchema.extend({ version: z.number().int().positive(), archived: z.boolean() }),
      },
    },
    async (req) => {
      const wid = await authorize(req, true),
        b = req.body;
      await atomic(async (c) => {
        await lock(c, wid);
        const card = await getCard(c, wid, req.params.id);
        check(card.version === b.version, 409, 'Cartão alterado. Atualize antes de salvar.');
        if (card.closing_day !== b.closingDay || card.due_day !== b.dueDay)
          check(
            !(
              await c.query('SELECT 1 FROM card_purchases WHERE workspace_id=$1 AND card_id=$2', [
                wid,
                card.id,
              ])
            ).rowCount,
            409,
            'Dias do ciclo não podem mudar após compras; cadastre outro cartão para um novo ciclo.',
          );
        check(
          b.limitCents >= Math.max(0, (await cardPosition(c, wid, card.id)).net),
          409,
          'Limite inferior ao valor comprometido.',
        );
        await c.query(
          'UPDATE credit_cards SET name=$3,limit_cents=$4,closing_day=$5,due_day=$6,archived_at=CASE WHEN $7 THEN COALESCE(archived_at,now()) ELSE NULL END,version=version+1 WHERE workspace_id=$1 AND id=$2',
          [wid, card.id, b.name, b.limitCents, b.closingDay, b.dueDay, b.archived],
        );
        await audit(c, wid, req.userId, 'card.update', card.id, card, b);
      });
      return { ok: true };
    },
  );
  app.get('/workspaces/:wid/cards/:id/statements', { schema: { params: entity } }, async (req) => {
    const wid = await authorize(req);
    return atomic(async (c) => {
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await getCard(c, wid, req.params.id);
      return moneyRows(
        (
          await c.query(
            `SELECT s.id,s.due_date AS "dueDate",s.closing_date AS "closingDate",s.settled_at AS "settledAt",s.settlement_date AS "settlementDate",s.paid_cents AS "paidCents",${statementTotal} AS "totalCents" FROM card_statements s WHERE s.workspace_id=$1 AND s.card_id=$2 ORDER BY s.due_date`,
            [wid, req.params.id],
          )
        ).rows,
        ['paidCents', 'totalCents'],
      );
    });
  });
  app.get(
    '/workspaces/:wid/cards/:id/purchases',
    { schema: { params: entity, querystring: pageQuery } },
    async (req) => {
      const wid = await authorize(req);
      return atomic(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await getCard(c, wid, req.params.id);
        const total = integer(
          (
            await c.query(
              'SELECT count(*) FROM card_purchases WHERE workspace_id=$1 AND card_id=$2',
              [wid, req.params.id],
            )
          ).rows[0].count,
        );
        const rows = (
          await c.query(
            'SELECT p.id,p.description,p.amount_cents AS "amountCents",p.date,p.installments,c.name AS "categoryName",COALESCE((SELECT sum(r.amount_cents) FROM card_refunds r WHERE r.purchase_id=p.id),0) AS "refundedCents" FROM card_purchases p LEFT JOIN categories c ON c.id=p.category_id WHERE p.workspace_id=$1 AND p.card_id=$2 ORDER BY p.date DESC,p.created_at DESC,p.id DESC LIMIT 25 OFFSET $3',
            [wid, req.params.id, (req.query.page - 1) * 25],
          )
        ).rows;
        return {
          items: moneyRows(rows, ['amountCents', 'refundedCents']),
          total,
          page: req.query.page,
        };
      });
    },
  );
  app.post(
    '/workspaces/:wid/cards/:id/purchases',
    { schema: { params: entity, body: purchaseSchema, headers: keyed } },
    async (req, reply) => {
      const wid = await authorize(req, true),
        b = req.body;
      const result = await atomic(async (c) => {
        await lock(c, wid);
        const card = await getCard(c, wid, req.params.id);
        const old = (
          await c.query(
            'SELECT * FROM card_purchases WHERE workspace_id=$1 AND idempotency_key=$2',
            [wid, req.headers['idempotency-key']],
          )
        ).rows[0];
        if (old) {
          check(
            old.card_id === card.id &&
              old.description === b.description &&
              integer(old.amount_cents) === b.amountCents &&
              old.date === b.date &&
              old.installments === b.installments &&
              (old.category_id || null) === (b.categoryId || null),
            409,
            'Chave já utilizada com outra compra.',
          );
          return { id: old.id, replayed: true };
        }
        check(!card.archived_at, 409, 'Cartão arquivado.');
        if (b.categoryId)
          check(
            (
              await c.query(
                "SELECT 1 FROM categories WHERE workspace_id=$1 AND id=$2 AND kind='expense' AND archived_at IS NULL",
                [wid, b.categoryId],
              )
            ).rowCount,
            400,
            'Categoria de despesa inválida.',
          );
        const position = await cardPosition(c, wid, card.id);
        check(
          BigInt(position.net) + BigInt(b.amountCents) <= BigInt(card.limit_cents),
          409,
          'Compra ultrapassa o limite disponível.',
        );
        const id = randomUUID();
        await c.query(
          'INSERT INTO card_purchases(id,workspace_id,card_id,description,amount_cents,date,installments,category_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            id,
            wid,
            card.id,
            b.description,
            b.amountCents,
            b.date,
            b.installments,
            b.categoryId || null,
            req.headers['idempotency-key'],
          ],
        );
        for (const [index, amount] of splitInstallments(b.amountCents, b.installments).entries()) {
          const dates = statementDates(b.date, card.closing_day, card.due_day, index);
          check(
            !(
              await c.query(
                'SELECT 1 FROM card_statements WHERE workspace_id=$1 AND card_id=$2 AND settled_at IS NOT NULL AND due_date>=$3',
                [wid, card.id, dates.dueDate],
              )
            ).rowCount,
            409,
            'Compra retroativa anterior a uma fatura já liquidada.',
          );
          const statement = await ensureStatement(c, wid, card.id, dates);
          check(!statement.settled_at, 409, 'Compra retroativa afetaria fatura já liquidada.');
          await c.query(
            'INSERT INTO card_installments(id,workspace_id,purchase_id,statement_id,number,amount_cents) VALUES($1,$2,$3,$4,$5,$6)',
            [randomUUID(), wid, id, statement.id, index + 1, amount],
          );
        }
        await audit(c, wid, req.userId, 'card.purchase', id, null, b);
        return { id, replayed: false };
      });
      return reply.code(result.replayed ? 200 : 201).send(result);
    },
  );
  app.get(
    '/workspaces/:wid/cards/:id/statements/:sid',
    { schema: { params: cardParams } },
    async (req) => {
      const wid = await authorize(req);
      return atomic(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        check(
          (
            await c.query(
              'SELECT 1 FROM card_statements WHERE workspace_id=$1 AND card_id=$2 AND id=$3',
              [wid, req.params.id, req.params.sid],
            )
          ).rowCount,
          404,
          'Fatura não encontrada.',
        );
        const installments = moneyRows(
          (
            await c.query(
              'SELECT i.id,p.id AS "purchaseId",p.description,p.date AS "purchaseDate",i.number,p.installments,i.amount_cents AS "amountCents",c.name AS "categoryName" FROM card_installments i JOIN card_purchases p ON p.id=i.purchase_id LEFT JOIN categories c ON c.id=p.category_id WHERE i.workspace_id=$1 AND i.statement_id=$2 ORDER BY p.date,p.id,i.number',
              [wid, req.params.sid],
            )
          ).rows,
          ['amountCents'],
        );
        const refunds = moneyRows(
          (
            await c.query(
              'SELECT id,purchase_id AS "purchaseId",amount_cents AS "amountCents",date,reason FROM card_refunds WHERE workspace_id=$1 AND statement_id=$2 ORDER BY date,created_at',
              [wid, req.params.sid],
            )
          ).rows,
          ['amountCents'],
        );
        return { installments, refunds };
      });
    },
  );
  app.post(
    '/workspaces/:wid/cards/:id/purchases/:pid/refunds',
    { schema: { params: purchaseParams, body: cardRefundSchema, headers: keyed } },
    async (req, reply) => {
      const wid = await authorize(req, true),
        b = req.body;
      const result = await atomic(async (c) => {
        await lock(c, wid);
        const card = await getCard(c, wid, req.params.id);
        const p = (
          await c.query(
            'SELECT * FROM card_purchases WHERE workspace_id=$1 AND card_id=$2 AND id=$3',
            [wid, card.id, req.params.pid],
          )
        ).rows[0];
        check(p, 404, 'Compra não encontrada.');
        const prior = (
          await c.query('SELECT * FROM card_refunds WHERE workspace_id=$1 AND idempotency_key=$2', [
            wid,
            req.headers['idempotency-key'],
          ])
        ).rows[0];
        if (prior) {
          check(
            prior.purchase_id === p.id &&
              integer(prior.amount_cents) === b.amountCents &&
              prior.date === b.date &&
              prior.reason === b.reason,
            409,
            'Chave já utilizada com outro estorno.',
          );
          return { id: prior.id, replayed: true };
        }
        check(b.date >= p.date, 400, 'Estorno anterior à compra.');
        const used = BigInt(
          (
            await c.query(
              'SELECT COALESCE(sum(amount_cents),0) AS total FROM card_refunds WHERE workspace_id=$1 AND purchase_id=$2',
              [wid, p.id],
            )
          ).rows[0].total,
        );
        check(
          used + BigInt(b.amountCents) <= BigInt(p.amount_cents),
          409,
          'Estornos excedem o valor da compra.',
        );
        const lastSettled = (
          await c.query(
            'SELECT max(due_date) AS date FROM card_statements WHERE workspace_id=$1 AND card_id=$2 AND settled_at IS NOT NULL',
            [wid, card.id],
          )
        ).rows[0].date;
        let target: any;
        for (let offset = 0; offset < 240; offset++) {
          const dates = statementDates(b.date, card.closing_day, card.due_day, offset);
          if (lastSettled && dates.dueDate <= lastSettled) continue;
          target = await ensureStatement(c, wid, card.id, dates);
          if (!target.settled_at) break;
        }
        check(
          target && !target.settled_at,
          409,
          'Não foi possível encontrar uma fatura aberta para o crédito.',
        );
        const id = randomUUID();
        await c.query(
          'INSERT INTO card_refunds(id,workspace_id,purchase_id,statement_id,amount_cents,date,reason,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            id,
            wid,
            p.id,
            target.id,
            b.amountCents,
            b.date,
            b.reason,
            req.headers['idempotency-key'],
          ],
        );
        await audit(c, wid, req.userId, 'card.refund', id, null, b);
        return { id, replayed: false };
      });
      return reply.code(result.replayed ? 200 : 201).send(result);
    },
  );
  app.post(
    '/workspaces/:wid/cards/:id/statements/:sid/settle',
    { schema: { params: cardParams, body: settlementSchema, headers: keyed } },
    async (req) => {
      const wid = await authorize(req, true),
        b = req.body;
      return atomic(async (c) => {
        await lock(c, wid);
        const s = (
          await c.query(
            `SELECT s.*,${statementTotal} AS total FROM card_statements s WHERE s.workspace_id=$1 AND s.card_id=$2 AND s.id=$3 FOR UPDATE`,
            [wid, req.params.id, req.params.sid],
          )
        ).rows[0];
        check(s, 404, 'Fatura não encontrada.');
        if (s.settled_at) {
          check(
            s.payment_key === req.headers['idempotency-key'] &&
              s.settlement_date === b.date &&
              integer(s.paid_cents) === b.expectedCashCents,
            409,
            'Fatura já liquidada.',
          );
          if (s.cash_transaction_id)
            check(
              (
                await c.query('SELECT 1 FROM transactions WHERE id=$1 AND account_id=$2', [
                  s.cash_transaction_id,
                  b.accountId || null,
                ])
              ).rowCount,
              409,
              'Pagamento já registrado em outra conta.',
            );
          return { paidCents: integer(s.paid_cents), replayed: true };
        }
        check(b.date >= s.closing_date, 400, 'Liquide a fatura após a data de fechamento.');
        if (b.accountId)
          check(
            (
              await c.query(
                'SELECT 1 FROM financial_accounts WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL',
                [wid, b.accountId],
              )
            ).rowCount,
            400,
            'Conta inválida ou arquivada.',
          );
        check(
          !(
            await c.query(
              'SELECT 1 FROM card_statements WHERE workspace_id=$1 AND card_id=$2 AND due_date>$3 AND settled_at IS NOT NULL',
              [wid, s.card_id, s.due_date],
            )
          ).rowCount,
          409,
          'Reabra as liquidações posteriores antes de inserir uma liquidação retroativa.',
        );
        check(
          !(
            await c.query(
              'SELECT 1 FROM card_statements WHERE workspace_id=$1 AND card_id=$2 AND due_date<$3 AND settled_at IS NULL',
              [wid, s.card_id, s.due_date],
            )
          ).rowCount,
          409,
          'Liquide as faturas anteriores primeiro.',
        );
        check(
          !(
            await c.query(
              'SELECT 1 FROM card_statements WHERE workspace_id=$1 AND card_id=$2 AND settlement_date>$3',
              [wid, s.card_id, b.date],
            )
          ).rowCount,
          400,
          'Pagamento anterior a uma liquidação já registrada.',
        );
        const position = await cardPosition(c, wid, s.card_id),
          total = integer(s.total);
        const cash = Math.max(0, total - position.credit);
        check(
          cash === b.expectedCashCents,
          409,
          'O valor da liquidação mudou. Atualize a fatura antes de confirmar.',
        );
        const creditDelta = total < 0 ? -total : -Math.min(position.credit, total);
        let tid = null;
        if (cash > 0) {
          check(b.accountId, 400, 'Selecione uma conta para pagar a fatura.');
          const card = await getCard(c, wid, s.card_id);
          tid = await managedExpense(c, wid, req.userId, {
            description: `Fatura ${card.name} · ${s.due_date}`,
            amountCents: cash,
            date: b.date,
            accountId: b.accountId,
            sourceType: 'card_payment',
            key: req.headers['idempotency-key'],
          });
        }
        if (creditDelta !== 0)
          await c.query(
            'INSERT INTO card_credit_entries(id,workspace_id,card_id,statement_id,amount_cents) VALUES($1,$2,$3,$4,$5)',
            [randomUUID(), wid, s.card_id, s.id, creditDelta],
          );
        await c.query(
          'UPDATE card_statements SET settled_at=now(),settlement_date=$2,cash_transaction_id=$3,payment_key=$4,paid_cents=$5 WHERE id=$1',
          [s.id, b.date, tid, req.headers['idempotency-key'], cash],
        );
        await audit(c, wid, req.userId, 'card.statement.settle', s.id, null, {
          ...b,
          paidCents: cash,
          creditDelta,
        });
        return { paidCents: cash, replayed: false };
      });
    },
  );
  app.post(
    '/workspaces/:wid/cards/:id/statements/:sid/reopen',
    { schema: { params: cardParams } },
    async (req) => {
      const wid = await authorize(req, true);
      await atomic(async (c) => {
        await lock(c, wid);
        const s = (
          await c.query(
            'SELECT * FROM card_statements WHERE workspace_id=$1 AND card_id=$2 AND id=$3 FOR UPDATE',
            [wid, req.params.id, req.params.sid],
          )
        ).rows[0];
        check(s?.settled_at, 409, 'Fatura não está liquidada.');
        check(
          !(
            await c.query(
              'SELECT 1 FROM card_statements WHERE workspace_id=$1 AND card_id=$2 AND due_date>$3 AND settled_at IS NOT NULL',
              [wid, s.card_id, s.due_date],
            )
          ).rowCount,
          409,
          'Reabra as liquidações posteriores primeiro para preservar créditos.',
        );
        if (s.cash_transaction_id) {
          await c.query(
            'UPDATE transactions SET voided_at=now(),updated_at=now(),version=version+1 WHERE id=$1',
            [s.cash_transaction_id],
          );
          await audit(c, wid, req.userId, 'transaction.void', s.cash_transaction_id, null, {
            reason: 'Reabertura da fatura',
          });
        }
        await c.query('DELETE FROM card_credit_entries WHERE statement_id=$1', [s.id]);
        await c.query(
          'UPDATE card_statements SET settled_at=NULL,settlement_date=NULL,cash_transaction_id=NULL,payment_key=NULL,paid_cents=0 WHERE id=$1',
          [s.id],
        );
        await audit(c, wid, req.userId, 'card.statement.reopen', s.id, s, null);
      });
      return { ok: true };
    },
  );
}
