# PROMPT MESTRE — PLATAFORMA COMPLETA DE GESTÃO FINANCEIRA

## 1. SUA MISSÃO

Você será o arquiteto de software, desenvolvedor full-stack sênior, designer UI/UX e engenheiro de qualidade responsável por construir uma plataforma profissional de gestão financeira pessoal e empresarial.

O projeto deve funcionar como um produto SaaS real, com versão web e aplicativo mobile, banco de dados, autenticação, segurança, relatórios, automações e inteligência artificial.

**Objetivo principal:** construir uma central financeira moderna, completa, segura, intuitiva e comercialmente viável.

Não quero um simples protótipo visual ou dashboard fictício. Quero um sistema funcional, com arquitetura profissional, código organizado, persistência real de dados e uma experiência de usuário excepcional.

O desenvolvimento deve ser dividido em fases, mas priorize entregar uma primeira versão web completa e utilizável, com arquitetura preparada para aplicativo mobile.

O usuário não deve sentir que está utilizando um software financeiro complicado. Apesar da quantidade de funcionalidades, a navegação precisa ser simples e natural.

---

# 2. VISÃO DO PRODUTO

A plataforma atenderá cinco públicos principais:

1. Pessoas físicas que desejam organizar suas finanças.
2. Autônomos e freelancers.
3. Microempreendedores individuais (MEIs).
4. Pequenas e médias empresas.
5. Empresas que precisam de gestão financeira com equipes.

O produto terá dois ambientes:

**Ambiente pessoal**

- Controle de despesas e receitas.
- Contas bancárias e carteiras.
- Cartões de crédito.
- Planejamento mensal.
- Metas financeiras.
- Dívidas e parcelamentos.
- Investimentos e patrimônio.
- Relatórios pessoais.

**Ambiente empresarial**

- Controle financeiro empresarial.
- Fluxo de caixa.
- Contas a pagar e receber.
- Faturamento.
- Clientes e fornecedores.
- Centros de custo.
- Relatórios de desempenho.
- Gestão de equipes.
- Permissões de acesso.
- Gestão de múltiplas empresas.

Um mesmo usuário poderá ter seus ambientes pessoais e empresariais na mesma conta, alternando entre eles com facilidade.

Esses ambientes devem ter dados financeiros devidamente isolados, com permissões verificadas no servidor.

---

# 3. TECNOLOGIAS

Escolha uma arquitetura moderna, estável e escalável, priorizando TypeScript.

Stack sugerida:

**Frontend web**

- React
- TypeScript
- Vite
- Tailwind CSS
- Componentes acessíveis e reutilizáveis
- React Router
- TanStack Query
- Biblioteca moderna de gráficos

**Aplicativo**

- React Native
- Expo
- TypeScript

**Backend**

- Node.js
- TypeScript
- Fastify
- API REST documentada com OpenAPI

**Banco de dados**

- PostgreSQL
- Prisma ORM ou Drizzle ORM
- Migrações versionadas

**Infraestrutura**

- Monorepo com workspaces.
- Docker Compose para desenvolvimento local.
- Frontend web preparado para hospedagem estática, inclusive Cloudflare Pages.
- Backend hospedado separadamente quando necessário.
- Storage privado para arquivos.
- Sistema de logs e monitoramento.

Você poderá alterar tecnologias caso encontre opções comprovadamente mais adequadas. Entretanto, explique as decisões e preserve uma arquitetura sustentável.

Se já existir código no repositório, examine toda a estrutura antes de modificar. Preserve o que estiver funcionando e não apague arquivos importantes sem necessidade.

---

# 4. IDENTIDADE VISUAL E DESIGN

Quero uma interface de nível comercial, inspirada na qualidade de produtos fintech modernos, mas com identidade própria.

## Estilo visual

- Design minimalista e sofisticado.
- Aparência premium e profissional.
- Componentes visualmente consistentes.
- Cantos suavemente arredondados.
- Sombras discretas.
- Espaçamento bem distribuído.
- Tipografia moderna.
- Ícones consistentes.
- Animações leves.
- Transições fluidas.
- Interface responsiva.
- Suporte a modo claro e escuro.

