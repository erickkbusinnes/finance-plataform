import { z } from 'zod';
export const cents = z.number().int().min(1).max(1_000_000_000_000);
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !isNaN(+d) && d.getUTCFullYear() >= 1900 && d.toISOString().slice(0, 10) === v;
  }, 'Data inválida');
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  kind: z.enum(['personal', 'business']),
});
export const accountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(['checking', 'savings', 'cash', 'wallet', 'investment']).default('checking'),
  openingCents: z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000).default(0),
  date: dateOnly,
});
export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  kind: z.enum(['income', 'expense']),
  parentId: z.uuid().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#10b981'),
});
export const transactionSchema = z
  .object({
    description: z.string().trim().min(2).max(200),
    kind: z.enum(['income', 'expense', 'transfer', 'refund']),
    amountCents: cents,
    date: dateOnly,
    accountId: z.uuid(),
    destinationAccountId: z.uuid().nullable().optional(),
    categoryId: z.uuid().nullable().optional(),
    notes: z.string().max(2000).default(''),
    tags: z
      .array(z.string().trim().min(1).max(32))
      .max(20)
      .transform((v) => [...new Set(v.map((t) => t.toLowerCase()))])
      .default([]),
    refundOf: z.uuid().nullable().optional(),
  })
  .superRefine((v, c) => {
    if ((v.kind === 'refund') !== !!v.refundOf)
      c.addIssue({
        code: 'custom',
        message: 'Reembolso exige uma despesa de origem.',
        path: ['refundOf'],
      });
    if (
      v.kind === 'transfer' &&
      (!v.destinationAccountId || v.destinationAccountId === v.accountId)
    )
      c.addIssue({
        code: 'custom',
        message: 'Selecione duas contas diferentes',
        path: ['destinationAccountId'],
      });
    if (v.kind !== 'transfer' && v.destinationAccountId)
      c.addIssue({
        code: 'custom',
        message: 'Destino só é permitido em transferências',
        path: ['destinationAccountId'],
      });
    if (v.kind === 'transfer' && v.categoryId)
      c.addIssue({
        code: 'custom',
        message: 'Transferências não têm categoria',
        path: ['categoryId'],
      });
  });
export const budgetSchema = z.object({
  categoryId: z.uuid(),
  month: z.string().regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/),
  limitCents: cents,
});
export const goalSchema = z.object({
  name: z.string().trim().min(2).max(100),
  targetCents: cents,
  dueDate: dateOnly.nullable().optional(),
});
export type TransactionInput = z.infer<typeof transactionSchema>;
export type Workspace = {
  id: string;
  name: string;
  kind: 'personal' | 'business';
  role: 'owner' | 'admin' | 'finance' | 'viewer';
};
export type User = { id: string; name: string; email: string; emailVerified: boolean };
export type Account = {
  id: string;
  name: string;
  type: string;
  balanceCents: number;
  archivedAt: string | null;
  version: number;
};
export type Category = {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  color: string;
  parentId: string | null;
  archivedAt: string | null;
  version: number;
};
export type Transaction = {
  id: string;
  description: string;
  kind: 'income' | 'expense' | 'transfer' | 'refund';
  amountCents: number;
  date: string;
  accountId: string;
  accountName: string;
  destinationAccountId: string | null;
  destinationName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  notes: string;
  version: number;
  tags: string[];
  refundOf: string | null;
  sourceType: string | null;
};
export type Summary = {
  change: { incomeCents: number; expenseCents: number; resultCents: number };
  grossExpenseCents: number;
  refundCents: number;
  previous: {
    from: string;
    to: string;
    incomeCents: number;
    expenseCents: number;
    resultCents: number;
  };
  balanceCents: number;
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
  monthly: { month: string; incomeCents: number; expenseCents: number }[];
  categories: { name: string; color: string; amountCents: number }[];
};
export type Budget = {
  id: string;
  categoryId: string;
  categoryName: string;
  month: string;
  limitCents: number;
  spentCents: number;
};
export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  contributedCents: number;
  dueDate: string | null;
};
export { money, parseMoney } from './money.js';

export const accountUpdateSchema = accountSchema
  .pick({ name: true, type: true })
  .extend({ archived: z.boolean(), version: z.number().int().positive() });
export const categoryUpdateSchema = categorySchema.extend({
  archived: z.boolean(),
  version: z.number().int().positive(),
});
export const transactionFilters = z
  .object({
    from: dateOnly,
    to: dateOnly,
    search: z.string().max(100).default(''),
    kind: z.enum(['income', 'expense', 'transfer', 'refund']).optional(),
    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    tag: z.string().max(32).optional(),
    minCents: z.coerce.number().int().min(0).max(1_000_000_000_000).optional(),
    maxCents: z.coerce.number().int().min(0).max(1_000_000_000_000).optional(),
    sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc']).default('date_desc'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine((v) => v.from <= v.to, 'Período inválido')
  .refine(
    (v) => v.minCents === undefined || v.maxCents === undefined || v.minCents <= v.maxCents,
    'Faixa de valores inválida',
  );
export type Statement = {
  openingCents: number;
  closingCents: number;
  total: number;
  page: number;
  items: {
    id: string;
    description: string;
    kind: string;
    date: string;
    amountCents: number;
    balanceCents: number;
  }[];
};
