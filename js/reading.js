/* Consulta não altera seleção, geometria ou formulários do editor. */
let consultaAberta = null;
let popupConsultaAtual = null;
let observadorPopupConsulta = null;
let artigoPopupObservado = null;
let framePopupConsulta = null;
let ajustandoPosicaoConsulta = false;
const consultasRegiao = new WeakMap();
const deslocamentosOriginaisConsulta = new WeakMap();

function normalizarBuscaConsulta(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function prepararRegiaoConsulta(root, estadoAnterior = null) {
  if (consultasRegiao.has(root)) return;
  const area = objetoPorId(root.dataset.consultaRegiao);
  if (!area) return;
  const itens = objetosDentroArea(area).map(obj => {
    const cat = categoriaPorId(obj.categoriaId);
    const texto = document.createElement("div");
    texto.innerHTML = detalhesObjetoHtml(obj);
    return { obj, cat, busca: normalizarBuscaConsulta(`${tituloObjeto(obj)} ${cat.nome} ${texto.textContent}`) };
  }).sort((a, b) => tituloObjeto(a.obj).localeCompare(tituloObjeto(b.obj), "pt-BR", { numeric: true }));
  const estado = { busca: "", tipo: "", limite: 30, abertos: new Set(), ...estadoAnterior, itens };
  consultasRegiao.set(root, estado);
  root.innerHTML = '<strong class="regiao-titulo-secao">Conteúdo da região</strong>' +
    '<div class="consulta-filtros"><label>Buscar nesta região<input type="search" placeholder="Nome, descrição ou dados…" autocomplete="off"></label>' +
    '<label>Tipo<select><option value="">Todos os tipos</option></select></label>' +
    '<button type="button" class="consulta-limpar">Limpar filtros</button></div>' +
    '<p class="consulta-contagem" role="status" aria-live="polite"></p>' +
    '<div class="consulta-resultados"></div><button type="button" class="consulta-mais">Mostrar mais 30</button>';
  const busca = root.querySelector("input");
  const tipo = root.querySelector("select");
  const grupos = new Map();
  for (const item of itens) {
    if (!grupos.has(item.cat.id)) grupos.set(item.cat.id, { nome: item.cat.nome, total: 0 });
    grupos.get(item.cat.id).total++;
  }
  for (const [id, grupo] of [...grupos].sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"))) {
    tipo.add(new Option(`${grupo.nome} (${grupo.total})`, id));
  }
  busca.value = estado.busca;
  tipo.value = estado.tipo;
  if (!tipo.value) estado.tipo = "";
  function filtrar() {
    estado.busca = busca.value;
    estado.tipo = tipo.value;
    estado.limite = 30;
    renderizarResultadosConsulta(root);
  }
  busca.addEventListener("input", filtrar);
  tipo.addEventListener("change", filtrar);
  root.querySelector(".consulta-limpar").onclick = () => {
    busca.value = tipo.value = "";
    filtrar();
    busca.focus();
  };
  root.querySelector(".consulta-mais").onclick = () => {
    estado.limite += 30;
    renderizarResultadosConsulta(root);
  };
  renderizarResultadosConsulta(root);
}

function renderizarResultadosConsulta(root) {
  const estado = consultasRegiao.get(root);
  const termos = normalizarBuscaConsulta(estado.busca).trim().split(/\s+/).filter(Boolean);
  const encontrados = estado.itens.filter(item => (!estado.tipo || item.cat.id === estado.tipo) && termos.every(termo => item.busca.includes(termo)));
  const visiveis = encontrados.slice(0, estado.limite);
  root.querySelector(".consulta-contagem").textContent = `${encontrados.length} de ${estado.itens.length} itens · ${visiveis.length} exibidos`;
  const lista = root.querySelector(".consulta-resultados");
  lista.replaceChildren();
  if (!encontrados.length) {
    const mensagem = document.createElement("p");
    mensagem.textContent = estado.itens.length ? "Nenhum item corresponde à busca e ao tipo selecionados." : "Nenhum item incluído nesta região. Tipos configurados para não aparecer em áreas não são listados.";
    lista.appendChild(mensagem);
  }
  for (const { obj, cat } of visiveis) {
    const row = document.createElement("article");
    row.className = "consulta-item";
    row.innerHTML = htmlMiniObjeto(obj, cat) +
      '<div class="consulta-item-acoes"><span>' + esc(cat.nome) + '</span><button type="button" data-consulta-localizar="' + esc(obj.id) + '" aria-label="Localizar ' + esc(tituloObjeto(obj)) + '">Localizar</button></div>';
    const details = row.querySelector("details");
    const preencher = () => {
      const body = details.querySelector(".regiao-detalhes");
      if (body.dataset.carregado) return;
      body.dataset.carregado = "true";
      body.innerHTML = detalhesObjetoHtml(obj) || "<p>Sem descrição ou dados vinculados.</p>";
      if (cat.comportamento === "portal") {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.dataset.consultaPortal = obj.id;
        botao.className = "object-popup-link-button";
        botao.textContent = obj.portalEntradaSomente ? "Somente chegada" : obj.portalDestinoMapaId ? "Ir para o destino" : "Destino não definido";
        botao.disabled = obj.portalEntradaSomente || !obj.portalDestinoMapaId;
        body.appendChild(botao);
      }
    };
    if (estado.abertos.has(obj.id)) { preencher(); details.open = true; }
    details.addEventListener("toggle", () => {
      if (!details.isConnected) return;
      if (details.open) { estado.abertos.add(obj.id); preencher(); }
      else estado.abertos.delete(obj.id);
      agendarAjustePopupConsulta();
    });
    lista.appendChild(row);
  }
  root.querySelector(".consulta-mais").hidden = visiveis.length >= encontrados.length;
  agendarAjustePopupConsulta();
}

function prepararConteudoConsulta(root) {
  for (const regiao of root.querySelectorAll("[data-consulta-regiao]")) prepararRegiaoConsulta(regiao);
  void atualizarDestinosConsulta(root);
}

function abrirConsultaNoPainel(id, origem = null) {
  const obj = objetoPorId(id);
  const cat = categoriaPorId(obj?.categoriaId);
  if (!obj || !cat) return;
  const regiao = origem?.querySelector("[data-consulta-regiao]");
  const estado = regiao && consultasRegiao.get(regiao);
  consultaAberta = { mapaId: mapaAtual.id, objetoId: id, voltarFoco: document.activeElement };
  const painel = document.getElementById("painelConsulta");
  painel.hidden = false;
  document.body.classList.add("consulta-aberta");
  definirPainelAberto(false);
  desenharConsultaNoPainel(estado);
  mapa.closePopup();
  atualizarLimitesConsulta();
  document.getElementById("fecharConsulta").focus({ preventScroll: true });
}

function desenharConsultaNoPainel(estado = null) {
  const obj = objetoPorId(consultaAberta?.objetoId);
  const cat = categoriaPorId(obj?.categoriaId);
  const conteudo = document.getElementById("conteudoConsulta");
  if (!obj || !cat) {
    conteudo.innerHTML = "<p>Este objeto foi removido. Feche a consulta ou abra outro objeto.</p>";
    return;
  }
  conteudo.innerHTML = popupObjeto(obj, cat, true);
  void atualizarDestinosConsulta(conteudo);
  const regiao = conteudo.querySelector("[data-consulta-regiao]");
  if (regiao) prepararRegiaoConsulta(regiao, estado);
}

function atualizarConsultaAberta() {
  if (!consultaAberta) return;
  if (consultaAberta.mapaId !== mapaAtual?.id) { fecharConsultaNoPainel(false); return; }
  const conteudo = document.getElementById("conteudoConsulta");
  const regiao = conteudo.querySelector("[data-consulta-regiao]");
  const estado = regiao && consultasRegiao.get(regiao);
  const scroll = conteudo.querySelector(".object-popup-body")?.scrollTop || 0;
  desenharConsultaNoPainel(estado);
  const body = conteudo.querySelector(".object-popup-body");
  if (body) body.scrollTop = scroll;
}

function fecharConsultaNoPainel(restaurarFoco = true) {
  const anterior = consultaAberta?.voltarFoco;
  consultaAberta = null;
  document.getElementById("painelConsulta").hidden = true;
  document.body.classList.remove("consulta-aberta");
  atualizarLimitesConsulta();
  agendarAjustePopupConsulta();
  if (restaurarFoco) {
    if (anterior?.isConnected) anterior.focus({ preventScroll: true });
    else mapa.getContainer().focus({ preventScroll: true });
  }
}

function atualizarLimitesConsulta() {
  const rect = mapa.getContainer().getBoundingClientRect();
  const viewport = window.visualViewport;
  const limiteDireito = (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth);
  const limiteInferior = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight);
  document.documentElement.style.setProperty("--consulta-viewport-height", (viewport?.height || innerHeight) + "px");
  document.documentElement.style.setProperty("--consulta-bottom", Math.max(34, innerHeight - limiteInferior + 8) + "px");
  let direita = Math.min(rect.right, limiteDireito);
  let baixo = Math.min(rect.bottom, limiteInferior);
  const esquerda = Math.max(rect.left, viewport?.offsetLeft || 0);
  const topo = Math.max(rect.top, viewport?.offsetTop || 0);
  if (consultaAberta) {
    const painel = document.getElementById("painelConsulta").getBoundingClientRect();
    if (innerWidth <= 700) baixo = Math.min(baixo, painel.top - 8);
    else direita = Math.min(direita, painel.left - 8);
  }
  const x = Math.max(120, direita - esquerda), y = Math.max(100, baixo - topo);
  const container = mapa.getContainer();
  container.style.setProperty("--atlas-popup-height", Math.max(64, Math.min(420, y - 64)) + "px");
  container.style.setProperty("--atlas-popup-width", Math.max(100, Math.min(360, x - 40)) + "px");
  if (popupConsultaAtual) {
    popupConsultaAtual.options.autoPanPaddingTopLeft = L.point(Math.max(12, esquerda - rect.left + 12), Math.max(12, topo - rect.top + 12));
    popupConsultaAtual.options.autoPanPaddingBottomRight = L.point(Math.max(12, rect.right - direita + 12), Math.max(12, rect.bottom - baixo + 12));
  }
  return { x, y, esquerda, topo, direita, baixo };
}

