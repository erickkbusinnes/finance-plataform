# Roadmap e estado da entrega

Esta entrega cobre a base das fases 1–2 e dois recursos de planejamento. **O produto completo permanece em desenvolvimento.**

## Entregue e validável

- [x] Monorepo TypeScript; web estático e API separados.
- [x] PostgreSQL, migrações e Docker Compose de desenvolvimento.
- [x] Cadastro/login, sessões, logout, senha, confirmação e recuperação com e-mail local; adaptador SMTP.
- [x] Ambientes pessoais/empresariais isolados e autorização de proprietário/admin/financeiro/visualizador na API.
- [x] Layout responsivo, estados vazios, navegação, modos claro/escuro no painel.
- [x] Site institucional e contato persistido. Textos legais identificados como preliminares.
- [x] Contas, saldo inicial rastreável, categorias, receitas e despesas.
- [x] Transferências vinculadas e atômicas, idempotência e precisão em centavos.
- [x] Edição com versão, cancelamento preservando auditoria, filtros e paginação.
- [x] Saldos e gráficos reais; exportação CSV respeitando filtros e protegendo fórmulas de planilha.
- [x] Limites mensais por categoria e metas com histórico de aportes manuais na API.
- [x] Testes de integração de regras críticas e jornada web/mobile responsiva.

## Fase 1 — antes de lançamento comercial

- [ ] Domínio e identificação jurídica real, termos definitivos, canal LGPD e política de retenção.
- [ ] Provar entrega SMTP em infraestrutura do operador e configurar DNS do remetente.
- [ ] Exclusão e exportação completa de dados pessoais (CSV financeiro já disponível).
- [ ] MFA e controles contra abuso distribuído; revisão independente de segurança.
- [ ] Observabilidade externa, política de backup com restauração em ambiente de homologação.

## Fase 2 — evolução do núcleo

- [ ] Duplicação explícita de movimentação, tags, subcategorias e reembolsos.
- [ ] Arquivar/editar contas e categorias; extrato com saldos de abertura e saldo progressivo.
- [ ] Comparações entre meses e personalização do dashboard.
- [ ] Filtros/ordenação adicionais e limites de escala documentados.

## Fase 3 — planejamento pessoal

Orçamentos e metas básicos disponíveis. Pendentes cartões, compras parceladas, fechamento/vencimento, pagamento de fatura sem dupla contagem, estornos, dívidas, bens, investimentos manuais e relatórios PDF/Excel. Histórico de aportes é persistido, mas sua tela detalhada ainda não foi implementada.

## Fase 4 — gestão empresarial

Ambientes empresariais e isolamento disponíveis. Pendentes contas a pagar/receber, baixas parciais, projeções, clientes, fornecedores, centros de custo, convites e gestão de equipe pela interface. Não há DRE ou lucro contábil nesta versão.

## Fase 5 — recursos inteligentes

CSV de saída disponível. Pendentes importação com prévia/deduplicação, notificações, recorrências, anexos privados, automações e assistente IA real com ferramentas autorizadas. Nenhuma integração de IA está ativa.

## Fase 6 — aplicativo

A interface web é responsiva e testada em viewport móvel. Aplicativo Expo Android/iOS, armazenamento seguro, sincronização e notificações push ainda não foram criados. A API é reutilizável, mas autenticação específica para cliente nativo exige projeto e revisão próprios.

## Fase 7 — SaaS e produção

Planos são informativos e sem preços inventados. Pendentes permissões comerciais centralizadas, cobrança (somente com autorização futura), limites por plano, deploy operacional, monitoramento e teste de recuperação de desastre. Não há cobrança nem movimentação externa.

## Limitações conhecidas

- Uma única moeda BRL; saldo inclui todos os registros confirmados, mesmo futuros. Não há status previsto/pendente nesta fase.
- Conta pode ficar negativa; a Clara registra informações, não movimenta dinheiro real.
- Testes de e-mail cobrem tokens e revogação, mas não entrega SMTP externa. Mensagens locais contêm links sensíveis.
- Interface não permite editar nome/perfil, gerenciar membros ou apagar a conta ainda. Não sugere o contrário com botões inativos.
- Um único processo API para o rate limiter em memória. Implementação de produção requer persistência compartilhada e revisão de implantação.
