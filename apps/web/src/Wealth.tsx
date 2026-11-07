import { money, parseMoney } from '@clara/shared/money';
import type { Debt, Holding } from '@clara/shared/planning';
import { useQuery } from '@tanstack/react-query';
import { Landmark, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, post } from './api';
import { useFinance } from './finance-context';
import { today } from './FinanceForms';
import { Button, Empty, ErrorBox, Field, Form, Modal } from './ui';
const decimal = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, useGrouping: false }).format(v / 100);
type NetWorth = {
  accountCents: number;
  holdingCents: number;
  debtCents: number;
  cardNetCents: number;
  netWorthCents: number;
};
export function Wealth() {
  const { wid, accounts, refresh } = useFinance();
  const base = `/workspaces/${wid}`;
  const debts = useQuery({
      queryKey: ['finance', wid, 'debts'],
      queryFn: () => api<Debt[]>(base + '/debts'),
    }),
    holdings = useQuery({
      queryKey: ['finance', wid, 'holdings'],
      queryFn: () => api<Holding[]>(base + '/holdings'),
    }),
    net = useQuery({
      queryKey: ['finance', wid, 'net-worth'],
      queryFn: () => api<NetWorth>(base + '/net-worth'),
    });
  const [modal, setModal] = useState<'debt' | 'payment' | 'holding' | 'valuation' | null>(null),
    [debt, setDebt] = useState<Debt>(),
    [holding, setHolding] = useState<Holding>(),
    [history, setHistory] = useState<{ kind: 'debt' | 'holding'; id: string; name: string }>();
  return (
    <>
      <div className="report-note">
        <Landmark size={20} />
        <span>
          Acompanhamento manual. Valores de bens e investimentos são informados por você, sem
          cotações de mercado ou movimentações bancárias automáticas.
        </span>
      </div>
      <ErrorBox error={net.error} />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Patrimônio líquido estimado</h2>
            <p>Contas sem vínculo + bens e investimentos − dívidas − posição líquida de cartões.</p>
          </div>
          <strong>{net.data ? money(net.data.netWorthCents) : '—'}</strong>
        </div>
        <div className="comparison-grid">
          {net.data &&
            [
              ['Contas sem investimento vinculado', net.data.accountCents],
              ['Bens e investimentos manuais', net.data.holdingCents],
              ['Dívidas pendentes', net.data.debtCents],
              ['Cartões (dívida menos créditos)', net.data.cardNetCents],
            ].map(([name, value]) => (
              <div key={String(name)}>
                <span>{name}</span>
                <strong>{money(Number(value))}</strong>
              </div>
            ))}
        </div>
        <p className="panel-footnote">
          Quando um investimento está vinculado a uma conta, sua avaliação substitui essa conta
          apenas no patrimônio estimado, evitando dupla contagem. O saldo bancário do dashboard
          permanece inalterado.
        </p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Dívidas</h2>
            <p>Principal pendente e pagamentos efetivamente registrados.</p>
          </div>
          <Button secondary onClick={() => setModal('debt')}>
            <Plus size={15} />
            Nova dívida
          </Button>
        </div>
        <ErrorBox error={debts.error} />
        <div className="planning-grid">
          {debts.data?.map((d) => (
            <article className="planning-card" key={d.id}>
              <h3>{d.creditor}</h3>
              <div className="progress-label">
                <strong>{money(d.outstandingCents)}</strong>
                <small>de {money(d.principalCents)}</small>
              </div>
              <p className="muted">
                Juros informados: {decimal(d.monthlyInterestBps)}% a.m.
                <br />
                {d.dueDate ? 'Vencimento: ' + d.dueDate : 'Sem prazo informado'}
              </p>
              <div className="detail-actions">
                <Button
                  secondary
                  disabled={d.outstandingCents === 0}
                  onClick={() => {
                    setDebt(d);
                    setModal('payment');
                  }}
                >
                  Registrar pagamento
                </Button>
                <Button
                  secondary
                  onClick={() => setHistory({ kind: 'debt', id: d.id, name: d.creditor })}
                >
                  Histórico de pagamentos
                </Button>
              </div>
            </article>
          ))}
        </div>
        {!debts.data?.length && !debts.error && (
          <Empty
            title="Cada dívida, um plano"
            description="Registre credor, principal e prazo para acompanhar os pagamentos."
          />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Bens e investimentos</h2>
            <p>Posições e avaliações manuais, com histórico.</p>
          </div>
          <Button secondary onClick={() => setModal('holding')}>
            <Plus size={15} />
            Adicionar bem ou investimento
          </Button>
        </div>
        <ErrorBox error={holdings.error} />
        <div className="planning-grid">
          {holdings.data?.map((h) => (
            <article className="planning-card" key={h.id}>
              <span className="badge">
                {h.kind === 'investment' ? 'Investimento' : 'Bem'} · {h.subtype}
              </span>
              <h3>{h.name}</h3>
              <div className="progress-label">
                <strong>{money(h.valueCents)}</strong>
                <small>Informado em {h.valuationDate}</small>
              </div>
              <p className="muted">
                Quantidade: {h.quantity}
                <br />
                Aplicado: {money(h.appliedCents)}
                {h.kind === 'investment'
                  ? ` · Variação estimada: ${money(h.valueCents - h.appliedCents)}`
                  : ''}
                <br />
                {h.linkedAccountId
                  ? 'Vinculado a conta · sem dupla contagem no patrimônio'
                  : 'Registro manual independente'}
              </p>
              <div className="detail-actions">
                <Button
                  secondary
                  onClick={() => {
                    setHolding(h);
                    setModal('valuation');
                  }}
                >
                  Atualizar avaliação
                </Button>
                <Button
                  secondary
                  onClick={() => setHistory({ kind: 'holding', id: h.id, name: h.name })}
                >
                  Histórico de avaliações
                </Button>
              </div>
            </article>
          ))}
        </div>
        {!holdings.data?.length && !holdings.error && (
          <Empty
            title="Uma visão do que você constrói"
            description="Informe seus bens e investimentos para acompanhar o patrimônio."
          />
        )}
      </section>
      {modal && (
        <WealthForm
          key={`${modal}-${debt?.id}-${holding?.id}`}
          mode={modal}
          base={base}
          debt={debt}
          holding={holding}
          accounts={accounts.filter((a) => !a.archivedAt)}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void refresh();
          }}
        />
      )}
      {history && (
        <WealthHistory
          base={base}
          history={history}
          onClose={() => setHistory(undefined)}
          onUpdated={() => void refresh()}
        />
      )}
    </>
  );
}
function WealthForm({
  mode,
  base,
  debt,
  holding,
  accounts,
  onClose,
  onSaved,
}: {
  mode: 'debt' | 'payment' | 'holding' | 'valuation';
  base: string;
  debt?: Debt;
  holding?: Holding;
  accounts: { id: string; name: string; type: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const key = useRef(crypto.randomUUID()),
    [kind, setKind] = useState('asset');
  return (
    <Modal
      title={
        {
          debt: 'Nova dívida',
          payment: 'Registrar pagamento de dívida',
          holding: 'Novo bem ou investimento',
          valuation: 'Atualizar avaliação manual',
        }[mode]
      }
      onClose={onClose}
    >
      <Form
        onSuccess={onSaved}
        onSave={(d) => {
          const v = (name: string) => String(d.get(name) || '');
          if (mode === 'debt')
            return post(base + '/debts', {
              creditor: v('creditor'),
              principalCents: parseMoney(v('principal')),
              monthlyInterestBps: parseMoney(v('rate')),
              date: v('date'),
              dueDate: v('dueDate') || null,
            });
          if (mode === 'payment')
            return post(
              base + `/debts/${debt!.id}/payments`,
              {
                principalCents: parseMoney(v('principal')),
                interestCents: parseMoney(v('interest')),
                date: v('date'),
                accountId: v('accountId'),
              },
              { 'Idempotency-Key': key.current },
            );
          if (mode === 'valuation')
            return post(base + `/holdings/${holding!.id}/valuations`, {
              valueCents: parseMoney(v('value')),
              date: v('date'),
            });
          return post(base + '/holdings', {
            name: v('name'),
            kind,
            subtype: v('subtype'),
            quantity: v('quantity').replace(',', '.'),
            appliedCents: parseMoney(v('applied')),
            valueCents: parseMoney(v('value')),
            date: v('date'),
            linkedAccountId: kind === 'investment' ? v('linkedAccountId') || null : null,
          });
        }}
      >
        {mode === 'debt' && (
          <>
            <Field label="Credor">
              <input name="creditor" required minLength={2} maxLength={100} />
            </Field>
            <Field label="Principal da dívida (R$)">
              <input name="principal" inputMode="decimal" required />
            </Field>
            <Field
              label="Taxa mensal informada (%)"
              hint="Até duas casas decimais. Informativa; os juros pagos são registrados manualmente."
            >
              <input name="rate" inputMode="decimal" defaultValue="0,00" required />
            </Field>
            <Field label="Data da dívida">
              <input name="date" type="date" defaultValue={today()} required />
            </Field>
            <Field label="Vencimento da dívida (opcional)">
              <input name="dueDate" type="date" />
            </Field>
            <p className="form-description">
              O cadastro acompanha o principal; não gera receita ou movimentação na conta. Juros
              futuros e renegociações não são calculados automaticamente.
            </p>
          </>
        )}
        {mode === 'payment' && (
          <>
            <p>
              {debt?.creditor} · principal pendente {money(debt!.outstandingCents)}
            </p>
            <Field label="Amortização do principal (R$)">
              <input
                name="principal"
                inputMode="decimal"
                defaultValue={decimal(debt!.outstandingCents)}
                required
              />
            </Field>
            <Field label="Juros pagos (R$)">
              <input name="interest" inputMode="decimal" defaultValue="0,00" required />
            </Field>
            <Field label="Data do pagamento">
              <input name="date" type="date" defaultValue={today()} required />
            </Field>
            <Field label="Conta do pagamento">
              <select name="accountId" defaultValue="" required>
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
            <p className="form-description">
              Gera uma saída de caixa com principal + juros. Apenas a amortização reduz o principal
              da dívida. Não realiza pagamento bancário.
            </p>
          </>
        )}
        {mode === 'holding' && (
          <>
            <Field label="Nome do bem ou investimento">
              <input name="name" required minLength={2} maxLength={100} />
            </Field>
            <Field label="Tipo de patrimônio">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="asset">Bem</option>
                <option value="investment">Investimento manual</option>
              </select>
            </Field>
            <Field label="Classificação">
              <input
                name="subtype"
                placeholder="Ex.: Imóvel, renda fixa, ações"
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field label="Quantidade" hint="Até oito casas decimais. Ex.: 1 ou 1,5.">
              <input name="quantity" inputMode="decimal" defaultValue="1" required />
            </Field>
            <Field label="Valor aplicado total (R$)">
              <input name="applied" inputMode="decimal" defaultValue="0,00" required />
            </Field>
            {kind === 'investment' && (
              <Field
                label="Conta de investimento já cadastrada (opcional)"
                hint="Vincule se esta posição já estiver representada em uma conta, para evitar dupla contagem."
              >
                <select name="linkedAccountId">
                  <option value="">Sem vínculo</option>
                  {accounts
                    .filter((a) => a.type === 'investment')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
          </>
        )}
        {(mode === 'holding' || mode === 'valuation') && (
          <>
            <Field label="Valor atual total informado (R$)">
              <input
                name="value"
                inputMode="decimal"
                defaultValue={holding ? decimal(holding.valueCents) : ''}
                required
              />
            </Field>
            <Field label="Data da avaliação">
              <input name="date" type="date" defaultValue={today()} required />
            </Field>
            <p className="form-description">
              Informe o valor total da posição, não o preço unitário. A avaliação não altera saldos
              bancários. Não consultamos cotações externas.
            </p>
          </>
        )}
      </Form>
    </Modal>
  );
}
function WealthHistory({
  base,
  history,
  onClose,
  onUpdated,
}: {
  base: string;
  history: { kind: 'debt' | 'holding'; id: string; name: string };
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { wid } = useFinance(),
    [page, setPage] = useState(1),
    [cancel, setCancel] = useState<string>();
  const query = useQuery({
    queryKey: ['finance', wid, 'wealth-history', history.kind, history.id, page],
    queryFn: () =>
      api<{
        items: {
          id: string;
          date: string;
          principalCents?: number;
          interestCents?: number;
          valueCents?: number;
          voidedAt?: string | null;
        }[];
        total: number;
      }>(
        base +
          `/${history.kind === 'debt' ? 'debts' : 'holdings'}/${history.id}/${history.kind === 'debt' ? 'payments' : 'valuations'}?page=${page}`,
      ),
  });
  return (
    <Modal title={`Histórico · ${history.name}`} onClose={onClose}>
      <ErrorBox error={query.error} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>{history.kind === 'debt' ? 'Principal + juros' : 'Avaliação total'}</th>
              {history.kind === 'debt' && <th>Estado</th>}
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((i) => (
              <tr key={i.id}>
                <td>{i.date}</td>
                <td>
                  {history.kind === 'debt'
                    ? `${money(i.principalCents!)} + ${money(i.interestCents!)}`
                    : money(i.valueCents!)}
                </td>
                {history.kind === 'debt' && (
                  <td>
                    {i.voidedAt ? (
                      'Cancelado'
                    ) : (
                      <Button secondary onClick={() => setCancel(i.id)}>
                        Cancelar pagamento
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data?.total === 0 && <p className="form-description">Nenhum registro no histórico.</p>}
      <div className="pagination">
        <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <span>Página {page}</span>
        <Button
          secondary
          disabled={!query.data || page * 25 >= query.data.total}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </Button>
      </div>
      {cancel && (
        <div className="inline-confirm">
          <p>Cancelar este pagamento e reverter sua saída de caixa?</p>
          <Form
            submit="Confirmar cancelamento"
            onSave={() => post(base + `/debts/${history.id}/payments/${cancel}/void`, {})}
            onSuccess={() => {
              setCancel(undefined);
              void query.refetch();
              onUpdated();
            }}
          >
            <Button secondary type="button" onClick={() => setCancel(undefined)}>
              Manter pagamento
            </Button>
          </Form>
        </div>
      )}
    </Modal>
  );
}