## Paleta inicial

- Azul-marinho profundo: `#0F172A`
- Verde-esmeralda: `#10B981`
- Branco: `#FFFFFF`
- Cinza claro: `#F8FAFC`
- Cinza de texto: `#64748B`
- Vermelho de alerta: `#EF4444`
- Azul de informação: `#3B82F6`

Essas cores são uma referência inicial. Refine a paleta para obter o melhor resultado visual.

## Princípios de UX

A regra principal será:

**Muitos recursos, mas sem parecer difícil.**

Para isso:

- Priorize as informações mais importantes.
- Use menus organizados.
- Evite excesso de informações simultâneas.
- Utilize navegação contextual.
- Crie estados vazios bem desenhados.
- Inclua feedback claro após ações.
- Crie formulários intuitivos.
- Ofereça busca e filtros.
- Permita personalização do dashboard.
- Inclua atalhos para tarefas frequentes.
- Garanta acessibilidade por teclado e leitores de tela.
- Utilize português brasileiro como idioma principal.
- Utilize real brasileiro como moeda padrão, com suporte planejado para outras moedas.

Não crie uma interface visualmente genérica.

Quero que o sistema transmita confiança, organização e tecnologia.

---

# 5. SITE INSTITUCIONAL

Crie um site público de apresentação do produto, separado do painel autenticado.

## Páginas

### Página inicial

- Hero moderno.
- Apresentação clara da plataforma.
- Demonstração visual do dashboard.
- Benefícios para pessoas físicas.
- Benefícios para empresas.
- Recursos principais.
- Destaque da inteligência artificial.
- Seção de segurança.
- Planos disponíveis.
- Perguntas frequentes.
- Chamadas para cadastro.

### Funcionalidades

Apresente os recursos disponíveis com explicações e demonstrações visuais.

### Soluções

Divida em:

- Pessoal.
- Autônomos.
- MEI.
- Empresas.

### Preços

Prepare a estrutura visual para planos SaaS.

### Sobre

Informações institucionais do produto.

### Contato

Formulário funcional com validações.

### Login e cadastro

Páginas próprias, com design consistente.

O site deverá ter:

- SEO técnico.
- Metadados.
- Sitemap.
- Responsividade.
- Boa performance.
- Acessibilidade.
- Links funcionais.
- Informações legais apropriadas.

Não invente depoimentos, certificações, números de clientes ou parcerias.

---

# 6. AUTENTICAÇÃO E CADASTRO

Implemente um sistema real de autenticação.

## Recursos

- Criar conta.
- Login por e-mail e senha.
- Verificação de e-mail.
- Recuperação de senha.
- Atualização de senha.
- Encerramento de sessão.
- Gerenciamento de sessões.
- Proteção de rotas.
- Controles contra tentativas abusivas.
- Preparação para autenticação multifator.

Nunca armazene senhas em texto puro.

Use mecanismos seguros e consolidados para autenticação, armazenamento de senhas e sessões.

## Onboarding

Após criar uma conta, o usuário deverá escolher:

- Finanças pessoais.
- Finanças empresariais.
- Ambas.

Em seguida, o onboarding deverá permitir cadastrar:

- Nome.
- Perfil financeiro.
- Conta financeira inicial.
- Saldo inicial.
- Preferências.
- Categorias.
- Objetivos financeiros.

Para empresas:

- Nome empresarial.
- Informações cadastrais opcionais.
- Setor de atuação.
- Moeda.
- Conta financeira principal.

O onboarding deve ser curto, com etapas opcionais e possibilidade de configurar mais informações depois.

---

# 7. ESTRUTURA DO PAINEL

O usuário terá acesso a um painel central autenticado.

Menu principal:

1. Visão Geral
2. Movimentações
3. Contas e Carteiras
4. Cartões
5. Orçamentos
6. Metas
7. Contas a Pagar
8. Contas a Receber
9. Fluxo de Caixa
10. Relatórios
11. Patrimônio
12. Assistente IA
13. Configurações

No ambiente empresarial, incluir:

14. Clientes
15. Fornecedores
16. Centros de Custo
17. Equipe e Permissões
18. Gestão Empresarial

Crie menus dinâmicos para exibir apenas as áreas pertinentes ao ambiente atual.

Implemente alternância entre ambientes sem precisar sair da conta.

---

# 8. DASHBOARD FINANCEIRO

Crie dashboards personalizados para cada ambiente.

## Dashboard pessoal

Apresente:

- Saldo total.
- Receitas mensais.
- Despesas mensais.
- Resultado do mês.
- Evolução patrimonial.
- Gastos por categoria.
- Próximas contas.
- Faturas de cartão.
- Metas financeiras.
- Histórico de movimentações.
- Alertas relevantes.

## Dashboard empresarial

Apresente:

- Saldo disponível.
- Entradas do período.
- Saídas do período.
- Resultado financeiro.
- Contas pendentes.
- Contas vencidas.
- Fluxo de caixa projetado.
- Evolução do faturamento.
- Despesas operacionais.
- Resultado por centro de custo.
- Clientes com pagamentos pendentes.
- Indicadores financeiros.

## Interatividade

- Filtros de período.
- Comparação entre meses.
- Gráficos interativos.
- Atualização após movimentações.
- Cards com navegação para detalhes.
- Personalização dos indicadores.

Todos os indicadores precisam ser calculados a partir de dados reais.

Diferencie claramente saldo, fluxo de caixa, faturamento e lucro. Não apresente resultado de caixa como lucro contábil.

---

# 9. TRANSAÇÕES FINANCEIRAS

Implemente um módulo robusto de movimentações.

## Tipos

- Receita.
- Despesa.
- Transferência.
- Reembolso.
- Ajuste de saldo.

## Dados

- Descrição.
- Valor.
- Data.
- Categoria.
- Subcategoria.
- Conta financeira.
- Forma de pagamento.
- Tags.
- Observações.
- Anexos.
- Estado da transação.
- Recorrência.

## Funcionalidades

- Cadastrar.
- Editar.
- Excluir ou cancelar com segurança.
- Duplicar.
- Filtrar.
- Pesquisar.
- Ordenar.
- Importar CSV.
- Exportar dados.
- Anexar comprovantes.
- Visualizar histórico.

As movimentações precisam atualizar corretamente os saldos e indicadores.

Implemente transferências como operações vinculadas entre duas contas, sem contabilizá-las como receitas ou despesas.

Evite lançamentos duplicados e inconsistências financeiras.

---

# 10. CONTAS, CARTEIRAS E SALDOS

Permita criar diferentes contas financeiras:

- Conta corrente.
- Poupança.
- Dinheiro físico.
- Carteira digital.
- Conta empresarial.
- Conta de investimento.
- Caixa interno.

Cada conta terá:

- Nome.
- Tipo.
- Moeda.
- Saldo inicial.
- Saldo atual calculado.
- Histórico.
- Status.
- Identificação visual.

Permita transferências entre contas.

Implemente operações financeiras usando transações de banco atômicas, garantindo consistência.

Nunca dependa apenas de um número de saldo armazenado e alterado sem trilha de movimentações.

---

# 11. CARTÕES DE CRÉDITO

Desenvolva gerenciamento completo de cartões.

## Dados

- Nome.
- Identificação visual.
- Limite.
- Dia de fechamento.
- Dia de vencimento.
- Conta utilizada para pagar a fatura.

## Recursos

- Registrar compras.
- Compras parceladas.
- Parcelas futuras.
- Faturas mensais.
- Limite utilizado.
- Limite disponível.
- Histórico por cartão.
- Alertas de vencimento.
- Pagamento de faturas.
- Estornos.

Diferencie data da compra, competência da fatura e pagamento efetivo.

Evite dupla contagem das despesas quando a fatura for paga.

---

# 12. ORÇAMENTOS E PLANEJAMENTO

Permita definir limites financeiros.

Exemplos:

- Alimentação.
- Transporte.
- Lazer.
- Moradia.
- Marketing.
- Operações.
- Equipe.

## Recursos