function manterPopupNaAreaVisivel() {
  if (ajustandoPosicaoConsulta || !popupConsultaAtual?.isOpen()) return;
  ajustandoPosicaoConsulta = true;
  try {
    const popup = popupConsultaAtual;
    const limites = atualizarLimitesConsulta();
    const original = deslocamentosOriginaisConsulta.get(popup);
    popup.options.offset = original;
    popup.update();
    const root = popup.getElement();
    root.classList.remove("consulta-popup-deslocado");
    const caixa = root.querySelector(".leaflet-popup-content-wrapper")?.getBoundingClientRect();
    if (!caixa) return;
    const dx = caixa.left < limites.esquerda + 12 ? caixa.left - limites.esquerda - 12 : Math.max(0, caixa.right - limites.direita + 12);
    const dy = caixa.top < limites.topo + 12 ? caixa.top - limites.topo - 12 : Math.max(0, caixa.bottom - limites.baixo + 12);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    // Com zoom distante, maxBounds pode impedir qualquer movimento da câmera.
    // Deslocar apenas a janela mantém a leitura dentro da tela sem disputar
    // com o limite do mapa. A ponta é ocultada quando não aponta para a âncora.
    popup.options.offset = original.subtract(L.point(dx, dy));
    root.classList.add("consulta-popup-deslocado");
    popup.update();
  }
  finally { ajustandoPosicaoConsulta = false; }
}

