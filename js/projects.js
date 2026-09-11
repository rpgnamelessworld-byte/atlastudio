/* Biblioteca de projetos: criação, busca, seleção e exclusão.
   O projectId delimita os mapas, as Fontes e as conexões de cada projeto. */

const gerenciadorProjetos = $("gerenciadorProjetos");
const listaProjetos = $("listaProjetos");
const projetosVazio = $("projetosVazio");
const projetosSemResultado = $("projetosSemResultado");
const criarPrimeiroProjeto = $("criarPrimeiroProjeto");
const abrirProjetos = $("abrirProjetos");
const abrirProjetosMarca = $("abrirProjetosMarca");
const novoProjetoMenu = $("novoProjetoMenu");
const buscaProjetosTopoWrap = $("buscaProjetosTopoWrap");
const buscaProjetosTopo = $("buscaProjetosTopo");
const buscaProjetosMobile = $("buscaProjetosMobile");
const projetoDialog = $("projetoDialog");
const projetoForm = $("projetoForm");
const projetoDialogTitulo = $("projetoDialogTitulo");
const nomeProjeto = $("nomeProjeto");
const descricaoProjeto = $("descricaoProjeto");
const fecharProjetoDialog = $("fecharProjetoDialog");
const cancelarProjeto = $("cancelarProjeto");
const administracaoBibliotecaLink = $("administracaoBibliotecaLink");

let projetoEditandoId = null;
let termoBuscaProjetos = "";

function gerarIdProjeto() {
  if (globalThis.crypto?.randomUUID) {
    return "project-" +
      crypto.randomUUID();
  }

  return "project-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(2);
}

function escaparProjeto(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizarBuscaProjeto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function dataProjetoLegivel(valor) {
  if (!valor) return "Ainda não editado";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return "Ainda não editado";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "medium"
    }
  ).format(data);
}

async function garantirEstruturaProjetos() {
  let projetos =
    await dbTodosProjetos();
  const mapas =
    await dbListarResumosMapas(true);

  if (!projetos.length && mapas.length) {
    const legado = {
      id: gerarIdProjeto(),
      nome: "Meu projeto",
      descricao:
        "Mapas existentes antes da organização por projetos.",
      criadoEm:
        new Date().toISOString(),
      schemaVersion: 1
    };

    await dbSalvarProjeto(legado);
    projetos = [legado];
  }

  if (!mapas.length || !projetos.length) {
    return;
  }

  const projetoPadrao =
    projetos.find(
      projeto =>
        projeto.id ===
        localStorage.getItem(
          CHAVE_PROJETO_ATUAL
        )
    ) || projetos[0];
  const idsProjetos =
    new Set(
      projetos.map(
        projeto => projeto.id
      )
    );

  for (const mapaLegado of mapas) {
    if (
      mapaLegado.projectId &&
      idsProjetos.has(
        mapaLegado.projectId
      )
    ) {
      continue;
    }

    const mapaCompleto = await dbPegarMapaGlobal(mapaLegado.id);
    mapaCompleto.projectId = projetoPadrao.id;

    /* A migração preserva integralmente o registro do mapa. */
    await new Promise(
      (resolve, reject) => {
        const tx = transacaoMapas();
        gravarMapaNaTransacao(tx, mapaCompleto);
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      }
    );
  }
}

function abrirDialogProjeto(
  projeto = null
) {
  projetoEditandoId =
    projeto?.id || null;
  projetoDialogTitulo.textContent =
    projeto
      ? "Editar projeto"
      : "Novo projeto";
  nomeProjeto.value =
    projeto?.nome || "";
  descricaoProjeto.value =
    projeto?.descricao || "";

  projetoDialog.showModal();
  requestAnimationFrame(
    () => nomeProjeto.focus()
  );
}

function fecharDialogProjeto() {
  projetoEditandoId = null;
  projetoForm.reset();
  projetoDialog.close();
}

