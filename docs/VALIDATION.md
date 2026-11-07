# Validação da entrega atual

Executada em 7 de novembro de 2026, com Node 24.22.1, npm 11.9, PostgreSQL 17.6 em Docker e Chromium do ambiente.

## Base anterior, antes de versionar

`npm run typecheck`, `npm test` (21 testes), `npm run build` e `npm run test:e2e` (quatro cenários) passaram antes do commit `48a1e31`, enviado à branch `feat/clara-core-and-planning`.

## Continuação

- `npm run db:migrate`: migrações 002–004 aplicadas. O teste automatizado começa com a versão 001 preenchida, migra duas vezes e confirma preservação de conta, saldo e lançamentos.
- `npm run typecheck`: verificações estritas, incluindo código não utilizado.
- `npm test`: **47 testes passaram**, zero falhas, zero ignorados na execução registrada. Abrangem o núcleo original e os cenários de consolidação, cartões, dívidas, patrimônio, privacidade e exportações.
- `npm run test:e2e`: **7 cenários passaram**, zero falhas, zero ignorados. Exercitam a jornada original, consolidação completa até exclusão de conta preenchida, cartões/parcelas/faturas/estornos/reabertura, dívidas/pagamentos/cancelamento, bens/investimentos/avaliações, perfil/exportação, experiência móvel e páginas públicas.
- Verificações axe de WCAG 2 A/AA: início, dashboard claro/escuro, cartões e patrimônio claro/escuro sem violações reportadas nas páginas avaliadas. Viewport móvel 390 × 844 verificado também nas páginas novas.
- `npm run test:build`: verificação reproduzível do artefato compilado em schema isolado e porta 3003: PostgreSQL, autenticação, parcelas exatas, PDF/Excel e OpenAPI.
- `npm run build`: API e web compiladas. Contratos compartilhados de planejamento são empacotados na API; dashboard segue carregado sob demanda.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas nas dependências de produção na consulta realizada.

## Regressões e casos financeiros cobertos

- Edição/arquivamento não alteram saldo; novos vínculos a arquivados são rejeitados; versões antigas causam conflito.
- Subcategorias respeitam ambiente, tipo e ausência de ciclos; conta vinculada a investimento não muda de tipo.
- Extrato soma abertura e janela SQL antes de paginar; segunda página preserva o saldo acumulado.
- Reembolsos concorrentes não excedem a despesa, não viram receita e podem produzir despesa líquida negativa quando devolvem gasto anterior.
- Parcelas somam exatamente a compra, inclusive divisão com resto; ciclos cobrem fechamento inclusivo, virada de ano e fevereiro bissexto/curto.
- Compras não alteram o caixa; liquidação concorrente/idempotente gera uma única despesa; valor esperado, conta, fechamento e ordem são verificados.
- Estornos após pagamento viram créditos futuros; compensação sem dinheiro e reabertura preservam a trilha e o patrimônio; lançamentos retroativos não criam lacunas antes de faturas liquidadas.
- Dívidas limitam amortização concorrente ao principal; juros pagos afetam caixa; cancelamento reverte saída e amortização.
- Avaliações retroativas não substituem posteriores; quantidade decimal é preservada; vínculo de investimento evita dupla contagem.
- PDF gerado é lido no teste e contém somente dados filtrados; Excel é descompactado e seu XML verificado, incluindo centavos inteiros e ausência de fórmulas injetadas.
- Perfil exige reautenticação para novo e-mail; exportação não contém senhas/hashes/tokens.
- Exclusão de conta preenchida remove categorias/filhas, lançamentos/reembolsos, metas, faturas, créditos, dívidas e investimentos atomicamente, sem afetar terceiros. Propriedade compartilhada bloqueia exclusão sem remoção parcial.
- Visualizador não pode editar cadastros nem criar cartões, dívidas ou patrimônio. Limitação de tentativas de login continua ativa e é testada.

Os testes utilizam schemas isolados em `clara_test`, removidos depois das execuções. Capturas e traces ficam em `test-results/`, ignorados pelo Git. Não foram adicionados dados financeiros fictícios a contas de usuário no banco de desenvolvimento.

Não houve deploy externo, envio SMTP real, integração financeira ou serviço pago. A execução remota do workflow de CI e restauração em uma nova tarefa de nuvem não foram confirmadas. As verificações automatizadas descrevem o recorte testado; não equivalem a certificação integral de segurança/acessibilidade.
