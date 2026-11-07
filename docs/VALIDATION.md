# Validação da primeira entrega

Executada em 7 de novembro de 2026, com Node 24.22.1, npm 11.9, PostgreSQL 17.6 em Docker e Chromium do ambiente.

- `npm ci`: instalação reproduzível pelo lockfile concluída.
- `npm run db:migrate`: migrações aplicadas e repetição sem alterações.
- `npm run typecheck`: passou, com verificações de código não utilizado habilitadas.
- `npm test`: **21 testes passaram**, zero falhas, zero ignorados. Inclui precisão monetária, datas inválidas, segurança de sessão, isolamento, referências entre ambientes, permissão de visualizador, concorrência/idempotência de transferências, edição, cancelamento, orçamento, metas e recuperação de acesso.
- `npm run build`: API e frontend compilados. Dashboard carregado sob demanda; contratos do backend empacotados no artefato da API.
- `npm run test:e2e`: **4 cenários passaram**, zero falhas, zero ignorados. Cadastro até logout/login; contas, receitas/despesas, transferências, filtros e edição; orçamentos/metas e alternância de ambientes; navegação móvel em 390×844; páginas públicas e contato. Verificações axe de WCAG 2 A/AA na página inicial e no dashboard em modos claro/escuro sem violações reportadas no recorte avaliado.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas nas dependências de produção consultadas. O plugin de documentação com servidor estático foi substituído por um visualizador OpenAPI independente, sem CDN; Nodemailer atualizado.
- Artefato compilado da API iniciado em processo separado: conexão ao banco, rota protegida sem sessão retornando 401 e documentação OpenAPI verificados.
- Serviços de desenvolvimento reiniciados nas portas 3001/5173, com consulta real ao PostgreSQL e HTML do frontend confirmados.
- Banco de desenvolvimento sem usuários ou dados demonstrativos. Os testes usam schemas isolados em `clara_test`, removidos após as execuções. `.env`, mensagens locais, dependências e artefatos estão ignorados pelo Git.

Capturas de navegador ficam em `test-results/` (artefatos locais, não versionados). O workflow de CI foi criado, mas não foi executado remotamente nesta entrega. Não houve deploy externo, teste de SMTP real, aplicativo nativo nem validação de restauração numa nova tarefa de nuvem. Esses estados não devem ser inferidos dos testes locais.
