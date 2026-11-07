import type { Account, Category, Goal, Transaction, User, Workspace } from '@clara/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, api, post } from './api';
import { FinanceContext } from './finance-context';
import type { ModalType } from './FinanceForms';
import { FinanceForm, today } from './FinanceForms';
import { Accounts, Overview } from './FinancialViews';
import { Planning, Reports } from './Planning';
import { Preferences } from './Preferences';
import { Transactions } from './Transactions';
import { Brand, Button, Empty, ErrorBox, Field, Form } from './ui';
const links = [
  { path: '', label: 'Visão geral', icon: LayoutDashboard },
  { path: 'movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { path: 'contas', label: 'Contas e carteiras', icon: Wallet },
  { path: 'planejamento', label: 'Planejamento', icon: Target },
  { path: 'relatorios', label: 'Relatórios', icon: ChartNoAxesCombined },
  { path: 'configuracoes', label: 'Configurações', icon: Settings },
];
function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  return {
    from: month + '-01',
    to: `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`,
  };
}
export function DashboardApp() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), retry: false });
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api<Workspace[]>('/workspaces'),
    enabled: !!me.data,
  });
  const [selected, setSelected] = useState(localStorage.getItem('clara-workspace') || ''),
    [month, setMonth] = useState(today().slice(0, 7)),
    [modal, setModal] = useState<ModalType>(null),
    [transaction, setTransaction] = useState<Transaction>(),
    [goal, setGoal] = useState<Goal>(),
    [menu, setMenu] = useState(false),
    [wsMenu, setWsMenu] = useState(false),
    [theme, setTheme] = useState(localStorage.getItem('clara-theme') || 'light');
  const [operationError, setOperationError] = useState<unknown>();
  const qc = useQueryClient(),
    navigate = useNavigate(),
    location = useLocation();
  const workspace = workspaces.data?.find((w) => w.id === selected) || workspaces.data?.[0];
  const wid = workspace?.id || '';
  const { from, to } = monthRange(month);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('clara-theme', theme);
  }, [theme]);
  useEffect(() => {
    if (wid) localStorage.setItem('clara-workspace', wid);
  }, [wid]);
  const accounts = useQuery({
    queryKey: ['finance', wid, 'accounts'],
    queryFn: () => api<Account[]>(`/workspaces/${wid}/accounts`),
    enabled: !!wid,
  });
  const categories = useQuery({
    queryKey: ['finance', wid, 'categories'],
    queryFn: () => api<Category[]>(`/workspaces/${wid}/categories`),
    enabled: !!wid,
  });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['finance', wid] });
    await qc.invalidateQueries({ queryKey: ['workspaces'] });
  };
  const open = (type: ModalType, t?: Transaction, g?: Goal) => {
    setTransaction(t);
    setGoal(g);
    setModal(type);
  };
  if (me.isPending)
    return (
      <div className="page-loading" role="status">
        O seu espaço está chegando…
      </div>
    );
  if (me.error instanceof ApiError && me.error.status === 401)
    return <Navigate to="/entrar" replace />;
  if (me.error)
    return (
      <div className="page-loading">
        <ErrorBox error={me.error} />
        <Button onClick={() => me.refetch()}>Tentar novamente</Button>
      </div>
    );
  if (workspaces.isPending) return <div className="page-loading">Preparando seus ambientes…</div>;
  if (workspaces.error)
    return (
      <div className="page-loading">
        <ErrorBox error={workspaces.error} />
        <Button onClick={() => workspaces.refetch()}>Tentar novamente</Button>
      </div>
    );
  if (!workspace)
    return (
      <main className="onboarding">
        <Brand />
        <div className="onboarding-card">
          <span className="eyebrow">VAMOS COMEÇAR COM O ESSENCIAL</span>
          <h1>
            Um espaço para
            <br />o seu dinheiro.
          </h1>
          <p>
            Escolha por onde começar. Depois você pode criar outros ambientes e alternar entre eles.
          </p>
          <Form
            submit="Criar meu ambiente"
            onSave={(d) => post('/workspaces', Object.fromEntries(d))}
            onSuccess={() => qc.invalidateQueries({ queryKey: ['workspaces'] })}
          >
            <Field label="Nome do ambiente">
              <input
                name="name"
                defaultValue="Minhas finanças"
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
            <Field label="O que você quer organizar?">
              <select name="kind">
                <option value="personal">Minha vida financeira pessoal</option>
                <option value="business">As finanças da minha empresa</option>
              </select>
            </Field>
          </Form>
          <small>
            Moeda inicial: Real brasileiro (BRL). Nenhum dado de exemplo será adicionado.
          </small>
        </div>
      </main>
    );
  const page = location.pathname.split('/')[2] || '';
  const heading = links.find((l) => l.path === page)?.label;
  return (
    <FinanceContext
      value={{
        wid,
        workspace,
        accounts: accounts.data || [],
        categories: categories.data || [],
        from,
        to,
        month,
        open,
        refresh,
      }}
    >
      <div className="app-shell">
        <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
          <Link to="/" className="sidebar-brand">
            <Brand />
          </Link>
          <button
            className="workspace-switch"
            onClick={() => setWsMenu(!wsMenu)}
            aria-expanded={wsMenu}
          >
            <span className="workspace-avatar">
              {workspace.kind === 'business' ? <Building2 size={19} /> : <UserRound size={19} />}
            </span>
            <span>
              <strong>{workspace.name}</strong>
              <small>
                {workspace.kind === 'personal' ? 'Ambiente pessoal' : 'Ambiente empresarial'}
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
          {wsMenu && (
            <div className="workspace-dropdown">
              {workspaces.data?.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setSelected(w.id);
                    setWsMenu(false);
                    setMenu(false);
                  }}
                >
                  {w.kind === 'personal' ? <UserRound size={16} /> : <Building2 size={16} />}{' '}
                  {w.name}
                  {w.id === wid ? ' ✓' : ''}
                </button>
              ))}
              <button
                onClick={() => {
                  setWsMenu(false);
                  open('workspace');
                }}
              >
                <Plus size={16} /> Criar ambiente
              </button>
            </div>
          )}
          <span className="nav-label">SEU ESPAÇO</span>
          <nav aria-label="Menu financeiro">
            {links.map(({ path, label, icon: Icon }) => (
              <NavLink
                to={'/app' + (path ? '/' + path : '')}
                end
                key={path}
                onClick={() => setMenu(false)}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={19} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-note">
            <div className="note-icon">
              <ShieldCheck size={20} />
            </div>
            <strong>Seu dinheiro, organizado.</strong>
            <p>
              Registros manuais.
              <br />
              Decisões mais conscientes.
            </p>
            <Link to="/sobre">
              Conheça a Clara <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="profile">
            <span className="user-avatar">{me.data?.name.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{me.data?.name}</strong>
              <small>Conta de desenvolvimento</small>
            </div>
            <button
              className="icon-button"
              title="Sair da conta"
              aria-label="Sair da conta"
              onClick={async () => {
                try {
                  await post('/auth/logout', {});
                  qc.clear();
                  navigate('/entrar');
                } catch (e) {
                  setOperationError(e);
                }
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>
        {menu && (
          <button
            className="sidebar-overlay"
            aria-label="Fechar menu"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="app-main">
          <header className="app-topbar">
            <div>
              <button
                className="icon-button mobile-menu"
                aria-label="Abrir menu financeiro"
                onClick={() => setMenu(!menu)}
              >
                <Menu size={22} />
              </button>
              <span className="breadcrumb">
                Meu espaço <span>/</span> <strong>{heading || 'Página'}</strong>
              </span>
            </div>
            <div>
              <span className="private-label">
                <span className="live-dot" /> Ambiente privado
              </span>
              <button
                className="icon-button"
                aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              >
                {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
              </button>
            </div>
          </header>
          <main className="dashboard-content">
            <div className="page-heading">
              <div>
                <div className="page-eyebrow">
                  {workspace.kind === 'personal'
                    ? 'SUAS FINANÇAS, COM CLAREZA'
                    : 'GESTÃO FINANCEIRA EMPRESARIAL'}
                </div>
                <h1>
                  {page === ''
                    ? `Tudo em perspectiva${me.data?.name ? ', ' + me.data.name.split(' ')[0] : ''}.`
                    : heading || 'Página não encontrada'}
                </h1>
                <p>
                  {page === ''
                    ? 'Um olhar tranquilo para o que entra, o que sai e o que vem pela frente.'
                    : {
                        movimentacoes: 'Cada registro conta uma parte da sua história.',
                        contas: 'Seu dinheiro, em cada lugar.',
                        planejamento: 'Pequenos passos. Planos maiores.',
                        relatorios: 'Transforme seus registros em perspectiva.',
                        configuracoes: 'Seu espaço, do seu jeito.',
                      }[page]}
                </p>
              </div>
              <div className="heading-actions">
                {['', 'movimentacoes', 'relatorios', 'planejamento'].includes(page) && (
                  <label className="period-picker">
                    <span className="sr-only">Período</span>
                    <input
                      type="month"
                      aria-label="Período"
                      value={month}
                      onChange={(e) => {
                        if (e.target.value) setMonth(e.target.value);
                      }}
                    />
                  </label>
                )}
                {page !== 'configuracoes' && (
                  <Button
                    onClick={() =>
                      open(
                        page === 'contas'
                          ? 'account'
                          : page === 'planejamento'
                            ? 'goal'
                            : 'transaction',
                      )
                    }
                    disabled={
                      page !== 'contas' && page !== 'planejamento' && !accounts.data?.length
                    }
                  >
                    <Plus size={17} />
                    {page === 'contas'
                      ? 'Nova conta'
                      : page === 'planejamento'
                        ? 'Nova meta'
                        : 'Nova movimentação'}
                  </Button>
                )}
              </div>
            </div>
            <ErrorBox error={operationError || accounts.error || categories.error} />
            {page === '' ? (
              <Overview />
            ) : page === 'movimentacoes' ? (
              <Transactions />
            ) : page === 'contas' ? (
              <Accounts />
            ) : page === 'planejamento' ? (
              <Planning />
            ) : page === 'relatorios' ? (
              <Reports />
            ) : page === 'configuracoes' ? (
              <Preferences user={me.data!} />
            ) : (
              <Empty title="Página não encontrada" description="Escolha uma área no menu." />
            )}
            <footer className="app-footer">
              <span>
                Clara <span className="green">/</span> Um pouco mais de clareza, todos os dias.
              </span>
              <span>Valores em BRL · Registros manuais</span>
            </footer>
          </main>
        </div>
      </div>
      {modal && (
        <FinanceForm
          key={`${modal}-${transaction?.id || goal?.id || wid}`}
          type={modal}
          wid={wid}
          accounts={accounts.data || []}
          categories={categories.data || []}
          transaction={transaction}
          goal={goal}
          month={month}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null);
            void refresh();
          }}
        />
      )}
    </FinanceContext>
  );
}