- Limites mensais.
- Limites por categoria.
- Valores utilizados.
- Percentual consumido.
- Alertas de excesso.
- Comparação entre períodos.
- Planejamento futuro.

Use barras de progresso e indicadores fáceis de interpretar.

---

# 13. METAS FINANCEIRAS

Permita criar objetivos como:

- Reserva de emergência.
- Comprar um veículo.
- Realizar uma viagem.
- Quitar dívidas.
- Expandir uma empresa.
- Acumular capital de giro.

Cada meta terá:

- Título.
- Valor objetivo.
- Valor acumulado.
- Prazo.
- Categoria.
- Prioridade.
- Progresso.
- Histórico de contribuições.

Permita aportes manuais e, futuramente, automáticos.

Diferencie o acompanhamento de uma meta do saldo real de uma conta para evitar dinheiro fictício.

---

# 14. CONTAS A PAGAR E A RECEBER

Crie um módulo especialmente completo para empresas.

## Contas a pagar

- Descrição.
- Fornecedor.
- Valor.
- Vencimento.
- Categoria.
- Recorrência.
- Status.
- Histórico de pagamentos.

## Contas a receber

- Cliente.
- Descrição.
- Valor.
- Vencimento.
- Parcelamento.
- Status.
- Histórico de recebimentos.

## Funcionalidades

- Cadastro.
- Edição.
- Filtros.
- Baixa manual.
- Pagamento parcial.
- Recebimento parcial.
- Alertas.
- Histórico.
- Projeções.
- Comprovantes.

Permita converter pagamentos e recebimentos confirmados em movimentações financeiras sem duplicação.

---

# 15. FLUXO DE CAIXA

Crie gráficos e relatórios de fluxo de caixa.

Mostrar:

- Entradas realizadas.
- Saídas realizadas.
- Entradas previstas.
- Saídas previstas.
- Saldo projetado.
- Saldo inicial e final por período.

Visualizações:

- Diária.
- Semanal.
- Mensal.
- Personalizada.

As projeções devem mostrar claramente o que é previsto e o que já aconteceu.

---

# 16. MÓDULO EMPRESARIAL

Implemente ferramentas específicas para empresas.

## Clientes

- Cadastro.
- Informações de contato.
- Histórico financeiro.
- Contas a receber.
- Pendências.
- Indicadores de relacionamento.

## Fornecedores

- Cadastro.
- Informações de contato.
- Histórico de despesas.
- Contas a pagar.
- Custos por fornecedor.

## Centros de custo

- Criar departamentos.
- Vincular despesas.
- Visualizar custos.
- Comparar períodos.
- Analisar resultados.

## Múltiplas empresas

Um usuário poderá administrar diferentes empresas.

Os dados de cada empresa devem ser isolados.

## Equipes

Crie permissões como:

- Proprietário.
- Administrador.
- Gestor financeiro.
- Colaborador.
- Visualizador.

As permissões devem ser verificadas no backend em cada operação, não apenas escondendo botões no frontend.

---

# 17. PATRIMÔNIO, DÍVIDAS E INVESTIMENTOS

Crie módulos para acompanhamento patrimonial.

## Patrimônio

- Bens.
- Ativos financeiros.
- Passivos.
- Evolução patrimonial.
- Patrimônio líquido estimado.

## Dívidas

- Credor.
- Valor original.
- Saldo devedor.
- Taxa de juros.
- Parcelas.
- Vencimentos.
- Pagamentos realizados.

## Investimentos

Inicialmente, permita acompanhamento manual:

- Tipo de investimento.
- Quantidade.
- Valor aplicado.
- Valor atual informado.
- Histórico.
- Rentabilidade estimada.

Não simule integrações com corretoras nem apresente preços de mercado fictícios.

Prepare a arquitetura para integrações futuras.

---

# 18. RELATÓRIOS AVANÇADOS

Desenvolva uma central de relatórios.

Relatórios pessoais:

- Receitas e despesas.
- Gastos por categoria.
- Comparação mensal.
- Cartões e faturas.
- Orçamento.
- Metas.
- Patrimônio.

Relatórios empresariais:

