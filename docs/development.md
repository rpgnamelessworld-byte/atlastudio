# Atlas Studio — Guia técnico

Para executar o aplicativo, siga o [README](../README.md). As instruções de operação ficam no [guia de uso](user-guide.md).

## Estrutura

O editor carrega scripts clássicos diretamente pelo `index.html`, sem compilação. Os módulos compartilham o escopo global e dependem da ordem de carregamento. `scripts/validate.mjs` verifica essa ordem para JavaScript e CSS.

| Arquivos em `js/` | Responsabilidade |
| --- | --- |
| `core.js`, `geometry.js` | Estado, DOM, regras centrais, coordenadas, medidas e polígonos |
| `persistence.js`, `history.js` | IndexedDB, transações, snapshots e undo/redo |
| `projects.js`, `navigation.js` | Biblioteca, câmera, seletores e abertura de mapas |
| `maps.js`, `rendering.js` | Camadas Leaflet, Inspector e invalidação incremental |
| `editor.js`, `interaction.js` | Formulários, geometria em edição, ações visíveis e teclado |
| `data.js`, `connections.js`, `connection-editor.js` | Planilhas, backups, referências entre mapas, seleção de locais e integridade |
| `recovery.js`, `reading.js` | Rascunhos, estado de salvamento, consulta e filtros |
| `bootstrap.js`, `system-dialog.js` | Inicialização, eventos e diálogos |
| `admin.js` | Aplicação administrativa independente em `admin.html` |

| Arquivos em `css/` | Responsabilidade |
| --- | --- |
| `base.css`, `shell.css` | Fundamentos, estrutura da página e integração com Leaflet |
| `workflow.css`, `creation.css` | Ferramentas contextuais, seleção de Tipos e criação de objetos |
| `inspector.css`, `editor.css` | Painel de edição, busca, conexões, pop-ups e menu do mapa |
| `admin.css` | Estrutura e controles da Administração |
| `atlas-theme.css`, `shared-components.css` | Base visual, biblioteca, navegação e componentes compartilhados |
| `controls.css` | Tipografia, espaçamento, foco e estados dos controles |
| `studio-interface.css` | Paleta, apresentação dos componentes e layouts responsivos |
| `components/reading.css` | Consultas, filtros e formulários de conexão |

`studio-interface.css` encerra os estilos compartilhados. O editor carrega `components/reading.css` em seguida. Há regras de componentes distribuídas entre folhas; a ordem e a especificidade determinam o resultado. Ao consolidá-las, confira o editor e a Administração nos temas claro e escuro.

Os arquivos usam nomes em inglês e `kebab-case`. Comentários e documentação são escritos em português e descrevem responsabilidades, comportamento e restrições técnicas. Nomes de arquivos devem indicar sua função, sem rótulos de entrega ou numeração de etapas.

## Persistência e integridade

O banco `nameless-world-map-editor` contém `projetos`, `mapas`, `rascunhos` e `resumosMapas`. O nome do banco, as chaves de armazenamento e os campos de versão fazem parte da compatibilidade com projetos existentes. Alterá-los exige migração. Os formatos dos pacotes e suas versões são definidos junto aos validadores no código.

- Use `dbListarResumosMapas()` para nomes, IDs e contagens; `dbTodos()` lê mapas completos pelo índice do projeto. `dbTodosGlobais()` é uma API de compatibilidade usada nos testes, não uma opção para novas listagens.
- Grave com `transacaoMapas`, `gravarMapaNaTransacao` e `excluirMapaNaTransacao`. Mapa e resumo devem participar da mesma transação, inclusive em importações, histórico e conexões pareadas. Resolva promessas somente após o commit.
- Preserve mapas existentes durante migrações e mantenha IDs globalmente únicos. No importador, remapeie referências por IDs, nunca por coincidência de nomes.
- Rascunhos ficam separados dos objetos publicados. Falhas de gravação devem manter o formulário recuperável e permitir nova tentativa sem duplicação.
- Busca global, relações, sincronização de Fontes e backups podem precisar de dados completos; seletores de nomes não devem carregar imagens.

A Administração lê os mapas e grava seus cadastros em `atlas-studio-administracao`, store `configuracoes`. Não conecte suas políticas aos comandos do editor sem identidade autenticada, autorização central e tratamento de sessão/permissão ausente. O aviso ao usuário está em [Administração](user-guide.md#administração).

## Renderização, consulta e memória

`renderMapaCompleto()` tenta atualizar apenas objetos alterados e dependências locais. Ligações dependem de suas extremidades; regiões são invalidadas conservadoramente quando o conteúdo pontual muda. Mudanças amplas de contexto, formulário ativo ou `forcarCompleto: true` usam o caminho completo. A remoção deve limpar também registros de linhas e rótulos escaláveis. Use `metricasRenderizacao` para inspecionar os caminhos.

Pop-ups mantêm nós DOM: `Popup.update()` do Leaflet recria conteúdo fornecido como string e perderia filtros e detalhes abertos. Os estados das listas ficam em `WeakMap`, sem alterar os dados persistidos.

Os limites do histórico são definidos em `historicoGlobal`; o comportamento para o usuário está em [Rascunhos e histórico](user-guide.md#rascunhos-e-histórico). A memória é estimada pelo JSON estrutural em UTF-16 e por imagens distintas, não pelo heap real. Imagens iguais são compartilhadas e tamanhos de snapshots ficam em `WeakMap`. A poda ocorre ao finalizar o gesto/lote, sem dividir operações entre mapas; clones e operações pendentes podem exceder temporariamente o orçamento de retenção.

## Testes e revisão

Os scripts usam os módulos nativos do Node.js, sem instalação de pacotes. Os testes de navegador usam Google Chrome em modo headless; para outro caminho do executável, defina `CHROME_BIN`.

Na raiz do projeto, com o servidor local indicado no README em execução:

```bash
node scripts/validate.mjs
node scripts/audit-unused.mjs
node scripts/browser-smoke.mjs http://127.0.0.1:4173/index.html
```

A validação estática verifica arquivos, sintaxe, IDs, referências de DOM e ordem de carregamento. A auditoria aponta candidatos a código sem uso: revise-os antes de remover migrações, callbacks ou APIs de compatibilidade. Ela não substitui testes no navegador.

A suíte usa Chrome e banco/perfil temporários. Cobre edição, navegação, Administração, conexões, backups, recuperação, migração, atomicidade, dependências das camadas, histórico e consulta responsiva. Inclui destinos Único, Área, Linha e posição livre, ida e volta, somente ida e exclusão pelos dois lados do par. Para investigar um grupo, acrescente `--reliability-only`, `--optimization-only`, `--reading-only` ou `--connection-only`. Com `--reading-screenshots` ou `--connection-screenshots`, as capturas correspondentes ficam em `/tmp`, identificadas por largura, tema e, nas conexões, cenário. A visibilidade do primeiro resultado da consulta é verificada também sem capturas.

Para medir uma alteração, use `--performance-only --performance-output=/tmp/atlas-performance.json`. Compare a mesma carga e ambiente; esse teste sintético não representa todos os dispositivos nem o pico real de memória.

Antes de entregar uma mudança:

- confira criação, edição, cancelamento, salvamento e recarga sem exceções;
- teste origem e destino de ligações, importação e recuperação sem perda de dados;
- revise desktop, tablet e celular, teclado, foco e temas claro/escuro;
- verifique rolagem, limites dos pop-ups e ausência de overflow horizontal;
- atualize o tópico correspondente neste guia ou no manual, sem acrescentar um histórico paralelo de entregas.
