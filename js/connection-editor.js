/* Seletores compartilhados por caminhos e passagens. As referências antigas
   continuam válidas; coordenadas pertencem sempre ao mapa da extremidade. */
const seletoresConexao = new Map();
let selecaoConexaoNoMapa = null;

function pontoNoCaminho(pontos, fracao = .5) {
  if (!pontos?.length) return null;
  const distancias = pontos.slice(1).map((p, i) => Math.hypot(p.x - pontos[i].x, p.y - pontos[i].y));
  let restante = distancias.reduce((a, b) => a + b, 0) * clamp(Number(fracao), 0, 1);
  for (let i = 0; i < distancias.length; i++) {
    if (restante <= distancias[i] && distancias[i] > 0) {
      const t = restante / distancias[i];
      return { x: pontos[i].x + (pontos[i + 1].x - pontos[i].x) * t, y: pontos[i].y + (pontos[i + 1].y - pontos[i].y) * t };
    }
    restante -= distancias[i];
  }
  return { ...pontos[pontos.length - 1] };
}

function posicaoReferenciaConexao(m, ref) {
  if (!m || !ref) return null;
  if (!ref.objetoId) return ref.posicao && Number.isFinite(ref.posicao.x) && Number.isFinite(ref.posicao.y) ? ref.posicao : null;
  const obj = m.objetos?.find(o => o.id === ref.objetoId);
  const cat = categoriaEmMapa(m, obj?.categoriaId);
  if (geometriaEfetiva(cat) === "linha") return pontoNoCaminho(obj.pontos, ref.fracao ?? .5);
  return ancoraObjetoRelacao(m, obj);
}

function instalarSeletorConexao(select, mudou = () => {}) {
  if (seletoresConexao.has(select)) return seletoresConexao.get(select);
  const root = document.createElement("div");
  root.className = "conexao-local";
  select.before(root);
  const prefixo = select.id;
  root.innerHTML = `<label for="${prefixo}Busca">Buscar local</label><input id="${prefixo}Busca" type="search" placeholder="Nome ou categoria" autocomplete="off">
    <div class="conexao-coordenadas" hidden><label>X<input id="${prefixo}X" type="number" step="any"></label><label>Y<input id="${prefixo}Y" type="number" step="any"></label></div>
    <label class="conexao-fracao" hidden>Ponto no caminho (%)<input id="${prefixo}Fracao" type="number" min="0" max="100" step="any" value="50"></label>
    <button type="button" class="conexao-escolher">Selecionar no mapa aberto</button>`;
  root.insertBefore(select, root.querySelector(".conexao-coordenadas"));
  const estado = { select, root, mapa: null, mudou, busca: root.querySelector('[type="search"]'), x: root.querySelector(`#${prefixo}X`), y: root.querySelector(`#${prefixo}Y`), fracao: root.querySelector(`#${prefixo}Fracao`) };
  seletoresConexao.set(select, estado);
  estado.busca.addEventListener("input", () => preencherSeletorConexao(estado, select.value));
  select.addEventListener("change", () => { atualizarCamposLocalConexao(estado); mudou(); });
  for (const input of [estado.x, estado.y, estado.fracao]) input.addEventListener("input", mudou);
  root.querySelector("button").onclick = () => {
    cancelarSelecaoConexao();
    if (estado.mapa?.id !== mapaAtual?.id) return;
    selecaoConexaoNoMapa = estado;
    root.classList.add("conexao-escolhendo");
    avisar("Clique em um objeto, região ou posição livre. Escape cancela a escolha.");
  };
  return estado;
}

function atualizarCamposLocalConexao(e) {
  e.root.querySelector(".conexao-coordenadas").hidden = e.select.value !== "@posicao";
  const obj = e.mapa?.objetos?.find(o => o.id === e.select.value);
  e.root.querySelector(".conexao-fracao").hidden = geometriaEfetiva(categoriaEmMapa(e.mapa, obj?.categoriaId)) !== "linha";
  e.root.querySelector("button").hidden = e.mapa?.id !== mapaAtual?.id;
}