function agendarAjustePopupConsulta() {
  if (framePopupConsulta !== null) return;
  framePopupConsulta = requestAnimationFrame(() => {
    framePopupConsulta = null;
    if (!popupConsultaAtual?.isOpen()) return;
    atualizarLimitesConsulta();
    popupConsultaAtual.update();
    manterPopupNaAreaVisivel();
  });
}

function prepararPopupConsulta(popup) {
  if (!popup.getElement()?.classList.contains("atlas-object-popup")) return;
  // Leaflet recria conteúdo string em update(). Mantendo um nó DOM,
  // a rolagem, a busca e os details abertos sobrevivem ao ajuste de posição.
  if (typeof popup.getContent() === "string") {
    const content = document.createElement("div");
    content.innerHTML = popup.getContent();
    popup.setContent(content);
  }
  prepararConteudoConsulta(popup.getElement());
  const article = popup.getElement().querySelector(".object-popup");
  observarArtigoConsulta(article);
  agendarAjustePopupConsulta();
}

function observarArtigoConsulta(article) {
  if (article === artigoPopupObservado) return;
  observadorPopupConsulta?.disconnect();
  artigoPopupObservado = article;
  observadorPopupConsulta = new ResizeObserver(agendarAjustePopupConsulta);
  if (article) observadorPopupConsulta.observe(article);
}