- Fluxo de caixa.
- Faturamento.
- Despesas.
- Contas vencidas.
- Contas futuras.
- Clientes.
- Fornecedores.
- Centros de custo.
- Indicadores gerenciais.
- Demonstrativo gerencial de resultados.

Deixe claro quando um relatório for gerencial, e não um demonstrativo contábil oficial.

## Exportação

- PDF.
- CSV.
- Excel.

Os relatórios devem refletir dados reais e filtros selecionados.

---

# 19. INTELIGÊNCIA ARTIFICIAL FINANCEIRA

Quero um assistente de IA integrado à plataforma.

Ele deverá ter uma interface de chat moderna e contextual.

O usuário poderá perguntar:

- Onde estou gastando mais?
- Quanto gastei no último mês?
- Quais despesas mais aumentaram?
- Quanto tenho disponível?
- Minha empresa poderá ficar com saldo negativo?
- Quais contas vencem nesta semana?
- Como posso melhorar meu orçamento?
- Compare os últimos três meses.
- Faça um resumo financeiro.

## Arquitetura da IA

- Integração por API exclusivamente no backend.
- Chaves protegidas em variáveis de ambiente.
- Consultas autorizadas aos dados financeiros.
- Ferramentas estruturadas para cálculos.
- Controle de permissões por ambiente.
- Limitação de uso.
- Histórico de conversas com controles de privacidade.
- Tratamento de erros e indisponibilidade.

A IA não deve inventar saldos, transações, projeções ou indicadores.

Cálculos financeiros devem ser feitos pelo backend. A IA interpreta os resultados e os explica.

Não permita que a IA execute transferências, exclua movimentações ou modifique registros importantes sem uma confirmação explícita e uma operação autorizada.

Se não houver chave de API configurada, exiba um estado de integração não configurada, sem fingir que a IA está funcionando.

---

# 20. NOTIFICAÇÕES E AUTOMAÇÕES

Crie uma central de notificações.

Eventos:

- Contas vencendo.
- Contas vencidas.
- Faturas próximas.
- Orçamento ultrapassado.
- Metas atingidas.
- Saldo projetado baixo.
- Recebimentos pendentes.
- Resumos periódicos.

Implemente notificações internas inicialmente.

Prepare a arquitetura para:

- E-mail.
- Push mobile.
- WhatsApp, futuramente.

Crie preferências para que cada usuário controle quais notificações deseja receber.

Evite disparos duplicados.

---

# 21. DOCUMENTOS E ANEXOS

Permita anexar:

- Comprovantes.
- Recibos.
- Notas.
- Documentos financeiros.
- Contratos.

Utilize armazenamento privado, controle de acesso, validação de formato e tamanho e URLs temporárias de acesso quando necessário.

Nunca exponha arquivos financeiros em URLs públicas permanentes.

---

# 22. BANCO DE DADOS

Projete um banco relacional normalizado e escalável.

Entidades sugeridas:

- users
- sessions
- workspaces
- workspace_members
- roles
- permissions
- financial_accounts
- categories
- transactions
- transaction_entries
- transfers
- credit_cards
- card_purchases
- card_installments
- card_statements
- budgets
- financial_goals
- goal_contributions
- payables
- receivables
- payments
- customers
- suppliers
- cost_centers
- assets
- liabilities
- investments
- recurring_rules
- notifications
- attachments
- ai_conversations
- audit_logs
- subscriptions

Essas tabelas são uma referência. Você deverá definir o modelo final com relacionamentos e integridade adequados.

## Requisitos essenciais

- Chaves primárias.
- Chaves estrangeiras.
- Índices.
- Restrições de integridade.
- Controle de acesso por workspace.
- Migrações versionadas.
- Timestamps.
- Paginação.
- Histórico de operações relevantes.
- Valores monetários usando precisão decimal ou unidades inteiras apropriadas, nunca ponto flutuante comum.
- Tratamento correto de fuso horário, datas e moedas.

Implemente uma estrutura que permita evolução sem reescrever todo o sistema.

---

# 23. SEGURANÇA E PRIVACIDADE

Estamos trabalhando com dados financeiros. A segurança deve ser prioridade.

Implemente:

