# Relatório de andamento — Clara / finance-plataform

Data: 10 de novembro de 2026.

Repositório: `erickkbusinnes/finance-plataform`.

## Situação atual

A primeira base foi revisada, testada, versionada no commit `48a1e31` e enviada ao GitHub na branch `feat/clara-core-and-planning`. A continuação foi desenvolvida nessa mesma branch, preservando o código e a identidade visual Clara. O SHA e o resultado do envio da atualização são informados no encerramento da tarefa; `git log -2 --oneline` e `git status` permitem conferência local.

O sistema tem frontend, API, PostgreSQL, migrações e persistência reais. O produto completo ainda está em desenvolvimento: não houve deploy comercial, integração bancária, ativação de IA ou cobrança.

### Acesso online — atualização de 10/11

O erro `ERR_CONNECTION_REFUSED` no computador do usuário ocorreu ao abrir `localhost:5173`: esse endereço aponta para o próprio computador, enquanto os processos estavam no ambiente de nuvem. O site local foi iniciado e a navegação para cadastro/login foi verificada. Não existe URL pública dessa execução.

Foi preparado um pacote de hospedagem com `render.yaml` (Node + PostgreSQL declarados Free), comando `npm run start:cloud`, migrações compiladas/repetíveis e entrega segura do build React pela própria API. O modo explícito de demonstração mantém cookies Secure e origem HTTPS, informa para usar dados de teste e não simula envio de e-mail: confirmação e recuperação ficam indisponíveis e nenhum token/outbox é criado nesse modo. Produção normal continua exigindo SMTP.

A conta de hospedagem ainda não foi criada/conectada. Não há credencial de hospedagem nem ferramenta de deploy autenticada nesta sessão. O acesso HTTP ao domínio Render também foi recusado pela política de rede atual; não houve provisionamento externo ou verificação dos planos no provedor. O próximo passo é o titular criar a conta e aplicar o Blueprint da branch `feat/clara-core-and-planning`, conferindo custo zero no painel conforme [DEPLOYMENT.md](../DEPLOYMENT.md). Nenhum serviço pago foi contratado. A URL exata só existirá após a implantação.

Validação desta atualização: 49 testes de API/regras e 8 cenários de navegador passaram, assim como typecheck, build e o teste do início de hospedagem compilado. Consulte [VALIDATION.md](VALIDATION.md) para o recorte e os limites.

## O que está implementado

| Área               | Funcionalidade real                                                                           | Limite relevante                                                             |
| ------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Autenticação       | Cadastro, login, logout, senha, confirmação, recuperação e sessões revogáveis                 | SMTP externo e MFA ainda pendentes                                           |
| Ambientes          | Pessoal/empresarial e autorização por associação/papel no backend                             | Gestão de membros pela interface ainda futura                                |
| Contas             | Criar, editar, arquivar/reativar e calcular saldo por lançamentos                             | Saldo inicial não é sobrescrito na edição                                    |
| Categorias         | Criar, editar, arquivar/reativar e organizar subcategorias                                    | Um nível de filhas; mesmo tipo; sem ciclos                                   |
| Extrato            | Abertura, lançamentos, evolução do saldo, fechamento e paginação                              | Saldo progressivo calculado antes de paginar                                 |
| Movimentações      | Receitas, despesas, transferências, reembolsos, tags, edição e cancelamento com auditoria     | Despesa reembolsada exige cancelar reembolsos antes de alterar a origem      |
| Filtros            | Busca, período, tipo, conta, categoria e filhas, tag, mínimo/máximo e ordenação               | Dados inválidos geram erro explícito                                         |
| Dashboard          | Indicadores reais, intervalos 1/3/6 meses e comparação anterior                               | Resultado é de caixa, não lucro contábil                                     |
| Planejamento       | Orçamentos com subcategorias/reembolsos e metas com histórico detalhado                       | Aporte de meta não altera conta bancária                                     |
| Perfil/privacidade | Nome/e-mail editáveis, troca de e-mail com senha, exportação JSON e exclusão confirmada       | Ambientes compartilhados próprios bloqueiam exclusão para proteger terceiros |
| Cartões            | Cadastro/edição/arquivamento, limite, compras parceladas e ciclos de fatura                   | Não armazena número do cartão nem efetua pagamento externo                   |
| Faturas            | Fechamento/vencimento, detalhes, liquidação integral idempotente e reabertura                 | Sem pagamento parcial ou rotativo                                            |
| Estornos           | Crédito vinculado à compra, limite acumulado e compensação futura com trilha                  | Não gera receita bancária fictícia                                           |
| Dívidas            | Credor, principal, taxa informativa, prazo, amortização/juros pagos e cancelamento coordenado | Sem capitalização, renegociação ou agenda automática de parcelas             |
| Patrimônio         | Bens, investimentos, quantidade decimal, valores manuais, avaliações datadas e histórico      | Sem cotações ou operações em corretora                                       |
| Dupla contagem     | Investimento vinculado substitui a conta apenas na estimativa patrimonial                     | Uma posição vinculada por conta de investimento                              |
| Relatórios         | CSV, PDF e Excel com filtros e dados reais; JSON de privacidade                               | Relatórios financeiros são de caixa; até 10.000 linhas                       |
| Interface          | Português brasileiro, web responsiva e modos claro/escuro                                     | Aplicativo Expo ainda não criado                                             |

