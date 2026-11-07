import type { TransactionInput } from '@clara/shared';
import type { FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { integer, pool } from './db.js';
import { check } from './errors.js';
export const ws = z.object({ wid: z.uuid() }),
  entity = ws.extend({ id: z.uuid() });
export async function authorize(req: FastifyRequest, write = false) {
  const wid = (req.params as { wid: string }).wid;
  const m = (
    await pool.query('SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [
      wid,
      req.userId,
    ])
  ).rows[0];
  check(m, 404, 'Ambiente não encontrado.');
  if (write)
    check(
      ['owner', 'admin', 'finance'].includes(m.role),
      403,
      'Você não tem permissão para alterar este ambiente.',
    );
  return wid;
}
export async function audit(
  c: PoolClient,
  wid: string,
  actor: string,
  action: string,
  id: string,
  before: unknown,
  after: unknown,
) {
  await c.query(
    'INSERT INTO audit_logs(id,workspace_id,actor_id,action,entity_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      randomUUID(),
      wid,
      actor,
      action,
      id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    ],
  );
}
export async function lock(c: PoolClient, wid: string) {
  await c.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [wid]);
}
export const moneyRows = (rows: any[], keys: string[]) =>
  rows.map((r) => {
    for (const k of keys) r[k] = integer(r[k]);
    return r;
  });
export async function validateReferences(
  c: PoolClient,
  wid: string,
  b: TransactionInput,
  before?: any,
) {
  const ids = [b.accountId, ...(b.destinationAccountId ? [b.destinationAccountId] : [])];
  const allowedOld = [before?.account_id, before?.destination_account_id].filter(Boolean);
  check(
    (
      await c.query(
        'SELECT id FROM financial_accounts WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND (archived_at IS NULL OR id=ANY($3::uuid[]))',
        [wid, ids, allowedOld],
      )
    ).rowCount === ids.length,
    400,
    'Conta inválida ou arquivada para este ambiente.',
  );
  if (b.categoryId && b.kind !== 'refund')
    check(
      (
        await c.query(
          'SELECT id FROM categories WHERE workspace_id=$1 AND id=$2 AND kind=$3 AND (archived_at IS NULL OR id=$4)',
          [wid, b.categoryId, b.kind, before?.category_id || null],
        )
      ).rowCount,
      400,
      'Categoria incompatível ou arquivada.',
    );
  if (b.kind === 'refund') {
    const source = (
      await c.query(
        "SELECT * FROM transactions WHERE workspace_id=$1 AND id=$2 AND kind='expense' AND voided_at IS NULL AND source_type IS NULL",
        [wid, b.refundOf],
      )
    ).rows[0];
    check(
      source,
      400,
      'Despesa de origem inválida. Use o módulo de origem para estornos de faturas ou dívidas.',
    );
    check(b.date >= source.date, 400, 'Reembolso não pode anteceder a despesa.');
    check(
      (b.categoryId || null) === (source.category_id || null),
      400,
      'Use a mesma categoria da despesa de origem.',
    );
    const used = integer(
      (
        await c.query(
          'SELECT COALESCE(sum(amount_cents),0) AS total FROM transactions WHERE workspace_id=$1 AND refund_of=$2 AND voided_at IS NULL AND id<>$3',
          [wid, b.refundOf, before?.id || '00000000-0000-0000-0000-000000000000'],
        )
      ).rows[0].total,
    );
    check(
      used + b.amountCents <= integer(source.amount_cents),
      409,
      'Reembolsos excedem o valor da despesa.',
    );
  }
}
export async function protectManaged(c: PoolClient, wid: string, before: any) {
  check(!before.source_type, 409, 'Movimentação vinculada. Utilize o módulo de origem.');
  check(
    !(
      await c.query(
        'SELECT 1 FROM transactions WHERE workspace_id=$1 AND refund_of=$2 AND voided_at IS NULL',
        [wid, before.id],
      )
    ).rowCount,
    409,
    'Cancele os reembolsos vinculados antes de alterar esta despesa.',
  );
}
export async function entries(c: PoolClient, wid: string, id: string, b: TransactionInput) {
  await c.query(
    'INSERT INTO transaction_entries(id,workspace_id,transaction_id,account_id,amount_cents) VALUES($1,$2,$3,$4,$5)',
    [
      randomUUID(),
      wid,
      id,
      b.accountId,
      ['income', 'refund'].includes(b.kind) ? b.amountCents : -b.amountCents,
    ],
  );
  if (b.kind === 'transfer')
    await c.query(
      'INSERT INTO transaction_entries(id,workspace_id,transaction_id,account_id,amount_cents) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), wid, id, b.destinationAccountId, b.amountCents],
    );
}
export async function managedExpense(
  c: PoolClient,
  wid: string,
  userId: string,
  b: {
    description: string;
    amountCents: number;
    date: string;
    accountId: string;
    sourceType: 'card_payment' | 'debt_payment';
    key: string;
  },
) {
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
  const id = randomUUID();
  await c.query(
    "INSERT INTO transactions(id,workspace_id,description,kind,amount_cents,date,account_id,idempotency_key,source_type) VALUES($1,$2,$3,'expense',$4,$5,$6,$7,$8)",
    [id, wid, b.description, b.amountCents, b.date, b.accountId, b.key, b.sourceType],
  );
  await entries(c, wid, id, { ...b, kind: 'expense', notes: '', tags: [] });
  await audit(c, wid, userId, 'transaction.create', id, null, b);
  return id;
}