- Autenticação segura.
- Autorização no servidor.
- Isolamento entre usuários e empresas.
- Validação de entradas.
- Proteção contra SQL Injection.
- Proteção contra XSS.
- Proteção CSRF quando aplicável.
- Controle de acesso a anexos.
- Rate limiting.
- Logs de auditoria.
- Tratamento seguro de erros.
- Gerenciamento de segredos.
- HTTPS em produção.
- Backups e procedimento documentado de restauração.
- Proteção de dados sensíveis.
- Política de retenção de dados.
- Fluxos de exportação e exclusão de dados pessoais.

Projete o tratamento de dados considerando os princípios da LGPD.

Nunca coloque segredos no frontend.

Não registre senhas, tokens ou informações financeiras desnecessárias em logs.

A plataforma inicial não deve movimentar dinheiro real nem armazenar credenciais bancárias de terceiros.

Integrações bancárias futuras deverão usar provedores autorizados e fluxos apropriados de consentimento.

---

# 24. SISTEMA SAAS E MONETIZAÇÃO

Prepare a plataforma para diferentes planos.

## Plano gratuito

- Gestão pessoal básica.
- Transações.
- Contas.
- Dashboard.
- Relatórios essenciais.

## Plano pessoal premium

- Mais recursos de planejamento.
- Metas avançadas.
- Relatórios completos.
- IA.
- Recursos adicionais de cartões.

## Plano profissional

- Recursos empresariais.
- Fluxo de caixa.
- Contas a pagar e receber.
- Clientes e fornecedores.
- Relatórios empresariais.

## Plano empresarial

- Múltiplos usuários.
- Permissões.
- Centros de custo.
- Gestão de múltiplas empresas.
- Relatórios avançados.
- Automações.

Crie uma arquitetura centralizada de permissões por plano.

Prepare a estrutura para cobranças recorrentes no futuro.

Não implemente cobranças reais, assinaturas pagas ou operações financeiras externas sem configuração e autorização explícitas.

Os preços poderão ser definidos posteriormente.

---

# 25. APLICATIVO MOBILE

Após estabilizar o núcleo web, desenvolva o aplicativo em React Native com Expo, utilizando a mesma API.

## Telas principais

- Login.
- Cadastro.
- Onboarding.
- Dashboard.
- Movimentações.
- Nova transação.
- Contas.
- Cartões.
- Metas.
- Orçamentos.
- Notificações.
- Assistente IA.
- Configurações.

Para empresas:

- Fluxo de caixa.
- Contas a pagar.
- Contas a receber.
- Indicadores empresariais.

## Experiência mobile

- Navegação inferior organizada.
- Gestos naturais.
- Componentes adaptados ao toque.
- Formulários rápidos.
- Estados de carregamento.
- Tratamento de falhas de conexão.
- Armazenamento seguro de credenciais.
- Suporte inicial a Android e iOS.

Não crie um aplicativo desconectado do sistema web.

Web e mobile devem compartilhar dados reais, regras de negócio e API.

---

# 26. ORGANIZAÇÃO DO CÓDIGO

Utilize uma estrutura profissional em monorepo, como referência:

```text
finance-platform/
├── apps/
│   ├── web/
│   ├── mobile/
│   └── api/
├── packages/
│   ├── shared/
│   ├── ui/
│   ├── validation/
│   └── config/
├── database/
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md
```

Ajuste conforme necessário.

Quero:

- Componentes reutilizáveis.
- Separação clara de responsabilidades.
- Tipagem consistente.
- Validação compartilhada quando possível.
- APIs documentadas.
- Tratamento centralizado de erros.
- Código legível.
- Nomenclatura padronizada.
- Ausência de código morto.
- Dependências justificadas.
- Estrutura preparada para manutenção.

---

# 27. QUALIDADE E TESTES

Não considere uma funcionalidade concluída apenas porque a tela foi criada.

Implemente testes automatizados para as regras críticas.

## Prioridades de teste

