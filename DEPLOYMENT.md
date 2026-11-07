# Deploy e operação

## Estado

Base de desenvolvimento funcional. Não houve publicação em serviço externo. Não utilize como SaaS comercial antes de resolver os itens de produção/LGPD do roadmap e revisar a segurança e a operação. Não há integração bancária, IA ou cobrança configurada.

## Frontend estático

Execute `npm ci`, `npm run typecheck` e `npm run build`. Publique **`apps/web/dist`**. O backend deve rodar separadamente. Use preferencialmente um reverse proxy HTTPS no mesmo domínio, encaminhando `/api/*` sem remover `/api`. Configure fallback de SPA de caminhos públicos e `/app/*` para `index.html` (o arquivo `_redirects` atende Cloudflare Pages). Não encaminhe `/api` ao fallback estático.

`VITE_API_URL` define a origem da API **sem `/api`** no build quando forem domínios separados. O padrão vazio usa a mesma origem. Para cookies confiáveis, prefira o mesmo site (ex.: `app.seudominio` e `api.seudominio`) e configure CORS em `APP_ORIGIN` com a origem exata do frontend. Domínios totalmente distintos não são suportados por esta política SameSite=Lax; não enfraqueça cookies indiscriminadamente. Configure `PUBLIC_SITE_URL` com o domínio HTTPS real no build para gerar `sitemap.xml` e a referência no robots. Não há domínio inventado no repositório.

## API

Use Node 22.21+; instale dependências, execute a migração na raiz e depois:

```bash
npm run build
npm run start -w @clara/api
```

O diretório de execução é `apps/api` (npm workspace ajusta automaticamente). O artefato é `apps/api/dist/server.js`; conserve as dependências de runtime, inclusive o binding nativo Argon2 correspondente à plataforma. Os contratos compartilhados são empacotados pelo build. Não execute migrações automaticamente a cada requisição. A rota `/api/health` executa uma consulta real ao banco.

Ambiente do servidor:

| Variável          | Uso                                                        |
| ----------------- | ---------------------------------------------------------- |
| DATABASE_URL      | PostgreSQL; usuário restrito e TLS verificado em produção  |
| NODE_ENV          | `production`                                               |
| APP_ORIGIN        | Origem HTTPS exata do frontend, sem barra final            |
| PORT              | Porta da API (3001 padrão)                                 |
| MAIL_MODE         | `smtp` em produção; `local` só em desenvolvimento          |
| SMTP_URL          | URL SMTP com credenciais apenas no backend, TLS verificado |
| MAIL_FROM         | Remetente de domínio próprio configurado                   |
| TEST_DATABASE_URL | Apenas testes, banco separado terminado em `_test`         |
| VITE_API_URL      | Origem pública da API no build web; nunca segredo          |
| PUBLIC_SITE_URL   | Origem HTTPS pública para sitemap no build                 |

Não reutilize `clara_local` em produção. Guarde credenciais em secret manager do provedor. Não passe senhas por argumentos de processos, frontend, logs ou Git. Configure TLS do PostgreSQL por conexão/CA do provedor sem `rejectUnauthorized=false`. Bloqueie acesso público direto ao banco. Separe a conta de migração da conta de aplicação, limitando os privilégios conforme a implantação.

Use HTTPS e cookies Secure. O reverse proxy deve aplicar HSTS e CSP do frontend (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' <origem-api>; frame-ancestors 'none'; base-uri 'self'`), e negar incorporação indevida. Ajuste apenas para os hosts reais. A API não usa trustProxy indiscriminado; se precisar do IP real para rate limiting, configure somente o proxy conhecido e impeça acesso direto à API. Para múltiplas réplicas, introduza rate limiter compartilhado e worker dedicado de e-mail. A outbox usa locks para evitar consumo simultâneo; SMTP é entrega pelo menos uma vez e uma falha após envio pode ocasionar repetição do mesmo link.

## Banco e backups

O Compose é voltado a desenvolvimento, não uma implantação endurecida. Mantenha volume persistente. Faça backup criptografado, automatizado e com acesso restrito. Defina retenção antes de produção, contemplando dados pessoais e links sensíveis ainda na outbox.

Exemplo com ferramentas PostgreSQL 17 e conexões definidas em variáveis protegidas, nunca coladas no histórico:

```bash
pg_dump --dbname="$DATABASE_URL" --format=custom --file=clara-backup.dump
# Restaure primeiro num banco vazio de homologação. Nunca sobrescreva produção sem plano.
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-acl clara-backup.dump
```

Teste saúde, autenticação e saldos no banco restaurado, comparando contagens e totais com a origem antes de promover. O procedimento acima está documentado, mas uma recuperação operacional em infraestrutura externa ainda precisa ser ensaiada. Inclua armazenamento SMTP e arquivos privados no plano quando esses serviços existirem. Limpe mensagens locais e tokens/sessões expirados conforme uma política explícita, sem apagar auditoria financeira inadvertidamente.

## Publicação do ambiente Codex

A preparação local e o rascunho de ambiente não equivalem a deploy. Após revisão/salvamento das configurações, a publicação do ambiente é feita na interface do produto. Processos não sobrevivem necessariamente ao snapshot: reinicie PostgreSQL e `npm run dev` e valide `/api/health` em tarefas futuras. Use o checkout existente; não crie worktrees automaticamente.

## Atualização desta entrega

Aplique `npm run db:migrate` antes de iniciar a nova API. Foram adicionadas as migrações 002 (consolidação), 003 (planejamento pessoal) e 004 (referências verificadas no commit para exclusão atômica). Não remova volumes nem recrie o banco para atualizar. O teste de migração começa com um banco 001 preenchido, validando a preservação do saldo.

As novas exportações PDF/Excel são geradas no servidor e retornadas como arquivos privados. Conserve as dependências de runtime `pdfkit` e `write-excel-file`. A API não exige serviços pagos para esses formatos. Relatórios têm limite explícito de 10.000 linhas; dados acima desse limite precisam de exportação administrativa planejada, não truncamento.

Excluir uma conta remove os ambientes exclusivos e revoga suas sessões. Ambientes compartilhados sob propriedade do solicitante bloqueiam a exclusão até a transferência de propriedade. Defina antes de produção como esse fluxo se relaciona com retenção obrigatória, backups, mensagens de contato e auditoria de terceiros; apagar dados ativos não remove automaticamente cópias de backup. A implementação local de exclusão não substitui essa política operacional.
