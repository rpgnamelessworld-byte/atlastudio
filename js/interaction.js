/* Ações da interface, seleção de objetos, foco e atalhos de teclado. */
let limiteSeletorEdicao = 30;
let focoAntesSeletorEdicao = null;

function atualizarInteracaoVisivel() {
  const barra = document.getElementById("acoesMapa");
  if (!barra) return;
  barra.hidden = !mapaAtual;
  const obj = objetoPorId(ui.objetoSelecionadoId);
  const tipoAberto = !modalCategoria.hidden;
  const estado = editor.ativo ? (editor.editandoId ? "edicao" : "criacao")
    : tipoAberto ? "tipo" : ui.modo === "visualizacao" ? "exploracao"
    : obj ? "selecao" : ui.ferramenta === "criar" ? "criacao" : "selecao";
  document.body.dataset.interacao = estado;
  const texto = editor.ativo
    ? (editor.editandoId ? "Editando" : "Criando") + " · " + (categoriaPorId(editor.categoriaId)?.nome || "Objeto") + " · Salve ou cancele no painel"
    : tipoAberto ? "Tipo de marcação · Salve ou cancele no painel"
    : estado === "exploracao" ? "Explorar · Clique ou toque para consultar"
    : obj ? "Selecionado · " + tituloObjeto(obj)
    : estado === "criacao" ? "Criar · Escolha um Tipo na barra inferior"
    : "Selecionar · Clique em um objeto ou use Editar";
  const rotulo = document.getElementById("estadoInteracaoMapa");
  if (rotulo.textContent !== texto) rotulo.textContent = texto;
  barra.querySelector('[data-acao-mapa="explorar"]').setAttribute("aria-pressed", String(estado === "exploracao"));
  barra.querySelector('[data-acao-mapa="criar"]').setAttribute("aria-pressed", String(estado === "criacao"));
  const posicionar = barra.querySelector('[data-acao-mapa="posicionar"]');
  posicionar.hidden = !editor.ativo;
  posicionar.textContent = geometriaEfetiva(categoriaPorId(editor.categoriaId)) === "unico"
    ? "Posicionar no centro do mapa" : "Adicionar ponto no centro do mapa";
}

function atualizarDestaquesInteracao() {
  for (const [id, registro] of layersObjetos) {
    for (const layer of registro.layers) {
      const el = layer.getElement?.();
      if (!el) continue;
      const ativo = ui.modo === "edicao" && id === ui.objetoSelecionadoId && !editor.ativo;
      el.classList.toggle("atlas-object-selected", ativo);
      el.setAttribute("aria-pressed", String(ativo));
    }
  }
  atualizarInteracaoVisivel();
}

function focarFormularioInteracao() {
  requestAnimationFrame(() => {
    if (editor.ativo && painel.classList.contains("aberto")) nomeObjeto.focus({ preventScroll: true });
  });
}

function podeTrocarInteracao() {
  if (!editor.ativo && modalCategoria.hidden) return true;
  definirPainelAberto(true);
  avisar("Salve ou cancele a edição atual antes de trocar de ação.");
  focarFormularioInteracao();
  return false;
}

function editarObjetoPelaInterface(id) {
  if (!podeTrocarInteracao()) return;
  const obj = objetoPorId(id);
  if (!obj) return;
  fecharConsultaNoPainel(false);
  mapa.closePopup();
  setModo("edicao");
  ui.ferramenta = "selecionar";
  ui.categoriasOcultas.delete(obj.categoriaId);
  ui.objetosOcultos.delete(obj.id);
  aplicarVisibilidadeCamadas();
  selecionarObjeto(id);
  editarObjetoSelecionado();
  definirPainelAberto(true);
  focarFormularioInteracao();
}

function listarObjetosParaEdicao() {
  const busca = normalizarBuscaConsulta(document.getElementById("buscaEdicaoObjeto").value).trim();
  const termos = busca.split(/\s+/).filter(Boolean);
  const itens = (mapaAtual?.objetos || []).filter(obj =>
    termos.every(t => normalizarBuscaConsulta(tituloObjeto(obj) + " " + categoriaPorId(obj.categoriaId)?.nome).includes(t))
  ).sort((a, b) => tituloObjeto(a).localeCompare(tituloObjeto(b), "pt-BR", { numeric: true }));
  const root = document.getElementById("resultadosEdicaoObjeto");
  root.replaceChildren();
  for (const obj of itens.slice(0, limiteSeletorEdicao)) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.dataset.editarObjeto = obj.id;
    const titulo = document.createElement("strong");
    titulo.textContent = tituloObjeto(obj);
    const tipo = document.createElement("span");
    tipo.textContent = (categoriaPorId(obj.categoriaId)?.nome || "Tipo desconhecido") + " · Editar";
    botao.append(titulo, tipo);
    root.appendChild(botao);
  }
  document.getElementById("contagemEdicaoObjeto").textContent = itens.length
    ? itens.length + " objeto(s) · " + Math.min(limiteSeletorEdicao, itens.length) + " exibidos"
    : mapaAtual?.objetos.length ? "Nenhum objeto corresponde à busca." : "Este mapa ainda não tem objetos. Feche e use Criar.";
  document.getElementById("maisEdicaoObjeto").hidden = itens.length <= limiteSeletorEdicao;
}