- Cadastro e login.
- Permissões.
- Isolamento de ambientes.
- Cadastro de transações.
- Cálculo de saldo.
- Transferências.
- Compras parceladas.
- Faturas.
- Pagamento de contas.
- Contas a receber.
- Orçamentos.
- Metas.
- Relatórios.
- Importações.
- Tratamento de entradas inválidas.

Inclua testes de integração para as principais rotas e testes end-to-end para os fluxos centrais.

Verifique cenários extremos:

- Valores negativos.
- Duplicações.
- Contas sem saldo.
- Datas inconsistentes.
- Operações simultâneas.
- Falhas de rede.
- Usuários sem permissão.
- Registros de outros ambientes.
- Reversões e estornos.

Os dados financeiros precisam continuar consistentes mesmo quando uma operação falha.

---

# 28. REGRAS IMPORTANTES DE DESENVOLVIMENTO

Siga rigorosamente:

1. Não criar botões sem funcionalidade real.
2. Não criar dados financeiros fictícios na conta de um usuário sem indicação explícita de demonstração.
3. Não inventar integrações.
4. Não simular uma IA real com respostas fixas.
5. Não duplicar lógica de negócio.
6. Não deixar links quebrados.
7. Não ignorar erros do backend.
8. Não misturar dados pessoais e empresariais.
9. Não implementar cálculos financeiros aproximados quando a precisão for necessária.
10. Não usar recursos pagos sem necessidade.
11. Não adicionar dependências desnecessárias.
12. Não substituir segurança real por validações apenas visuais.
13. Não apagar recursos funcionais sem justificativa.
14. Não declarar funcionalidades concluídas sem testá-las.
15. Não deixar formulários que aparentem salvar mas não persistam dados.

Caso uma funcionalidade ainda não esteja implementada, indique isso claramente. Não apresente uma simulação como recurso pronto.

---

# 29. ESTRATÉGIA DE IMPLEMENTAÇÃO

O projeto é grande. Desenvolva progressivamente, garantindo estabilidade.

## Fase 1 — Fundação

Implemente:

- Arquitetura.
- Monorepo.
- Configuração.
- Banco de dados.
- Autenticação.
- Workspaces pessoais e empresariais.
- Sistema de permissões.
- Design system.
- Layout principal.
- Site institucional.

## Fase 2 — Núcleo financeiro

Implemente:

- Contas e carteiras.
- Categorias.
- Transações.
- Transferências.
- Saldos.
- Dashboard.
- Filtros.
- Histórico.

Esta fase deverá entregar um sistema realmente utilizável.

## Fase 3 — Planejamento pessoal

Implemente:

- Cartões.
- Faturas.
- Parcelamentos.
- Orçamentos.
- Metas.
- Dívidas.
- Patrimônio.
- Relatórios pessoais.

## Fase 4 — Gestão empresarial

Implemente:

- Contas a pagar e receber.
- Fluxo de caixa.
- Clientes.
- Fornecedores.
- Centros de custo.
- Relatórios empresariais.
- Equipes.
- Gestão de múltiplas empresas.

## Fase 5 — Recursos inteligentes

Implemente:

- Notificações.
- Recorrências.
- Importação/exportação.
- Anexos.
- Assistente IA.
- Análises financeiras.
- Projeções.

## Fase 6 — Aplicativo

Implemente:

- React Native com Expo.
- Telas principais.
- Integração com API.
- Sincronização.
- Autenticação mobile.
- Notificações quando configuradas.

## Fase 7 — SaaS e produção

Implemente ou prepare:

- Planos.
- Permissões comerciais.
- Monitoramento.
- Backups.
- Otimização.
- Segurança adicional.
- Documentação de deploy.
- Preparação para integrações externas.

---

# 30. COMO VOCÊ DEVE TRABALHAR

Antes de desenvolver:

1. Analise a estrutura do repositório.
2. Identifique os recursos disponíveis.
3. Defina a arquitetura.
4. Defina a estrutura do banco.
5. Organize as tarefas.
6. Identifique dependências.
7. Comece a implementação.

Durante o desenvolvimento:

