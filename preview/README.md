# Clara em um único HTML

Baixe **[Clara.html](Clara.html)** e abra o arquivo com dois cliques no computador. Não é necessário instalar Node, iniciar um servidor ou acessar a internet. O CSS, os ícones, os gráficos e o código de navegação estão dentro do próprio arquivo.

Use **Site**, **Painel**, os links do menu lateral ou **Escolha uma tela** na barra superior. Há 39 telas: páginas públicas, acesso/cadastro, dashboard claro/escuro, movimentações, contas/categorias, extrato, reembolsos, cartões/parcelas/faturas, patrimônio/dívidas, metas/orçamentos, relatórios, perfil/privacidade, formulários e históricos. Inclui uma visão empresarial de exemplo.

É uma visualização para consulta do sistema existente. Os exemplos financeiros e o perfil são inteiramente fictícios, identificados na barra superior. Inputs ficam bloqueados; botões de gravação e exportação exibem um aviso. O HTML não autentica usuários, envia mensagens, altera registros ou representa um banco de dados. A aplicação conectada continua sendo necessária para essas operações. Os períodos, dados e gráficos refletem a captura; filtros não recalculam dados neste arquivo.

## Regenerar

Com as dependências e o Chromium instalados, configure `TEST_DATABASE_URL` em `.env`, apontando para um banco separado terminado em `_test`, e execute:

```bash
npm run preview:html
```

O script cria um schema temporário nesse banco, aplica as migrações, cadastra exemplos usando a própria API e captura as telas reais com Playwright. Ao terminar, remove o schema e fecha os processos que iniciou. Não lê contas de usuários nem adiciona exemplos ao banco de desenvolvimento. Nenhuma senha, cookie, token, `.env` ou conexão PostgreSQL é incorporada ao HTML.

Para testar apenas o arquivo pronto, sem banco ou API:

```bash
npm run test:html
```

O teste carrega o conteúdo do arquivo em Chromium com a rede desabilitada, percorre as 39 telas, verifica diálogos, avisos, navegação, tema e largura móvel. A política do Chromium deste ambiente bloqueia navegação `file://`; por isso o teste usa `setContent`, sem contornar a política. O arquivo foi construído sem dependências externas, mas a abertura com duplo clique no computador do usuário ainda depende da verificação dele.
