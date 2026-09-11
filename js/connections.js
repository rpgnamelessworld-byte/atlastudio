/* Referências são identificadas pelo par mapa/objeto, nunca por coordenadas remotas. */
function validarPacoteProjeto(pacote) {
  if (!pacote || pacote.formato !== "atlas-studio-project" ||
      ![1, 2].includes(pacote.schemaVersion) || typeof pacote.projeto?.nome !== "string" ||
      !pacote.projeto.nome.trim() || !Array.isArray(pacote.mapas)) {
    throw new Error("Backup inválido ou versão não suportada. Nenhum dado foi importado.");
  }
  const idsMapas = new Set();
  const pontoValido = p => p && typeof p.x === "number" && Number.isFinite(p.x) && typeof p.y === "number" && Number.isFinite(p.y);
  for (const m of pacote.mapas) {
    if (!m || typeof m.id !== "string" || !m.id || idsMapas.has(m.id) ||
        typeof m.nome !== "string" || !m.nome.trim() || typeof m.imagem !== "string" || !m.imagem ||
        !Number.isFinite(m.largura) || m.largura <= 0 || !Number.isFinite(m.altura) || m.altura <= 0 ||
        !Array.isArray(m.categorias) || !Array.isArray(m.objetos)) {
      throw new Error("Mapa inválido ou repetido no backup. Nenhum dado foi importado.");
    }
    idsMapas.add(m.id);
    const categorias = new Map();
    for (const cat of m.categorias) {
      if (!cat || typeof cat.id !== "string" || !cat.id || categorias.has(cat.id) || !["unico", "linha", "area", "conexao"].includes(cat.geometria) ||
          cat.geometria === "conexao" && !["caminho", "passagem"].includes(cat.conexaoRepresentacao)) {
        throw new Error(`Tipos inválidos ou repetidos no mapa ${m.nome}.`);
      }
      categorias.set(cat.id, cat);
    }
    const ids = new Set();
    for (const obj of m.objetos) {
      const cat = categorias.get(obj?.categoriaId);
      if (!obj || typeof obj.id !== "string" || !obj.id || ids.has(obj.id) || !cat) throw new Error(`Objeto inválido, repetido ou sem tipo no mapa ${m.nome}.`);
      ids.add(obj.id);
      if (geometriaEfetiva(cat) === "unico" && !pontoValido(obj) ||
          geometriaEfetiva(cat) === "linha" && (!Array.isArray(obj.pontos) || obj.pontos.length < 2 || !obj.pontos.every(pontoValido)) ||
          geometriaEfetiva(cat) === "area" && (!Array.isArray(obj.area) || obj.area.length < 3 || !obj.area.every(pontoValido) || !pontoInteriorArea(obj.area))) {
        throw new Error(`Geometria inválida em ${obj.nome || obj.id}, mapa ${m.nome}.`);
      }
      if (obj.ramificacoes !== undefined && (!Array.isArray(obj.ramificacoes) || obj.ramificacoes.some(r => !r || !Number.isInteger(r.origemIndice) || r.origemIndice < 0 || r.origemIndice >= (obj.pontos?.length || 0) || !Array.isArray(r.pontos) || !r.pontos.every(pontoValido)))) {
        throw new Error(`Ramificação inválida em ${obj.nome || obj.id}.`);
      }
      for (const campo of ["relacaoOrigemMapaId", "relacaoDestinoMapaId", "relacaoOrigemId", "relacaoDestinoId", "portalDestinoMapaId", "portalParMapaId", "portalParObjetoId", "portalOrigemMapaId", "portalOrigemObjetoId", "portalDestinoAreaId", "portalDestinoObjetoId"]) {
        if (obj[campo] !== undefined && typeof obj[campo] !== "string") throw new Error(`Referência inválida em ${obj.nome || obj.id}.`);
      }
      for (const campo of ["relacaoOrigemPosicao", "relacaoDestinoPosicao", "portalDestinoPosicao"]) {
        if (obj[campo] != null && !pontoValido(obj[campo])) throw new Error(`Posição de conexão inválida em ${obj.nome || obj.id}.`);
      }
      for (const campo of ["relacaoOrigemFracao", "relacaoDestinoFracao", "portalDestinoFracao"]) {
        if (obj[campo] != null && (typeof obj[campo] !== "number" || !Number.isFinite(obj[campo]) || obj[campo] < 0 || obj[campo] > 1)) throw new Error(`Ponto de encontro inválido em ${obj.nome || obj.id}.`);
      }
    }
  }
}

function referenciasLinha(obj, mapaId) {
  return ["Origem", "Destino"].map(lado => ({
    mapaId: obj[`relacao${lado}MapaId`] || mapaId,
    objetoId: obj[`relacao${lado}Id`] || "",
    posicao: obj[`relacao${lado}Posicao`],
    fracao: obj[`relacao${lado}Fracao`]
  }));
}