async function renderizarProjetos() {
  const [projetos, mapas] =
    await Promise.all([
      dbTodosProjetos(),
      dbListarResumosMapas(true)
    ]);

  projetos.sort(
    (a, b) =>
      String(a.nome)
        .localeCompare(
          String(b.nome),
          "pt-BR"
        )
  );

  if (administracaoBibliotecaLink) {
    const projetoPreferidoId = localStorage.getItem(CHAVE_PROJETO_ATUAL);
    const projetoPreferido = projetos.find(projeto => projeto.id === projetoPreferidoId);
    administracaoBibliotecaLink.href = projetoPreferido
      ? "admin.html?project=" + encodeURIComponent(projetoPreferido.id)
      : "admin.html";
  }

  const termo =
    normalizarBuscaProjeto(
      termoBuscaProjetos
    );

  const itens = projetos
    .map(projeto => {
      const mapasProjeto =
        mapas.filter(
          mapa =>
            mapa.projectId ===
            projeto.id
        );
      const objetos =
        mapasProjeto.reduce(
          (total, mapa) =>
            total +
            (
              mapa.totalObjetos || 0
            ),
          0
        );
      const atualizadoEm =
        [
          projeto.atualizadoEm,
          ...mapasProjeto.map(
            mapa => mapa.atualizadoEm
          )
        ]
          .filter(Boolean)
          .sort()
          .at(-1);
      const campoBusca =
        normalizarBuscaProjeto(
          [
            projeto.nome,
            projeto.descricao,
            ...mapasProjeto.map(
              mapa => mapa.nome
            )
          ].join(" ")
        );

      return {
        projeto,
        mapasProjeto,
        objetos,
        atualizadoEm,
        visivel:
          !termo ||
          campoBusca.includes(termo)
      };
    });

  const visiveis =
    itens.filter(item => item.visivel);

  const cardsProjetos =
    visiveis
      .map(({
        projeto,
        mapasProjeto,
        objetos,
        atualizadoEm
      }) => (
        '<article class="project-card" data-project-id="' +
          escaparProjeto(projeto.id) +
        '">' +
          '<button class="project-card-open" type="button" data-project-action="open">' +
            '<span class="project-card-icon" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24"><path d="M4 7h6l2 2h8v10H4Z"></path><path d="M8 13h8M8 16h5"></path></svg>' +
            '</span>' +
            '<span class="project-card-copy">' +
              '<strong>' +
                escaparProjeto(projeto.nome) +
              '</strong>' +
              '<small>' +
                escaparProjeto(
                  projeto.descricao ||
                  "Projeto de mapas do Atlas Studio"
                ) +
              '</small>' +
            '</span>' +
          '</button>' +
          '<div class="project-card-stats">' +
            '<span><b>' +
              mapasProjeto.length +
            '</b> mapa(s)</span>' +
            '<span><b>' +
              objetos +
            '</b> objeto(s)</span>' +
            '<span>Atualizado ' +
              escaparProjeto(
                dataProjetoLegivel(
                  atualizadoEm
                )
              ) +
            '</span>' +
          '</div>' +
          '<div class="project-card-actions">' +
            '<button type="button" data-project-action="edit">Editar</button>' +
            '<button class="danger" type="button" data-project-action="delete">Excluir</button>' +
            '<button class="project-manage-action" type="button" data-project-action="manage">Administrar <span aria-hidden="true">→</span></button>' +
          '</div>' +
        '</article>'
      ))
      .join("");

  listaProjetos.innerHTML =
    cardsProjetos +
    '<button class="project-create-card" type="button" data-project-action="create">' +
      '<span class="project-create-icon" aria-hidden="true">＋</span>' +
      '<strong>Criar novo projeto</strong>' +
      '<small>Comece um novo mundo ou campanha</small>' +
    '</button>';

  projetosVazio.hidden = true;
  listaProjetos.hidden = false;
  projetosSemResultado.hidden =
    !projetos.length ||
    visiveis.length > 0;
}

