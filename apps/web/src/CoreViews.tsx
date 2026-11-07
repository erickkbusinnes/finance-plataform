import type { Account, Category, Goal, Statement as StatementData } from '@clara/shared';
import { money, parseMoney } from '@clara/shared/money';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from './api';
import { useFinance } from './finance-context';
import { Button, ErrorBox, Field, Form, Modal } from './ui';
export function EntityEditor({
  account,
  category,
  onClose,
}: {
  account?: Account;
  category?: Category;
  onClose: () => void;
}) {
  const { wid, categories, refresh } = useFinance();
  const item = (account || category)!;
  return (
    <Modal title={account ? 'Editar conta' : 'Editar categoria'} onClose={onClose}>
      <Form
        onSave={(d) =>
          api(`/workspaces/${wid}/${account ? 'accounts' : 'categories'}/${item.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: d.get('name'),
              ...(account
                ? { type: d.get('type') }
                : {
                    kind: d.get('kind'),
                    color: d.get('color'),
                    parentId: d.get('parentId') || null,
                  }),
              archived: d.get('archived') === 'on',
              version: item.version,
            }),
          })
        }
        onSuccess={() => {
          onClose();
          void refresh();
        }}
      >
        <Field label="Nome">
          <input
            name="name"
            defaultValue={item.name}
            required
            minLength={2}
            maxLength={account ? 80 : 60}
          />
        </Field>
        {account ? (
          <Field label="Tipo da conta">
            <select name="type" defaultValue={account.type}>
              {Object.entries({
                checking: 'Conta corrente',
                savings: 'Poupança',
                cash: 'Dinheiro / caixa',
                wallet: 'Carteira digital',
                investment: 'Investimento manual',
              }).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="Tipo da categoria">
              <select name="kind" defaultValue={category!.kind}>
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </Field>
            <Field label="Categoria principal">
              <select name="parentId" defaultValue={category!.parentId || ''}>
                <option value="">Categoria principal (sem mãe)</option>
                {categories
                  .filter(
                    (c) =>
                      !c.archivedAt && !c.parentId && c.id !== item.id && c.kind === category!.kind,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Cor">
              <input name="color" type="color" defaultValue={category!.color} />
            </Field>
          </>
        )}
        <label className="checkbox">
          <input name="archived" type="checkbox" defaultChecked={!!item.archivedAt} /> Arquivada
        </label>
        <p className="form-description">
          Arquivar preserva saldos e histórico e impede novos lançamentos. Desmarque para reativar.
          O saldo inicial permanece registrado e não é sobrescrito por esta edição.
        </p>
      </Form>
    </Modal>
  );
}
export function AccountStatement({ account, onClose }: { account: Account; onClose: () => void }) {
  const { wid, from, to } = useFinance();
  const [period, setPeriod] = useState({ from, to }),
    [page, setPage] = useState(1);
  const query = new URLSearchParams({ ...period, page: String(page) });
  const result = useQuery({
    queryKey: ['finance', wid, 'statement', account.id, query.toString()],
    queryFn: () =>
      api<StatementData>(`/workspaces/${wid}/accounts/${account.id}/statement?${query}`),
  });
  return (
    <Modal title={`Extrato · ${account.name}`} onClose={onClose}>
      <div className="form-row">
        <Field label="Início do extrato">
          <input
            type="date"
            value={period.from}
            onChange={(e) => {
              setPeriod({ ...period, from: e.target.value });
              setPage(1);
            }}
          />
        </Field>
        <Field label="Fim do extrato">
          <input
            type="date"
            value={period.to}
            onChange={(e) => {
              setPeriod({ ...period, to: e.target.value });
              setPage(1);
            }}
          />
        </Field>
      </div>
      <ErrorBox error={result.error} />
      {result.data && (
        <>
          <dl className="detail-list">
            <div>
              <dt>Saldo antes do período</dt>
              <dd>{money(result.data.openingCents)}</dd>
            </div>
            <div>
              <dt>Saldo ao fim do período</dt>
              <dd>{money(result.data.closingCents)}</dd>
            </div>
          </dl>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data / descrição</th>
                  <th>Movimento</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.date}
                      <br />
                      {row.description}
                    </td>
                    <td>{money(row.amountCents)}</td>
                    <td>{money(row.balanceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!result.data.total && (
            <p className="form-description">Nenhum lançamento neste período.</p>
          )}
          <div className="pagination">
            <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span>
              Página {page} · {result.data.total} lançamentos
            </span>
            <Button
              secondary
              disabled={page * 25 >= result.data.total}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
export function GoalHistory({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { wid } = useFinance();
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['finance', wid, 'goal-history', goal.id, page],
    queryFn: () =>
      api<{
        items: { id: string; createdAt: string; amountCents: number; accumulatedCents: number }[];
        total: number;
      }>(`/workspaces/${wid}/goals/${goal.id}/contributions?page=${page}`),
  });
  return (
    <Modal title={`Histórico · ${goal.name}`} onClose={onClose}>
      <p className="form-description">
        Aportes manuais de acompanhamento. Não são transferências bancárias.
      </p>
      <ErrorBox error={history.error} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Registrado em</th>
              <th>Aporte</th>
              <th>Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {history.data?.items.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString('pt-BR')}</td>
                <td>{money(row.amountCents)}</td>
                <td>{money(row.accumulatedCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {history.data?.total === 0 && <p className="form-description">Ainda não há aportes.</p>}
      <div className="pagination">
        <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <span>Página {page}</span>
        <Button
          secondary
          disabled={!history.data || page * 25 >= history.data.total}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </Modal>
  );
}
// Shared money range inputs stay in Brazilian decimal notation.
export const optionalCents = (value: string) =>
  value.trim() ? String(parseMoney(value)) : undefined;