## Regras financeiras e de segurança preservadas

Valores monetários são centavos inteiros. Transferência debita e credita atomicamente. Arquivar não apaga o saldo. Reembolsos de despesa reduzem despesas líquidas, sem virar receita, e não podem ultrapassar a origem mesmo sob concorrência.

Compra de cartão compromete o limite, mas não é saída bancária. A liquidação registra a despesa uma única vez, depois de aplicar créditos. Fatura negativa pode ser compensada sem dinheiro sair da conta. Reabertura desfaz a saída/crédito coordenadamente e exige reabrir liquidações posteriores primeiro. Compras retroativas anteriores a faturas já liquidadas são rejeitadas.

Dívida é principal original menos amortizações válidas. O pagamento gera saída de principal mais juros informados; somente o principal reduz a dívida. Cancelamento reverte os dois efeitos. Avaliações manuais não movimentam contas.

Autorização continua sendo verificada no servidor em todas as rotas. Troca de e-mail exige senha e invalida credenciais temporárias antigas/outras sessões. Exclusão exige senha e confirmação literal, é atômica e preserva dados de terceiros. Dados exportados não incluem hashes de senha ou tokens.

## Testes e verificações

A base anterior passou em 21 testes de API e quatro cenários de navegador antes do primeiro commit. A continuação ampliou a cobertura; consulte `docs/VALIDATION.md` para os resultados atuais e limites da validação.

A cobertura nova inclui atualização de um banco 001 preenchido, arquivamento, extrato paginado, reembolsos concorrentes, tags/subcategorias, comparação de períodos, histórico de metas, perfil, exclusão de ambientes preenchidos/compartilhados, ciclos em meses curtos, parcelas exatas, liquidações, créditos, reaberturas, dívidas, avaliações, isolamento e exportações reais.

A auditoria das dependências de produção não reportou vulnerabilidades na consulta realizada. Nenhum `.env`, token de sessão, mensagem privada ou artefato de teste deve ser incluído no Git. Senhas de fixtures de teste e exemplos locais não são credenciais de serviços externos e não devem ser reutilizadas em produção.

## Arquivos e organização

- `apps/api/src/ledger.ts`: regras compartilhadas de autorização, lançamentos e auditoria.
- `core.ts`, `cards.ts`, `wealth.ts`, `privacy.ts`, `reports.ts`, `queries.ts`: novos módulos de negócio, consultas e exportações.
- `apps/web/src/CoreViews.tsx`, `Cards.tsx`, `Wealth.tsx`, `Downloads.tsx`: interfaces ligadas às APIs e tratamento de erros.
- Páginas existentes de dashboard, contas, movimentações, metas e configurações foram ampliadas.
- `database/migrations/002_*.sql`, `003_*.sql`, `004_*.sql`: evolução aditiva e integridade de exclusão.
- `packages/shared/src/planning.ts` e contratos existentes: validação compartilhada, regras de ciclo e parcelamento.
- `apps/api/test/finance.test.ts`, `tests/continuation.spec.ts` e testes originais: regras, integração e jornadas completas.
- README, arquitetura, banco, deploy, roadmap e este relatório foram atualizados.

## O que ainda precisa ser desenvolvido

1. Gestão empresarial: contas a pagar/receber, baixas parciais, fluxo projetado, clientes, fornecedores, centros de custo e equipes/transferência de propriedade.
2. Automações: importação CSV, recorrências, notificações e anexos privados.
3. Assistente IA real, com ferramentas autorizadas e configuração segura no backend.
4. Aplicativo Expo Android/iOS conectado à mesma API.
5. Evoluções pessoais: faturas parciais/rotativo, agenda e renegociação de dívidas, operações/histórico de negociação de investimentos e relatórios especializados.
6. Evoluções do núcleo: duplicação explícita, personalização de indicadores, múltiplas moedas e status previsto/agendado.
7. Produção/SaaS: hospedagem e domínio, SMTP real, MFA/revisão de segurança, LGPD/retenção definitivas, monitoramento, backups/restauração e planos comerciais. Cobranças externas continuam dependentes de autorização específica.

## Execução e verificação

Preserve o `.env` existente e os volumes. Na raiz, depois de instalar dependências com `npm ci`, inicie `docker compose up -d --wait postgres`, aplique `npm run db:migrate` e execute `npm run dev`. Pare apenas os processos de desenvolvimento que você iniciou antes de reinstalar dependências; não execute cópias nas mesmas portas.

Web usa porta 5173, API 3001 e PostgreSQL 5432. Confirmação/recuperação usam mensagens privadas em `.local/mail` sem serviço pago. Verificações: `npm run typecheck`, `npm test`, `npm run build` e `npm run test:e2e`. Os testes usam schemas isolados no banco terminado em `_test`.

As próximas entregas devem seguir o `ROADMAP.md`; esta entrega não encerra o produto inteiro.
