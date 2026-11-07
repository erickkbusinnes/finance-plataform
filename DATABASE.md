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

A estrutura de cartões, faturas, pagamentos parciais, clientes e assinaturas não existe ainda; será introduzida nas respectivas fases.

## Precisão

Valores de movimentações são `bigint` de centavos; não se usa `float` para persistir ou somar dinheiro. Entrada monetária brasileira é convertida por string e BigInt. Cada valor é limitado a 1.000.000.000.000 centavos. Agregados são somados pelo PostgreSQL e a conversão para JSON verifica `Number.isSafeInteger`; se um total exceder esse intervalo, a API falha em vez de arredondar. Percentuais e gráficos são apenas representações visuais de totais inteiros.

## Saldo e resultado

Saldo = soma dos lançamentos de operações não canceladas. Receita é positiva; despesa é negativa; transferência debita origem e credita destino. Saldo inicial é uma operação `opening` com lançamento assinado e não participa de receita/despesa. Não há campo de saldo alterado sem trilha.

A soma de transferência deve ser zero: a API grava os dois lançamentos em uma única transação. O banco verifica chaves estrangeiras, limite de valores, unicidade e contas distintas. A restrição de exatamente dois lançamentos por transferência é garantida pelo serviço transacional (não por trigger); não permita gravação direta por outros serviços.

Saldos negativos são permitidos e aparecem explicitamente. Datas futuras são confirmadas, não previstas. Resultado de caixa = receitas − despesas do período. Não representa lucro contábil. O saldo consolidado considera todas as datas; as métricas do período respeitam os filtros. Não há integrações com bancos ou ordens de pagamento.

## Concorrência e auditoria

Escritas financeiras bloqueiam a linha do ambiente. `Idempotency-Key` UUID é obrigatório na criação de movimentação e aporte. Reutilizar a mesma chave com dados diferentes resulta em 409; repetir a mesma movimentação não gera lançamentos adicionais. Edição/cancelamento exigem `version`, evitando sobrepor atualização concorrente. Gravação e auditoria são atômicas. O resumo é calculado em snapshot de leitura repetível.

## Migrações

`npm run db:migrate` executa SQL ainda não aplicado em ordem, com advisory lock e transação. Repita o comando com segurança. Não altere migrações publicadas; adicione um novo arquivo. Não há rollback destrutivo automático. Para mudanças em produção, faça backup e planeje uma migração corretiva compatível. Restauração está em DEPLOYMENT.md.
