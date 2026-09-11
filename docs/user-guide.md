# Atlas Studio — Guia de uso

O Atlas Studio transforma imagens em mapas navegáveis com objetos e dados associados. Para iniciar o aplicativo, veja o [README](../README.md); para manutenção do código, consulte o [guia técnico](development.md).

## Começar um projeto

1. Em **Meus projetos**, crie ou abra um projeto.
2. No **Menu principal**, escolha **Criar mapa**, selecione uma imagem PNG, JPEG ou WebP e informe um nome.
3. Use **Criar** e escolha um Tipo de marcação, ou cadastre um pelo botão `+` da barra inferior.
4. Preencha os dados desejados, posicione ou desenhe o objeto e clique em **Salvar**.
5. Consulte o resultado e [exporte um backup](#backup-e-recuperação).

Um **Projeto** reúne mapas independentes dos demais projetos. Um **Tipo** define a aparência e o comportamento; um **Objeto** é uma ocorrência desse Tipo no mapa. Tipos e Fontes de dados são compartilhados entre os mapas do mesmo projeto. As **Camadas** agrupam objetos por Tipo.

## Navegar e consultar

Arraste o mapa para mover a câmera. Use os controles `+` e `−`, a roda do mouse ou a pinça no celular para ajustar o zoom. Cada mapa lembra sua posição de câmera.

A busca superior seleciona mapas pelo nome; em **Meus projetos**, procura projetos pelo nome, descrição ou nome de seus mapas. O Menu principal reúne gerenciamento de projetos e mapas, pesquisa, backup, tema e Administração.

**Pesquisar objetos** encontra nome, descrição, Tipo, mapa e dados vinculados em todo o projeto. Escolher um resultado abre o mapa correspondente e destaca o objeto. Salve ou cancele formulários em andamento antes de navegar pela pesquisa.

### Informações e regiões

No modo Visualização, clique ou toque em um ponto ou região para consultar suas informações. Linhas mostram informações ao passar o ponteiro. Os pop-ups têm rolagem interna e se ajustam à área disponível.

Use **Abrir no painel** para manter a consulta enquanto move ou amplia o mapa. O painel fica à direita no desktop e embaixo no celular; preserva filtros e itens expandidos. Fecha pelo `×`, por `Escape` com foco nele ou ao trocar de mapa. Abrir outra consulta no painel substitui a anterior.

Dentro de uma região:

- busque por nome, descrição ou dados vinculados, sem distinguir acentos e maiúsculas;
- filtre por Tipo e confira as contagens de resultados, total e itens exibidos;
- expanda um item para ler seus detalhes;
- use **Mostrar mais 30** para carregar outro bloco ou **Limpar filtros** para voltar à lista completa;
- use **Localizar** para revelar e destacar o objeto sem perder a consulta.

A lista inclui objetos pontuais dentro do contorno. Para excluir um Tipo desse resumo, desative **Exibir objetos deste tipo no resumo de Áreas**.

### Camadas e Legenda

A árvore mostra Tipos, contagens e objetos. Os controles permitem ocultar a Camada inteira ou itens individuais sem apagá-los. O estado intermediário indica uma Camada parcialmente visível.

A ação de localizar revela objetos ocultos, ajusta a câmera e aplica um destaque temporário. Na árvore do modo Edição, também seleciona o objeto.

### Painéis e tema

**Ferramentas** abre as ações de edição, criação, Camadas, Dados, Legenda e Coordenadas. O Inspector é o painel de formulários e configurações; a Consulta é o painel de leitura.

Arraste a borda esquerda do Inspector para ajustar a largura e a alça inferior para ajustar a altura. Com essas alças em foco, use as setas; dois cliques na alça inferior restauram a altura automática. Conteúdo extenso recebe rolagem interna.

O Menu principal alterna o tema claro/escuro. Tema e dimensões do Inspector são lembrados pelo navegador.

## Criar e editar

Na barra de criação, clique no ícone do Tipo desejado. Ícones agrupados exibem um contador e abrem uma lista de Tipos. O `+` cadastra um Tipo; os três pontos abrem o gerenciador.

No modo Edição, selecione um objeto e escolha **Editar objeto** para alterar dados e geometria, ou **Editar tipo** para alterar as propriedades compartilhadas. Também é possível usar a ação de edição na consulta do objeto.

Nome, descrição e vínculos de dados são opcionais. Um objeto pode ter registro principal, vínculos adicionais e link com texto próprio. Links aceitam `http://`, `https://`, `/`, `./`, `../` ou `#` e abrem em outra aba.

**Salvar** confirma a edição; **Cancelar** abandona as alterações e restaura o objeto original. Salve ou cancele antes de iniciar outra edição.

### Tipos de marcação

| Marcação | Configuração e uso |
| --- | --- |
| Único | Uma posição com ícone e cor. Clique para posicionar e arraste para mover. |
| Linha | Um desenho livre com no mínimo dois pontos; define espessura, opacidade, tracejado e extremidades. |
| Área | Um contorno com no mínimo três vértices; define preenchimento e título no mapa. |
| Conexão | Relaciona locais no mesmo mapa ou entre mapas, como caminho visível ou passagem com ícone. |

O nome do Tipo é livre: “Marcador”, por exemplo, pode ser o nome de um Tipo Único. Alterar um Tipo afeta os objetos que o utilizam; a prévia visual pode ser confirmada ou cancelada. O tipo de marcação não pode ser trocado enquanto houver objetos desse Tipo.

Nas Linhas e Áreas, cada clique acrescenta um ponto. Arraste vértices para ajustar a geometria; o `+` sobre um segmento insere outro ponto. A exclusão de um vértice depende de manter a geometria válida e suas ligações.

O título de uma Área pode ter posição automática ou manual, cor própria e tamanho pelo **Padrão do tipo** ou **Tamanho próprio**. No modo manual, o título pode ser arrastado.

### Conexões e ramificações

Ao criar um Tipo **Conexão**, escolha sua representação:

- **Caminho visível:** desenha o trajeto entre dois locais. Pontos intermediários e ramificações continuam editáveis.
- **Somente passagem:** usa um ícone em uma posição e leva ao local escolhido.

Na criação do objeto, escolha o mapa e o Local de origem e destino. A busca aceita nome e categoria; no mapa aberto, **Selecionar no mapa aberto** permite clicar diretamente em um objeto, região, Linha livre ou posição. Ao escolher uma Linha, informe o ponto de encontro ao longo do trajeto.

Únicos usam sua posição; Áreas usam uma posição interna; Linhas usam o ponto de encontro definido. Uma extremidade do caminho deve pertencer ao mapa aberto. Se o outro local estiver em outro mapa, o caminho termina em uma passagem `↗`.

Em **Navegação**, escolha apenas conectar, somente ida ou ida e volta. Ida e volta cria uma passagem de retorno; somente ida cria uma chegada sem retorno. Clicar em uma Conexão abre suas informações: use **Ir para o destino** para navegar e destacar a chegada. Consultar ou localizar nunca atravessa automaticamente.

Para ramificar um caminho, selecione um ponto, use **Criar ramificação deste ponto**, desenhe o ramo e escolha **Finalizar ramificação**. Pontos com ramos dependentes não podem ser removidos antes de ajustar esses ramos.

### Coordenadas e escala

Em **Coordenadas e escala**, clique no mapa para consultar X e Y. Configure uma equivalência, como `100 px = 25 m`, digitando a distância em pixels ou capturando dois pontos. A medida convertida aparece nas consultas; a equivalência fica no mapa e no backup.

## Planilhas e vínculos

Em **Dados**, use **Importar planilha** para arquivos `.xlsx`, `.xls`, `.xlsm` ou `.csv`. Escolha a aba, nomeie a Fonte e configure a coluna de ID, a coluna de título e os campos/rótulos a exibir.

Prefira IDs únicos e permanentes. IDs vazios são ignorados; duplicados impedem a importação. Usar o número da linha é possível, mas reordenar ou inserir linhas pode associar vínculos ao registro errado na atualização.

Um objeto pode usar um registro principal e vários vínculos adicionais, cada um com rótulo e seleção de campos. Valores vazios não aparecem na consulta.

Ao atualizar uma Fonte, os registros são associados pelo ID configurado. Registros ausentes no novo arquivo são preservados e sinalizados, evitando romper vínculos imediatamente.

## Backup e recuperação

Os dados ficam **neste navegador e perfil**, sem sincronização em nuvem ou colaboração em tempo real. Trocar de navegador não transfere projetos; limpar os dados do site pode apagá-los.

O indicador distingue **Alterações pendentes**, **Salvando**, **Salvo neste navegador** e **Falha ao salvar**. Uma falha mantém a edição aberta para nova tentativa. Conexões pareadas são gravadas juntas.

### Exportar e importar

**Exportar projeto** salva e gera um `.atlasproject` com mapas, imagens, Tipos, objetos, Fontes e vínculos. Complete edições inválidas antes de exportar. Confira o arquivo nos downloads: a data exibida no menu indica uma exportação iniciada, não a confirmação do arquivo em disco.

**Importar projeto** valida o pacote e cria um novo projeto, sem sobrescrever o existente. Referências entre mapas são remapeadas. Arquivos `.nwmap` também são aceitos como novos mapas do projeto aberto; ligações entre arquivos importados separadamente podem exigir nova seleção de destino.

Arquivos inválidos são rejeitados antes da gravação. Para revisar destinos removidos, use **Verificar vínculos do projeto**; referências quebradas são informadas, não apagadas automaticamente.

### Rascunhos e histórico

Formulários de objetos e Tipos são guardados como rascunhos, sem publicar objetos incompletos. Ao reabrir o mapa, escolha **Recuperar** ou **Descartar**. Trocar de mapa/projeto preserva o rascunho; **Cancelar** o descarta. Arquivos de planilha ainda em importação não fazem parte dessa recuperação.

Desfazer prioriza pontos da geometria em edição e depois o histórico do projeto. O histórico retém até **100 ações ou 32 MiB estimados**, removendo primeiro as mais antigas. Uma operação maior que o orçamento é salva, mas não pode ser desfeita; o aplicativo avisa. Trocar de projeto ou recarregar encerra o histórico. Rascunhos e histórico não substituem backups.

### Exclusões e cuidados

Confirme o alcance antes de excluir:

- **Projeto ou mapa:** remove seu conteúdo; outros mapas podem ficar com destinos quebrados.
- **Tipo:** remove os objetos que o utilizam.
- **Objeto:** remove o item; se fizer parte de uma Conexão pareada, remove também o retorno ou a chegada.
- **Fonte:** mantém os objetos, mas desconecta referências no mapa ativo e deixa de disponibilizar a Fonte nos demais mapas do projeto.

O tamanho prático dos projetos depende da memória e da quota do navegador. Imagens grandes, muitas geometrias ou planilhas extensas podem causar lentidão. Antes de importar cargas grandes, exporte um backup e teste gradualmente.

## Administração

O Menu principal abre a Administração, que permite cadastrar usuários locais e configurar perfis, mapas acessíveis e visibilidade por Camada/objeto.

**Essas políticas são provisórias e não controlam acesso nem restringem o editor.** São salvas separadamente dos mapas e dependem de integração de identidade e autorização para serem aplicadas. Não use esses cadastros como proteção de conteúdo.

## Atalhos

Os gestos complementam as ações da interface. Em campos de texto, edição e seleção de texto mantêm seus atalhos normais.

| Atalho ou gesto | Ação |
| --- | --- |
| Botão direito / segurar o toque por 2 segundos | Abrir Ferramentas; mover o dedo cancela a pressão |
| Dois cliques/toques no mapa livre | Abrir Criação |
| Dois cliques/toques em um objeto | Abrir sua edição |
| `Shift + F10` ou tecla de menu | Abrir o menu de ferramentas pelo teclado |
| `Ctrl + F` | Pesquisar objetos do projeto |
| `Ctrl + A` / `Ctrl + E` | Abrir Criação / Edição |
| `Ctrl + D` / `Ctrl + Q` / `Ctrl + L` | Abrir Dados / Camadas / Legenda |
| `Ctrl + S` | Salvar o projeto e a edição válida |
| `Ctrl + Z` / `Ctrl + Y` | Desfazer / refazer |
| `Delete` / `Backspace` com vértice selecionado | Remover o vértice, quando permitido |
| Setas e `Enter` na pesquisa | Percorrer e abrir resultados |
| `Escape` | Fechar o menu/consulta com foco, finalizar ramo ou cancelar edição, conforme o contexto |
