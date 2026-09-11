/*
  Núcleo do Atlas Studio: estado compartilhado, referências do DOM,
  compatibilidade de dados e regras de Portais. IndexedDB e histórico
  ficam em persistence.js e history.js.
*/

/* =========================================================
   BANCO
   ========================================================= */

const DB_NOME = "nameless-world-map-editor";
const DB_VERSAO = 4;
const STORE_MAPAS = "mapas";
const STORE_RESUMOS = "resumosMapas";
const STORE_PROJETOS = "projetos";
const CHAVE_ATUAL = "nameless-world-map-atual";
const CHAVE_PROJETO_ATUAL = "atlas-studio-projeto-atual";
const CHAVE_LEGADA_CATEGORIA_PORTAL_AUTOMATICA =
  ["portalAutoCriada", "V", 125].join("");
const CHAVE_LEGADA_OBJETO_PORTAL_AUTOMATICO =
  ["portalCriadoAutomaticamente", "V", 125].join("");

let db = null;
let projetoAtual = null;
let mapaAtual = null;
let imageOverlay = null;

const layersObjetos = new Map();
const linhasEscalaveis = [];
const labelsEscalaveis = [];

/* =========================================================
   ESTADO DA INTERFACE
   ========================================================= */

const ui = {
  modo: "visualizacao",
  ferramenta: "selecionar",
  inspectorTab: "propriedades",
  camadasOcultas: new Set(),
  objetosOcultos: new Set(),
  camadasAbertas: new Set(),

  categoriaSelecionadaId: null,
  objetoSelecionadoId: null,

  categoriaEditandoId: null,
  iconeCategoria: "pin",
  corCategoria: "#D7DDE3"
};

const editor = {
  ativo: false,
  editandoId: null,
  categoriaId: null,

  pontos: [],
  label: null,
  relacoes: [],
  entityFieldColumns: null,

  aguardandoLabel: false,

  verticeSelecionado: null,

  preview: null,
  handles: [],
  plusHandles: [],
  labelHandle: null,

  ramificacoes: [],
  ramoAtivo: null,
  ramoSelecionado: null,
  linhaExtremidadeAtiva: null,
  branchHandles: [],
  historicoRefazer: []
};

function invalidarHistoricoRefazerGeometria() {
  editor.historicoRefazer = [];
}

let categoryEditSnapshot = null;
let cadastroTipoPeloAtalho = false;
let categoriaObjetoRetornoId = null;

const importador = {
  modo: "novo",
  workbook: null,
  arquivoNome: "",
  fonteId: null,
  headers: [],
  linhas: []
};

/* =========================================================
   DOM
   ========================================================= */

const $ = id =>
  document.getElementById(id);

const seletorMapa = $("seletorMapa");
const buscaMapa = $("buscaMapa");
const listaMapasBusca = $("listaMapasBusca");
const abrirListaMapas = $("abrirListaMapas");
const novoMapa = $("novoMapa");
const estadoMapaVazio = $("estadoMapaVazio");
const estadoMapaVazioProjeto = $("estadoMapaVazioProjeto");
const alternarTema = $("alternarTema");
const alternarTemaBiblioteca = $("alternarTemaBiblioteca");
const abrirMenuPrincipal = $("abrirMenuPrincipal");
const menuPrincipal = $("menuPrincipal");
const pesquisarObjetos = $("pesquisarObjetos");
const buscaObjetosOverlay = $("buscaObjetosOverlay");
const buscaObjetosInput = $("buscaObjetosInput");
const resultadosBuscaObjetos = $("resultadosBuscaObjetos");
const estadoBuscaObjetos = $("estadoBuscaObjetos");
const fecharBuscaObjetos = $("fecharBuscaObjetos");

function aplicarTemaInterface(tema, salvar = true) {
  const claro = tema === "claro";
  const proximoTema = claro ? "escuro" : "claro";

  document.documentElement.classList.toggle("tema-claro", claro);
  document.documentElement.style.colorScheme = claro ? "light" : "dark";

  if (alternarTema) {
    const icone = alternarTema.querySelector(".tema-icone");
    if (icone) icone.textContent = claro ? "☾" : "☼";

    const rotulo = alternarTema.querySelector(".menu-command-label");
    if (rotulo) rotulo.textContent = `Ativar modo ${proximoTema}`;

    alternarTema.title = `Ativar modo ${proximoTema}`;
    alternarTema.setAttribute("aria-label", alternarTema.title);
    alternarTema.setAttribute("aria-pressed", String(claro));
  }

  if (alternarTemaBiblioteca) {
    const icone = alternarTemaBiblioteca.querySelector(".projects-theme-icon");
    if (icone) icone.textContent = claro ? "☾" : "☼";

    alternarTemaBiblioteca.title = `Ativar modo ${proximoTema}`;
    alternarTemaBiblioteca.setAttribute("aria-label", alternarTemaBiblioteca.title);
    alternarTemaBiblioteca.setAttribute("aria-pressed", String(claro));
  }

  if (salvar) {
    localStorage.setItem("temaInterface", tema);
  }
}

aplicarTemaInterface(
  document.documentElement.classList.contains("tema-claro") ? "claro" : "escuro",
  false
);

alternarTema?.addEventListener("click", () => {
  const tema = document.documentElement.classList.contains("tema-claro")
    ? "escuro"
    : "claro";

  aplicarTemaInterface(tema);
});

alternarTemaBiblioteca?.addEventListener("click", () => {
  const tema = document.documentElement.classList.contains("tema-claro")
    ? "escuro"
    : "claro";

  aplicarTemaInterface(tema);
});

function itensMenuPrincipal() {
  return [
    ...(menuPrincipal?.querySelectorAll(".menu-command") || [])
  ].filter(item => !item.disabled);
}

function definirMenuPrincipalAberto(aberto, focarPrimeiro = false) {
  if (!menuPrincipal || !abrirMenuPrincipal) return;

  menuPrincipal.hidden = !aberto;
  abrirMenuPrincipal.classList.toggle("ativo", aberto);
  abrirMenuPrincipal.setAttribute("aria-expanded", String(aberto));
  abrirMenuPrincipal.title = aberto ? "Fechar menu principal" : "Abrir menu principal";
  abrirMenuPrincipal.setAttribute("aria-label", abrirMenuPrincipal.title);

  if (aberto && focarPrimeiro) {
    requestAnimationFrame(() => itensMenuPrincipal()[0]?.focus());
  }
}

abrirMenuPrincipal?.addEventListener("click", evento => {
  evento.stopPropagation();
  definirMenuPrincipalAberto(menuPrincipal.hidden);
});

abrirMenuPrincipal?.addEventListener("keydown", evento => {
  if (evento.key !== "ArrowDown") return;
  evento.preventDefault();
  definirMenuPrincipalAberto(true, true);
});

menuPrincipal?.addEventListener("click", evento => {
  if (evento.target.closest(".menu-command")) {
    definirMenuPrincipalAberto(false);
  }
});

menuPrincipal?.addEventListener("keydown", evento => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(evento.key)) return;

  const itens = itensMenuPrincipal();
  if (!itens.length) return;

  evento.preventDefault();
  const atual = itens.indexOf(document.activeElement);
  let proximo = atual;

  if (evento.key === "Home") proximo = 0;
  else if (evento.key === "End") proximo = itens.length - 1;
  else if (evento.key === "ArrowDown") proximo = (atual + 1 + itens.length) % itens.length;
  else proximo = (atual - 1 + itens.length) % itens.length;

  itens[proximo].focus();
});

