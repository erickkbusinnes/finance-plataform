import { z } from 'zod';
import { cents, dateOnly } from './index.js';
export const cardSchema = z.object({
  name: z.string().trim().min(2).max(80),
  limitCents: cents,
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
});
export const purchaseSchema = z
  .object({
    description: z.string().trim().min(2).max(200),
    amountCents: cents,
    date: dateOnly,
    installments: z.number().int().min(1).max(120).default(1),
    categoryId: z.uuid().nullable().optional(),
  })
  .refine(
    (b) => b.installments <= b.amountCents,
    'O valor deve permitir ao menos um centavo por parcela.',
  );
export const cardRefundSchema = z.object({
  amountCents: cents,
  date: dateOnly,
  reason: z.string().trim().min(2).max(200),
});
export const settlementSchema = z.object({
  date: dateOnly,
  expectedCashCents: z.number().int().min(0).max(1_000_000_000_000),
  accountId: z.uuid().nullable().optional(),
});
export const debtSchema = z
  .object({
    creditor: z.string().trim().min(2).max(100),
    principalCents: cents,
    monthlyInterestBps: z.number().int().min(0).max(100000).default(0),
    date: dateOnly,
    dueDate: dateOnly.nullable().optional(),
  })
  .refine((b) => !b.dueDate || b.dueDate >= b.date, 'Vencimento anterior à dívida.');
export const debtPaymentSchema = z
  .object({
    principalCents: cents,
    interestCents: z.number().int().min(0).max(1_000_000_000_000).default(0),
    date: dateOnly,
    accountId: z.uuid(),
  })
  .refine(
    (b) => b.principalCents + b.interestCents <= 1_000_000_000_000,
    'Pagamento acima do limite.',
  );
export const holdingSchema = z.object({
  name: z.string().trim().min(2).max(100),
  kind: z.enum(['asset', 'investment']),
  subtype: z.string().trim().min(2).max(80),
  quantity: z
    .string()
    .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/)
    .refine((v) => BigInt(v.replace('.', '')) > 0n, 'Quantidade deve ser positiva.'),
  appliedCents: z.number().int().min(0).max(1_000_000_000_000),
  valueCents: z.number().int().min(0).max(1_000_000_000_000),
  date: dateOnly,
  linkedAccountId: z.uuid().nullable().optional(),
});
export const valuationSchema = holdingSchema.pick({ valueCents: true, date: true });
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function calendarDate(year: number, month: number, day: number) {
  return new Date(
    Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()), 12),
  );
}
export function statementDates(date: string, closingDay: number, dueDay: number, offset = 0) {
  const d = new Date(date + 'T12:00:00Z');
  const closing = calendarDate(d.getUTCFullYear(), d.getUTCMonth(), closingDay);
  const advance = +d > +closing ? 1 : 0;
  const close = calendarDate(d.getUTCFullYear(), d.getUTCMonth() + advance + offset, closingDay);
  const due = calendarDate(
    close.getUTCFullYear(),
    close.getUTCMonth() + (dueDay <= closingDay ? 1 : 0),
    dueDay,
  );
  return { closingDate: iso(close), dueDate: iso(due) };
}
export function splitInstallments(amount: number, count: number) {
  if (
    !Number.isSafeInteger(amount) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 120 ||
    count > amount
  )
    throw new Error('Parcelamento inválido');
  const base = Math.floor(amount / count),
    remaining = amount % count;
  return Array.from({ length: count }, (_, i) => base + (i < remaining ? 1 : 0));
}
export type CreditCard = {
  id: string;
  name: string;
  limitCents: number;
  usedCents: number;
  availableCents: number;
  creditCents: number;
  closingDay: number;
  dueDay: number;
  version: number;
  archivedAt: string | null;
};
export type CardStatement = {
  id: string;
  dueDate: string;
  closingDate: string;
  settledAt: string | null;
  settlementDate: string | null;
  paidCents: number;
  totalCents: number;
};
export type CardPurchase = {
  id: string;
  description: string;
  amountCents: number;
  refundedCents: number;
  date: string;
  installments: number;
  categoryName: string | null;
};
export type Debt = {
  id: string;
  creditor: string;
  principalCents: number;
  outstandingCents: number;
  monthlyInterestBps: number;
  date: string;
  dueDate: string | null;
};
export type Holding = {
  id: string;
  name: string;
  kind: 'asset' | 'investment';
  subtype: string;
  quantity: string;
  appliedCents: number;
  valueCents: number;
  valuationDate: string;
  linkedAccountId: string | null;
};
