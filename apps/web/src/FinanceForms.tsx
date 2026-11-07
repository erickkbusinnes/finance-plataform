import type { Account, Category, Goal, Transaction } from '@clara/shared';
import { parseMoney } from '@clara/shared/money';
import { useRef, useState } from 'react';
import { api, post } from './api';
import { Field, Form, Modal } from './ui';
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export type ModalType =
  | 'refund'
  | 'account'
  | 'category'
  | 'transaction'
  | 'workspace'
  | 'budget'
  | 'goal'
  | 'contribution'
  | null;
export function FinanceForm({
  type,
  wid,
  accounts,
  categories,
  transaction,
  goal,
  month,
  onClose,
  onSuccess,
}: {
  type: ModalType;
  wid: string;
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction;
  goal?: Goal;
  month: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [kind, setKind] = useState(type === 'refund' ? 'refund' : transaction?.kind || 'expense');
  const key = useRef(crypto.randomUUID());
  const base = `/workspaces/${wid}`;
  const title = {
    refund: 'Reembolsar despesa',
    account: 'Adicionar conta',
    category: 'Nova categoria',
    transaction: transaction ? 'Editar movimentação' : 'Nova movimentação',
    workspace: 'Um novo ambiente',
    budget: 'Definir orçamento',
    goal: 'Um novo objetivo',
    contribution: 'Registrar progresso',
  }[type!];
  const val = (d: FormData, k: string) => String(d.get(k) || '');
  const decimal = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }).format(v / 100);
  return (
    <Modal title={title} onClose={onClose}>
      <Form
        submit={type === 'workspace' ? 'Criar ambiente' : 'Salvar'}
        onSuccess={onSuccess}
        onSave={async (d) => {
          if (type === 'workspace')
            return post('/workspaces', { name: val(d, 'name'), kind: val(d, 'kind') });
          if (type === 'account')
            return post(base + '/accounts', {
              name: val(d, 'name'),
              type: val(d, 'type'),
              openingCents: parseMoney(val(d, 'amount')),
              date: val(d, 'date'),
            });
          if (type === 'category')
            return post(base + '/categories', {
              name: val(d, 'name'),
              kind: val(d, 'kind'),
              color: val(d, 'color'),
              parentId: val(d, 'parentId') || null,
            });
          if (type === 'goal')
            return post(base + '/goals', {
              name: val(d, 'name'),
              targetCents: parseMoney(val(d, 'amount')),
              dueDate: val(d, 'date') || null,
            });
          if (type === 'contribution')
            return post(
              base + `/goals/${goal!.id}/contributions`,
              { amountCents: parseMoney(val(d, 'amount')) },
              { 'Idempotency-Key': key.current },
            );
          if (type === 'budget')
            return post(base + '/budgets', {
              categoryId: val(d, 'categoryId'),
              month: val(d, 'month'),
              limitCents: parseMoney(val(d, 'amount')),
            });
          if (type === 'transaction' || type === 'refund') {
            const body = {
              description: val(d, 'description'),
              refundOf:
                kind === 'refund'
                  ? type === 'refund'
                    ? transaction!.id
                    : transaction!.refundOf
                  : null,
              tags: val(d, 'tags')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              kind,
              amountCents: parseMoney(val(d, 'amount')),
              date: val(d, 'date'),
              accountId: val(d, 'accountId'),
              destinationAccountId: kind === 'transfer' ? val(d, 'destinationAccountId') : null,
              categoryId:
                kind === 'refund'
                  ? transaction!.categoryId
                  : kind === 'transfer'
                    ? null
                    : val(d, 'categoryId') || null,
              notes: val(d, 'notes'),
            };
            if (transaction && type !== 'refund')
              return api(base + `/transactions/${transaction.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...body, version: transaction.version }),
              });
            return post(base + '/transactions', body, { 'Idempotency-Key': key.current });
          }
        }}
      >
        {type === 'workspace' && (
          <>
            <p className="form-description">
              Um espaço independente para seus registros. Você pode criar outros depois.
            </p>
            <Field label="Nome do ambiente">
              <input
                name="name"
                placeholder="Ex.: Minhas finanças"
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
            <Field label="Tipo de ambiente">
              <select name="kind">
                <option value="personal">Finanças pessoais</option>
                <option value="business">Finanças empresariais</option>
              </select>
            </Field>
          </>
        )}
        {type === 'account' && (
          <>
            <Field label="Nome da conta">
              <input
                name="name"
                placeholder="Ex.: Minha conta principal"
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field label="Tipo">
              <select name="type">
                <option value="checking">Conta corrente</option>
                <option value="savings">Poupança</option>
                <option value="cash">Dinheiro / caixa</option>
                <option value="wallet">Carteira digital</option>
                <option value="investment">Investimento (registro manual)</option>
              </select>
            </Field>
            <Field
              label="Saldo inicial (R$)"
              hint="O saldo inicial será registrado no histórico da conta."
            >
              <input name="amount" inputMode="decimal" defaultValue="0,00" required />
            </Field>
            <Field label="Data do saldo inicial">
              <input name="date" type="date" defaultValue={today()} required />
            </Field>
          </>
        )}
        {type === 'category' && (
          <>
            <Field label="Nome">
              <input
                name="name"
                placeholder="Ex.: Alimentação"
                required
                minLength={2}
                maxLength={60}
              />
            </Field>
            <Field label="Tipo">
              <select name="kind">
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </Field>
            <Field label="Categoria principal">
              <select name="parentId">
                <option value="">Categoria principal (sem mãe)</option>
                {categories
                  .filter((c) => !c.archivedAt && !c.parentId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.kind === 'expense' ? 'Despesa' : 'Receita'})
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Cor">
              <input type="color" name="color" defaultValue="#10b981" />
            </Field>
          </>
        )}
        {(type === 'transaction' || type === 'refund') && (
          <>
            <div className="type-tabs" role="group" aria-label="Tipo da movimentação">
              {kind === 'refund' ? (
                <span className="badge">Reembolso vinculado à despesa</span>
              ) : null}
              {(kind === 'refund' ? [] : (['expense', 'income', 'transfer'] as const)).map((k) => (
                <button
                  className={kind === k ? 'active' : ''}
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                >
                  {{ expense: 'Despesa', income: 'Receita', transfer: 'Transferência' }[k]}
                </button>
              ))}
            </div>
            <Field label="Descrição">
              <input
                name="description"
                placeholder="O que aconteceu?"
                defaultValue={
                  type === 'refund'
                    ? 'Reembolso: ' + transaction?.description
                    : transaction?.description
                }
                required
                minLength={2}
                maxLength={200}
              />
            </Field>
            <div className="form-row">
              <Field label="Valor (R$)">
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={transaction ? decimal(transaction.amountCents) : ''}
                  required
                />
              </Field>
              <Field label="Data">
                <input
                  name="date"
                  type="date"
                  defaultValue={type === 'refund' ? today() : transaction?.date || today()}
                  required
                />
              </Field>
            </div>
            <Field label={kind === 'transfer' ? 'Conta de origem' : 'Conta'}>
              <select
                name="accountId"
                defaultValue={
                  transaction &&
                  (type === 'transaction' ||
                    accounts.some((a) => a.id === transaction.accountId && !a.archivedAt))
                    ? transaction.accountId
                    : ''
                }
                required
              >
                <option value="" disabled>
                  Selecione uma conta
                </option>
                {accounts
                  .filter(
                    (a) =>
                      !a.archivedAt ||
                      (type === 'transaction' &&
                        (a.id === transaction?.accountId ||
                          a.id === transaction?.destinationAccountId)),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </Field>
            {kind === 'transfer' ? (
              <Field label="Conta de destino">
                <select
                  name="destinationAccountId"
                  defaultValue={transaction?.destinationAccountId || ''}
                  required
                >
                  <option value="" disabled>
                    Selecione outra conta
                  </option>
                  {accounts
                    .filter(
                      (a) =>
                        !a.archivedAt ||
                        a.id === transaction?.accountId ||
                        a.id === transaction?.destinationAccountId,
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            ) : (
              <Field label="Categoria">
                <select
                  name="categoryId"
                  disabled={kind === 'refund'}
                  defaultValue={transaction?.categoryId || ''}
                >
                  <option value="">Sem categoria</option>
                  {categories
                    .filter(
                      (c) =>
                        c.kind === (kind === 'refund' ? 'expense' : kind) &&
                        (!c.archivedAt || c.id === transaction?.categoryId),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Tags (separadas por vírgula)">
              <input
                name="tags"
                defaultValue={transaction?.tags?.join(', ')}
                maxLength={650}
                placeholder="Ex.: trabalho, viagem"
              />
            </Field>
            <Field label="Observações (opcional)">
              <textarea name="notes" defaultValue={transaction?.notes} maxLength={2000} rows={2} />
            </Field>
            <p className="form-description">
              Registro manual confirmado. Não realiza pagamentos ou movimentações bancárias.
            </p>
          </>
        )}
        {type === 'budget' && (
          <>
            <Field label="Categoria de despesa">
              <select name="categoryId" required defaultValue="">
                <option value="" disabled>
                  Selecione uma categoria
                </option>
                {categories
                  .filter((c) => c.kind === 'expense' && !c.archivedAt)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Mês">
              <input type="month" name="month" defaultValue={month} required />
            </Field>
            <Field label="Limite (R$)">
              <input name="amount" placeholder="0,00" inputMode="decimal" required />
            </Field>
            <p className="form-description">
              Se já houver orçamento para esta categoria e mês, o limite será atualizado.
            </p>
          </>
        )}
        {type === 'goal' && (
          <>
            <Field label="O que você quer realizar?">
              <input
                name="name"
                placeholder="Ex.: Reserva de emergência"
                minLength={2}
                maxLength={100}
                required
              />
            </Field>
            <Field label="Valor objetivo (R$)">
              <input name="amount" placeholder="0,00" inputMode="decimal" required />
            </Field>
            <Field label="Prazo (opcional)">
              <input name="date" type="date" />
            </Field>
          </>
        )}
        {type === 'contribution' && (
          <>
            <p>
              Meta: <strong>{goal?.name}</strong>
            </p>
            <Field label="Valor reservado (R$)">
              <input name="amount" inputMode="decimal" placeholder="0,00" required />
            </Field>
            <p className="form-description">
              Este registro acompanha seu progresso. Não transfere dinheiro nem altera o saldo de
              uma conta.
            </p>
          </>
        )}
      </Form>
    </Modal>
  );
}
