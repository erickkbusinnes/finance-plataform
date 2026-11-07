import type { Transaction } from '@clara/shared';
import { money } from '@clara/shared/money';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Plus,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from './api';
import { optionalCents } from './CoreViews';
import { dateLabel } from './dates';
import { DownloadButton } from './Downloads';
import { useFinance } from './finance-context';
import { Button, Empty, ErrorBox, Form, Modal } from './ui';
export function Transactions({ compact = false }: { compact?: boolean }) {
  const { wid, from, to, accounts, categories, open, refresh } = useFinance();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [search, setSearch] = useState(''),
    [debounced, setDebounced] = useState(''),
    [kind, setKind] = useState(params.get('kind') || ''),
    [accountId, setAccountId] = useState(params.get('accountId') || ''),
    [categoryId, setCategoryId] = useState(''),
    [tag, setTag] = useState(''),
    [min, setMin] = useState(''),
    [max, setMax] = useState(''),
    [sort, setSort] = useState('date_desc'),
    [page, setPage] = useState(1),
    [dates, setDates] = useState({ from, to }),
    [detail, setDetail] = useState<Transaction>(),
    [cancel, setCancel] = useState<Transaction>();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setDates({ from, to });
    setPage(1);
  }, [from, to]);
  useEffect(() => setPage(1), [debounced, kind, accountId, categoryId, tag, min, max, sort]);
  let moneyFilters: Record<string, string> = {};
  let filterError: unknown;
  try {
    const lo = optionalCents(min),
      hi = optionalCents(max);
    moneyFilters = { ...(lo ? { minCents: lo } : {}), ...(hi ? { maxCents: hi } : {}) };
  } catch (e) {
    filterError = e;
  }
  const query = new URLSearchParams({
    ...dates,
    ...(!compact
      ? {
          search: debounced,
          tag,
          sort,
          ...moneyFilters,
          ...(kind ? { kind } : {}),
          ...(accountId ? { accountId } : {}),
          ...(categoryId ? { categoryId } : {}),
        }
      : {}),
    page: String(page),
  }).toString();
  const result = useQuery({
    queryKey: ['finance', wid, 'transactions', query, compact],
    enabled: !filterError,
    queryFn: () =>
      api<{ items: Transaction[]; total: number; page: number }>(
        `/workspaces/${wid}/transactions?${query}`,
      ),
  });
  const items = compact ? result.data?.items.slice(0, 5) : result.data?.items;
  return (
    <section className={`panel transactions-panel ${compact ? 'compact' : ''}`}>
      <div className="panel-heading">
        <div>
          <h2>{compact ? 'Últimas movimentações' : 'Seu histórico'}</h2>
          <p>
            {compact
              ? 'Os últimos passos do seu dinheiro'
              : `${result.data?.total ?? 0} registros no período`}
          </p>
        </div>
        {compact ? (
          <Link to="/app/movimentacoes" className="text-button">
            Ver todas <ArrowUpRight size={16} />
          </Link>
        ) : (
          <div className="row-actions">
            <DownloadButton
              path={`/workspaces/${wid}/export.csv?${query}`}
              filename="clara-movimentacoes.csv"
              label="Exportar CSV"
            />
            <DownloadButton
              path={`/workspaces/${wid}/export.pdf?${query}`}
              filename="clara-relatorio.pdf"
              label="PDF"
            />
            <DownloadButton
              path={`/workspaces/${wid}/export.xlsx?${query}`}
              filename="clara-relatorio.xlsx"
              label="Excel"
            />
          </div>
        )}
      </div>
      {!compact && (
        <div className="filters">
          <label className="search-box">
            <Search size={17} />
            <input
              placeholder="Buscar descrição…"
              aria-label="Buscar movimentações"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select aria-label="Filtrar tipo" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
            <option value="transfer">Transferências</option>
            <option value="refund">Reembolsos</option>
          </select>
          <select
            aria-label="Filtrar conta"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar categoria"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Filtrar tag"
            placeholder="Tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <input
            aria-label="Valor mínimo (R$)"
            placeholder="Mínimo R$"
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
          <input
            aria-label="Valor máximo (R$)"
            placeholder="Máximo R$"
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
          <select
            aria-label="Ordenar movimentações"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigas</option>
            <option value="amount_desc">Maior valor</option>
            <option value="amount_asc">Menor valor</option>
          </select>
          <label className="date-filter">
            De{' '}
            <input
              aria-label="Data inicial"
              type="date"
              value={dates.from}
              onChange={(e) => {
                setDates({ ...dates, from: e.target.value });
                setPage(1);
              }}
            />
          </label>
          <label className="date-filter">
            Até{' '}
            <input
              aria-label="Data final"
              type="date"
              value={dates.to}
              onChange={(e) => {
                setDates({ ...dates, to: e.target.value });
                setPage(1);
              }}
            />
          </label>
        </div>
      )}
      <ErrorBox error={filterError || result.error} />
      {result.isPending ? (
        <div className="loading" role="status">
          Buscando seus registros…
        </div>
      ) : items?.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>{compact ? 'Data' : 'Conta / categoria'}</th>
                {!compact && <th>Data</th>}
                <th className="align-right">Valor</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="transaction-description">
                      <span className={`transaction-icon ${t.kind}`}>
                        {t.kind === 'transfer' ? (
                          <ArrowLeftRight size={17} />
                        ) : t.kind === 'income' ? (
                          <ArrowDownLeft size={17} />
                        ) : (
                          <ArrowUpRight size={17} />
                        )}
                      </span>
                      <div>
                        <strong>{t.description}</strong>
                        {t.tags?.length ? (
                          <span className="tag-list">{t.tags.join(' · ')}</span>
                        ) : null}
                        <small>
                          {compact
                            ? t.categoryName ||
                              {
                                refund: 'Reembolso',
                                income: 'Receita',
                                expense: 'Despesa',
                                transfer: 'Transferência entre contas',
                              }[t.kind]
                            : {
                                refund: 'Reembolso',
                                income: 'Receita',
                                expense: 'Despesa',
                                transfer: 'Transferência',
                              }[t.kind]}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {compact ? (
                      dateLabel(t.date)
                    ) : (
                      <div className="table-account">
                        {t.accountName}
                        {t.destinationName && ' → ' + t.destinationName}
                        <small>{t.categoryName || 'Sem categoria'}</small>
                      </div>
                    )}
                  </td>
                  {!compact && <td>{dateLabel(t.date)}</td>}
                  <td className={`align-right value-${t.kind}`}>
                    {['income', 'refund'].includes(t.kind)
                      ? '+ '
                      : t.kind === 'expense'
                        ? '− '
                        : ''}
                    {money(t.amountCents)}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Detalhes de ${t.description}`}
                      onClick={() => setDetail(t)}
                    >
                      <Ellipsis size={19} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !result.error && (
          <Empty
            title="Uma página em branco. Um novo começo."
            description={
              search || kind || accountId
                ? 'Nenhuma movimentação corresponde aos filtros.'
                : 'Registre sua primeira movimentação e acompanhe tudo por aqui.'
            }
            action={
              accounts.length && !compact ? (
                <Button onClick={() => open('transaction')}>
                  <Plus size={17} /> Criar movimentação
                </Button>
              ) : undefined
            }
          />
        )
      )}
      {!compact && (result.data?.total || 0) > 25 && (
        <div className="pagination">
          <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} /> Anterior
          </Button>
          <span>
            Página {page} de {Math.ceil(result.data!.total / 25)}
          </span>
          <Button
            secondary
            disabled={page * 25 >= result.data!.total}
            onClick={() => setPage(page + 1)}
          >
            Próxima <ChevronRight size={16} />
          </Button>
        </div>
      )}
      {detail && (
        <TransactionDetail
          transaction={detail}
          onClose={() => setDetail(undefined)}
          onEdit={() => {
            open('transaction', detail);
            setDetail(undefined);
          }}
          onCancel={() => {
            setCancel(detail);
            setDetail(undefined);
          }}
        />
      )}
      {cancel && (
        <Modal title="Cancelar movimentação?" onClose={() => setCancel(undefined)}>
          <p>
            O registro “{cancel.description}” deixará de compor os saldos e os indicadores. O
            histórico será preservado.
          </p>
          <Form
            submit="Confirmar cancelamento"
            onSave={() =>
              api(`/workspaces/${wid}/transactions/${cancel.id}`, {
                method: 'DELETE',
                body: JSON.stringify({ version: cancel.version }),
              })
            }
            onSuccess={() => {
              setCancel(undefined);
              void refresh();
            }}
          >
            <Button type="button" secondary onClick={() => setCancel(undefined)}>
              Manter registro
            </Button>
          </Form>
        </Modal>
      )}
    </section>
  );
}
function TransactionDetail({
  transaction: t,
  onClose,
  onEdit,
  onCancel,
}: {
  transaction: Transaction;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { wid, open } = useFinance();
  const history = useQuery({
    queryKey: ['finance', wid, 'history', t.id],
    queryFn: () => api<any[]>(`/workspaces/${wid}/transactions/${t.id}/history`),
  });
  return (
    <Modal title="Detalhes da movimentação" onClose={onClose}>
      <h3>{t.description}</h3>
      <div className="detail-amount">{money(t.amountCents)}</div>
      <dl className="detail-list">
        <div>
          <dt>Data</dt>
          <dd>{dateLabel(t.date)}</dd>
        </div>
        <div>
          <dt>Conta</dt>
          <dd>{t.accountName}</dd>
        </div>
        {t.destinationName && (
          <div>
            <dt>Destino</dt>
            <dd>{t.destinationName}</dd>
          </div>
        )}
        <div>
          <dt>Categoria</dt>
          <dd>{t.categoryName || 'Sem categoria'}</dd>
        </div>
        <div>
          <dt>Observações</dt>
          <dd>{t.notes || '—'}</dd>
        </div>
      </dl>
      {t.refundOf && <p className="form-description">Reembolso vinculado à despesa {t.refundOf}</p>}
      {t.sourceType ? (
        <p className="form-description">
          Registro gerenciado pelo módulo de origem; edição direta bloqueada.
        </p>
      ) : (
        <div className="detail-actions">
          <Button onClick={onEdit}>Editar registro</Button>
          <Button secondary onClick={onCancel}>
            Cancelar movimentação
          </Button>
          {t.kind === 'expense' && (
            <Button
              secondary
              onClick={() => {
                open('refund', t);
                onClose();
              }}
            >
              Registrar reembolso
            </Button>
          )}
        </div>
      )}
      <h3 className="history-title">Histórico de alterações</h3>
      <ErrorBox error={history.error} />
      <ul className="history-list">
        {history.data?.map((h, i) => (
          <li key={i}>
            <span>
              {h.action === 'transaction.create'
                ? 'Registro criado'
                : h.action === 'transaction.update'
                  ? 'Registro atualizado'
                  : 'Registro cancelado'}
            </span>
            <time>{new Date(h.createdAt).toLocaleString('pt-BR')}</time>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
