# Banco de dados e regras financeiras

PostgreSQL 17; todos os IDs são UUID, datas de competência são `date` (sem conversão de fuso) e eventos são `timestamptz`. A moeda inicial é BRL; múltiplas moedas ainda não são suportadas. A data inicial nos formulários usa America/Sao_Paulo.

## Modelo atual

- `users` → `sessions`, `auth_tokens` e `mail_outbox`: identidade, sessões e links temporários. As senhas têm hash Argon2id; os tokens de sessão e de uso único têm hash SHA-256. O token em trânsito na outbox é apagado após envio; proteja banco e backups.
- `workspaces` ↔ `users` por `workspace_members`: ambiente pessoal/empresarial e papel. Índice por usuário e associação única por ambiente.
- `financial_accounts`: contas; `categories`: categorias de receita/despesa. Identidade composta `(workspace_id,id)` protege referências cruzadas.
- `transactions` → `transaction_entries`: operação e seus efeitos assinados em cada conta. Índice por ambiente e data; chave única de idempotência por ambiente.
- `budgets`: limite único por categoria/mês; restrição exige primeiro dia do mês. A API só aceita categoria de despesa do ambiente.
- `goals` → `goal_contributions`: objetivo e histórico manual de progresso. Aporte idempotente, sem lançamentos em conta.
- `audit_logs`: ator, ação, entidade, instante, estado anterior e posterior. Nunca exposto sem verificar o ambiente.
- `contact_messages`: mensagens do site, sem rota pública de leitura.
- `schema_migrations`: migrações aplicadas.

Cartões e planejamento pessoal estão descritos abaixo. Contas a pagar/receber empresariais, clientes e assinaturas ainda não têm tabelas nesta versão.

## Precisão

Valores de movimentações são `bigint` de centavos; não se usa `float` para persistir ou somar dinheiro. Entrada monetária brasileira é convertida por string e BigInt. Cada valor é limitado a 1.000.000.000.000 centavos. Agregados são somados pelo PostgreSQL e a conversão para JSON verifica `Number.isSafeInteger`; se um total exceder esse intervalo, a API falha em vez de arredondar. Percentuais e gráficos são apenas representações visuais de totais inteiros.

## Saldo e resultado

Saldo = soma dos lançamentos de operações não canceladas. Receita e reembolso são positivos; despesa é negativa; transferência debita origem e credita destino. Saldo inicial é uma operação `opening` com lançamento assinado e não participa de receita/despesa. Não há campo de saldo alterado sem trilha.

A soma de transferência deve ser zero: a API grava os dois lançamentos em uma única transação. O banco verifica chaves estrangeiras, limite de valores, unicidade e contas distintas. A restrição de exatamente dois lançamentos por transferência é garantida pelo serviço transacional (não por trigger); não permita gravação direta por outros serviços.

Saldos negativos são permitidos e aparecem explicitamente. Datas futuras são confirmadas, não previstas. Resultado de caixa = receitas − (despesas brutas − reembolsos) do período. Não representa lucro contábil. O saldo consolidado considera todas as datas; as métricas do período respeitam os filtros. Não há integrações com bancos ou ordens de pagamento.

## Concorrência e auditoria

Escritas financeiras bloqueiam a linha do ambiente. `Idempotency-Key` UUID é obrigatório na criação de movimentação e aporte. Reutilizar a mesma chave com dados diferentes resulta em 409; repetir a mesma movimentação não gera lançamentos adicionais. Edição/cancelamento exigem `version`, evitando sobrepor atualização concorrente. Gravação e auditoria são atômicas. O resumo é calculado em snapshot de leitura repetível.

## Migrações

`npm run db:migrate` executa SQL ainda não aplicado em ordem, com advisory lock e transação. Repita o comando com segurança. Não altere migrações publicadas; adicione um novo arquivo. Não há rollback destrutivo automático. Para mudanças em produção, faça backup e planeje uma migração corretiva compatível. Restauração está em DEPLOYMENT.md.

## Migração 002 — consolidação

Contas e categorias ganham `version` e `archived_at`; categorias recebem `parent_id` com referência composta no ambiente. Movimentações recebem `tags`, `refund_of` e `source_type`. O vínculo de reembolso é obrigatório somente para `kind=refund`. Categorias de reembolsos seguem a despesa de origem. Orçamentos de categoria principal incluem suas subcategorias e os reembolsos do mês. Auditoria admite ator removido/anônimo, preservando registros de terceiros.

O extrato soma lançamentos anteriores ao início para calcular a abertura e usa uma janela SQL ordenada por data, criação e ID antes da paginação. A consulta inteira usa leitura repetível. Saldo progressivo não é recalculado apenas com as 25 linhas da página.

## Migração 003 — cartões, dívidas e patrimônio

- `credit_cards`: limite, fechamento, vencimento, versão e arquivamento. Não armazena número de cartão ou credenciais.
- `card_purchases` e `card_installments`: compra original e parcelas inteiras que somam exatamente seu total. Chave de idempotência por ambiente.
- `card_statements`: competência por vencimento, fechamento, liquidação e vínculo à despesa bancária. Uma fatura por cartão/vencimento.
- `card_refunds`: créditos vinculados à compra, limitados ao valor original. O ciclo respeita as liquidações existentes.
- `card_credit_entries`: histórico assinado dos créditos gerados/consumidos na compensação de faturas. O crédito disponível é calculado pela soma, sem saldo alterado isoladamente.
- `debts` e `debt_payments`: principal original, taxa mensal em pontos-base (informativa), vencimento, amortização, juros pagos, vínculo ao caixa e cancelamento preservado.
- `holdings` e `holding_valuations`: bem/investimento, quantidade `numeric(24,8)`, valor aplicado em centavos e avaliações totais datadas. A avaliação mais recente por data/criação/ID define o valor atual. Avaliações retroativas não sobrescrevem avaliações posteriores.

A posição líquida de cartão é o total de parcelas abertas menos estornos abertos e créditos já compensados. Pode ser negativa quando existe crédito a favor do titular. O limite disponível considera essa posição. A liquidação integral registra apenas a saída que sobra depois de aplicar créditos. Não há rotativo, cálculo automático de juros ou pagamento parcial de fatura.

Patrimônio estimado = contas não substituídas por investimento vinculado + avaliações manuais − principal das dívidas pendente − posição líquida dos cartões. Vincular um investimento exige uma conta de investimento do próprio ambiente e vínculo único. Alterar o tipo de uma conta já vinculada é bloqueado. Nenhuma avaliação ou cadastro de dívida/bem gera dinheiro na conta.

## Migração 004 — exclusão atômica

Referências financeiras `NO ACTION` entre tabelas dependentes tornam-se `DEFERRABLE INITIALLY DEFERRED`. Elas continuam sendo verificadas ao confirmar a transação. Isso permite remover um ambiente completo sem que a ordem interna das cascatas deixe referências temporárias impedindo a exclusão. Os testes cobrem conta preenchida, reembolsos, categorias com filhas, metas, faturas, créditos, dívidas e investimentos, e verificam que dados de terceiros permanecem intactos.