async function mostrarGerenciadorProjetos() {
  await preservarRascunhoAtual();
  suspenderRascunhoCategoria();
  desativarHistoricoGlobal();

  if (editor.ativo) {
    cancelarEdicaoObjeto({ preservarRascunho: true });
  }

  fecharMenuRadial();
  definirMenuPrincipalAberto(false);
  mostrarTelaSemMapa();
  projetoAtual = null;

  document.body.classList.add(
    "projects-visible"
  );
  if (window.location.hash !== "#projetos") {
    history.replaceState(null, "", "#projetos");
  }
  gerenciadorProjetos.hidden = false;
  buscaProjetosTopoWrap.hidden = false;
  document.querySelector(
    ".topbar-map"
  ).hidden = true;
  document.querySelector(
    ".top-mode-switch"
  ).hidden = true;

  pesquisarObjetos.disabled = true;
  novoMapa.disabled = true;
  importarMapa.disabled = true;

  await renderizarProjetos();
  mapa.invalidateSize();
}

async function abrirProjeto(id) {
  await preservarRascunhoAtual();
  suspenderRascunhoCategoria();
  cancelarEdicaoObjeto({ preservarRascunho: true });
  const projeto =
    await dbPegarProjeto(id);

  if (!projeto) {
    avisar("Projeto não encontrado.");
    await renderizarProjetos();
    return;
  }

  projetoAtual = projeto;
  localStorage.setItem(
    CHAVE_PROJETO_ATUAL,
    projeto.id
  );

  document.body.classList.remove(
    "projects-visible"
  );
  if (window.location.hash === "#projetos") {
    history.replaceState(
      null,
      "",
      window.location.pathname +
        window.location.search
    );
  }
  gerenciadorProjetos.hidden = true;
  buscaProjetosTopoWrap.hidden = true;
  document.querySelector(
    ".topbar-map"
  ).hidden = false;
  document.querySelector(
    ".top-mode-switch"
  ).hidden = false;

  pesquisarObjetos.disabled = false;
  novoMapa.disabled = false;
  importarMapa.disabled = false;

  if (buscaMapa) {
    buscaMapa.placeholder =
      "Buscar mapa em " +
      projeto.nome;
  }

  const mapas = await dbListarResumosMapas();
  const idPreferido =
    localStorage.getItem(CHAVE_ATUAL);
  const mapaPreferido =
    mapas.find(
      item => item.id === idPreferido
    ) || mapas[0];

  if (mapaPreferido) {
    await abrirMapa(
      mapaPreferido.id
    );
  } else {
    mostrarTelaSemMapa();
    await atualizarSeletorMapas();
  }

  setModo("visualizacao");
  await atualizarSeletorMapas();
  iniciarHistoricoGlobal();

  requestAnimationFrame(
    () => mapa.invalidateSize()
  );
}

async function restaurarTelaInicial() {
  const projetoPreferidoId =
    localStorage.getItem(
      CHAVE_PROJETO_ATUAL
    );
  const projetoExiste =
    window.location.hash !== "#projetos" &&
    projetoPreferidoId
      ? await dbPegarProjeto(projetoPreferidoId)
      : false;

  return projetoExiste
    ? abrirProjeto(projetoPreferidoId)
    : mostrarGerenciadorProjetos();
}

async function excluirProjeto(projeto) {
  const mapas =
    (await dbListarResumosMapas(true))
      .filter(
        mapa =>
          mapa.projectId ===
          projeto.id
      );
  const objetos =
    mapas.reduce(
      (total, mapa) =>
        total +
        (mapa.totalObjetos || 0),
      0
    );

  if (
    !await confirmarSistema(
      "Excluir projeto",
      'Excluir o projeto "' +
      projeto.nome +
      '"?\n\nSerão removidos ' +
      mapas.length +
      " mapa(s) e " +
      objetos +
      " objeto(s).",
      {
        rotuloConfirmar: "Excluir projeto",
        perigo: true
      }
    )
  ) {
    return;
  }

  for (const mapaProjeto of mapas) {
    await dbExcluir(mapaProjeto.id);
    localStorage.removeItem(
      chaveCameraMapa(
        mapaProjeto.id
      )
    );
  }

  await dbExcluirProjeto(projeto.id);
  await renderizarProjetos();
  avisar("Projeto excluído.");
}

