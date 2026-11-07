# Clara · gestão financeira

Primeira entrega funcional da `finance-plataform`: site público e aplicação web para organizar finanças pessoais e empresariais, com persistência em PostgreSQL. **Em desenvolvimento; não é um serviço bancário nem uma versão comercial pronta.** Nenhum dado financeiro é adicionado automaticamente.

## O que funciona

- Cadastro e login por e-mail/senha; sessões HttpOnly revogáveis, logout, alteração e recuperação de senha, confirmação de e-mail.
- Criação e alternância de ambientes pessoais e empresariais, com autorização no servidor e dados separados.
- Contas, saldos iniciais rastreáveis, categorias, receitas, despesas e transferências atômicas entre contas.
- Edição com controle de versão, cancelamento sem apagar histórico, busca, filtros, paginação e auditoria.
- Dashboard e gráficos calculados sobre os registros; CSV respeita os filtros.
- Orçamentos por categoria/mês e metas com registro manual de progresso (não alteram dinheiro real).
- Interface em português, real brasileiro, responsiva, modo claro/escuro no painel.
- Site com funcionalidades, soluções, planos sem cobrança, sobre, contato persistido, privacidade e termos preliminares.

Cartões, contas a pagar/receber, equipes pela interface, anexos, IA e aplicativo nativo ainda não estão disponíveis. Consulte [ROADMAP.md](ROADMAP.md).

## Tecnologias e requisitos

Node.js **22.21+** (validado com 24.22), npm 11, Docker com Compose v2. React 19, TypeScript, Vite, React Router, TanStack Query, Recharts e Lucide; Fastify 5, Zod, Argon2id; PostgreSQL 17 com driver `pg` e migrações SQL versionadas. CSS próprio mantém a identidade visual sem uma biblioteca de componentes adicional.

## Instalação

Na raiz do checkout:

```bash
cp .env.example .env   # apenas se .env ainda não existir
npm ci
docker compose up -d --wait postgres
npm run db:migrate
npm run dev
```

Web: porta **5173**. API: **3001**. O Vite encaminha `/api` para a API. Abra o frontend no navegador usando o host configurado em `APP_ORIGIN` (padrão `http://localhost:5173`). Se usar outro domínio/porta, ajuste `APP_ORIGIN`; não desative a proteção de origem. A documentação OpenAPI está em `/api/docs` na API.

O Compose publica o banco somente em `127.0.0.1:5432` e usa um volume persistente. A senha incluída no exemplo serve apenas para desenvolvimento. **Não execute `docker compose down -v` se quiser preservar seus dados.** Em ambientes gerenciados onde os seletores Docker apontam para outro daemon, use `docker --host=unix:///var/run/docker.sock compose …` com os seletores de endpoint/contexto/TLS removidos.

### E-mail local, sem serviços externos

Com `MAIL_MODE=local`, a API grava mensagens pessoais de confirmação e recuperação em **`.local/mail/`** na raiz. O processamento acontece na inicialização e a cada 10 segundos. Leia o arquivo correspondente ao seu e-mail e abra o link no navegador; ele expira em uma hora e só pode ser utilizado uma vez. A pasta é ignorada pelo Git e contém links sensíveis. Nenhum e-mail externo é enviado nesse modo.

Para envio real, configure SMTP e remetente de domínio próprio no backend. Produção recusa `MAIL_MODE=local`, falta de SMTP ou origem sem HTTPS. Não coloque segredos em variáveis `VITE_*`.

## Verificação

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm test` executa 21 testes de regras/integração com o PostgreSQL, incluindo concorrência, referências cruzadas, permissões, reversão e autenticação. `TEST_DATABASE_URL` precisa apontar a um banco cujo nome termina em `_test`; cada execução cria e remove seu próprio schema. O Compose cria `clara_test` na primeira inicialização. Para volumes preexistentes sem ele:

```bash
docker compose exec -T postgres psql -U clara -d postgres -c 'CREATE DATABASE clara_test;'
```

E2E inicia API na porta **3002** e web em **5174**, em um schema isolado, sem tocar as contas do ambiente de desenvolvimento. Usa Chromium de `/usr/bin/chromium` quando disponível; em outras máquinas execute `npx playwright install chromium`. Testa cadastro, movimentações, saldos, transferências, filtros, edição, planejamento, isolamento, logout/login e visualização móvel. Capturas e traces ficam em `test-results/` e não entram no Git. Não rode dois E2E simultaneamente nas mesmas portas.

### Verificação manual

1. Crie sua conta; o onboarding cria seu primeiro ambiente.
2. Adicione uma conta com saldo de R$ 1.000,00 e outra com saldo zero.
3. Registre R$ 500,00 de receita e R$ 100,00 de despesa.
4. Transfira R$ 200,00 da primeira conta para a segunda.
5. O saldo consolidado será R$ 1.400,00; entradas R$ 500,00, saídas R$ 100,00 e resultado de caixa R$ 400,00. A transferência não altera esses totais.
6. Crie um ambiente empresarial pelo seletor lateral. Ele começará vazio.
7. Saia e entre novamente. Os registros continuam no PostgreSQL.

Saldo disponível inclui todos os registros confirmados, inclusive saldos iniciais e datas futuras informadas. As entradas, saídas e gráficos usam o período selecionado. Esta fase não oferece agendamentos: uma data futura também representa um registro confirmado. O resultado de caixa **não** é lucro contábil.

## Estrutura

```text
apps/api/          API, autenticação, permissões, finanças, e-mail e testes de integração
apps/web/          Site público, painel, formulários, gráficos e estilos
packages/shared/   Contratos, validações e utilitários monetários
 database/         Migrações versionadas e inicialização do banco de teste
scripts/           Preparação dos testes e geração de sitemap
 tests/            Testes de navegador e limpeza do schema isolado
```

[Arquitetura](ARCHITECTURE.md) · [Banco](DATABASE.md) · [Deploy e backups](DEPLOYMENT.md) · [Roadmap](ROADMAP.md).
