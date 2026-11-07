import type { User } from '@clara/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Layers3, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, post } from './api';
import { ErrorBox, Field, Form, Status } from './ui';
export function Preferences({ user }: { user: User }) {
  const qc = useQueryClient();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () =>
      api<{ id: string; createdAt: string; expiresAt: string; current: boolean }[]>(
        '/auth/sessions',
      ),
  });
  const [notice, setNotice] = useState('');
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Seu perfil</h2>
            <p>Informações da sua conta</p>
          </div>
          <UserRound size={21} />
        </div>
        <dl className="detail-list">
          <div>
            <dt>Nome</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Verificação</dt>
            <dd>{user.emailVerified ? 'E-mail confirmado' : 'Confirmação pendente'}</dd>
          </div>
        </dl>
        {!user.emailVerified && (
          <Form
            submit="Reenviar confirmação"
            onSave={() => post('/auth/resend-verification', {})}
            onSuccess={() =>
              setNotice(
                'Confirmação solicitada. Em desenvolvimento, consulte .local/mail. Nenhum e-mail externo é enviado sem SMTP configurado.',
              )
            }
          />
        )}
        <Status>{notice}</Status>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Segurança da conta</h2>
            <p>Escolha uma senha que só você conhece</p>
          </div>
          <ShieldCheck size={21} />
        </div>
        <Form
          submit="Atualizar senha"
          onSave={(d) => post('/auth/change-password', Object.fromEntries(d))}
          onSuccess={() => {
            setNotice('Senha atualizada. Outras sessões foram encerradas.');
            void qc.invalidateQueries({ queryKey: ['sessions'] });
          }}
        >
          <Field label="Senha atual">
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              maxLength={128}
            />
          </Field>
          <Field label="Nova senha">
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>
        </Form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Sessões ativas</h2>
            <p>Controle seus acessos</p>
          </div>
        </div>
        <ErrorBox error={sessions.error} />
        {sessions.data?.map((s) => (
          <div className="session-item" key={s.id}>
            <div>
              <strong>{s.current ? 'Esta sessão' : 'Outra sessão'}</strong>
              <small>Iniciada em {new Date(s.createdAt).toLocaleString('pt-BR')}</small>
            </div>
            {!s.current && (
              <Form
                submit="Encerrar"
                onSave={() => api('/auth/sessions/' + s.id, { method: 'DELETE' })}
                onSuccess={() => qc.invalidateQueries({ queryKey: ['sessions'] })}
              />
            )}
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Integrações e próximas etapas</h2>
            <p>Transparência sobre esta versão</p>
          </div>
          <Layers3 size={21} />
        </div>
        <p className="muted">
          Assistente IA, bancos, cartões, anexos, equipe e cobranças não estão disponíveis nesta
          fase. Seus registros são manuais. Nenhuma integração ou cobrança externa está ativa.
        </p>
        <Link to="/privacidade" className="text-button">
          Privacidade e uso dos dados <ArrowUpRight size={17} />
        </Link>
      </section>
    </div>
  );
}