mapa.on("popupopen", ({ popup }) => {
  if (!popup.getElement()?.classList.contains("atlas-object-popup")) return;
  if (!deslocamentosOriginaisConsulta.has(popup)) deslocamentosOriginaisConsulta.set(popup, L.point(popup.options.offset));
  // Uma animação anterior não pode sobrescrever o enquadramento da consulta.
  mapa.stop();
  popupConsultaAtual = popup;
  prepararPopupConsulta(popup);
  popup.off("contentupdate", aoAtualizarConteudoConsulta);
  popup.on("contentupdate", aoAtualizarConteudoConsulta);
});
function aoAtualizarConteudoConsulta(e) {
  const root = e.target.getElement();
  if (!root) return;
  prepararConteudoConsulta(root);
  observarArtigoConsulta(root.querySelector(".object-popup"));
}
mapa.on("popupclose", ({ popup }) => {
  popup.off("contentupdate", aoAtualizarConteudoConsulta);
  if (popup !== popupConsultaAtual) return;
  popupConsultaAtual = null;
  observadorPopupConsulta?.disconnect();
  artigoPopupObservado = null;
});
mapa.on("resize", agendarAjustePopupConsulta);
mapa.on("moveend", manterPopupNaAreaVisivel);
window.addEventListener("resize", () => { atualizarLimitesConsulta(); agendarAjustePopupConsulta(); });
window.visualViewport?.addEventListener("resize", () => { atualizarLimitesConsulta(); agendarAjustePopupConsulta(); });

document.getElementById("fecharConsulta").onclick = () => fecharConsultaNoPainel();
document.getElementById("painelConsulta").addEventListener("keydown", e => {
  if (e.key === "Escape") { e.stopPropagation(); fecharConsultaNoPainel(); }
});
document.addEventListener("click", async e => {
  const botao = e.target.closest("[data-consulta-abrir], [data-consulta-localizar], [data-consulta-portal]");
  if (!botao || botao.disabled) return;
  const root = botao.closest(".atlas-object-popup");
  if (!root) return;
  e.preventDefault();
  if (botao.dataset.consultaAbrir) abrirConsultaNoPainel(botao.dataset.consultaAbrir, root);
  if (botao.dataset.consultaLocalizar) {
    const id = botao.dataset.consultaLocalizar;
    if (!consultaAberta && root.querySelector("[data-consulta-regiao]")) {
      abrirConsultaNoPainel(root.querySelector("[data-consulta-regiao]").dataset.consultaRegiao, root);
    }
    mapa.closePopup();
    focarObjetoNoMapa(id, { selecionar: false, areaVisivel: atualizarLimitesConsulta() });
  }
  if (botao.dataset.consultaPortal) {
    const obj = objetoPorId(botao.dataset.consultaPortal);
    if (!obj || obj.portalEntradaSomente || !obj.portalDestinoMapaId) return;
    botao.disabled = true;
    try { await navegarPortal(obj); }
    catch (erro) { avisar(erro.message); }
    finally { botao.disabled = false; }
  }
});