function abrirSeletorEdicao() {
  if (!mapaAtual || !podeTrocarInteracao()) return;
  setModo("edicao");
  ui.ferramenta = "selecionar";
  atualizarFerramentas();
  definirPainelAberto(false);
  focoAntesSeletorEdicao = document.activeElement;
  limiteSeletorEdicao = 30;
  document.getElementById("buscaEdicaoObjeto").value = "";
  listarObjetosParaEdicao();
  document.getElementById("seletorEdicaoObjeto").showModal();
}

function prepararAcessibilidadeObjeto(layer, obj) {
  const configurar = () => {
    const el = layer.getElement?.();
    if (!el || el.dataset.objetoAcessivel) return;
    el.dataset.objetoAcessivel = obj.id;
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", tituloObjeto(obj) + " · " + (categoriaPorId(obj.categoriaId)?.nome || "Objeto"));
    el.addEventListener("keydown", e => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      layer.fire("click", { originalEvent: e });
    }, true);
  };
  layer.on("add", configurar);
  configurar();
}

function prepararTecladoHandle(marker, indice, ancorado, pontual) {
  marker.on("add", () => {
    const el = marker.getElement();
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", (pontual ? categoriaPorId(editor.categoriaId)?.nome : "Ponto " + (indice + 1)) +
      (ancorado ? " · ligado ao destino" : " · Use as setas para mover; Shift move 10 pixels"));
    el.addEventListener("keydown", e => {
      if (e.target !== el) return;
      const deslocamentos = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const d = deslocamentos[e.key];
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      if (ancorado) return;
      invalidarHistoricoRefazerGeometria();
      const passo = e.shiftKey ? 10 : 1;
      editor.pontos[indice].x = clamp(editor.pontos[indice].x + d[0] * passo, 0, mapaAtual.largura);
      editor.pontos[indice].y = clamp(editor.pontos[indice].y + d[1] * passo, 0, mapaAtual.altura);
      editor.verticeSelecionado = indice;
      atualizarPreview();
      atualizarAcoesRail();
      editor.handles[indice]?.getElement()?.focus({ preventScroll: true });
    });
  });
}

function navegarBotoesInteracao(e, seletor) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
  const botoes = [...e.currentTarget.querySelectorAll(seletor)].filter(b => !b.disabled && !b.hidden);
  const indice = botoes.indexOf(document.activeElement);
  if (indice < 0) return;
  e.preventDefault();
  const proximo = e.key === "Home" ? 0 : e.key === "End" ? botoes.length - 1
    : (indice + (["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1) + botoes.length) % botoes.length;
  botoes[proximo]?.focus({ preventScroll: true });
}

document.getElementById("acoesMapa").addEventListener("keydown", e => navegarBotoesInteracao(e, ".map-action-buttons button"));
document.getElementById("menuRadialMapa").addEventListener("keydown", e => navegarBotoesInteracao(e, ".radial-action, .radial-close"));
document.getElementById("acoesMapa").addEventListener("click", e => {
  const botao = e.target.closest("[data-acao-mapa]");
  if (!botao || !mapaAtual) return;
  const acao = botao.dataset.acaoMapa;
  if (acao === "ferramentas") {
    const r = mapa.getContainer().getBoundingClientRect();
    abrirMenuRadial(r.left + r.width / 2, r.top + r.height / 2, true);
    return;
  }
  if (acao === "posicionar") {
    mapa.fire("click", { latlng: mapa.getCenter(), originalEvent: new MouseEvent("click") });
    editor.handles.at(-1)?.getElement()?.focus({ preventScroll: true });
    return;
  }
  if (!podeTrocarInteracao()) return;
  if (acao === "explorar") {
    setModo("visualizacao");
    definirPainelAberto(false);
  } else if (acao === "criar") {
    fecharConsultaNoPainel(false);
    abrirCriacaoRapidaMapa();
    requestAnimationFrame(() => document.querySelector('#tiposCriacaoRapida button')?.focus({ preventScroll: true }) || document.getElementById("novoTipoRapido").focus());
  } else if (acao === "editar") {
    if (objetoPorId(ui.objetoSelecionadoId)) editarObjetoPelaInterface(ui.objetoSelecionadoId);
    else abrirSeletorEdicao();
  }
});
document.addEventListener("click", e => {
  const botao = e.target.closest("[data-editar-objeto]");
  if (!botao) return;
  const seletor = document.getElementById("seletorEdicaoObjeto");
  if (seletor.open) seletor.close();
  editarObjetoPelaInterface(botao.dataset.editarObjeto);
});
document.getElementById("buscaEdicaoObjeto").addEventListener("input", () => { limiteSeletorEdicao = 30; listarObjetosParaEdicao(); });
document.getElementById("maisEdicaoObjeto").onclick = () => { limiteSeletorEdicao += 30; listarObjetosParaEdicao(); };
document.getElementById("seletorEdicaoObjeto").addEventListener("close", () => {
  if (focoAntesSeletorEdicao?.isConnected) focoAntesSeletorEdicao.focus({ preventScroll: true });
});
document.getElementById("mapa").setAttribute("aria-label", "Mapa interativo. Use as ações Explorar, Criar, Editar e Ferramentas.");
