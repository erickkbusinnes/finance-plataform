import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  Check,
  Layers3,
  LockKeyhole,
  Menu,
  MoveRight,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { post } from './api';
import { Brand, Field, Form, Status } from './ui';
const nav = [
  ['Funcionalidades', '/funcionalidades'],
  ['Para você e sua empresa', '/solucoes'],
  ['Planos', '/precos'],
];
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-header">
      <Link to="/" aria-label="Clara, início">
        <Brand />
      </Link>
      <nav className={open ? 'open' : ''} aria-label="Navegação principal">
        {nav.map(([name, to]) => (
          <Link key={to} to={to} onClick={() => setOpen(false)}>
            {name}
          </Link>
        ))}
      </nav>
      <div className="public-actions">
        <Link to="/entrar" className="login-link">
          Entrar
        </Link>
        <Link className="button" to="/cadastro">
          Começar agora <ArrowUpRight size={16} />
        </Link>
        <button
          className="icon-button mobile-menu"
          aria-label="Abrir menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer className="public-footer">
      <div>
        <Link to="/">
          <Brand />
        </Link>
        <p>Mais clareza. Mais possibilidades.</p>
        <small>© {new Date().getFullYear()} Clara. Em desenvolvimento.</small>
      </div>
      <div>
        <Link to="/sobre">Sobre a Clara</Link>
        <Link to="/contato">Contato</Link>
        <Link to="/privacidade">Privacidade</Link>
        <Link to="/termos">Termos de uso</Link>
      </div>
      <span>
        Feito para a sua vida financeira <span className="green">↗</span>
      </span>
    </footer>
  );
}
const features = [
  {
    icon: Wallet,
    title: 'Cada real no seu lugar',
    text: 'Contas, receitas, despesas e transferências. Tudo conectado para você entender seu dinheiro.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Decisões com clareza',
    text: 'Veja o que entra, o que sai e para onde vai. Relatórios que partem das suas movimentações.',
  },
  {
    icon: Layers3,
    title: 'Sua vida. Sua empresa.',
    text: 'Ambientes separados, na mesma conta. Alterne de contexto sem misturar os números.',
  },
];
export function Landing() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" /> UM NOVO OLHAR PARA O SEU DINHEIRO
            </span>
            <h1>
              Suas finanças,
              <br />
              com mais <em>clareza.</em>
            </h1>
            <p>
              Menos planilhas. Mais tranquilidade. Organize sua vida financeira e sua empresa em um
              só lugar.
            </p>
            <div className="hero-actions">
              <Link to="/cadastro" className="button">
                Criar minha conta <ArrowRight size={18} />
              </Link>
              <a href="#como-funciona" className="text-button">
                Conhecer a Clara <MoveRight size={18} />
              </a>
            </div>
            <div className="hero-notes">
              <span>
                <Check size={15} /> Sem cartão de crédito
              </span>
              <span>
                <Check size={15} /> Seus dados, seu controle
              </span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-label">
              <span className="live-dot" /> SIMPLIFIQUE O QUE IMPORTA
            </div>
            <div className="clarity-card">
              <div className="clarity-card-top">
                <span className="mini-logo">c.</span>
                <span>Seu próximo capítulo</span>
                <ArrowUpRight size={20} />
              </div>
              <div className="clarity-word">
                Uma vida
                <br />
                mais leve<span>.</span>
              </div>
              <div className="clarity-line">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="clarity-bottom">
                <ShieldCheck size={17} /> Organização é o primeiro passo.
              </div>
            </div>
            <div className="floating-card float-top">
              <div className="round-icon mint">
                <Wallet size={21} />
              </div>
              <div>
                <strong>Tudo conectado</strong>
                <small>Uma visão completa do seu dinheiro</small>
              </div>
              <Check size={18} className="green" />
            </div>
            <div className="floating-card float-bottom">
              <div className="round-icon navy">
                <Building2 size={21} />
              </div>
              <div>
                <strong>Pessoal & empresarial</strong>
                <small>Juntos na rotina. Separados nos dados.</small>
              </div>
            </div>
            <span className="art-footnote">Organização de verdade, do seu jeito.</span>
          </div>
        </section>
        <section className="trust-strip">
          <span>Um espaço para cada parte da sua vida.</span>
          <div>
            <Wallet size={19} /> Para você
          </div>
          <div>
            <Sparkles size={19} /> Para quem empreende
          </div>
          <div>
            <Building2 size={19} /> Para sua empresa
          </div>
        </section>
        <section className="features-section" id="como-funciona">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SIMPLES NA ROTINA. COMPLETA NO ESSENCIAL.</span>
              <h2>
                Seu dinheiro merece
                <br />
                uma visão melhor.
              </h2>
            </div>
            <p>
              Da primeira conta ao próximo objetivo,
              <br />
              um caminho mais organizado começa aqui.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }, i) => (
              <article className="feature-card" key={title}>
                <span className="feature-number" aria-hidden="true">
                  0{i + 1}
                </span>
                <div className="feature-icon">
                  <Icon size={25} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to="/funcionalidades">
                  Explorar recurso <ArrowUpRight size={17} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="security-banner">
          <div className="security-icon">
            <LockKeyhole size={34} />
          </div>
          <div>
            <span className="eyebrow">CONFIANÇA COMEÇA COM CUIDADO</span>
            <h2>Privacidade faz parte da conta.</h2>
            <p>
              Você controla seus registros. Não movimentamos dinheiro nem pedimos sua senha
              bancária.
            </p>
          </div>
          <Link to="/privacidade" className="button secondary">
            Nosso compromisso <ArrowUpRight size={17} />
          </Link>
        </section>
        <section className="faq-section">
          <span className="eyebrow">SEM COMPLICAÇÃO</span>
          <h2>Antes de começar</h2>
          {[
            [
              'A Clara se conecta ao meu banco?',
              'Nesta versão, os registros são manuais. Não solicitamos credenciais bancárias e não executamos pagamentos ou movimentações reais.',
            ],
            [
              'Posso separar as contas da minha empresa?',
              'Sim. Crie ambientes pessoais e empresariais. Contas, categorias e movimentações são isoladas por ambiente.',
            ],
            [
              'Preciso pagar para usar?',
              'Esta versão de desenvolvimento não tem cobrança ou assinatura. Os planos comerciais serão definidos antes do lançamento.',
            ],
            [
              'A inteligência artificial já está disponível?',
              'Ainda não. O assistente e as integrações fazem parte das próximas fases. Os indicadores disponíveis são calculados pela API a partir dos seus registros.',
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="public-cta">
          <span className="eyebrow">UM PASSO DE CADA VEZ</span>
          <h2>
            Mais controle hoje.
            <br />
            <em>Mais possibilidades amanhã.</em>
          </h2>
          <Link className="button" to="/cadastro">
            Começar minha organização <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
const pageContent: Record<string, { title: string; intro: string }> = {
  '/funcionalidades': {
    title: 'O essencial, bem organizado.',
    intro:
      'Recursos disponíveis nesta versão: contas e carteiras com saldo inicial, categorias, receitas, despesas, transferências vinculadas, filtros, histórico, gráficos, exportação CSV/PDF/Excel, orçamentos, histórico de metas, cartões parcelados, dívidas e patrimônio com avaliações manuais.',
  },
  '/solucoes': {
    title: 'Um lugar para cada realidade.',
    intro:
      'Para pessoas físicas, autônomos, MEIs e empresas. Crie um ambiente pessoal para sua rotina ou um empresarial para os registros do negócio. Cada ambiente mantém seus próprios dados. Gestão de equipe e recursos fiscais ainda não estão disponíveis.',
  },
  '/precos': {
    title: 'Clareza também nos planos.',
    intro:
      'A versão de desenvolvimento não realiza cobranças. Os preços e os limites comerciais serão definidos antes do lançamento. Não solicitamos cartão de crédito.',
  },
  '/sobre': {
    title: 'Organização abre possibilidades.',
    intro:
      'A Clara está sendo construída para tornar a gestão financeira pessoal e empresarial mais simples. Esta primeira versão prioriza registros confiáveis, dados separados e uma visão clara do dinheiro. Não somos um banco nem uma instituição de pagamentos.',
  },
  '/privacidade': {
    title: 'Seus dados merecem cuidado.',
    intro:
      'Esta versão armazena nome, e-mail, sessões e os registros financeiros que você informa. Usamos esses dados para autenticar seu acesso e calcular os indicadores. Senhas são protegidas por hash e os ambientes têm controle de acesso no servidor. Não armazenamos credenciais bancárias. Em Configurações, você pode exportar seus dados em JSON e excluir a conta mediante senha e confirmação. A exclusão remove seus ambientes exclusivos; ambientes compartilhados de sua propriedade precisam ter a titularidade transferida antes. Registros de terceiros mantêm sua auditoria com ator anonimizado. Mensagens de contato têm finalidade separada. A política definitiva de retenção ainda será estabelecida. Antes de uso comercial, serão publicados identificação do controlador, canal de atendimento LGPD e termos definitivos. Não utilize dados financeiros sensíveis em uma instalação de demonstração.',
  },
  '/termos': {
    title: 'Transparência desde o começo.',
    intro:
      'A Clara é um sistema de organização de registros financeiros em desenvolvimento. Não fornece consultoria de investimentos, serviços bancários ou demonstrações contábeis oficiais. Valores e relatórios dependem dos registros informados por você. Os resultados apresentados são de caixa, não lucro contábil. Não há cobrança nesta versão. Faça backups e revise os registros. As condições comerciais e os termos definitivos serão estabelecidos antes do lançamento.',
  },
};
export function PublicPage() {
  const { pathname } = useLocation();
  const content = pageContent[pathname];
  return (
    <>
      <PublicHeader />
      <main className="info-page">
        <span className="eyebrow">CLARA / {pathname.slice(1).toUpperCase()}</span>
        <h1>{content?.title || 'Vamos conversar.'}</h1>
        <p className="info-intro">
          {content?.intro ||
            'Tem uma dúvida ou sugestão? Registre sua mensagem. Nesta versão ela fica armazenada para consulta pela equipe responsável pela instalação; ainda não há prazo de resposta.'}
        </p>
        {pathname === '/contato' ? (
          <div className="contact-form">
            <Contact />
          </div>
        ) : pathname === '/precos' ? (
          <div className="feature-grid">
            {['Pessoal', 'Profissional', 'Empresarial'].map((n, i) => (
              <article className="feature-card" key={n}>
                <span className="eyebrow">{i === 0 ? 'VERSÃO ATUAL' : 'PLANEJADO'}</span>
                <h2>{n}</h2>
                <p>
                  {i === 0
                    ? 'Contas, movimentações, planejamento e relatórios essenciais.'
                    : 'Recursos e condições comerciais a definir.'}
                </p>
                {i === 0 ? (
                  <Link to="/cadastro" className="button">
                    Criar conta <ArrowRight size={17} />
                  </Link>
                ) : (
                  <span className="badge">Ainda não disponível</span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Link to="/cadastro" className="button">
            Conhecer por dentro <ArrowRight size={18} />
          </Link>
        )}
      </main>
      <Footer />
    </>
  );
}
function Contact() {
  const [sent, setSent] = useState(false);
  return sent ? (
    <Status>Mensagem registrada com sucesso.</Status>
  ) : (
    <Form
      submit="Enviar mensagem"
      onSave={(d) => post('/contact', Object.fromEntries(d))}
      onSuccess={() => setSent(true)}
    >
      <Field label="Seu nome">
        <input name="name" required minLength={2} maxLength={100} />
      </Field>
      <Field label="E-mail">
        <input name="email" type="email" required maxLength={254} />
      </Field>
      <Field label="Mensagem">
        <textarea name="message" required minLength={10} maxLength={3000} rows={5} />
      </Field>
    </Form>
  );
}
export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'verify' | 'reset' }) {
  const navigate = useNavigate(),
    qc = useQueryClient(),
    [params] = useSearchParams(),
    [done, setDone] = useState(false);
  const title = {
    login: 'Bom ter você de volta.',
    register: 'Seu próximo passo começa aqui.',
    forgot: 'Vamos recuperar seu acesso.',
    verify: 'Confirme seu e-mail.',
    reset: 'Uma nova senha, um novo começo.',
  }[mode];
  return (
    <div className="auth-page">
      <section className="auth-art">
        <Link to="/">
          <Brand />
        </Link>
        <div>
          <span className="eyebrow">UM POUCO MAIS DE CLAREZA</span>
          <h1>
            O controle
            <br />
            nas suas mãos<span>.</span>
          </h1>
          <p>
            Cuide do presente.
            <br />
            Dê espaço para o que vem depois.
          </p>
          <div className="auth-art-lines">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <small>Suas finanças, do seu jeito.</small>
      </section>
      <section className="auth-content">
        <Link to="/" className="auth-home">
          ← Voltar ao início
        </Link>
        <div className="auth-box">
          <span className="eyebrow">BEM-VINDO À CLARA</span>
          <h2>{title}</h2>
          <p>
            {mode === 'register'
              ? 'Comece a organizar suas finanças. Sem cartão de crédito.'
              : 'Um lugar para enxergar seu dinheiro com tranquilidade.'}
          </p>
          {done ? (
            <>
              <Status>
                {mode === 'forgot'
                  ? 'Se houver uma conta, enviaremos as instruções para o e-mail informado.'
                  : mode === 'verify'
                    ? 'E-mail confirmado com sucesso.'
                    : 'Senha atualizada. Todas as sessões anteriores foram encerradas.'}
              </Status>
              <Link className="button" to="/entrar">
                Ir para login <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <Form
              submit={
                {
                  login: 'Entrar na minha conta',
                  register: 'Criar minha conta',
                  forgot: 'Enviar instruções',
                  verify: 'Confirmar e-mail',
                  reset: 'Salvar nova senha',
                }[mode]
              }
              onSave={async (d) => {
                if (mode === 'verify') {
                  await post('/auth/verify-email', { token: params.get('token') || '' });
                  setDone(true);
                  return;
                }
                if (mode === 'reset') {
                  await post('/auth/reset-password', {
                    token: params.get('token') || '',
                    password: d.get('password'),
                  });
                  setDone(true);
                  return;
                }
                if (mode === 'forgot') {
                  await post('/auth/forgot-password', { email: d.get('email') });
                  setDone(true);
                  return;
                }
                await post('/auth/' + mode, Object.fromEntries(d));
                qc.clear();
                navigate('/app');
              }}
            >
              {mode === 'register' && (
                <Field label="Como podemos chamar você?">
                  <input
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    placeholder="Seu nome"
                    required
                  />
                </Field>
              )}
              {['login', 'register', 'forgot'].includes(mode) && (
                <Field label="Seu e-mail">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="voce@exemplo.com"
                    required
                  />
                </Field>
              )}
              {['login', 'register', 'reset'].includes(mode) && (
                <Field
                  label={mode === 'reset' ? 'Nova senha' : 'Sua senha'}
                  hint={mode !== 'login' ? 'Use pelo menos 12 caracteres.' : ''}
                >
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={12}
                    maxLength={128}
                    placeholder="••••••••••••"
                    required
                  />
                </Field>
              )}
              {mode === 'register' && (
                <label className="checkbox">
                  <input type="checkbox" required /> Li os <Link to="/termos">termos de uso</Link> e
                  a <Link to="/privacidade">política de privacidade</Link>.
                </label>
              )}
            </Form>
          )}
          {mode === 'login' && (
            <>
              <Link to="/recuperar-senha" className="forgot-link">
                Esqueci minha senha
              </Link>
              <div className="auth-divider" />
              <p className="auth-switch">
                Ainda não tem uma conta?{' '}
                <Link to="/cadastro">
                  Comece por aqui <ArrowUpRight size={14} />
                </Link>
              </p>
            </>
          )}
          {mode === 'register' && (
            <p className="auth-switch">
              Já tem uma conta? <Link to="/entrar">Entrar</Link>
            </p>
          )}
          <div className="auth-security">
            <ShieldCheck size={16} /> Não solicitamos sua senha bancária.
          </div>
        </div>
      </section>
    </div>
  );
}
export function Seo() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith('/app')) document.documentElement.dataset.theme = 'light';
    document.title = pathname.startsWith('/app')
      ? 'Seu espaço financeiro — Clara'
      : pageContent[pathname]
        ? `${pageContent[pathname].title} — Clara`
        : 'Clara — clareza para suas finanças';
  }, [pathname]);
  return null;
}