function preencherSeletorConexao(e, escolhido = "") {
  const consulta = normalizarBuscaConsulta(e.busca.value).trim();
  const itens = objetosRelacionaveis(e.mapa).filter(o => o.id !== editor.editandoId);
  e.select.replaceChildren(new Option("Selecione um local", ""), new Option("Posição no mapa", "@posicao"));
  const grupos = new Map();
  for (const obj of itens.sort((a, b) => tituloObjetoEmMapa(e.mapa, a).localeCompare(tituloObjetoEmMapa(e.mapa, b), "pt-BR", { numeric: true }))) {
    const cat = categoriaEmMapa(e.mapa, obj.categoriaId);
    const nome = tituloObjetoEmMapa(e.mapa, obj);
    if (obj.id !== escolhido && !normalizarBuscaConsulta(nome + " " + cat.nome).includes(consulta)) continue;
    if (!grupos.has(cat.id)) { const g = document.createElement("optgroup"); g.label = cat.nome; grupos.set(cat.id, g); }
    grupos.get(cat.id).appendChild(new Option(nome, obj.id));
  }
  for (const g of [...grupos.values()].sort((a,b) => a.label.localeCompare(b.label, "pt-BR"))) e.select.appendChild(g);
  if (escolhido && ![...e.select.options].some(o => o.value === escolhido)) {
    const anterior = e.mapa?.objetos?.find(o => o.id === escolhido);
    e.select.add(new Option(anterior ? tituloObjetoEmMapa(e.mapa, anterior) : "Local ausente — escolha outro", escolhido));
  }
  e.select.value = escolhido;
  atualizarCamposLocalConexao(e);
}

function configurarSeletorConexao(select, m, escolhido = "", ref = {}) {
  const e = instalarSeletorConexao(select, select === portalAreaDestino ? () => {} : aplicarRelacaoLinha);
  e.mapa = m;
  e.busca.value = "";
  e.x.value = ref.posicao?.x ?? Math.round((m?.largura || 0) / 2);
  e.y.value = ref.posicao?.y ?? Math.round((m?.altura || 0) / 2);
  e.fracao.value = (ref.fracao ?? .5) * 100;
  preencherSeletorConexao(e, escolhido || (ref.posicao ? "@posicao" : ""));
}

function referenciaDoSeletor(select) {
  const e = seletoresConexao.get(select);
  const posicao = { x: Number(e?.x.value), y: Number(e?.y.value) };
  return { mapaId: e?.mapa?.id || "", objetoId: select.value === "@posicao" ? "" : select.value,
    posicao: select.value === "@posicao" || select === portalAreaDestino && !select.value ? posicao : null, fracao: clamp(Number(e?.fracao.value || 50) / 100, 0, 1) };
}

function cancelarSelecaoConexao() {
  selecaoConexaoNoMapa?.root.classList.remove("conexao-escolhendo");
  selecaoConexaoNoMapa = null;
}

