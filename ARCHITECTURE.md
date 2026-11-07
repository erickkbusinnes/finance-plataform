# Arquitetura

## Componentes

Monorepo npm com um frontend estático e uma API independente. A mesma API REST pode atender futuramente um cliente Expo; nenhum cliente nativo foi criado nesta entrega. `packages/shared` contém contratos TypeScript, esquemas Zod e utilitários monetários. A API valida toda entrada, independentemente do navegador.

- Web: React Router para navegação; TanStack Query para cache **indexado pelo ambiente** e invalidação após gravações; CSS próprio com tokens e componentes de formulário, modal nativo acessível, botões e estados vazios. React escapa o conteúdo do usuário.
- API: Fastify com plugins de autenticação e finanças encapsulados. Zod valida corpo, parâmetros, cabeçalhos e filtros. OpenAPI é derivada dos esquemas e oferecida em `/api/docs`. Erros internos retornam mensagem genérica; logs não registram corpos, senhas, cookies ou parâmetros de query.
- Banco: PostgreSQL via `pg`, SQL parametrizado e migrações em transações com lock consultivo. SQL explícito foi escolhido em vez de ORM para manter a primeira base pequena e tornar visíveis as restrições e operações contábeis. A interface da API permanece independente do driver.

## Acesso e sessões

Senhas usam Argon2id. Um token aleatório de 256 bits é enviado por cookie HttpOnly/SameSite=Lax (Secure em produção). Apenas SHA-256 do token é armazenado. Sessões expiram em sete dias e podem ser revogadas. Troca de senha encerra outras sessões; recuperação encerra todas e invalida os tokens restantes. Confirmação e recuperação têm tokens de uso único, expiração de uma hora e entrega por outbox. E-mails ainda não confirmados são explicitamente sinalizados, mas podem usar os registros manuais nesta versão.

Toda rota financeira consulta `workspace_members`. Leituras exigem associação; escritas exigem `owner`, `admin` ou `finance`. `viewer` só lê. O identificador de ambiente nunca é aceito como prova de acesso. Referências compostas no banco impedem vincular conta/categoria de outro ambiente. A gestão dessas associações pela interface fica para a fase empresarial.

Operações mutáveis exigem `X-Clara-Client: web`. Navegadores de outras origens não conseguem enviar esse cabeçalho sem preflight autorizado; o servidor também verifica `Origin`. CORS admite uma única origem configurada, com credenciais. A API não confia automaticamente em cabeçalhos de proxy. Produção deve manter TLS e usar a topologia documentada em DEPLOYMENT.md.

## Fluxo financeiro

1. Autenticar sessão, validar entrada e autorizar associação.
2. Abrir transação SQL e bloquear a linha do ambiente para serializar alterações contábeis.
3. Validar as referências; verificar chave de idempotência ou versão do registro.
4. Gravar movimentação, lançamentos e auditoria na mesma transação.
5. Confirmar e invalidar consultas do ambiente no frontend.

Transferências têm dois lançamentos opostos ligados à mesma operação. Editar substitui os lançamentos atomicamente e mantém o estado anterior na auditoria. Cancelar preserva registro e lançamentos, marcando a operação para exclusão dos cálculos. O frontend nunca calcula ou altera o saldo persistido.

## Limites atuais

A serialização por ambiente simplifica a consistência; maior escala pode migrar para locks por conta. Rate limiting e sessão operacional dependem de uma única instância da API nesta versão; múltiplas réplicas exigem rate limiter compartilhado. Não há mecanismo de dinheiro real, integração bancária, cotação, LLM, assinatura ou cliente mobile simulado. Arquivos privados, políticas comerciais, notificações e tarefas recorrentes serão módulos futuros, com autorização no mesmo contexto do ambiente.

O assistente IA, quando implementado, deverá receber somente resultados de ferramentas autorizadas do backend; cálculos continuarão no servidor e operações mutáveis exigirão confirmação. Sem configuração, deverá permanecer indisponível.