document.addEventListener("pointerdown", evento => {
  if (
    menuPrincipal &&
    !menuPrincipal.hidden &&
    !menuPrincipal.contains(evento.target) &&
    !abrirMenuPrincipal?.contains(evento.target)
  ) {
    definirMenuPrincipalAberto(false);
  }
});

document.addEventListener("keydown", evento => {
  if (evento.key !== "Escape" || menuPrincipal?.hidden) return;

  evento.preventDefault();
  evento.stopImmediatePropagation();
  definirMenuPrincipalAberto(false);
  abrirMenuPrincipal?.focus();
}, true);

window.addEventListener("resize", () => definirMenuPrincipalAberto(false));

const painel = $("painel");
const redimensionarPainel = $("redimensionarPainel");
const redimensionarAlturaPainel = $("redimensionarAlturaPainel");
const fecharPainel = $("fecharPainel");
const tituloPainel = $("tituloPainel");
const menuRadialMapa = $("menuRadialMapa");
const fecharMenuRadialBotao = $("fecharMenuRadial");
const barraCriacaoRapida = $("barraCriacaoRapida");
const tiposCriacaoRapida = $("tiposCriacaoRapida");
const menuGrupoCriacaoRapida = $("menuGrupoCriacaoRapida");
const selecaoRapida = $("selecaoRapida");
const novoTipoRapido = $("novoTipoRapido");
const gerenciarTiposRapido = $("gerenciarTiposRapido");
const fecharCriacaoRapida = $("fecharCriacaoRapida");
const abrirLegendaVisual = $("abrirLegendaVisual");

const modoVisualizacao = $("modoVisualizacao");
const modoEdicao = $("modoEdicao");

const painelVisualizacao = $("painelVisualizacao");
const painelEdicao = $("painelEdicao");
const legendaAutomatica = $("legendaAutomatica");

const statusX = $("statusX");
const statusY = $("statusY");
const statusZoom = $("statusZoom");
const statusSelecionados = $("statusSelecionados");


const status = $("status");

const importarPlanilha = $("importarPlanilha");

const salvarRail = $("salvarRail");
const apagarRail = $("apagarRail");
const cancelarRail = $("cancelarRail");

const painelInicioEdicao = $("painelInicioEdicao");
const editorObjetoWrap = $("editorObjetoWrap");
const painelDadosEdicao = $("painelDadosEdicao");
const criarPrimeiraCategoria = $("criarPrimeiraCategoria");
const tituloFormularioObjeto = $("tituloFormularioObjeto");
const modoObjetoLabel = $("modoObjetoLabel");

const comportamentoCategoria = $("comportamentoCategoria");
const comportamentoLinhaCategoria = $("comportamentoLinhaCategoria");
const campoComportamentoUnico = $("campoComportamentoUnico");
const campoComportamentoLinha = $("campoComportamentoLinha");
const campoIconeCategoria = $("campoIconeCategoria");
const campoExibirEmAreasCategoria = $("campoExibirEmAreasCategoria");

const camposReferenciaObjeto = $("camposReferenciaObjeto");
const grupoCamposReferenciaObjeto = $("grupoCamposReferenciaObjeto");
const camposRelacaoObjeto = $("camposRelacaoObjeto");
const grupoCamposRelacao = $("grupoCamposRelacao");

const criarMapaDestinoPortal = $("criarMapaDestinoPortal");
const arquivoNovoMapaPortal = $("arquivoNovoMapaPortal");
const portalAreaDestino = $("portalAreaDestino");
const grupoPortalAreaDestino = $("grupoPortalAreaDestino");

const contextoGeometria = $("contextoGeometria");
const contextoGeometriaTexto = $("contextoGeometriaTexto");
const listaFontesDados = $("listaFontesDados");

const selecaoObjeto = $("selecaoObjeto");
const objetoNome = $("objetoNome");
const objetoCategoria = $("objetoCategoria");
const editarObjeto = $("editarObjeto");
const editarCategoriaObjeto = $("editarCategoriaObjeto");
const removerObjeto = $("removerObjeto");

const formObjeto = $("formObjeto");
const nomeObjeto = $("nomeObjeto");
const descricaoObjeto = $("descricaoObjeto");
const linkObjeto = $("linkObjeto");
const textoLinkObjeto = $("textoLinkObjeto");

const fonteObjeto = $("fonteObjeto");
const registroObjeto = $("registroObjeto");
const grupoPortal = $("grupoPortal");
const portalMapaDestino = $("portalMapaDestino");
const portalDirecao = $("portalDirecao");


const grupoRelacoesArea = $("grupoRelacoesArea");
const rotuloRelacao = $("rotuloRelacao");
const fonteRelacao = $("fonteRelacao");
const registroRelacao = $("registroRelacao");
const adicionarRelacao = $("adicionarRelacao");
const listaRelacoesArea = $("listaRelacoesArea");

const controleVertice = $("controleVertice");
const verticeSelecionado = $("verticeSelecionado");
const removerVertice = $("removerVertice");
const controlesRamificacao = $("controlesRamificacao");
const criarRamificacao = $("criarRamificacao");
const finalizarRamificacao = $("finalizarRamificacao");
const listaRamificacoes = $("listaRamificacoes");


const renomearMapa = $("renomearMapa");
const excluirMapa = $("excluirMapa");
const salvarProjeto = $("salvarProjeto");
const exportarMapa = $("exportarMapa");
const importarMapa = $("importarMapa");

const arquivoNovoMapa = $("arquivoNovoMapa");
const arquivoImportar = $("arquivoImportar");

const modalCategoria = $("modalCategoria");
const tituloModalCategoria = $("tituloModalCategoria");
const fecharCategoria = $("fecharCategoria");
const formCategoria = $("formCategoria");

const nomeCategoria = $("nomeCategoria");
const geometriaCategoria = $("geometriaCategoria");
const ajudaGeometriaCategoria = $("ajudaGeometriaCategoria");
const gradeIcones = $("gradeIcones");
const gradeCores = $("gradeCores");
const corHex = $("corHex");

const opcoesLinha = $("opcoesLinha");
const larguraLinha = $("larguraLinha");
const estiloLinha = $("estiloLinha");
const extremidadeLinha = $("extremidadeLinha");
const opacidadeLinha = $("opacidadeLinha");
const valorOpacidade = $("valorOpacidade");

const opcoesArea = $("opcoesArea");
const areaOpacidade = $("areaOpacidade");
const valorOpacidadeArea = $("valorOpacidadeArea");
const tamanhoFonte = $("tamanhoFonte");
const exibirEmAreasCategoria = $("exibirEmAreasCategoria");


const modalFonteDados = $("modalFonteDados");
const tituloModalFonte = $("tituloModalFonte");
const fecharFonteDados = $("fecharFonteDados");
const formFonteDados = $("formFonteDados");
const nomeFonteDados = $("nomeFonteDados");
const tipoEntidadeFonte = $("tipoEntidadeFonte");
const campoAbaFonte = $("campoAbaFonte");
const abaFonteDados = $("abaFonteDados");
const colunaIdFonte = $("colunaIdFonte");
const colunaTituloFonte = $("colunaTituloFonte");
const camposFonteDados = $("camposFonteDados");
const resumoAtualizacaoFonte = $("resumoAtualizacaoFonte");
const cancelarFonteDados = $("cancelarFonteDados");
const arquivoPlanilha = $("arquivoPlanilha");

