import { transactionFilters } from '@clara/shared';
import type { z } from 'zod';
export const transactionSelect = `SELECT t.id,t.description,t.kind,t.amount_cents AS "amountCents",t.date,t.account_id AS "accountId",a.name AS "accountName",t.destination_account_id AS "destinationAccountId",d.name AS "destinationName",t.category_id AS "categoryId",c.name AS "categoryName",t.notes,t.version,t.tags,t.refund_of AS "refundOf",t.source_type AS "sourceType" FROM transactions t JOIN financial_accounts a ON a.id=t.account_id LEFT JOIN financial_accounts d ON d.id=t.destination_account_id LEFT JOIN categories c ON c.id=t.category_id`;
export function transactionWhere(wid: string, b: z.infer<typeof transactionFilters>) {
  return {
    sql: `t.workspace_id=$1 AND t.voided_at IS NULL AND t.kind<>'opening' AND t.date BETWEEN $2 AND $3 AND t.description ILIKE $4 AND ($5::text IS NULL OR t.kind=$5) AND ($6::uuid IS NULL OR t.account_id=$6 OR t.destination_account_id=$6) AND ($7::uuid IS NULL OR t.category_id=$7 OR t.category_id IN (SELECT id FROM categories WHERE workspace_id=$1 AND parent_id=$7)) AND ($8::text IS NULL OR $8=ANY(t.tags)) AND ($9::bigint IS NULL OR t.amount_cents>=$9) AND ($10::bigint IS NULL OR t.amount_cents<=$10)`,
    values: [
      wid,
      b.from,
      b.to,
      `%${b.search.replace(/[\\%_]/g, '\\$&')}%`,
      b.kind || null,
      b.accountId || null,
      b.categoryId || null,
      b.tag?.toLowerCase() || null,
      b.minCents ?? null,
      b.maxCents ?? null,
    ],
  };
}
export const transactionOrder = {
  date_desc: 't.date DESC,t.created_at DESC,t.id DESC',
  date_asc: 't.date ASC,t.created_at ASC,t.id ASC',
  amount_desc: 't.amount_cents DESC,t.date DESC,t.id DESC',
  amount_asc: 't.amount_cents ASC,t.date ASC,t.id ASC',
};