function escolherLocalConexao(obj, evento) {
  const e = selecaoConexaoNoMapa;
  if (!e || !editor.ativo || e.mapa?.id !== mapaAtual?.id) return false;
  if (evento?.originalEvent) L.DomEvent.stop(evento.originalEvent);
  if (obj && !objetosRelacionaveis(mapaAtual).some(o => o.id === obj.id && o.id !== editor.editandoId)) {
    avisar("Escolha um objeto Único, Área ou Linha livre, sem criar dependências circulares.");
    return true;
  }
  preencherSeletorConexao(e, obj?.id || "@posicao");
  if (!obj && evento?.latlng) {
    const p = mapaParaPixel(evento.latlng);
    e.x.value = p.x; e.y.value = p.y;
  }
  if (obj && geometriaEfetiva(categoriaEmMapa(mapaAtual, obj.categoriaId)) === "linha" && evento?.latlng) {
    const p = mapaParaPixel(evento.latlng);
    const pontos = obj.pontos;
    const total = pontos.slice(1).reduce((s,q,i)=>s + Math.hypot(q.x-pontos[i].x,q.y-pontos[i].y),0);
    let melhor = Infinity, percorrido = 0, distancia = 0;
    for (let i=0;i<pontos.length-1;i++) {
      const a=pontos[i], b=pontos[i+1], dx=b.x-a.x, dy=b.y-a.y, tamanho=Math.hypot(dx,dy);
      const t=tamanho ? clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(tamanho*tamanho),0,1):0;
      const d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
      if(d<melhor){melhor=d;distancia=percorrido+t*tamanho;} percorrido+=tamanho;
    }
    e.fracao.value = total ? distancia/total*100 : 0;
  }
  cancelarSelecaoConexao();
  e.mudou();
  agendarRascunho();
  e.select.focus({ preventScroll: true });
  return true;
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && selecaoConexaoNoMapa) { e.preventDefault(); e.stopImmediatePropagation(); cancelarSelecaoConexao(); }
}, true);

function referenciaPortal(obj) {
  return { mapaId: obj.portalDestinoMapaId, objetoId: obj.portalDestinoObjetoId || obj.portalDestinoAreaId || "", posicao: obj.portalDestinoPosicao, fracao: obj.portalDestinoFracao };
}

async function sincronizarCaminhoReciproco(obj, cat, anterior, pendentes) {
  const refs = referenciasLinha(obj, mapaAtual.id);
  const destino = refs.find(r => r.mapaId !== mapaAtual.id) || refs[1];
  // Reutiliza a transação de pares, nunca o desenho do caminho como ícone de chegada.
  obj.portalDestinoMapaId = destino.mapaId;
  obj.portalDestinoObjetoId = destino.objetoId;
  obj.portalDestinoPosicao = destino.posicao;
  obj.portalDestinoFracao = destino.fracao;
  obj.portalDestinoNome = mapaRelacaoLinhaPorId(destino.mapaId)?.nome || "";
  const catPassagem = { ...cat, id: cat.id + "-chegada", geometria: "conexao", conexaoRepresentacao: "passagem", comportamento: "portal", icone: "portal" };
  delete catPassagem.comportamentoLinha;
  // Caminhos antigos não recebem pares até que o usuário habilite a navegação.
  if (!obj.conexaoNavegavel && !anterior?.portalParObjetoId) return;
  if (!obj.conexaoNavegavel) { await removerPortalReciproco(anterior, pendentes); delete obj.portalParMapaId; delete obj.portalParObjetoId; return; }
  return sincronizarPortalReciproco(obj, catPassagem, anterior, pendentes);
}

async function atualizarDestinosConsulta(root) {
  for (const el of root.querySelectorAll("[data-destino-conexao]")) {
    const obj = objetoPorId(el.dataset.destinoConexao);
    if (!obj) continue;
    const refs = referenciasLinha(obj, mapaAtual.id);
    const ref = refs.find(r => r.mapaId !== mapaAtual.id) || refs[1];
    try {
      const alvo = await resolverReferenciaMapa(ref);
      if (!el.isConnected) continue;
      const valido = posicaoReferenciaConexao(alvo.mapa, ref);
      el.textContent = valido ? "Destino: " + alvo.mapa.nome + " → " + (alvo.objeto ? tituloObjetoEmMapa(alvo.mapa, alvo.objeto) : "Posição no mapa") : "Destino ausente. Edite a conexão para escolher outro local.";
      const botao = el.parentElement.querySelector("[data-consulta-conexao]");
      if (botao) botao.disabled = !valido;
      agendarAjustePopupConsulta();
    } catch { el.textContent = "Não foi possível consultar o destino. Tente novamente."; }
  }
}
