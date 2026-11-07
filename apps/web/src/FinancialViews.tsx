import type { Account, Category, Summary } from '@clara/shared';
import { money } from '@clara/shared/money';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Plus,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from './api';
import { AccountStatement, EntityEditor } from './CoreViews';
import { useFinance } from './finance-context';
import { Transactions } from './Transactions';
import { Button, Empty, ErrorBox } from './ui';
export function useSummary() {
  const { wid, from, to } = useFinance();
  return useQuery({
    queryKey: ['finance', wid, 'summary', from, to],
    queryFn: () => api<Summary>(`/workspaces/${wid}/summary?from=${from}&to=${to}`),
  });
}
export function StatCards({ summary }: { summary?: Summary }) {
  return (
    <div className="stats-grid">
      {[
        {
          title: 'Saldo disponível',
          value: summary?.balanceCents,
          icon: Wallet,
          className: 'balance',
          caption: 'Todas as contas · todos os registros',
        },
        {
          title: 'Entradas do período',
          value: summary?.incomeCents,
          icon: ArrowDownLeft,
          className: 'income',
          caption: 'Receitas confirmadas',
        },
        {
          title: 'Saídas do período',
          value: summary?.expenseCents,
          icon: ArrowUpRight,
          className: 'expense',
          caption: 'Despesas menos reembolsos',
        },
        {
          title: 'Resultado de caixa',
          value: summary?.resultCents,
          icon: ChartNoAxesCombined,
          className: 'result',
          caption: 'Entradas menos saídas · não é lucro',
        },
      ].map(({ title, value, icon: Icon, className, caption }) => (
        <Link
          to={`/app/movimentacoes${className === 'income' ? '?kind=income' : className === 'expense' ? '?kind=expense' : ''}`}
          className={`stat-card ${className}`}
          key={title}
        >
          <div className="stat-title">
            {title}
            <span className="stat-icon">
              <Icon size={18} />
            </span>
          </div>
          <strong>{value === undefined ? '—' : money(value)}</strong>
          <small>{caption}</small>
        </Link>
      ))}
    </div>
  );
}
export function FlowChart({ summary }: { summary?: Summary }) {
  const data = summary?.monthly || [];
  return (
    <section className="panel flow-panel">
      <div className="panel-heading">
        <div>
          <h2>Seu fluxo financeiro</h2>
          <p>Entradas e saídas no período selecionado</p>
        </div>
        <div className="chart-legend">
          <span>
            <i className="dot green-bg" /> Entradas
          </span>
          <span>
            <i className="dot blue-bg" /> Saídas
          </span>
        </div>
      </div>
      {data.length ? (
        <div
          className="chart"
          role="img"
          aria-label={`Entradas ${money(summary!.incomeCents)} e saídas ${money(summary!.expenseCents)} no período`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 5 }}>
              <defs>
                <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.23} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="4 5" stroke="var(--line)" />
              <XAxis
                dataKey="month"
                tickFormatter={(v) =>
                  new Date(v + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'short' })
                }
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#5d6d65', fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v / 100)
                }
                tick={{ fill: '#5d6d65', fontSize: 11 }}
                width={50}
              />
              <Tooltip
                formatter={(v: any) => money(Number(v))}
                labelFormatter={(l) => String(l)}
                contentStyle={{ borderRadius: 12, border: '1px solid #dce4e9', color: '#0f172a' }}
              />
              <Area
                isAnimationActive={false}
                name="Entradas"
                type="monotone"
                dataKey="incomeCents"
                stroke="#10b981"
                strokeWidth={3}
                fill="url(#incomeFill)"
                dot={{ r: 5 }}
              />
              <Area
                isAnimationActive={false}
                name="Saídas"
                type="monotone"
                dataKey="expenseCents"
                stroke="#6689c4"
                strokeWidth={2}
                fill="transparent"
                dot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty
          title="Sua história começa no primeiro registro"
          description="Adicione uma receita ou despesa para acompanhar o fluxo financeiro."
        />
      )}
    </section>
  );
}
export function CategoryChart({ summary }: { summary?: Summary }) {
  const data = summary?.categories || [];
  return (
    <section className="panel category-panel">
      <div className="panel-heading">
        <div>
          <h2>Para onde vai?</h2>
          <p>Despesas brutas por categoria · antes de reembolsos</p>
        </div>
        <span className="round-icon subtle">
          <ChartNoAxesCombined size={17} />
        </span>
      </div>
      {data.length ? (
        <>
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={data}
                  dataKey="amountCents"
                  innerRadius={65}
                  outerRadius={84}
                  paddingAngle={3}
                  stroke="none"
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => money(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-label">
              <small>Despesas brutas</small>
              <strong>{money(summary!.grossExpenseCents)}</strong>
            </div>
          </div>
          <div className="category-legend">
            {data.map((d) => (
              <div key={d.name}>
                <span>
                  <i className="dot" style={{ background: d.color }} />
                  {d.name}
                </span>
                <strong>{money(d.amountCents)}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty
          title="Tudo pronto para organizar"
          description="Categorize suas despesas para descobrir o que mais pesa no orçamento."
        />
      )}
    </section>
  );
}
export function Overview() {
  const { accounts, open } = useFinance();
  const summary = useSummary();
  return (
    <>
      <ErrorBox error={summary.error} />
      <StatCards summary={summary.data} />
      {summary.data && (
        <section className="panel comparison-panel">
          <div className="panel-heading">
            <div>
              <h2>Comparação com o período anterior</h2>
              <p>
                {summary.data.previous.from} a {summary.data.previous.to} · reembolsos no período:{' '}
                {money(summary.data.refundCents)}
              </p>
            </div>
          </div>
          <div className="comparison-grid">
            {[
              ['Entradas', summary.data.change.incomeCents, summary.data.previous.incomeCents],
              [
                'Saídas líquidas',
                summary.data.change.expenseCents,
                summary.data.previous.expenseCents,
              ],
              [
                'Resultado de caixa',
                summary.data.change.resultCents,
                summary.data.previous.resultCents,
              ],
            ].map(([label, current, old]) => (
              <div key={String(label)}>
                <strong>{label}</strong>
                <span>Anterior: {money(Number(old))}</span>
                <span>Variação: {money(Number(current))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!accounts.length && (
        <div className="welcome-banner">
          <span className="round-icon mint">
            <Wallet size={23} />
          </span>
          <div>
            <strong>Vamos dar o primeiro passo?</strong>
            <p>
              Adicione sua primeira conta e informe o saldo inicial. O resto começa a fazer sentido.
            </p>
          </div>
          <Button onClick={() => open('account')}>
            Adicionar minha conta <ArrowRight size={17} />
          </Button>
        </div>
      )}
      <div className="charts-grid">
        <FlowChart summary={summary.data} />
        <CategoryChart summary={summary.data} />
      </div>
      <div className="lower-grid">
        <Transactions compact />
        <section className="panel accounts-overview">
          <div className="panel-heading">
            <div>
              <h2>Suas contas</h2>
              <p>Um lugar para cada saldo</p>
            </div>
            <Link to="/app/contas" className="icon-button" aria-label="Ver todas as contas">
              <ArrowUpRight size={20} />
            </Link>
          </div>
          {accounts.length ? (
            accounts.slice(0, 4).map((a, i) => (
              <div className="account-line" key={a.id}>
                <span className={`account-icon color-${i % 3}`}>
                  <Wallet size={20} />
                </span>
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    {accountTypes[a.type]}
                    {a.archivedAt ? ' · Arquivada' : ''}
                  </small>
                </div>
                <strong>{money(a.balanceCents)}</strong>
              </div>
            ))
          ) : (
            <Empty title="Espaço para seus saldos" description="Cadastre uma conta para começar." />
          )}
          <button className="add-account-link" onClick={() => open('account')}>
            <Plus size={16} /> Adicionar conta
          </button>
        </section>
      </div>
    </>
  );
}
const accountTypes: Record<string, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Dinheiro / caixa',
  wallet: 'Carteira digital',
  investment: 'Investimento manual',
};
export function Accounts() {
  const { accounts, categories, open } = useFinance();
  const [editing, setEditing] = useState<{ account?: Account; category?: Category }>(),
    [statement, setStatement] = useState<Account>();
  return (
    <>
      <div className="accounts-grid">
        {accounts.map((a, i) => (
          <article className="panel account-card" key={a.id}>
            <span className={`account-icon color-${i % 3}`}>
              <Wallet size={24} />
            </span>
            <small>
              {accountTypes[a.type]}
              {a.archivedAt ? ' · Arquivada' : ''}
            </small>
            <h2>{a.name}</h2>
            <strong>{money(a.balanceCents)}</strong>
            <div className="detail-actions">
              <Button secondary onClick={() => setEditing({ account: a })}>
                Editar conta
              </Button>
              <Button secondary onClick={() => setStatement(a)}>
                Extrato
              </Button>
            </div>
            <Link to={'/app/movimentacoes?accountId=' + a.id}>
              Consultar movimentações <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
        {!accounts.length && (
          <div className="panel">
            <Empty
              title="Seu dinheiro começa a se organizar aqui"
              description="Cadastre sua conta corrente, carteira ou dinheiro em espécie."
              action={
                <Button onClick={() => open('account')}>
                  <Plus size={16} /> Adicionar conta
                </Button>
              }
            />
          </div>
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Suas categorias</h2>
            <p>Mais contexto para cada movimentação</p>
          </div>
          <Button secondary onClick={() => open('category')}>
            <Plus size={16} /> Nova categoria
          </Button>
        </div>
        <div className="category-chips">
          {categories.map((c) => (
            <span key={c.id}>
              <i className="dot" style={{ background: c.color }} />
              {c.name}
              <small>
                {c.parentId ? 'Subcategoria · ' : ''}
                {c.kind === 'expense' ? 'Despesa' : 'Receita'}
                {c.archivedAt ? ' · Arquivada' : ''}
              </small>
              <button
                className="text-button"
                aria-label={`Editar categoria ${c.name}`}
                onClick={() => setEditing({ category: c })}
              >
                Editar
              </button>
            </span>
          ))}
          {!categories.length && (
            <p className="muted">
              Crie categorias de receita e despesa para organizar seus registros.
            </p>
          )}
        </div>
      </section>
      {editing && <EntityEditor {...editing} onClose={() => setEditing(undefined)} />}
      {statement && (
        <AccountStatement account={statement} onClose={() => setStatement(undefined)} />
      )}
    </>
  );
}
