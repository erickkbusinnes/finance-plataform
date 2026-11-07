# Clara · gestão financeira

Plataforma `finance-plataform`: site público e aplicação web para organizar finanças pessoais e empresariais, com persistência em PostgreSQL. **Em desenvolvimento; não é um serviço bancário nem uma versão comercial pronta.** Nenhum dado financeiro é adicionado automaticamente.

## O que funciona

- Cadastro e login por e-mail/senha; sessões HttpOnly revogáveis, logout, alteração e recuperação de senha, confirmação de e-mail.
- Criação e alternância de ambientes pessoais e empresariais, com autorização no servidor e dados separados.
- Contas e categorias editáveis/arquiváveis, subcategorias, extrato com saldo progressivo, receitas, despesas, reembolsos vinculados, tags e transferências atômicas.
- Edição com controle de versão, cancelamento sem apagar histórico, busca, filtros, paginação e auditoria.
- Dashboard com períodos de 1/3/6 meses e comparação anterior; filtros por tipo, conta, categoria/subcategoria, tag e faixa de valores nas movimentações; CSV, PDF e Excel respeitam os filtros.
- Orçamentos por categoria/mês, incluindo subcategorias e reembolsos, e metas com histórico detalhado de aportes manuais (sem alterar saldos).
- Cartões: cadastro/edição/arquivamento, compras parceladas, faturas, liquidação integral, reabertura e créditos de estorno.
- Dívidas: principal, taxa informativa, vencimento, amortizações/juros pagos e cancelamento com reversão de caixa.
- Bens e investimentos manuais: quantidades decimais, avaliações datadas, histórico e patrimônio estimado sem dupla contagem de contas vinculadas.
- Perfil editável e privacidade: troca de e-mail com senha, exportação JSON sem credenciais e exclusão confirmada dos ambientes exclusivos.
- Interface em português, real brasileiro, responsiva, modo claro/escuro no painel.
- Site com funcionalidades, soluções, planos sem cobrança, sobre, contato persistido, privacidade e termos preliminares.

Contas a pagar/receber, equipes pela interface, anexos, IA, cobrança SaaS e aplicativo nativo ainda não estão disponíveis. Faturas parciais/rotativo, juros futuros automáticos e negociação de investimentos não são suportados. Consulte [ROADMAP.md](ROADMAP.md).

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
npm run test:build
npm run test:e2e
```

`npm test` executa 47 testes de regras/integração com o PostgreSQL, incluindo concorrência, referências cruzadas, permissões, reversão e autenticação. `TEST_DATABASE_URL` precisa apontar a um banco cujo nome termina em `_test`; cada execução cria e remove seu próprio schema. O Compose cria `clara_test` na primeira inicialização. Para volumes preexistentes sem ele:

```bash
docker compose exec -T postgres psql -U clara -d postgres -c 'CREATE DATABASE clara_test;'
```

`npm run test:build` exercita o artefato compilado da API na porta **3003**, com PostgreSQL isolado, autenticação, parcelas e geração PDF/Excel. Requer build anterior.

E2E inicia API na porta **3002** e web em **5174**, em um schema isolado, sem tocar as contas do ambiente de desenvolvimento. Usa Chromium de `/usr/bin/chromium` quando disponível; em outras máquinas execute `npx playwright install chromium`. Executa sete cenários: jornada original, consolidação/privacidade, cartões/dívidas/patrimônio, experiência móvel, site público e acessibilidade. Testa também exportação de arquivos, reabertura de faturas e cancelamento de pagamentos. Capturas e traces ficam em `test-results/` e não entram no Git. Não rode dois E2E simultaneamente nas mesmas portas.

### Verificação manual

1. Crie sua conta; o onboarding cria seu primeiro ambiente.
2. Adicione uma conta com saldo de R$ 1.000,00 e outra com saldo zero.
3. Registre R$ 500,00 de receita e R$ 100,00 de despesa.
4. Transfira R$ 200,00 da primeira conta para a segunda.
5. O saldo consolidado será R$ 1.400,00; entradas R$ 500,00, saídas R$ 100,00 e resultado de caixa R$ 400,00. A transferência não altera esses totais.
6. Crie um ambiente empresarial pelo seletor lateral. Ele começará vazio.
7. Saia e entre novamente. Os registros continuam no PostgreSQL.

Saldo disponível inclui todos os registros confirmados, inclusive saldos iniciais e datas futuras informadas. As entradas, saídas e gráficos usam o período selecionado. Esta fase não oferece agendamentos: uma data futura também representa um registro confirmado. O resultado de caixa **não** é lucro contábil. Reembolsos reduzem despesas líquidas, sem virar receita. O gráfico de categorias apresenta despesas brutas, identificado explicitamente.

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

## Regras de cartões e patrimônio

Compras no dia do fechamento pertencem ao ciclo atual; compras depois dele entram no seguinte. Datas como 31 de fevereiro são ajustadas ao último dia do mês. Parcelas distribuem os centavos restantes nas primeiras parcelas e sempre somam o total original. Compras comprometem o limite integral e não alteram o saldo bancário.

A despesa de caixa nasce uma única vez, na liquidação integral da fatura, classificada como pagamento de fatura. A categoria informada na compra é consultável na fatura, não uma segunda despesa no orçamento de caixa. Liquidação exige data a partir do fechamento, ordem de vencimento e confirmação do valor esperado. Não há pagamento externo.

Estorno é crédito de cartão, nunca receita bancária automática. Se a fatura já estiver liquidada, o crédito entra na primeira fatura aberta após as liquidações existentes. Uma fatura negativa pode ser compensada sem saída de conta e carregar crédito às seguintes. Reabrir desfaz a liquidação e a saída vinculada; primeiro reabra as faturas posteriores. Compras retroativas antes de faturas já liquidadas são rejeitadas.

Dívidas são acompanhadas manualmente: principal original menos amortizações válidas. Juros pagos são informados à parte, sem capitalização ou projeção automática. Bens e investimentos usam valores totais informados pelo usuário, sem cotações. Vincular um investimento a uma conta de investimento substitui essa conta pela avaliação apenas no patrimônio estimado; os saldos bancários continuam intactos.

As migrações 002–004 são aditivas e preservam o histórico. O teste de atualização começa com a versão 001 preenchida e verifica saldos depois das migrações. A exclusão de conta remove ambientes exclusivos atomicamente; ambientes compartilhados sob sua propriedade bloqueiam a exclusão para proteger os demais membros. Auditoria em ambientes de terceiros é preservada com ator anonimizado. Mensagens de contato têm finalidade separada e política definitiva ainda pendente para produção.

Relatórios financeiros têm limite de 10.000 linhas e exportação de privacidade de 10.000 registros por entidade. Acima disso a API rejeita explicitamente, sem entregar arquivos incompletos. Excel mantém uma coluna de centavos inteiros; textos nunca são escritos como fórmulas. Consulte [docs/STATUS_REPORT.md](docs/STATUS_REPORT.md) para a entrega atual.