- Trabalhe diretamente nos arquivos do projeto.
- Utilize comandos e ferramentas disponíveis.
- Instale dependências necessárias.
- Crie migrations.
- Execute testes.
- Corrija erros.
- Teste os fluxos completos.
- Mantenha a arquitetura consistente.
- Documente decisões importantes.
- Preserve a compatibilidade entre módulos.

Não se limite a explicar como implementar. Implemente o código efetivamente.

Caso não exista banco configurado, crie a configuração local utilizando Docker Compose e documente os comandos necessários.

Não solicite credenciais reais, serviços pagos ou informações desnecessárias apenas para continuar o desenvolvimento local.

Quando serviços externos forem obrigatórios, prepare adaptadores, variáveis de ambiente e mensagens claras de configuração pendente.

---

# 31. DOCUMENTAÇÃO OBRIGATÓRIA

Crie e mantenha:

**README.md**

- Descrição.
- Tecnologias.
- Requisitos.
- Instalação.
- Inicialização.
- Testes.
- Estrutura.

**ARCHITECTURE.md**

- Arquitetura.
- Componentes.
- Decisões.
- Fluxos de dados.

**DATABASE.md**

- Entidades.
- Relacionamentos.
- Regras financeiras.
- Migrações.

**ROADMAP.md**

- Fases.
- Tarefas.
- Funcionalidades completas.
- Funcionalidades pendentes.
- Problemas conhecidos.

**DEPLOYMENT.md**

- Preparação para produção.
- Variáveis de ambiente.
- Configuração da hospedagem.
- Banco de dados.
- Segurança.
- Backups.

Inclua um `.env.example` sem credenciais reais.

---

# 32. CRITÉRIOS DE ACEITAÇÃO

Para considerar a primeira versão pronta, preciso conseguir:

1. Abrir o site institucional.
2. Criar uma conta.
3. Entrar no sistema.
4. Criar um ambiente pessoal.
5. Criar um ambiente empresarial.
6. Alternar entre ambientes.
7. Cadastrar contas financeiras.
8. Registrar receitas e despesas.
9. Realizar transferências entre contas.
10. Ver os saldos corretos.
11. Visualizar gráficos reais.
12. Cadastrar categorias.
13. Editar e consultar movimentações.
14. Aplicar filtros.
15. Criar orçamentos e metas.
16. Acessar o sistema pelo celular.
17. Sair e entrar novamente sem perder os dados.
18. Ter os dados protegidos de outros usuários.

Todas essas operações precisam funcionar com persistência real.

O projeto também deve passar nos testes automatizados aplicáveis e executar sem erros críticos.

---

# 33. EXPECTATIVA FINAL

Quero que você pense como se estivesse desenvolvendo uma nova empresa de tecnologia financeira com potencial de crescimento no Brasil e, futuramente, no mercado internacional.

O sistema deve ter:

- Qualidade visual de uma fintech profissional.
- Profundidade funcional de uma plataforma financeira robusta.
- Facilidade de uso de um aplicativo moderno.
- Arquitetura de um SaaS escalável.
- Segurança apropriada para informações financeiras.
- Código de qualidade e manutenção simples.

Evite criar uma interface bonita sobre um sistema incompleto.

Prefiro menos recursos realmente funcionais em cada entrega do que dezenas de recursos que apenas aparentam funcionar.

**Prioridade máxima: qualidade, funcionalidade real, usabilidade e estabilidade.**

## INSTRUÇÃO FINAL

Comece imediatamente pela análise do projeto e pela implementação da Fase 1, seguida do núcleo financeiro da Fase 2.

Se o repositório estiver vazio, crie a estrutura desde o início.

Se já existir código, preserve e melhore a base existente.

Tome decisões técnicas razoáveis sem interromper o desenvolvimento para perguntas triviais. Solicite confirmação apenas quando houver escolhas de negócio essenciais, ações irreversíveis, cobranças ou uso de credenciais reais.

Ao terminar cada etapa, informe:

- O que foi implementado.
- Quais arquivos foram criados ou modificados.
- Quais testes foram executados.
- O que está funcionando.
- O que ainda falta.
- Como executar e verificar o sistema.

Não declare o projeto inteiro concluído enquanto existirem fases pendentes.

**Comece a construir o produto real agora.**
