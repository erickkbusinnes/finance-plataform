# Roadmap e estado da entrega

A base web e o núcleo financeiro estão funcionais, com consolidação e uma primeira entrega de planejamento pessoal. **O produto completo permanece em desenvolvimento.**

## Fundação e núcleo entregues

- [x] Monorepo TypeScript, web/API separados, PostgreSQL e migrações versionadas.
- [x] Cadastro/login, sessões, senha, verificação e recuperação com e-mail local; adaptador SMTP.
- [x] Ambientes pessoais/empresariais isolados e autorização no servidor.
- [x] Site institucional, contato persistido, interface responsiva e modo claro/escuro.
- [x] Contas, categorias, receitas/despesas, transferências atômicas, saldos e auditoria.
- [x] Edição/cancelamento de movimentações com versão e idempotência.

## Prioridade 1 — consolidação entregue

- [x] Edição, arquivamento e reativação de contas/categorias sem perder saldos ou histórico.
- [x] Extrato com abertura, evolução do saldo, fechamento e paginação correta.
- [x] Reembolsos vinculados, limite acumulado, tags e subcategorias.
- [x] Filtros por tipo/conta/categoria e filhas/tag/valor, busca e ordenação nas movimentações.
- [x] Dashboard com intervalos de 1/3/6 meses e comparação com o período anterior.
- [x] Histórico detalhado/paginado dos aportes em metas.
- [x] Perfil editável, troca de e-mail com reautenticação, exportação JSON e exclusão confirmada de conta.
- [x] Migração testada sobre dados da versão antiga e exclusão atômica de ambiente preenchido.

Evoluções ainda pendentes do núcleo: duplicação explícita, personalização de indicadores, múltiplas moedas e status agendado/previsto. A exclusão bloqueia ambientes compartilhados sob propriedade do solicitante; transferência de titularidade pela interface virá na gestão de equipes.

## Prioridade 2 — planejamento pessoal entregue nesta versão

- [x] Cartões: cadastro, edição/arquivamento, limite e ciclo.
- [x] Compras parceladas, divisão exata de centavos e faturas futuras.
- [x] Fechamento inclusivo e vencimento com ajuste para meses curtos.
- [x] Liquidação integral com uma única saída de caixa, idempotência e confirmação do valor esperado.
- [x] Estornos parciais/integrais como créditos em fatura, com compensação futura e trilha.
- [x] Reabertura coordenada de fatura e reversão de sua saída/créditos.
- [x] Dívidas manuais: credor, principal, taxa informativa, vencimento, amortização/juros pagos e cancelamento de pagamento.
- [x] Bens e investimentos: quantidade decimal, aplicado, avaliações manuais e histórico.
- [x] Patrimônio estimado sem dupla contagem de investimento vinculado à conta.
- [x] Relatórios financeiros CSV, PDF e Excel com os mesmos filtros.

Limites desta entrega: liquidação de fatura é integral; não há rotativo ou juros automáticos. A categoria da compra é informativa na fatura; o caixa registra pagamento de fatura, sem duplicar a compra. Dívidas não têm agenda automática de parcelas, renegociação ou capitalização. Investimentos não têm cotações, ordens, aportes/resgates automáticos ou histórico de negociação de quantidades. Os relatórios exportados cobrem movimentações de caixa; demonstrativos especializados de patrimônio, investimentos e cartões ficam para evolução posterior.

## Próxima prioridade — gestão empresarial, fase 4

- [ ] Contas a pagar/receber, parcelas, baixas parciais e comprovantes.
- [ ] Converter baixas em movimentações sem duplicação.
- [ ] Separar fluxo de caixa realizado e projetado.
- [ ] Clientes, fornecedores e centros de custo.
- [ ] Convites, equipes, papéis e transferência de propriedade pela interface.
- [ ] Relatórios empresariais e demonstrativo gerencial, sem confundir caixa com lucro contábil.

## Recursos inteligentes, fase 5

- [ ] Importação CSV com prévia, validação e deduplicação.
- [ ] Recorrências, notificações internas e preferências.
- [ ] Anexos privados, validação e controle de acesso.
- [ ] Assistente IA real no backend, ferramentas autorizadas, limites e histórico privado.

Nenhuma integração de IA, banco, cobrança ou envio externo de mensagens foi ativada nesta entrega.

## Aplicativo, fase 6

- [ ] Expo/React Native com a mesma API e dados reais.
- [ ] Autenticação nativa, armazenamento seguro e tratamento de conexão/sincronização.
- [ ] Telas principais e testes em Android/iOS.
- [ ] Push quando houver provedor configurado.

A web responsiva está disponível; não equivale a aplicativo nativo.

## SaaS e preparação para produção, fase 7

- [ ] Domínio, hospedagem, PostgreSQL de produção e HTTPS.
- [ ] SMTP real, DNS do remetente e teste de entrega.
- [ ] Identificação jurídica, canal LGPD e termos/retenção definitivos.
- [ ] MFA, revisão de segurança e proteção contra abuso distribuído.
- [ ] Monitoramento, alertas, backups automáticos e restauração em homologação.
- [ ] Planos, limites e permissões comerciais centralizadas.
- [ ] Cobrança somente após configuração e autorização específicas.
- [ ] Validar CI remoto e deploy completo.

## Limites operacionais

- BRL apenas; registros datados no futuro são confirmados, não previsões.
- Saldo pode ficar negativo; nenhuma operação move dinheiro real.
- Rate limiter em memória numa única instância. Escala horizontal exige estado compartilhado.
- Exportações financeiras: até 10.000 linhas; privacidade: até 10.000 registros por entidade. Excedentes são rejeitados explicitamente.
- Perfis e dados de ambientes exclusivos podem ser excluídos. Auditoria de ambientes de terceiros é preservada com ator anonimizado; mensagens de contato têm finalidade separada.
- E-mail local contém links sensíveis em pasta ignorada pelo Git; entrega SMTP externa não foi validada.