const toast = $("toast");

/* =========================================================
   MAPA LEAFLET
   ========================================================= */

const mapa = L.map(
  "mapa",
  {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 5,
    zoomControl: true,
    attributionControl: false
  }
);


/* =========================================================
   BIBLIOTECA DE ÍCONES
   ========================================================= */

function svg(body) {
  return (
    '<svg viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round">' +
    body +
    "</svg>"
  );
}

/*
  Mais de 50 opções internas.
  Todos usam currentColor.
*/
const ICONES = [
  ["pin", "Local", svg('<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>')],
  ["cidade", "Cidade", svg('<path d="M3 21V9l5-3v15M8 21V3l8 4v14M16 21V11l5-2v12"/><path d="M5 12h1M5 16h1M11 9h1M11 13h1M11 17h1M18 14h1M18 18h1"/>')],
  ["vila", "Vila", svg('<path d="m3 11 7-6 7 6v10H3Z"/><path d="m12 9 4-4 5 5v11h-4"/><path d="M7 21v-6h5v6"/>')],
  ["casa", "Casa", svg('<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-7h6v7"/>')],
  ["castelo", "Castelo", svg('<path d="M4 21V8h4V4h3v4h2V4h3v4h4v13"/><path d="M2 21h20"/><path d="M9 21v-6h6v6"/>')],
  ["torre", "Torre", svg('<path d="M7 21 9 7h6l2 14"/><path d="M8 7V3h2v2h4V3h2v4"/><path d="M5 21h14"/>')],
  ["fortaleza", "Fortaleza", svg('<path d="M3 21V7h4V3h3v4h4V3h3v4h4v14"/><path d="M8 21v-7h8v7"/>')],
  ["tenda", "Acampamento", svg('<path d="M3 20 12 4l9 16"/><path d="M6.5 20 12 10l5.5 10"/><path d="M2 20h20"/>')],
  ["fogueira", "Fogueira", svg('<path d="M12 3c3 4 4 6 2 9 3-1 5 2 4 5-1 3-3 4-6 4s-6-2-6-5c0-3 2-5 5-7 0 2 0 3 1 4 2-3 1-6 0-10Z"/><path d="m6 22 12-6M18 22 6 16"/>')],
  ["arvore", "Árvore", svg('<path d="M12 22v-7"/><path d="M8 15h8l-2-4h3L12 2 7 11h3Z"/>')],
  ["floresta", "Floresta", svg('<path d="M7 21v-5M17 21v-6M12 21v-8"/><path d="M3 16h8L7 5Z"/><path d="M9 13h7L12 3Z"/><path d="M13 15h8L17 5Z"/>')],
  ["planta", "Planta", svg('<path d="M12 21V10"/><path d="M12 14c-4 0-7-2-8-6 4 0 7 2 8 6Z"/><path d="M12 11c4 0 7-2 8-6-4 0-7 2-8 6Z"/>')],
  ["plantacao", "Plantação", svg('<path d="M4 21V8M8 21V6M12 21V9M16 21V5M20 21V8"/><path d="M2 13h20M2 17h20"/>')],
  ["flor", "Flor", svg('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="6" r="3"/><circle cx="18" cy="12" r="3"/><circle cx="12" cy="18" r="3"/><circle cx="6" cy="12" r="3"/>')],
  ["folha", "Folha", svg('<path d="M20 4C12 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z"/><path d="M4 21c4-6 8-9 13-12"/>')],
  ["animal", "Animal", svg('<circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="5" cy="14" r="2"/><circle cx="19" cy="14" r="2"/><path d="M8.5 19c0-3 1.5-5 3.5-5s3.5 2 3.5 5c0 1.4-1.5 2-3.5 2s-3.5-.6-3.5-2Z"/>')],
  ["pegada", "Pegada", svg('<ellipse cx="8" cy="7" rx="2" ry="3"/><ellipse cx="15.5" cy="5.5" rx="2" ry="3"/><ellipse cx="18" cy="12" rx="2" ry="3"/><path d="M6 17c2-4 5-5 8-3 3 2 2 6-1 7-4 1-9 0-7-4Z"/>')],
  ["monstro", "Monstro", svg('<path d="M5 8 3 3l5 3M19 8l2-5-5 3"/><path d="M5 9c0-4 3-6 7-6s7 2 7 6v5c0 4-3 7-7 7s-7-3-7-7Z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/><path d="m9 16 2-2 1 2 1-2 2 2"/>')],
  ["alvo", "Caça", svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>')],
  ["peixe", "Peixe", svg('<path d="M3 12c4-5 10-5 15 0-5 5-11 5-15 0Z"/><path d="m18 12 4-4v8Z"/><circle cx="8" cy="11" r=".7" fill="currentColor" stroke="none"/>')],
  ["anzol", "Pesca", svg('<path d="M6 3h8a4 4 0 0 1 4 4v7a5 5 0 0 1-10 0v-2"/><path d="M8 12h4"/><path d="m8 12 2 2"/>')],
  ["cristal", "Cristal", svg('<path d="M7 3h10l4 7-9 11L3 10Z"/><path d="m7 3 5 7 5-7M3 10h18"/>')],
  ["pedra", "Pedra", svg('<path d="m5 19-2-7 5-8 8 1 5 8-4 7Z"/><path d="m8 4 4 6 4-5M3 12l9-2 9 3"/>')],
  ["minerio", "Minério", svg('<path d="m6 20-3-8 5-8 9 2 4 8-6 7Z"/><circle cx="10" cy="10" r="2"/><circle cx="15" cy="15" r="1.5"/>')],
  ["picareta", "Picareta", svg('<path d="M14 4 20 10"/><path d="M17 3 6 14"/><path d="M4 20 9 15"/><path d="M12 4c-3-2-7-1-9 2"/>')],
  ["pa", "Pá", svg('<path d="M14 3 9 15"/><path d="M11 4h6"/><path d="M6 14c4-1 7 1 8 4-2 3-6 4-9 2Z"/>')],
  ["escavacao", "Escavação", svg('<path d="M4 20h16"/><path d="M6 16h12"/><path d="M8 12h8"/><path d="M10 8h4"/><path d="m16 3 5 5"/><path d="M18 2 8 12"/>')],
  ["madeira", "Madeira", svg('<path d="M5 7h14v10H5Z"/><circle cx="8" cy="12" r="3"/><path d="M8 9v6M19 10h2M19 14h2"/>')],
  ["machado", "Machado", svg('<path d="M13 3 5 21"/><path d="M12 5c4-3 8-1 9 2-4 3-7 3-10 1Z"/>')],
  ["recurso", "Recurso", svg('<path d="m14 4 6 6"/><path d="M17 3 6 14"/><path d="m5 13 6 6"/><path d="M3 21 8 16"/>')],
  ["bau", "Baú", svg('<path d="M4 9h16v11H4Z"/><path d="M5 9V7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M4 13h16"/><path d="M10 12h4v4h-4Z"/>')],
  ["moeda", "Moeda", svg('<circle cx="12" cy="12" r="9"/><path d="M15 8c-1-1-5-1-5 1 0 3 6 1 6 5 0 3-5 3-7 1"/><path d="M12 6v12"/>')],
  ["gema", "Gema", svg('<path d="m5 8 4-5h6l4 5-7 13Z"/><path d="M5 8h14M9 3l3 5 3-5"/>')],
  ["espada", "Espada", svg('<path d="m14 4 6-2-2 6L8 18l-4 2 2-4Z"/><path d="m10 16 4 4"/>')],
  ["escudo", "Escudo", svg('<path d="M12 2 20 5v6c0 5-3 9-8 11-5-2-8-6-8-11V5Z"/><path d="M12 6v11"/>')],
  ["caveira", "Caveira", svg('<path d="M5 11a7 7 0 1 1 14 0c0 3-1 5-3 6v4H8v-4c-2-1-3-3-3-6Z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M10 17h4"/>')],
  ["perigo", "Perigo", svg('<path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>')],
  ["livro", "Livro", svg('<path d="M4 4h7a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 1Z"/><path d="M20 4h-3a3 3 0 0 0-3 3v13h3a3 3 0 0 1 3 1Z"/>')],
  ["pergaminho", "Pergaminho", svg('<path d="M7 3h10v15H7a3 3 0 0 1 0-6h10"/><path d="M17 18a3 3 0 1 0 0-6"/>')],
  ["quest", "Quest", svg('<path d="M6 3h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2Z"/><path d="M10 8h4M12 11v4M10.5 13.5h3"/>')],
  ["bandeira", "Bandeira", svg('<path d="M5 22V3"/><path d="M5 4h12l-2 4 2 4H5"/>')],
  ["ruina", "Ruína", svg('<path d="M4 21V8l4-4 4 4 4-5 4 5v13"/><path d="M8 21v-6h3M15 21v-8h5"/>')],
  ["templo", "Templo", svg('<path d="m3 9 9-6 9 6"/><path d="M5 10h14M6 20V10M10 20V10M14 20V10M18 20V10M3 21h18"/>')],
  ["portal", "Portal", svg('<ellipse cx="12" cy="12" rx="7" ry="9"/><ellipse cx="12" cy="12" rx="3" ry="5"/><path d="M12 3v18"/>')],
  ["barco", "Barco", svg('<path d="M4 14h16l-3 6H7Z"/><path d="M12 3v11M12 4l6 7h-6M12 6 7 12h5"/>')],
  ["porto", "Porto", svg('<path d="M4 21V9M20 21V9M4 13h16"/><path d="M8 21v-5M16 21v-5"/><path d="M2 21h20"/>')],
  ["ponte", "Ponte", svg('<path d="M3 18h18M5 18c0-7 14-7 14 0"/><path d="M5 12V8M19 12V8M3 8h18"/>')],
  ["agua", "Água", svg('<path d="M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13Z"/><path d="M8 16c1 2 3 3 5 2"/>')],
  ["montanha", "Montanha", svg('<path d="m2 21 7-13 4 7 3-5 6 11Z"/><path d="m7 12 2-4 2 4"/>')],
  ["caverna", "Caverna", svg('<path d="M3 21c1-8 4-16 9-18 5 2 8 10 9 18Z"/><path d="M8 21c0-5 2-8 4-8s4 3 4 8"/>')],
  ["mina", "Mina", svg('<path d="M4 21c1-7 3-13 8-16 5 3 7 9 8 16Z"/><path d="M9 21v-7h6v7"/><path d="m5 5 14 14M19 5 5 19"/>')],
  ["entrada", "Entrada", svg('<path d="M4 21V5h12v16"/><path d="M9 13h12"/><path d="m17 9 4 4-4 4"/>')],
  ["saida", "Saída", svg('<path d="M20 21V5H8v16"/><path d="M15 13H3"/><path d="m7 9-4 4 4 4"/>')],
  ["estrela", "Estrela", svg('<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>')],
  ["olho", "Observação", svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>')],
  ["mapa", "Mapa", svg('<path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3Z"/><path d="M8 3v15M16 6v15"/>')],
  ["relogio", "Tempo", svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>')],
  ["chave", "Chave", svg('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v3M20 12v2"/>')]
];

const ICON_MAP =
  new Map(
    ICONES.map(
      ([id, nome, conteudo]) =>
        [
          id,
          {
            id,
            nome,
            svg: conteudo
          }
        ]
    )
  );

/* =========================================================
   CORES
   ========================================================= */

const CORES_PADRAO = [
  "#4FA3FF",
  "#FF7A45",
  "#FF4D4F",
  "#F0C94B",
  "#61D095",
  "#C18CFF",
  "#8FD36B",
  "#D9A56D",
  "#8FC7D8",
  "#C8A675",
  "#FFD166",
  "#69B9E6",
  "#9CBD72",
  "#B8B8B8",
  "#FFFFFF",
  "#D7DDE3",
  "#E285A4",
  "#9B8AFB",
  "#67D5C4",
  "#E0A96D"
];

/* =========================================================
   CATEGORIAS PADRÃO PARA MIGRAÇÃO
   ========================================================= */

const PRESETS_ANTIGOS = {
  local: {
    nome: "Local",
    geometria: "unico",
    icone: "pin",
    cor: "#4FA3FF"
  },

  acampamento: {
    nome: "Acampamento",
    geometria: "unico",
    icone: "tenda",
    cor: "#FF7A45"
  },

  perigo: {
    nome: "Perigo",
    geometria: "unico",
    icone: "perigo",
    cor: "#FF4D4F"
  },

  caca: {
    nome: "Caça",
    geometria: "unico",
    icone: "alvo",
    cor: "#F0C94B"
  },

  recurso: {
    nome: "Recurso",
    geometria: "unico",
    icone: "recurso",
    cor: "#61D095"
  },

  quest: {
    nome: "Quests",
    geometria: "unico",
    icone: "quest",
    cor: "#C18CFF"
  },

  plantacao: {
    nome: "Plantação",
    geometria: "unico",
    icone: "plantacao",
    cor: "#8FD36B"
  },

  animais: {
    nome: "Animais",
    geometria: "unico",
    icone: "animal",
    cor: "#D9A56D"
  },

  mineral: {
    nome: "Mineral",
    geometria: "unico",
    icone: "cristal",
    cor: "#8FC7D8"
  },

  escavacao: {
    nome: "Escavação",
    geometria: "unico",
    icone: "escavacao",
    cor: "#C8A675"
  },

  tesouro: {
    nome: "Tesouro",
    geometria: "unico",
    icone: "bau",
    cor: "#FFD166"
  },

  pesca: {
    nome: "Pesca",
    geometria: "unico",
    icone: "peixe",
    cor: "#69B9E6"
  },

  madeira: {
    nome: "Madeira",
    geometria: "unico",
    icone: "madeira",
    cor: "#9CBD72"
  },

  ruina: {
    nome: "Ruína",
    geometria: "unico",
    icone: "ruina",
    cor: "#B8B8B8"
  },

  portal: {
    nome: "Portal",
    geometria: "unico",
    icone: "portal",
    cor: "#C18CFF"
  },

  caminho: {
    nome: "Caminho",
    geometria: "linha",
    icone: "mapa",
    cor: "#D7DDE3",

    largura: 24,
    estiloLinha: "continuo",
    extremidade: "arredondada",
    opacidade: 0.55
  },

  regiao: {
    nome: "Região",
    geometria: "area",
    icone: "mapa",
    cor: "#D7DDE3",

    tamanhoFonte: 14
  }
};

/* =========================================================
   HELPERS
   ========================================================= */

function clone(valor) {
  return JSON.parse(
    JSON.stringify(valor)
  );
}

function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slug(texto) {
  return String(texto || "item")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ||
    "item";
}

function idUnico(base, existentes) {
  let id = slug(base);
  let n = 2;

  while (existentes.has(id)) {
    id =
      slug(base) +
      "-" +
      n;

    n++;
  }

  return id;
}

function normalizarTipoAntigo(tipo) {
  const t =
    String(tipo || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  if (t === "local") return "local";
  if (t === "acampamento") return "acampamento";
  if (t === "perigo") return "perigo";

  if (t === "caca" || t === "area de caca") {
    return "caca";
  }

  if (t === "recurso" || t === "recursos") {
    return "recurso";
  }

  if (
    t === "quest" ||
    t === "quests" ||
    t === "missao" ||
    t === "missoes"
  ) {
    return "quest";
  }

  if (t === "plantacao" || t === "plantacoes") {
    return "plantacao";
  }

  if (t === "animal" || t === "animais" || t === "fauna") {
    return "animais";
  }

  if (t === "mineral" || t === "minerais") {
    return "mineral";
  }

  if (t === "escavacao" || t === "escavacoes") {
    return "escavacao";
  }

  if (t === "tesouro" || t === "tesouros") {
    return "tesouro";
  }

  if (t === "pesca" || t === "pescaria") {
    return "pesca";
  }

  if (t === "madeira" || t === "madeiras") {
    return "madeira";
  }

  if (t === "ruina" || t === "ruinas") {
    return "ruina";
  }

  if (t === "portal" || t === "portais") {
    return "portal";
  }

  if (t === "caminho" || t === "rota") {
    return "caminho";
  }

  if (t === "regiao" || t === "territorio") {
    return "regiao";
  }

  return slug(tipo || "local");
}

function avisar(texto) {
  toast.textContent = texto;

  toast.classList.add(
    "visivel"
  );

  clearTimeout(
    avisar.timer
  );

  avisar.timer =
    setTimeout(
      () => {
        toast.classList.remove(
          "visivel"
        );
      },
      1800
    );
}

function linkSeguro(url) {
  const valor =
    String(url || "").trim();

  if (!valor) {
    return false;
  }

  return (
    valor.startsWith("/") ||
    valor.startsWith("./") ||
    valor.startsWith("../") ||
    valor.startsWith("#") ||
    valor.startsWith("http://") ||
    valor.startsWith("https://")
  );
}

function categoriaPorId(id) {
  return mapaAtual?.categorias.find(
    c => c.id === id
  );
}

function objetoPorId(id) {
  return mapaAtual?.objetos.find(
    o => o.id === id
  );
}

function iconeSvg(id) {
  return (
    ICON_MAP.get(id)?.svg ||
    ICON_MAP.get("pin").svg
  );
}


const PORTAL_CATEGORY_ID = "__portal_sistema__";

/* Conexão é uma marcação própria; o desenho reutiliza as primitivas existentes.
   Os comportamentos antigos continuam legíveis sem reescrever os objetos. */
function tipoMarcacao(cat) {
  return cat?.geometria === "conexao" || cat?.comportamento === "portal" || cat?.comportamentoLinha === "relacao"
    ? "conexao" : cat?.geometria;
}

function geometriaEfetiva(cat) {
  return cat?.geometria === "conexao"
    ? (cat.conexaoRepresentacao === "passagem" ? "unico" : "linha")
    : cat?.geometria;
}

function normalizarTipoConexao(cat) {
  if (cat.geometria !== "conexao") return;
  if (cat.conexaoRepresentacao === "passagem") {
    cat.comportamento = "portal";
    delete cat.comportamentoLinha;
  } else {
    cat.conexaoRepresentacao = "caminho";
    cat.comportamentoLinha = "relacao";
    delete cat.comportamento;
  }
}

function garantirCategoriaPortal(mapaAlvo) {
  if (
    !mapaAlvo ||
    !Array.isArray(mapaAlvo.categorias)
  ) {
    return null;
  }

  let cat =
    mapaAlvo.categorias.find(
      c =>
        c.id ===
        PORTAL_CATEGORY_ID
    );

  if (!cat) {
    cat = {
      id: PORTAL_CATEGORY_ID,
      nome: "Passagem",
      geometria: "conexao",
      conexaoRepresentacao: "passagem",
      icone: "portal",
      cor: "#A77BFF",
      exibirEmAreas: false,
      comportamento: "portal",
      sistema: true
    };

    mapaAlvo.categorias.push(cat);
  }

  cat.geometria = "conexao";
  cat.conexaoRepresentacao = "passagem";
  cat.icone = cat.icone || "portal";
  cat.cor = cat.cor || "#A77BFF";
  cat.exibirEmAreas = false;
  cat.comportamento = "portal";
  cat.sistema = true;

  return cat;
}

/* =========================================================
   MIGRAÇÃO DE FORMATOS LEGADOS
   ========================================================= */

function migrarMapa(mapaEntrada) {
  const m =
    clone(mapaEntrada);

  /* O mapa já usa a estrutura normalizada de categorias e objetos. */
  if (
    Array.isArray(m.categorias) &&
    Array.isArray(m.objetos)
  ) {
    m.versaoEditor = 7;

    for (const cat of m.categorias) {
      normalizarTipoConexao(cat);
      if (!cat.cor) {
        cat.cor = "#D7DDE3";
      }

      if (!cat.icone) {
        cat.icone = "pin";
      }

      if (
        geometriaEfetiva(cat) === "linha"
      ) {
        cat.largura =
          Number(cat.largura) ||
          24;

        cat.estiloLinha =
          cat.estiloLinha ||
          "continuo";

        cat.extremidade =
          cat.extremidade ||
          "arredondada";

        cat.opacidade =
          Number.isFinite(
            Number(cat.opacidade)
          )
            ? Number(cat.opacidade)
            : 0.55;
      }

      if (
        geometriaEfetiva(cat) === "area"
      ) {
        cat.tamanhoFonte =
          Number(cat.tamanhoFonte) ||
          14;
      }
    }

    return m;
  }

  const antigos =
    Array.isArray(m.locais)
      ? m.locais
      : [];

  const categorias = [];
  const objetos = [];

  const idsCategoria =
    new Set();

  /*
    Primeiro cria categorias necessárias.
  */
  for (const antigo of antigos) {
    const chave =
      normalizarTipoAntigo(
        antigo.tipo
      );

    if (
      idsCategoria.has(chave)
    ) {
      continue;
    }

    const preset =
      PRESETS_ANTIGOS[chave] ||
      {
        nome:
          antigo.tipo ||
          chave,

        geometria: "unico",
        icone: "pin",
        cor: "#D7DDE3"
      };

    const cat = {
      id: chave,
      ...clone(preset)
    };

    /*
      Preserva largura de Caminho antigo quando disponível.
    */
    if (
      geometriaEfetiva(cat) === "linha" &&
      Number(antigo.largura)
    ) {
      cat.largura =
        Number(antigo.largura);
    }

    categorias.push(cat);
    idsCategoria.add(chave);
  }

  /*
    Converte objetos.
  */
  const idsObjetos =
    new Set();

  for (const antigo of antigos) {
    const categoriaId =
      normalizarTipoAntigo(
        antigo.tipo
      );

    const cat =
      categorias.find(
        c => c.id === categoriaId
      );

    const id =
      idUnico(
        antigo.id ||
        antigo.nome ||
        "objeto",
        idsObjetos
      );

    idsObjetos.add(id);

    const obj = {
      id,
      categoriaId,

      nome:
        antigo.nome ||
        "Sem nome",

      descricao:
        antigo.descricao ||
        ""
    };

    if (antigo.link) {
      obj.link =
        antigo.link;
    }

    if (antigo.textoLink) {
      obj.textoLink =
        antigo.textoLink;
    }

    if (
      geometriaEfetiva(cat) === "linha"
    ) {
      obj.pontos =
        clone(
          antigo.pontos ||
          []
        );
    } else if (
      geometriaEfetiva(cat) === "area"
    ) {
      obj.area =
        clone(
          antigo.area ||
          []
        );

      obj.label = {
        x:
          Number(antigo.x) ||
          0,

        y:
          Number(antigo.y) ||
          0
      };
    } else {
      obj.x =
        Number(antigo.x) ||
        0;

      obj.y =
        Number(antigo.y) ||
        0;
    }

    objetos.push(obj);
  }

  m.categorias =
    categorias;

  m.objetos =
    objetos;

  delete m.locais;

  m.versaoEditor = 7;

  return m;
}

/* =========================================================
   DADOS DE REFERÊNCIA
   ========================================================= */

function normalizarEstruturaMapa(mapaEntrada) {
  const m = migrarMapa(mapaEntrada);

  if (calibracaoMedidaValida(m.calibracaoMedida)) {
    m.calibracaoMedida = {
      pixels:
        Number(m.calibracaoMedida.pixels),
      valor:
        Number(m.calibracaoMedida.valor),
      unidade:
        String(m.calibracaoMedida.unidade).trim()
    };
  } else {
    delete m.calibracaoMedida;
  }

  m.fontesDados =
    Array.isArray(m.fontesDados)
      ? m.fontesDados
      : [];

  for (const fonte of m.fontesDados) {
    fonte.headers =
      Array.isArray(fonte.headers)
        ? fonte.headers
        : [];

    fonte.displayFields =
      Array.isArray(fonte.displayFields)
        ? fonte.displayFields
        : [];

    fonte.records =
      Array.isArray(fonte.records)
        ? fonte.records
        : [];
  }

  for (const cat of m.categorias) {
    if (
      cat[CHAVE_LEGADA_CATEGORIA_PORTAL_AUTOMATICA] === true &&
      typeof cat.portalCriadaAutomaticamente !== "boolean"
    ) {
      cat.portalCriadaAutomaticamente = true;
    }

    delete cat[CHAVE_LEGADA_CATEGORIA_PORTAL_AUTOMATICA];

    if (
      typeof cat.exibirEmAreas !==
      "boolean"
    ) {
      cat.exibirEmAreas =
        geometriaEfetiva(cat) === "unico";
    }
  }

  for (const obj of m.objetos) {
    if (
      obj[CHAVE_LEGADA_OBJETO_PORTAL_AUTOMATICO] === true &&
      typeof obj.portalCriadoAutomaticamente !== "boolean"
    ) {
      obj.portalCriadoAutomaticamente = true;
    }

    delete obj[CHAVE_LEGADA_OBJETO_PORTAL_AUTOMATICO];

    if (!Array.isArray(obj.relacoes)) {
      obj.relacoes = [];
    }
  }

  /*
    Portais de sistema herdados são removidos quando vazios ou convertidos
    em Tipos editáveis quando já possuem objetos.
  */
  const portalSistema =
    m.categorias.find(
      c =>
        c.id ===
        PORTAL_CATEGORY_ID ||
        c.sistema === true
    );

  if (portalSistema) {
    const emUso =
      m.objetos.some(
        o =>
          o.categoriaId ===
          portalSistema.id
      );

    if (!emUso) {
      m.categorias =
        m.categorias.filter(
          c =>
            c.id !==
            portalSistema.id
        );
    } else {
      delete portalSistema.sistema;
    }
  }

  for (const cat of m.categorias) {
    if (
      geometriaEfetiva(cat) === "area" &&
      !Number.isFinite(
        Number(
          cat.opacidadeArea
        )
      )
    ) {
      cat.opacidadeArea =
        0.15;
    }
  }

  m.versaoEditor = 12.5;

  return m;
}

/* =========================================================
   INDEXED DB
   ========================================================= */




/* =========================================================
   ARQUIVOS / IMAGENS
   ========================================================= */

function arquivoParaDataUrl(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload =
        () => resolve(
          reader.result
        );

      reader.onerror =
        () => reject(
          reader.error
        );

      reader.readAsDataURL(file);
    }
  );
}

function dimensoesImagem(src) {
  return new Promise(
    (resolve, reject) => {
      const img =
        new Image();

      img.onload =
        () => resolve({
          largura:
            img.naturalWidth,

          altura:
            img.naturalHeight
        });

      img.onerror =
        () => reject(
          new Error(
            "Não foi possível carregar a imagem."
          )
        );

      img.src = src;
    }
  );
}


function percentualZoomAtual() {
  if (!mapa) {
    return "—";
  }

  return (
    Math.round(
      Math.pow(
        2,
        mapa.getZoom()
      ) *
      100
    ) +
    "%"
  );
}

function atualizarBarraStatus(ponto = null) {
  if (ponto) {
    statusX.textContent =
      ponto.x;

    statusY.textContent =
      ponto.y;
  }

  statusZoom.textContent =
    percentualZoomAtual();

  statusSelecionados.textContent =
    ui.objetoSelecionadoId
      ? "1"
      : "0";
}


let pedidoLocaisPassagem = 0;
async function atualizarAreasDestinoPortal(mapaDestinoId, selecionado = "", ref = {}) {
  const pedido = ++pedidoLocaisPassagem;
  if (!portalAreaDestino || !grupoPortalAreaDestino) return;
  grupoPortalAreaDestino.hidden = !mapaDestinoId;
  if (!mapaDestinoId) { configurarSeletorConexao(portalAreaDestino, null); return; }
  const bruto = mapaDestinoId === mapaAtual?.id ? mapaAtual : await dbPegar(mapaDestinoId);
  if (pedido !== pedidoLocaisPassagem) return;
  const destino = bruto ? normalizarEstruturaMapa(bruto) : null;
  configurarSeletorConexao(portalAreaDestino, destino, selecionado || "@posicao", ref);
}

function tituloObjetoEmMapa(
  mapaAlvo,
  obj
) {
  if (!obj) {
    return "";
  }

  if (
    obj.entityRef &&
    Array.isArray(
      mapaAlvo.fontesDados
    )
  ) {
    const fonte =
      mapaAlvo.fontesDados.find(
        f =>
          f.id ===
          obj.entityRef.sourceId
      );

    const registro =
      fonte?.records?.find(
        r =>
          String(r.id) ===
          String(
            obj.entityRef.recordId
          )
      );

    const titulo =
      registro?.values?.[
        fonte?.titleColumn
      ];

    if (titulo) {
      return String(titulo);
    }
  }

  return (
    obj.nome ||
    "Sem nome"
  );
}

async function criarMapaDestinoSemTrocar(
  nomeMapa,
  arquivo
) {
  const imagem =
    await arquivoParaDataUrl(
      arquivo
    );

  const dim =
    await dimensoesImagem(
      imagem
    );

  const ids =
    new Set(
      (await dbListarResumosMapas(true))
        .map(
          m => m.id
        )
    );

  const novo = {
    id:
      idUnico(
        nomeMapa,
        ids
      ),

    nome:
      nomeMapa,

    imagem,

    largura:
      dim.largura,

    altura:
      dim.altura,

    categorias:
      clone(
        mapaAtual?.categorias ||
        []
      ),
    objetos: [],
    fontesDados:
      clone(
        mapaAtual?.fontesDados ||
        []
      ),

    versaoEditor: 12.5
  };

  await dbSalvar(novo);
  await atualizarSeletorMapas();

  await atualizarDestinosPortal(
    novo.id
  );

  portalMapaDestino.value =
    novo.id;

  await atualizarAreasDestinoPortal(
    novo.id
  );

  avisar(
    "Mapa de destino criado."
  );

  return novo;
}


/* =========================================================
   PORTAIS RECÍPROCOS AUTOMÁTICOS
   ========================================================= */

function centroAreaPortal(
  mapaAlvo,
  areaId
) {
  if (areaId) {
    const area =
      (mapaAlvo.objetos || [])
        .find(
          obj =>
            obj.id ===
            areaId
        );

    const pontos =
      Array.isArray(
        area?.area
      )
        ? area.area
        : [];

    if (pontos.length) {
      const soma =
        pontos.reduce(
          (acc, p) => ({
            x:
              acc.x +
              Number(p.x || 0),

            y:
              acc.y +
              Number(p.y || 0)
          }),
          {
            x: 0,
            y: 0
          }
        );

      return {
        x:
          Math.round(
            soma.x /
            pontos.length
          ),

        y:
          Math.round(
            soma.y /
            pontos.length
          )
      };
    }
  }

  return {
    x:
      Math.round(
        Number(
          mapaAlvo.largura
        ) /
        2
      ),

    y:
      Math.round(
        Number(
          mapaAlvo.altura
        ) /
        2
      )
  };
}

function garantirCategoriaPortalEspelhada(
  mapaAlvo,
  categoriaOrigem,
  categoriaPreferidaId = ""
) {
  mapaAlvo.categorias =
    Array.isArray(
      mapaAlvo.categorias
    )
      ? mapaAlvo.categorias
      : [];

  let categoria =
    categoriaPreferidaId
      ? mapaAlvo.categorias.find(
          c =>
            c.id ===
            categoriaPreferidaId &&
            c.comportamento ===
            "portal"
        )
      : null;

  if (!categoria) {
    categoria =
      mapaAlvo.categorias.find(
        c =>
          c.id ===
            categoriaOrigem.id &&
          c.comportamento ===
            "portal"
      );
  }

  if (!categoria) {
    categoria =
      mapaAlvo.categorias.find(
        c =>
          c.comportamento ===
            "portal" &&
          c.nome ===
            categoriaOrigem.nome &&
          c.icone ===
            categoriaOrigem.icone &&
          c.cor ===
            categoriaOrigem.cor
      );
  }

  if (!categoria) {
    const ids =
      new Set(
        mapaAlvo.categorias.map(
          c => c.id
        )
      );

    const id =
      !ids.has(
        categoriaOrigem.id
      )
        ? categoriaOrigem.id
        : idUnico(
            categoriaOrigem.nome ||
            "Portal",
            ids
          );

    categoria = {
      id,
      nome:
        categoriaOrigem.nome ||
        "Portal",
      geometria:
        "unico",
      icone:
        categoriaOrigem.icone ||
        "portal",
      cor:
        categoriaOrigem.cor ||
        "#A77BFF",
      exibirEmAreas:
        categoriaOrigem.exibirEmAreas !==
        false,
      comportamento:
        "portal",
      portalCriadaAutomaticamente:
        true
    };

    mapaAlvo.categorias.push(
      categoria
    );
  }

  /* O par mantém exatamente o mesmo ícone e a mesma cor. */
  categoria.geometria =
    categoriaOrigem.geometria === "conexao" ? "conexao" : "unico";
  if (categoria.geometria === "conexao") categoria.conexaoRepresentacao = "passagem";

  categoria.icone =
    categoriaOrigem.icone ||
    "portal";

  categoria.cor =
    categoriaOrigem.cor ||
    "#A77BFF";

  categoria.comportamento =
    "portal";

  return categoria;
}

async function removerPortalReciproco(
  portalOrigem,
  pendentes = null
) {
  if (!portalOrigem) {
    return;
  }

  const mapaParId =
    portalOrigem.portalParMapaId ||
    portalOrigem.portalDestinoMapaId ||
    "";

  const objetoParId =
    portalOrigem.portalParObjetoId ||
    "";

  if (
    !mapaParId ||
    !objetoParId
  ) {
    return;
  }

  const mesmoMapa =
    mapaAtual?.id === mapaParId;

  const bruto =
    mesmoMapa
      ? mapaAtual
      : await dbPegar(mapaParId);

  if (!bruto) return;

  const mapaPar =
    mesmoMapa
      ? mapaAtual
      : normalizarEstruturaMapa(bruto);

  const par =
    (mapaPar.objetos || [])
      .find(
        obj =>
          obj.id ===
          objetoParId
      );

  if (!par) {
    return;
  }

  const categoriaParId =
    par.categoriaId;

  mapaPar.objetos =
    mapaPar.objetos.filter(
      obj =>
        obj.id !==
        objetoParId
    );

  const categoriaPar =
    mapaPar.categorias.find(
      c =>
        c.id ===
        categoriaParId
    );

  if (
    categoriaPar?.portalCriadaAutomaticamente &&
    !mapaPar.objetos.some(
      obj =>
        obj.categoriaId ===
        categoriaParId
    )
  ) {
    mapaPar.categorias =
      mapaPar.categorias.filter(
        c =>
          c.id !==
          categoriaParId
      );
  }

  if (pendentes) pendentes.set(mapaPar.id, mapaPar);
  else await dbSalvar(mapaPar);
}

async function sincronizarPortalReciproco(
  portal,
  categoria,
  portalAnterior = null,
  pendentes = null
) {
  if (
    categoria?.comportamento !==
    "portal"
  ) {
    return null;
  }

  /* A chegada unidirecional é um marcador editável, mas não cria
     outra conexão enquanto permanecer configurada como entrada. */
  if (portal.portalEntradaSomente) {
    return null;
  }

  if (portalAnterior?.portalParMapaId && portalAnterior.portalParObjetoId) {
    const fonte = portalAnterior.portalParMapaId === mapaAtual.id ? mapaAtual : await dbPegar(portalAnterior.portalParMapaId);
    const original = fonte?.objetos?.find(o => o.id === portalAnterior.portalParObjetoId);
    if (geometriaEfetiva(categoriaEmMapa(fonte, original?.categoriaId)) === "linha" &&
        (portal.portalDestinoMapaId !== portalAnterior.portalDestinoMapaId || portal.portalBidirecional !== portalAnterior.portalBidirecional ||
         portal.portalDestinoObjetoId && portal.portalDestinoObjetoId !== original.id)) {
      throw new Error("Esta passagem é o retorno de um caminho. Altere o destino e o sentido pelo caminho de origem; aqui você pode editar o ícone e a posição.");
    }
  }

  const mapaOrigem =
    mapaAtual;

  const destinoId =
    portal.portalDestinoMapaId ||
    "";

  const destinoAnteriorId =
    portalAnterior?.portalParMapaId ||
    portalAnterior?.portalDestinoMapaId ||
    "";

  const bidirecional =
    portal.portalBidirecional !== false;

  if (
    portalAnterior?.portalParObjetoId &&
    destinoAnteriorId &&
    destinoAnteriorId !==
      destinoId
  ) {
    await removerPortalReciproco(
      portalAnterior,
      pendentes
    );
  }

  if (!destinoId) {
    delete portal.portalParMapaId;
    delete portal.portalParObjetoId;

    return null;
  }

  const mesmoMapa =
    destinoId === mapaOrigem.id;

  const brutoDestino =
    mesmoMapa
      ? mapaOrigem
      : await dbPegar(destinoId);

  if (!brutoDestino) {
    delete portal.portalParMapaId;
    delete portal.portalParObjetoId;

    return null;
  }

  const mapaDestino =
    mesmoMapa
      ? mapaOrigem
      : normalizarEstruturaMapa(brutoDestino);

  mapaDestino.objetos =
    Array.isArray(
      mapaDestino.objetos
    )
      ? mapaDestino.objetos
      : [];

  let par =
    null;

  const idParConhecido =
    portal.portalParObjetoId ||
    (
      destinoAnteriorId ===
        destinoId
        ? portalAnterior?.portalParObjetoId
        : ""
    );

  if (idParConhecido) {
    par =
      mapaDestino.objetos.find(
        obj =>
          obj.id ===
          idParConhecido
      );
  }

  if (!par) {
    par =
      mapaDestino.objetos.find(
        obj =>
          obj.portalParMapaId ===
            mapaOrigem.id &&
          obj.portalParObjetoId ===
            portal.id
      );
  }

  if (par && geometriaEfetiva(categoriaEmMapa(mapaDestino, par.categoriaId)) === "linha") {
    if (destinoId !== (portalAnterior?.portalDestinoMapaId || portalAnterior?.portalParMapaId)) throw new Error("Altere o destino pelo caminho de origem; esta passagem é seu retorno.");
    portal.portalParMapaId = mapaDestino.id;
    portal.portalParObjetoId = par.id;
    portal.portalDestinoObjetoId = par.id;
    portal.portalBidirecional = par.portalBidirecional;
    return null;
  }

  const categoriaDestino =
    garantirCategoriaPortalEspelhada(
      mapaDestino,
      categoria,
      par?.categoriaId ||
      ""
    );

  const criado =
    !par;

  if (!par) {
    const ids =
      new Set(
        mapaDestino.objetos.map(
          obj => obj.id
        )
      );

    const posicao = posicaoReferenciaConexao(mapaDestino, referenciaPortal(portal)) || centroAreaPortal(mapaDestino, portal.portalDestinoAreaId || "");

    par = {
      id:
        idUnico(
          portal.nome ||
          "Portal",
          ids
        ),

      categoriaId:
        categoriaDestino.id,

      nome:
        portal.nome ||
        "Portal para " +
        mapaOrigem.nome,

      descricao:
        portal.descricao ||
        "",

      x:
        posicao.x,

      y:
        posicao.y
    };

    mapaDestino.objetos.push(
      par
    );
  }

  /*
    Se o usuário já moveu o portal de retorno, a posição é preservada.
    Apenas a criação inicial usa o centro da Área de destino ou do mapa.
  */
  par.categoriaId =
    categoriaDestino.id;

  par.nome =
    portal.nome ||
    par.nome ||
    "Portal para " +
    mapaOrigem.nome;

  if (bidirecional) {
    par.portalDestinoMapaId =
      mapaOrigem.id;

    par.portalDestinoNome =
      mapaOrigem.nome;

    delete par.portalEntradaSomente;
    delete par.portalOrigemMapaId;
    delete par.portalOrigemMapaNome;
    delete par.portalOrigemObjetoId;
  } else {
    delete par.portalDestinoMapaId;
    delete par.portalDestinoNome;

    par.portalEntradaSomente =
      true;

    par.portalOrigemMapaId =
      mapaOrigem.id;

    par.portalOrigemMapaNome =
      mapaOrigem.nome;

    par.portalOrigemObjetoId =
      portal.id;
  }

  delete par.portalDestinoAreaId;
  delete par.portalDestinoAreaNome;
  delete par.portalDestinoObjetoId;
  delete par.portalDestinoPosicao;
  delete par.portalDestinoFracao;
  if (bidirecional) par.portalDestinoObjetoId = portal.id;

  par.portalParMapaId =
    mapaOrigem.id;

  par.portalParObjetoId =
    portal.id;

  par.portalCriadoAutomaticamente =
    true;

  par.portalBidirecional =
    bidirecional;

  if (pendentes) pendentes.set(mapaDestino.id, mapaDestino);
  else await dbSalvar(mapaDestino);

  portal.portalParMapaId =
    mapaDestino.id;

  portal.portalParObjetoId =
    par.id;

  return {
    criado,
    mapaNome:
      mapaDestino.nome,
    objetoId:
      par.id
  };
}

async function atualizarDestinosPortal(
  selecionado = ""
) {
  if (!portalMapaDestino) {
    return;
  }

  const mapas =
    await dbListarResumosMapas();

  portalMapaDestino.innerHTML =
    '<option value="">Sem destino por enquanto</option>';

  for (const m of mapas) {
    const opt =
      document.createElement(
        "option"
      );

    opt.value = m.id;
    opt.textContent =
      m.nome +
      (
        mapaAtual &&
        m.id === mapaAtual.id
          ? " (este mapa)"
          : ""
      );

    portalMapaDestino.appendChild(
      opt
    );
  }

  if (selecionado) {
    portalMapaDestino.value =
      selecionado;
  }

  await atualizarAreasDestinoPortal(
    portalMapaDestino.value,
    ""
  );
}

async function navegarPortal(obj) {
  const destino =
    obj?.portalDestinoMapaId;

  if (!destino) {
    avisar(
      "Esta conexão ainda não possui mapa de destino."
    );
    return;
  }

  const mapaDestino =
    await dbPegar(destino);

  if (!mapaDestino) {
    avisar(
      "O mapa de destino desta conexão não existe mais."
    );
    return;
  }

  const ref = referenciaPortal(obj);
  if (ref.objetoId && !posicaoReferenciaConexao(mapaDestino, ref)) {
    avisar("O local de chegada foi removido. Edite a conexão para escolher outro destino.");
    return;
  }
  await abrirMapa(destino);

  setModo(
    "visualizacao"
  );

  definirPainelAberto(false);

  const chegadaId =
    obj.portalDestinoObjetoId ||
    obj.portalDestinoAreaId ||
    obj.portalParObjetoId ||
    "";

  if (chegadaId) {
    focarObjetoNoMapa(chegadaId);
    const posicao = ref.objetoId && posicaoReferenciaConexao(mapaDestino, ref);
    if (posicao) mapa.panTo(pixelParaMapa(posicao.x, posicao.y));
  } else if (obj.portalDestinoPosicao) {
    mapa.panTo(pixelParaMapa(obj.portalDestinoPosicao.x, obj.portalDestinoPosicao.y));
  }

  avisar(
    "Destino: " +
    mapaDestino.nome +
    (
      obj.portalDestinoAreaNome
        ? " → " +
          obj.portalDestinoAreaNome
        : ""
    )
  );
}
