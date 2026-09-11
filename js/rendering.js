/* Invalidação incremental. O fallback completo é usado ao trocar mapa, imagem,
   dimensões, câmera inicial ou durante a prévia de um formulário ativo. */
let contextoRenderizado = null;
let assinaturasRenderizadas = new Map();
const metricasRenderizacao = { completos: 0, incrementais: 0, objetosAtualizados: 0 };

function invalidarCacheRenderizacao() {
  contextoRenderizado = null;
  assinaturasRenderizadas.clear();
}

function contextoRenderizacaoAtual() {
  return { id: mapaAtual.id, imagem: mapaAtual.imagem, largura: mapaAtual.largura, altura: mapaAtual.altura,
    dependencias: JSON.stringify([mapaAtual.fontesDados, mapaAtual.calibracaoMedida]) };
}

function assinaturasObjetosMapa() {
  const objetos = new Map(mapaAtual.objetos.map(obj => [obj.id, obj]));
  const categorias = new Map(mapaAtual.categorias.map(cat => [cat.id, cat]));
  const base = new Map(mapaAtual.objetos.map(obj => [obj.id, JSON.stringify([obj, categorias.get(obj.categoriaId)])]));
  // A consulta agregada de uma área depende do conteúdo dos objetos pontuais.
  const conteudoAreas = mapaAtual.objetos.filter(obj => geometriaEfetiva(categorias.get(obj.categoriaId)) === "unico")
    .map(obj => base.get(obj.id)).join("|");
  return new Map(mapaAtual.objetos.map(obj => {
    const cat = categorias.get(obj.categoriaId);
    let dependencia = "";
    if (geometriaEfetiva(cat) === "area") dependencia = conteudoAreas;
    if (geometriaEfetiva(cat) === "linha" && cat.comportamentoLinha === "relacao") {
      dependencia = ["Origem", "Destino"].map(lado => {
        const ref = referenciasLinha(obj, mapaAtual.id)[lado === "Origem" ? 0 : 1];
        return ref?.mapaId === mapaAtual.id ? base.get(objetos.get(ref.objetoId)?.id) : "";
      }).join("|");
    }
    return [obj.id, base.get(obj.id) + dependencia];
  }));
}

function removerCamadasObjeto(id) {
  const registro = layersObjetos.get(id);
  if (!registro) return;
  cancelarCliquePendenteObjeto(registro.objeto);
  const removidas = new Set(registro.layers);
  for (const layer of removidas) if (mapa.hasLayer(layer)) mapa.removeLayer(layer);
  for (let i = linhasEscalaveis.length - 1; i >= 0; i--) if (removidas.has(linhasEscalaveis[i].layer)) linhasEscalaveis.splice(i, 1);
  for (let i = labelsEscalaveis.length - 1; i >= 0; i--) if (labelsEscalaveis[i].obj.id === id) labelsEscalaveis.splice(i, 1);
  layersObjetos.delete(id);
}

function tentarRenderizacaoIncremental(opcoes) {
  const contexto = contextoRenderizacaoAtual();
  if (!contextoRenderizado || !imageOverlay || !mapa.hasLayer(imageOverlay) || editor.ativo || opcoes.forcarCompleto || opcoes.resetCamera || opcoes.preservarCamera === false ||
    Object.keys(contexto).some(chave => contexto[chave] !== contextoRenderizado[chave])) return false;
  const assinaturas = assinaturasObjetosMapa();
  for (const id of layersObjetos.keys()) if (!assinaturas.has(id)) removerCamadasObjeto(id);
  for (const obj of mapaAtual.objetos) {
    const registro = layersObjetos.get(obj.id);
    const oculto = ui.camadasOcultas.has(obj.categoriaId) || ui.objetosOcultos.has(obj.id);
    const ausente = registro && !oculto && registro.layers.every(layer => !mapa.hasLayer(layer));
    if (!registro || registro.objeto !== obj || ausente || assinaturas.get(obj.id) !== assinaturasRenderizadas.get(obj.id)) {
      removerCamadasObjeto(obj.id);
      renderObjeto(obj);
      metricasRenderizacao.objetosAtualizados++;
    }
  }
  assinaturasRenderizadas = assinaturas;
  metricasRenderizacao.incrementais++;
  finalizarRenderizacaoInterface();
  return true;
}

function registrarRenderizacaoCompleta() {
  contextoRenderizado = contextoRenderizacaoAtual();
  assinaturasRenderizadas = assinaturasObjetosMapa();
  metricasRenderizacao.completos++;
  metricasRenderizacao.objetosAtualizados += mapaAtual.objetos.length;
}

function finalizarRenderizacaoInterface() {
  atualizarLegenda();
  atualizarSelecaoObjetoUI();
  aplicarVisibilidadeCamadas();
  atualizarAcoesRail();
  atualizarConsultaAberta();
}
