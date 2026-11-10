import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AuthPage, Landing, PublicPage, Seo } from './Public';
import { useRuntimeConfig } from './runtime';
const DashboardApp = lazy(() => import('./Dashboard').then((m) => ({ default: m.DashboardApp })));

export function App() {
  const runtime = useRuntimeConfig();
  return (
    <>
      <Seo />
      {runtime.data?.preview && (
        <aside className="preview-notice" aria-label="Ambiente de demonstração">
          Demonstração Clara · Use dados de teste. Confirmação por e-mail e recuperação de senha
          indisponíveis.
        </aside>
      )}
      <Routes>
        <Route path="/" element={<Landing />} />
        {['funcionalidades', 'solucoes', 'precos', 'sobre', 'contato', 'termos', 'privacidade'].map(
          (p) => (
            <Route path={'/' + p} key={p} element={<PublicPage />} />
          ),
        )}
        <Route path="/entrar" element={<AuthPage key="login" mode="login" />} />
        <Route path="/cadastro" element={<AuthPage key="register" mode="register" />} />
        <Route path="/recuperar-senha" element={<AuthPage key="forgot" mode="forgot" />} />
        <Route path="/verificar-email" element={<AuthPage key="verify" mode="verify" />} />
        <Route path="/redefinir-senha" element={<AuthPage key="reset" mode="reset" />} />
        <Route
          path="/app/*"
          element={
            <Suspense fallback={<div className="page-loading">Preparando seu espaço…</div>}>
              <DashboardApp />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <main className="not-found">
              <h1>Este caminho não existe.</h1>
              <Link className="button" to="/">
                Voltar ao início
              </Link>
            </main>
          }
        />
      </Routes>
    </>
  );
}
