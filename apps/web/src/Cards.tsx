import { money, parseMoney } from '@clara/shared/money';
import type { CardPurchase, CardStatement, CreditCard } from '@clara/shared/planning';
import { useQuery } from '@tanstack/react-query';
import { CreditCard as CardIcon, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, post } from './api';
import { useFinance } from './finance-context';
import { today } from './FinanceForms';
import { Button, Empty, ErrorBox, Field, Form, Modal } from './ui';
const decimal = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, useGrouping: false }).format(v / 100);
export function Cards() {
  const { wid, accounts, categories, refresh } = useFinance();
  const cards = useQuery({
    queryKey: ['finance', wid, 'cards'],
    queryFn: () => api<CreditCard[]>(`/workspaces/${wid}/cards`),
  });
  const [selected, setSelected] = useState(''),
    [modal, setModal] = useState<'card' | 'purchase' | 'refund' | 'settle' | 'reopen' | null>(null),
    [editing, setEditing] = useState<CreditCard>(),
    [purchase, setPurchase] = useState<CardPurchase>(),
    [statement, setStatement] = useState<CardStatement>(),
    [details, setDetails] = useState<CardStatement>(),
    [page, setPage] = useState(1);
  const card = cards.data?.find((c) => c.id === selected) || cards.data?.[0];
  const base = `/workspaces/${wid}/cards/${card?.id}`;
  const statements = useQuery({
    queryKey: ['finance', wid, 'statements', card?.id],
    queryFn: () => api<CardStatement[]>(base + '/statements'),
    enabled: !!card,
  });
  const purchases = useQuery({
    queryKey: ['finance', wid, 'purchases', card?.id, page],
    queryFn: () => api<{ items: CardPurchase[]; total: number }>(base + `/purchases?page=${page}`),
    enabled: !!card,
  });
  const close = () => {
    setModal(null);
    void refresh();
  };
  return (
    <>
      <div className="report-note">
        <CardIcon size={20} />
        <span>
          Compras e parcelas são compromissos. No regime de caixa, a despesa aparece somente ao
          liquidar a fatura. Estornos viram crédito no cartão; não criam receita na conta.
        </span>
      </div>
      <div className="section-actions">
        <Button
          onClick={() => {
            setEditing(undefined);
            setModal('card');
          }}
        >
          <Plus size={16} />
          Novo cartão
        </Button>
      </div>
      <ErrorBox error={cards.error} />
      <div className="accounts-grid">
        {cards.data?.map((c) => (
          <article
            key={c.id}
            className={`panel account-card ${card?.id === c.id ? 'selected-card' : ''}`}
          >
            <CardIcon size={25} />
            <h2>{c.name}</h2>
            <small>
              {c.archivedAt ? 'Arquivado · ' : ''}Limite: {money(c.limitCents)}
            </small>
            <strong>{money(c.availableCents)}</strong>
            <small>Disponível · comprometido: {money(c.usedCents)}</small>
            <p className="muted">
              Fecha dia {c.closingDay} · vence dia {c.dueDay}
              <br />
              Crédito já compensado: {money(c.creditCents)}
            </p>
            <div className="detail-actions">
              <Button
                secondary
                onClick={() => {
                  setSelected(c.id);
                  setPage(1);
                }}
              >
                Ver faturas de {c.name}
              </Button>
              <Button
                secondary
                onClick={() => {
                  setEditing(c);
                  setModal('card');
                }}
              >
                Editar cartão
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!cards.data?.length && !cards.error && (
        <section className="panel">
          <Empty
            title="Cada compra, no seu tempo"
            description="Cadastre um cartão pelo nome, limite e ciclo. Não solicitamos número do cartão nem dados bancários."
          />
        </section>
      )}
      {card && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Faturas · {card.name}</h2>
                <p>
                  Parcelas distribuídas com precisão de centavos. Liquidação integral em ordem de
                  vencimento.
                </p>
              </div>
              <Button secondary disabled={!!card.archivedAt} onClick={() => setModal('purchase')}>
                Registrar compra
              </Button>
            </div>
            <ErrorBox error={statements.error} />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fechamento</th>
                    <th>Vencimento</th>
                    <th>Total da fatura</th>
                    <th>Estado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.data?.map((s) => (
                    <tr key={s.id}>
                      <td>{s.closingDate}</td>
                      <td>{s.dueDate}</td>
                      <td>{money(s.totalCents)}</td>
                      <td>
                        {s.settledAt ? `Liquidada · saída ${money(s.paidCents)}` : 'Em aberto'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Button secondary onClick={() => setDetails(s)}>
                            Detalhes da fatura {s.dueDate}
                          </Button>
                          <Button
                            secondary
                            onClick={() => {
                              setStatement(s);
                              setModal(s.settledAt ? 'reopen' : 'settle');
                            }}
                          >
                            {s.settledAt ? 'Reabrir' : 'Liquidar'} {s.dueDate}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!statements.data?.length && !statements.error && (
              <Empty
                title="Nenhuma fatura por aqui"
                description="As faturas serão criadas a partir das suas compras e parcelas."
              />
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Compras e estornos</h2>
                <p>Compra original, parcelas e créditos preservados no histórico.</p>
              </div>
            </div>
            <ErrorBox error={purchases.error} />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Descrição / data</th>
                    <th>Compra</th>
                    <th>Parcelas</th>
                    <th>Estornado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.data?.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.description}
                        <small className="table-sub">
                          {p.date} · {p.categoryName || 'Sem categoria'}
                        </small>
                      </td>
                      <td>{money(p.amountCents)}</td>
                      <td>{p.installments}x</td>
                      <td>{money(p.refundedCents)}</td>
                      <td>
                        <Button
                          secondary
                          disabled={p.refundedCents >= p.amountCents}
                          onClick={() => {
                            setPurchase(p);
                            setModal('refund');
                          }}
                        >
                          Estornar {p.description}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span>Página {page}</span>
              <Button
                secondary
                disabled={!purchases.data || page * 25 >= purchases.data.total}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </Button>
            </div>
          </section>
        </>
      )}
      {modal && (
        <CardForm
          key={`${modal}-${editing?.id || card?.id}-${purchase?.id}-${statement?.id}`}
          mode={modal}
          card={card}
          editing={editing}
          purchase={purchase}
          statement={statement}
          base={base}
          accounts={accounts.filter((a) => !a.archivedAt)}
          categories={categories.filter((c) => !c.archivedAt && c.kind === 'expense')}
          wid={wid}
          onClose={() => setModal(null)}
          onSaved={close}
        />
      )}
      {details && card && (
        <StatementDetails
          wid={wid}
          cardId={card.id}
          statement={details}
          onClose={() => setDetails(undefined)}
        />
      )}
    </>
  );
}
function CardForm({
  mode,
  card,
  editing,
  purchase,
  statement,
  base,
  accounts,
  categories,
  wid,
  onClose,
  onSaved,
}: {
  mode: 'card' | 'purchase' | 'refund' | 'settle' | 'reopen';
  card?: CreditCard;
  editing?: CreditCard;
  purchase?: CardPurchase;
  statement?: CardStatement;
  base: string;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  wid: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const key = useRef(crypto.randomUUID());
  const expected = Math.max(0, (statement?.totalCents || 0) - (card?.creditCents || 0));
  return (
    <Modal
      title={
        {
          card: editing ? 'Editar cartão' : 'Novo cartão',
          purchase: 'Registrar compra no cartão',
          refund: 'Registrar estorno',
          settle: 'Liquidar fatura',
          reopen: 'Reabrir fatura',
        }[mode]
      }
      onClose={onClose}
    >
      <Form
        submit={mode === 'reopen' ? 'Confirmar reabertura' : 'Salvar'}
        onSuccess={onSaved}
        onSave={async (d) => {
          const v = (n: string) => String(d.get(n) || '');
          if (mode === 'card') {
            const b = {
              name: v('name'),
              limitCents: parseMoney(v('limit')),
              closingDay: Number(v('closing')),
              dueDay: Number(v('due')),
            };
            return editing
              ? api(`/workspaces/${wid}/cards/${editing.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    ...b,
                    version: editing.version,
                    archived: d.get('archived') === 'on',
                  }),
                })
              : post(`/workspaces/${wid}/cards`, b);
          }
          if (mode === 'purchase')
            return post(
              base + '/purchases',
              {
                description: v('description'),
                amountCents: parseMoney(v('amount')),
                date: v('date'),
                installments: Number(v('installments')),
                categoryId: v('categoryId') || null,
              },
              { 'Idempotency-Key': key.current },
            );
          if (mode === 'refund')
            return post(
              base + `/purchases/${purchase!.id}/refunds`,
              { amountCents: parseMoney(v('amount')), date: v('date'), reason: v('reason') },
              { 'Idempotency-Key': key.current },
            );
          if (mode === 'settle')
            return post(
              base + `/statements/${statement!.id}/settle`,
              { date: v('date'), accountId: v('accountId') || null, expectedCashCents: expected },
              { 'Idempotency-Key': key.current },
            );
          return post(base + `/statements/${statement!.id}/reopen`, {});
        }}
      >
        {mode === 'card' && (
          <>
            <Field label="Nome do cartão">
              <input
                name="name"
                defaultValue={editing?.name}
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field label="Limite (R$)">
              <input
                name="limit"
                inputMode="decimal"
                defaultValue={editing ? decimal(editing.limitCents) : ''}
                required
              />
            </Field>
            <div className="form-row">
              <Field label="Dia de fechamento">
                <input
                  name="closing"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={editing?.closingDay || 25}
                  required
                />
              </Field>
              <Field label="Dia de vencimento">
                <input
                  name="due"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={editing?.dueDay || 5}
                  required
                />
              </Field>
            </div>
            {editing && (
              <label className="checkbox">
                <input name="archived" type="checkbox" defaultChecked={!!editing.archivedAt} />
                Arquivar cartão
              </label>
            )}
            <p className="form-description">
              Compras no dia do fechamento entram na fatura atual; após esse dia, na próxima. Dias
              inexistentes no mês usam o último dia. O ciclo fica fixo após a primeira compra.
            </p>
          </>
        )}
        {mode === 'purchase' && (
          <>
            <Field label="Descrição da compra">
              <input name="description" required minLength={2} maxLength={200} />
            </Field>
            <Field label="Valor total da compra (R$)">
              <input name="amount" inputMode="decimal" required />
            </Field>
            <Field label="Data da compra">
              <input name="date" type="date" defaultValue={today()} required />
            </Field>
            <Field label="Número de parcelas">
              <input
                name="installments"
                type="number"
                min={1}
                max={120}
                defaultValue={1}
                required
              />
            </Field>
            <Field label="Categoria da compra">
              <select name="categoryId">
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <p className="form-description">
              A compra compromete o limite integral. O cadastro não altera o saldo bancário. A
              classificação da compra é informativa nas faturas; o pagamento aparece no caixa como
              uma saída de fatura.
            </p>
          </>
        )}
        {mode === 'refund' && (
          <>
            <p>{purchase?.description}</p>
            <Field label="Valor do estorno (R$)">
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={decimal(purchase!.amountCents - purchase!.refundedCents)}
                required
              />
            </Field>
            <Field label="Data do estorno">
              <input name="date" type="date" defaultValue={today()} required />
            </Field>
            <Field label="Motivo do estorno">
              <input name="reason" required minLength={2} maxLength={200} />
            </Field>
            <p className="form-description">
              O crédito entra na primeira fatura não liquidada do ciclo desta data. Faturas com
              crédito negativo podem ser liquidadas sem saída bancária, carregando o crédito para as
              próximas.
            </p>
          </>
        )}
        {mode === 'settle' && (
          <>
            <p>
              Fatura com vencimento em {statement!.dueDate}. Saída a registrar:{' '}
              <strong>{money(expected)}</strong>.
            </p>
            <p className="form-description">
              Crédito já compensado: {money(card!.creditCents)}. Esta operação registra uma
              liquidação integral; não realiza pagamento bancário.
            </p>
            <Field label="Data do pagamento ou compensação">
              <input
                name="date"
                type="date"
                min={statement!.closingDate}
                defaultValue={today()}
                required
              />
            </Field>
            {expected > 0 && (
              <Field label="Conta para pagamento">
                <select name="accountId" required defaultValue="">
                  <option value="" disabled>
                    Selecione uma conta
                  </option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}
        {mode === 'reopen' && (
          <p>
            A liquidação será revertida, preservando auditoria. A saída vinculada será cancelada e
            os créditos compensados serão desfeitos. É necessário reabrir primeiro as faturas
            posteriores já liquidadas.
          </p>
        )}
      </Form>
    </Modal>
  );
}
function StatementDetails({
  wid,
  cardId,
  statement,
  onClose,
}: {
  wid: string;
  cardId: string;
  statement: CardStatement;
  onClose: () => void;
}) {
  const data = useQuery({
    queryKey: ['finance', wid, 'statement-details', statement.id],
    queryFn: () =>
      api<{
        installments: {
          id: string;
          description: string;
          purchaseDate: string;
          number: number;
          installments: number;
          amountCents: number;
        }[];
        refunds: { id: string; date: string; reason: string; amountCents: number }[];
      }>(`/workspaces/${wid}/cards/${cardId}/statements/${statement.id}`),
  });
  return (
    <Modal title={`Fatura · ${statement.dueDate}`} onClose={onClose}>
      <ErrorBox error={data.error} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Compra / data</th>
              <th>Parcela</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.data?.installments.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.description}
                  <br />
                  {i.purchaseDate}
                </td>
                <td>
                  {i.number}/{i.installments}
                </td>
                <td>{money(i.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="history-title">Créditos de estorno</h3>
      <ul className="history-list">
        {data.data?.refunds.map((r) => (
          <li key={r.id}>
            <span>
              {r.date} · {r.reason}
            </span>
            <strong>− {money(r.amountCents)}</strong>
          </li>
        ))}
      </ul>
      {data.data && !data.data.refunds.length && (
        <p className="form-description">Sem estornos nesta fatura.</p>
      )}
    </Modal>
  );
}