async function atualizarBuscaProjetos(valor) {
  termoBuscaProjetos = valor;

  if (
    buscaProjetosTopo.value !== valor
  ) {
    buscaProjetosTopo.value = valor;
  }

  if (
    buscaProjetosMobile.value !== valor
  ) {
    buscaProjetosMobile.value = valor;
  }

  await renderizarProjetos();
}

function focarBuscaProjetos() {
  const campo =
    window.matchMedia(
      "(max-width: 700px)"
    ).matches
      ? buscaProjetosMobile
      : buscaProjetosTopo;

  campo?.focus();
  campo?.select();
}

criarPrimeiroProjeto?.addEventListener(
  "click",
  () => abrirDialogProjeto()
);
novoProjetoMenu?.addEventListener(
  "click",
  () => abrirDialogProjeto()
);
abrirProjetos?.addEventListener(
  "click",
  mostrarGerenciadorProjetos
);
abrirProjetosMarca?.addEventListener(
  "click",
  evento => {
    evento.preventDefault();
    mostrarGerenciadorProjetos();
  }
);

buscaProjetosTopo?.addEventListener(
  "input",
  evento =>
    atualizarBuscaProjetos(
      evento.target.value
    )
);
buscaProjetosMobile?.addEventListener(
  "input",
  evento =>
    atualizarBuscaProjetos(
      evento.target.value
    )
);

fecharProjetoDialog?.addEventListener(
  "click",
  fecharDialogProjeto
);
cancelarProjeto?.addEventListener(
  "click",
  fecharDialogProjeto
);

projetoDialog?.addEventListener(
  "click",
  evento => {
    if (evento.target === projetoDialog) {
      fecharDialogProjeto();
    }
  }
);

projetoForm?.addEventListener(
  "submit",
  async evento => {
    evento.preventDefault();

    const nome =
      nomeProjeto.value.trim();
    if (!nome) return;

    const existente =
      projetoEditandoId
        ? await dbPegarProjeto(
            projetoEditandoId
          )
        : null;
    const projeto = {
      ...(existente || {}),
      id:
        existente?.id ||
        gerarIdProjeto(),
      nome,
      descricao:
        descricaoProjeto.value.trim(),
      criadoEm:
        existente?.criadoEm ||
        new Date().toISOString(),
      schemaVersion: 1
    };

    await dbSalvarProjeto(projeto);
    const novo = !existente;
    fecharDialogProjeto();

    if (novo) {
      await abrirProjeto(projeto.id);
      avisar("Projeto criado.");
    } else {
      await renderizarProjetos();
      avisar("Projeto atualizado.");
    }
  }
);

listaProjetos?.addEventListener(
  "click",
  async evento => {
    const card =
      evento.target.closest(
        "[data-project-id]"
      );
    const acao =
      evento.target.closest(
        "[data-project-action]"
      )?.dataset.projectAction;

    if (!acao) return;

    if (acao === "create") {
      abrirDialogProjeto();
      return;
    }

    if (!card) return;

    const projeto =
      await dbPegarProjeto(
        card.dataset.projectId
      );
    if (!projeto) return;

    if (acao === "open") {
      await abrirProjeto(projeto.id);
    } else if (acao === "edit") {
      abrirDialogProjeto(projeto);
    } else if (acao === "delete") {
      await excluirProjeto(projeto);
    } else if (acao === "manage") {
      localStorage.setItem(
        CHAVE_PROJETO_ATUAL,
        projeto.id
      );
      window.location.href =
        "admin.html?project=" +
        encodeURIComponent(projeto.id);
    }
  }
);
