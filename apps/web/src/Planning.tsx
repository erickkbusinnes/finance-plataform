import type { Budget, Goal } from '@clara/shared';
import { money } from '@clara/shared/money';
import { useQuery } from '@tanstack/react-query';
import { Download, Plus, ShieldCheck, Target } from 'lucide-react';
import { api, apiBase } from './api';
import { dateLabel } from './dates';
import { useFinance } from './finance-context';
import { CategoryChart, FlowChart, StatCards, useSummary } from './FinancialViews';
import { Button, Empty, ErrorBox } from './ui';
export function Planning() {
  const { wid, month, categories, open } = useFinance();
  const budgets = useQuery({
      queryKey: ['finance', wid, 'budgets', month],
      queryFn: () => api<Budget[]>(`/workspaces/${wid}/budgets?month=${month}`),
    }),
    goals = useQuery({
      queryKey: ['finance', wid, 'goals'],
      queryFn: () => api<Goal[]>(`/workspaces/${wid}/goals`),
    });
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Orçamento do mês</h2>
            <p>Mais intenção em cada escolha</p>
          </div>
          <Button
            secondary
            onClick={() => open('budget')}
            disabled={!categories.some((c) => c.kind === 'expense')}
          >
            <Plus size={16} /> Definir limite
          </Button>
        </div>
        <ErrorBox error={budgets.error} />
        <div className="planning-grid">
          {budgets.data?.map((b) => {
            const pct = Math.round((b.spentCents / b.limitCents) * 100);
            return (
              <article className="planning-card" key={b.id}>
                <h3>{b.categoryName}</h3>
                <div className="progress-label">
                  <strong>{money(b.spentCents)}</strong>
                  <small>de {money(b.limitCents)}</small>
                </div>
                <progress
                  aria-label={`Orçamento de ${b.categoryName}`}
                  max={b.limitCents}
                  value={Math.min(b.spentCents, b.limitCents)}
                  className={pct >= 100 ? 'over-budget' : ''}
                />
                <small className={pct > 100 ? 'red' : 'muted'}>
                  {pct}% utilizado {pct > 100 ? '· Limite ultrapassado' : ''}
                </small>
              </article>
            );
          })}
        </div>
        {!budgets.data?.length && !budgets.error && (
          <Empty
            title="Seu mês com mais intenção"
            description="Crie uma categoria de despesa em Contas e carteiras e defina um limite para acompanhar seus gastos."
          />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Seus próximos capítulos</h2>
            <p>Metas que dão direção ao seu dinheiro</p>
          </div>
          <Button secondary onClick={() => open('goal')}>
            <Plus size={16} /> Nova meta
          </Button>
        </div>
        <ErrorBox error={goals.error} />
        <div className="planning-grid">
          {goals.data?.map((g) => (
            <article className="planning-card goal-card" key={g.id}>
              <span className="round-icon mint">
                <Target size={21} />
              </span>
              <h3>{g.name}</h3>
              <div className="progress-label">
                <strong>{money(g.contributedCents)}</strong>
                <small>de {money(g.targetCents)}</small>
              </div>
              <progress
                aria-label={`Progresso de ${g.name}`}
                max={g.targetCents}
                value={Math.min(g.contributedCents, g.targetCents)}
              />
              <small className="muted">
                {Math.round((g.contributedCents / g.targetCents) * 100)}% acompanhado{' '}
                {g.dueDate ? '· Até ' + dateLabel(g.dueDate) : ''}
              </small>
              <Button secondary onClick={() => open('contribution', undefined, g)}>
                Registrar progresso <Plus size={15} />
              </Button>
            </article>
          ))}
        </div>
        {!goals.data?.length && !goals.error && (
          <Empty
            title="O que você quer realizar?"
            description="Uma reserva, uma viagem ou o próximo passo da empresa. Crie sua primeira meta."
          />
        )}
        <p className="panel-footnote">
          O progresso de metas é um acompanhamento manual. Ele não altera saldos nem reserva
          dinheiro nas contas.
        </p>
      </section>
    </>
  );
}
export function Reports() {
  const summary = useSummary();
  const { wid, from, to } = useFinance();
  return (
    <>
      <div className="report-note">
        <ShieldCheck size={20} />
        <span>
          Relatório gerencial de caixa. Não é um demonstrativo contábil oficial. Transferências e
          saldos iniciais não compõem receitas ou despesas.
        </span>
      </div>
      <ErrorBox error={summary.error} />
      <StatCards summary={summary.data} />
      <div className="charts-grid">
        <FlowChart summary={summary.data} />
        <CategoryChart summary={summary.data} />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Seus dados também são seus</h2>
            <p>Exporte o período selecionado para consultar em uma planilha.</p>
          </div>
          <a
            className="button secondary"
            href={`${apiBase}/workspaces/${wid}/export.csv?from=${from}&to=${to}`}
            download
          >
            <Download size={17} /> Baixar CSV
          </a>
        </div>
      </section>
    </>
  );
}