function linhaEntreMapas(obj, mapaId = mapaAtual?.id) {
  const [a, b] = referenciasLinha(obj, mapaId);
  return Boolean((a.objetoId || a.posicao) && (b.objetoId || b.posicao) && a.mapaId !== b.mapaId);
}

function pontosPassagemLinha(obj) {
  const local = referenciasLinha(obj, mapaAtual.id).find(ref => ref.mapaId === mapaAtual.id);
  const inicio = posicaoReferenciaConexao(mapaAtual, local);
  if (!inicio) return [];
  if (obj.relacaoVersao === 2 && obj.pontos?.length >= 2) {
    const pontos = clone(obj.pontos);
    pontos[0] = inicio;
    return pontos;
  }
  const distancia = Math.max(24, Math.min(mapaAtual.largura, mapaAtual.altura) * .06);
  const sinal = inicio.x + distancia < mapaAtual.largura ? 1 : -1;
  return [inicio, { x: inicio.x + sinal * distancia, y: inicio.y }];
}

async function resolverReferenciaMapa(ref) {
  const m = ref.mapaId === mapaAtual?.id ? mapaAtual : await dbPegar(ref.mapaId);
  const obj = m?.objetos?.find(item => item.id === ref.objetoId);
  return { mapa: m, objeto: obj };
}

function vincularPassagemLinha(marker, obj, cat) {
  marker.bindPopup(popupObjeto(obj, cat), opcoesPopupObjeto());
  vincularInteracaoObjeto(marker, obj, cat);
}

async function navegarConexao(obj) {
  if (!obj || editor.ativo) return;
  const refs = referenciasLinha(obj, mapaAtual.id);
  const ref = refs.find(r => r.mapaId !== mapaAtual.id) || refs[1];
  const alvo = await resolverReferenciaMapa(ref);
  const p = posicaoReferenciaConexao(alvo.mapa, ref);
  if (!p) throw new Error("Destino ausente. Edite a conexão para escolher outro local.");
  if (ref.mapaId !== mapaAtual.id) await abrirMapa(ref.mapaId);
  setModo("visualizacao");
  if (ref.objetoId) focarObjetoNoMapa(ref.objetoId);
  mapa.panTo(pixelParaMapa(p.x, p.y));
}

document.addEventListener("click", async e => {
  const botao = e.target.closest("[data-consulta-conexao]");
  if (!botao) return;
  botao.disabled = true;
  try { await navegarConexao(objetoPorId(botao.dataset.consultaConexao)); }
  catch (erro) { avisar(erro.message); }
  finally { botao.disabled = false; }
});

function verificarVinculosMapas(mapas) {
  const porId = new Map(mapas.map(m => [m.id, m]));
  const problemas = [];
  for (const m of mapas) {
    for (const obj of m.objetos || []) {
      const refs = [];
      if (obj.relacaoOrigemId || obj.relacaoDestinoId || obj.relacaoOrigemPosicao || obj.relacaoDestinoPosicao) {
        refs.push(...referenciasLinha(obj, m.id).map((ref, i) => ({ ...ref, tipo: i ? "Destino da linha" : "Origem da linha", geometria: true })));
      }
      for (const [campo, objetoCampo, tipo] of [
        ["portalDestinoMapaId", obj.portalDestinoObjetoId ? "portalDestinoObjetoId" : "portalDestinoAreaId", "Destino da passagem"],
        ["portalParMapaId", "portalParObjetoId", "Par do portal"],
        ["portalOrigemMapaId", "portalOrigemObjetoId", "Origem do portal"]
      ]) {
        if (obj[campo]) refs.push({ mapaId: obj[campo], objetoId: obj[objetoCampo], tipo });
      }
      for (const ref of refs) {
        const destino = porId.get(ref.mapaId);
        const objeto = destino?.objetos?.find(item => item.id === ref.objetoId);
        const erro = !destino ? "Mapa ausente" : ref.objetoId && !objeto ? "Objeto ausente" :
          ref.geometria && !posicaoReferenciaConexao(destino, ref) ? "Destino sem geometria válida" : "";
        if (erro) problemas.push({ mapaId: m.id, objetoId: obj.id, mapa: m.nome, objeto: obj.nome || obj.id, tipo: ref.tipo, erro });
      }
    }
  }
  return problemas;
}

async function mostrarVerificacaoVinculos() {
  const mapas = await dbTodos();
  const problemas = verificarVinculosMapas(mapas);
  const dialogo = document.getElementById("dialogoVinculos");
  const lista = document.getElementById("listaVinculos");
  lista.replaceChildren();
  if (!problemas.length) lista.textContent = "Nenhum vínculo quebrado encontrado neste projeto.";
  for (const problema of problemas) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = `${problema.mapa} → ${problema.objeto}: ${problema.tipo} — ${problema.erro}. Abrir objeto`;
    botao.addEventListener("click", async () => {
      dialogo.close();
      await abrirMapa(problema.mapaId);
      setModo("edicao");
      selecionarObjeto(problema.objetoId);
      editarObjetoSelecionado();
    });
    lista.appendChild(botao);
  }
  dialogo.showModal();
}
