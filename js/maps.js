/*
  Mapas e apresentação.
  Construção das camadas Leaflet e montagem do Inspector.
  Câmera e navegação ficam em navigation.js; invalidação em rendering.js.
*/

/* =========================================================
   FONTES REUTILIZÁVEIS ENTRE MAPAS
   ========================================================= */

async function fontesCompartilhadasProjeto() {
  const mapas =
    await dbTodos();

  const porId =
    new Map();

  for (const mapa of mapas) {
    for (
      const fonte of
      mapa.fontesDados ||
      []
    ) {
      if (
        !porId.has(
          fonte.id
        )
      ) {
        porId.set(
          fonte.id,
          clone(fonte)
        );
      }
    }
  }

  if (mapaAtual) {
    for (
      const fonte of
      mapaAtual.fontesDados ||
      []
    ) {
      porId.set(
        fonte.id,
        clone(fonte)
      );
    }
  }

  return Array.from(
    porId.values()
  );
}

async function garantirFontesCompartilhadasNoMapa(
  mapa
) {
  const fontes =
    await fontesCompartilhadasProjeto();

  const porId =
    new Map(
      fontes.map(
        f => [
          f.id,
          clone(f)
        ]
      )
    );

  for (
    const fonte of
    mapa.fontesDados ||
    []
  ) {
    porId.set(
      fonte.id,
      clone(fonte)
    );
  }

  mapa.fontesDados =
    Array.from(
      porId.values()
    );

  return mapa;
}

async function sincronizarFontesCompartilhadas() {
  if (!mapaAtual) {
    return;
  }

  const fontes =
    clone(
      mapaAtual.fontesDados ||
      []
    );

  const mapas =
    await dbTodos();

  for (const bruto of mapas) {
    if (
      bruto.id ===
      mapaAtual.id
    ) {
      continue;
    }

    const mapa =
      normalizarEstruturaMapa(
        bruto
      );

    mapa.fontesDados =
      clone(
        fontes
      );

    await dbSalvar(
      mapa
    );
  }
}

/* =========================================================
   TIPOS REUTILIZÁVEIS ENTRE MAPAS
   ========================================================= */

function categoriaPodeReceberDefinicao(
  mapa,
  atual,
  compartilhada
) {
  if (
    !atual ||
    geometriaEfetiva(atual) ===
      geometriaEfetiva(compartilhada)
  ) {
    return true;
  }

  return !(
    mapa.objetos || []
  ).some(
    obj =>
      obj.categoriaId === atual.id
  );
}

function aplicarTamanhoPadraoCategoria(
  projeto,
  categoriaId,
  tamanhoAnterior,
  tamanhoNovo
) {
  const anterior =
    clamp(
      Number(
        tamanhoAnterior
      ) || 14,
      4,
      80
    );

  const novo =
    clamp(
      Number(
        tamanhoNovo
      ) || 14,
      4,
      80
    );

  for (
    const obj of
    projeto.objetos || []
  ) {
    if (
      obj.categoriaId !==
      categoriaId
    ) {
      continue;
    }

    const rotulo =
      obj.rotulo ||
      {};

    const tamanhoAtual =
      Number(
        rotulo.tamanho
      );

    const usaPadrao =
      rotulo.modoTamanho ===
        "tipo" ||
      (
        rotulo.modoTamanho !==
          "objeto" &&
        (
          rotulo.tamanhoPersonalizado ===
            false ||
          (
            rotulo.tamanhoPersonalizado !==
              true &&
            (
              !Number.isFinite(
                tamanhoAtual
              ) ||
              tamanhoAtual ===
                anterior
            )
          )
        )
      );

    if (usaPadrao) {
      obj.rotulo = {
        ...rotulo,
        tamanho:
          novo,
        tamanhoPersonalizado:
          false,
        modoTamanho:
          "tipo"
      };
    }
  }
}

async function categoriasCompartilhadasProjeto() {
  const mapas =
    await dbTodos();

  const porId =
    new Map();

  const registrar =
    categoria => {
      const existente =
        porId.get(
          categoria.id
        );

      const dataExistente =
        Number(
          existente?.atualizadoEm
        ) || 0;

      const dataCategoria =
        Number(
          categoria.atualizadoEm
        ) || 0;

      if (
        !existente ||
        dataCategoria > dataExistente
      ) {
        porId.set(
          categoria.id,
          clone(categoria)
        );
      }
    };

  for (const projeto of mapas) {
    for (
      const categoria of
      projeto.categorias || []
    ) {
      registrar(categoria);
    }
  }

  for (
    const categoria of
    mapaAtual?.categorias || []
  ) {
    registrar(categoria);
  }

  return Array.from(
    porId.values()
  );
}

async function garantirCategoriasCompartilhadasNoMapa(
  mapa
) {
  const compartilhadas =
    await categoriasCompartilhadasProjeto();

  const porId =
    new Map(
      (mapa.categorias || []).map(
        categoria => [
          categoria.id,
          clone(categoria)
        ]
      )
    );

  for (const compartilhada of compartilhadas) {
    const atual =
      porId.get(
        compartilhada.id
      );

    if (!atual) {
      porId.set(
        compartilhada.id,
        clone(compartilhada)
      );
      continue;
    }

    const compartilhadaMaisNova =
      Number(
        compartilhada.atualizadoEm
      ) >
      Number(
        atual.atualizadoEm || 0
      );

    if (
      compartilhadaMaisNova &&
      categoriaPodeReceberDefinicao(
        mapa,
        atual,
        compartilhada
      )
    ) {
      if (
        geometriaEfetiva(atual) ===
          "area" &&
        geometriaEfetiva(compartilhada) ===
          "area"
      ) {
        aplicarTamanhoPadraoCategoria(
          mapa,
          atual.id,
          atual.tamanhoFonte,
          compartilhada.tamanhoFonte
        );
      }

      porId.set(
        compartilhada.id,
        clone(compartilhada)
      );
    }
  }

  mapa.categorias =
    Array.from(
      porId.values()
    );

  return mapa;
}

async function sincronizarCategoriasCompartilhadas() {
  if (!mapaAtual) {
    return;
  }

  const categorias =
    clone(
      mapaAtual.categorias || []
    );

  const mapas =
    await dbTodos();

  for (const bruto of mapas) {
    if (bruto.id === mapaAtual.id) {
      continue;
    }

    const projeto =
      normalizarEstruturaMapa(bruto);

    let alterado =
      false;

    for (const compartilhada of categorias) {
      const indice =
        projeto.categorias.findIndex(
          categoria =>
            categoria.id ===
            compartilhada.id
        );

      if (indice < 0) {
        projeto.categorias.push(
          clone(compartilhada)
        );
        alterado = true;
        continue;
      }

      const atual =
        projeto.categorias[indice];

      const compartilhadaMaisNova =
        Number(
          compartilhada.atualizadoEm
        ) >=
        Number(
          atual.atualizadoEm || 0
        );

      if (
        compartilhadaMaisNova &&
        categoriaPodeReceberDefinicao(
          projeto,
          atual,
          compartilhada
        )
      ) {
        if (
          geometriaEfetiva(atual) ===
            "area" &&
          geometriaEfetiva(compartilhada) ===
            "area"
        ) {
          aplicarTamanhoPadraoCategoria(
            projeto,
            atual.id,
            atual.tamanhoFonte,
            compartilhada.tamanhoFonte
          );
        }

        projeto.categorias[indice] =
          clone(compartilhada);
        alterado = true;
      }
    }

    if (alterado) {
      await dbSalvar(projeto);
    }
  }
}

async function criarNovoMapa(
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
  await abrirMapa(novo.id);

  setModo("edicao");

  avisar(
    "Novo mapa criado."
  );
}

/* =========================================================
   FONTES DE DADOS / REGISTROS DE REFERÊNCIA
   ========================================================= */

function fontePorId(id) {
  return mapaAtual?.fontesDados?.find(
    f => f.id === id
  );
}

function registroPorRef(ref) {
  if (
    !ref ||
    !ref.sourceId ||
    !ref.recordId
  ) {
    return null;
  }

  const fonte =
    fontePorId(ref.sourceId);

  if (!fonte) {
    return null;
  }

  const registro =
    fonte.records.find(
      r =>
        String(r.id) ===
        String(ref.recordId)
    );

  if (!registro) {
    return null;
  }

  return {
    fonte,
    registro
  };
}

function tituloRegistro(ref) {
  const dado =
    registroPorRef(ref);

  if (!dado) {
    return "";
  }

  const valor =
    dado.registro.values?.[
      dado.fonte.titleColumn
    ];

  return String(
    valor ?? dado.registro.id
  ).trim();
}

function tituloObjeto(obj) {
  return (
    tituloRegistro(
      obj.entityRef
    ) ||
    obj.nome ||
    "Sem nome"
  );
}

function camposRegistroHtml(
  ref,
  fieldColumns = null
) {
  const dado =
    registroPorRef(ref);

  if (!dado) {
    return (
      '<p class="registro-ausente">' +
      "Registro de referência não encontrado." +
      "</p>"
    );
  }

  let html = "";

  const filtroCampos =
    Array.isArray(fieldColumns)
      ? new Set(fieldColumns)
      : null;

  for (
    const campo of
    dado.fonte.displayFields
  ) {
    if (
      filtroCampos &&
      !filtroCampos.has(
        campo.column
      )
    ) {
      continue;
    }
    if (
      campo.column ===
      dado.fonte.titleColumn
    ) {
      continue;
    }

    const valor =
      dado.registro.values?.[
        campo.column
      ];

    if (
      valor === "" ||
      valor === null ||
      valor === undefined
    ) {
      continue;
    }

    html +=
      "<p><strong>" +
      esc(
        campo.label ||
        campo.column
      ) +
      ":</strong> " +
      esc(valor) +
      "</p>";
  }

  if (
    dado.registro.ausenteNaAtualizacao
  ) {
    html +=
      '<p class="registro-ausente">' +
      "Este registro não apareceu na última atualização da planilha." +
      "</p>";
  }

  return html;
}


function relacoesObjetoHtml(obj) {
  const relacoes =
    Array.isArray(obj.relacoes)
      ? obj.relacoes
      : [];

  if (!relacoes.length) {
    return "";
  }

  let html =
    '<section class="object-popup-section object-popup-relations">' +
      '<div class="object-popup-section-title">' +
        '<span>Dados Vinculados</span>' +
        '<span class="object-popup-count">' +
          relacoes.length +
        "</span>" +
      "</div>" +
      '<div class="object-popup-card-list">';

  for (const relacao of relacoes) {
    html +=
      htmlRelacaoArea(
        relacao
      );
  }

  html += "</div></section>";

  return html;
}

function detalhesObjetoHtml(obj) {
  let html = "";

  if (obj.descricao) {
    html +=
      "<p>" +
      esc(obj.descricao) +
      "</p>";
  }

  if (obj.entityRef) {
    html +=
      '<section class="object-popup-section">' +
        '<div class="object-popup-section-title">' +
          "<span>Dados importados</span>" +
        "</div>" +
        '<div class="object-popup-card-list">' +
          htmlRegistroVinculado(
            obj.entityRef,
            obj.entityFieldColumns,
            null
          ) +
        "</div>" +
      "</section>";
  }

  html +=
    relacoesObjetoHtml(
      obj
    );

  const temLink =
    obj.link &&
    linkSeguro(obj.link);

  if (temLink) {
    html +=
      '<div class="object-popup-actions">' +
        '<a class="object-popup-link-button" href="' +
        esc(obj.link) +
        '" target="_blank" ' +
        'rel="noopener noreferrer">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M14 5h5v5M19 5l-8 8"></path>' +
            '<path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"></path>' +
          "</svg>" +
          "<span>" +
            esc(
              obj.textoLink ||
              "Abrir link"
            ) +
          "</span>" +
        "</a>" +
      "</div>";
  }

  return html;
}


function objetosDentroArea(areaObj) {
  const poligono =
    Array.isArray(areaObj.area)
      ? areaObj.area
      : [];

  if (poligono.length < 3) {
    return [];
  }

  return mapaAtual.objetos.filter(
    obj => {
      if (obj.id === areaObj.id) {
        return false;
      }

      const cat =
        categoriaPorId(
          obj.categoriaId
        );

      if (
        !cat ||
        geometriaEfetiva(cat) !== "unico" ||
        cat.exibirEmAreas === false ||
        !Number.isFinite(obj.x) ||
        !Number.isFinite(obj.y)
      ) {
        return false;
      }

      return pontoDentroPoligono(
        {
          x: obj.x,
          y: obj.y
        },
        poligono
      );
    }
  );
}

function htmlMiniObjeto(obj, cat) {
  return (
    '<details class="regiao-entidade" data-consulta-item="' + esc(obj.id) + '">' +
      "<summary>" +
        '<span class="mini-icone" style="color:' +
        esc(cat.cor) +
        ';">' +
        iconeSvg(cat.icone) +
        "</span>" +
        "<span>" +
        esc(tituloObjeto(obj)) +
        "</span>" +
      "</summary>" +
      '<div class="regiao-detalhes"></div>' +
    "</details>"
  );
}

function htmlRelacaoArea(relacao) {
  const ref =
    relacao?.entityRef;

  const titulo =
    tituloRegistro(ref) ||
    "Registro não encontrado";

  return htmlRegistroVinculado(
    ref,
    relacao?.fields,
    relacao.rotulo || "Vínculo",
    titulo
  );
}

function htmlRegistroVinculado(
  ref,
  campos,
  rotulo,
  tituloForcado = null
) {
  const dado = registroPorRef(ref);
  const titulo =
    tituloForcado ||
    tituloRegistro(ref) ||
    "Registro não encontrado";
  const origem =
    rotulo ||
    dado?.fonte?.nome ||
    "Fonte importada";

  return (
    '<article class="object-popup-data-card">' +
      '<div class="object-popup-data-source" title="' +
        esc(origem) +
      '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M4 7h16M6 3h5l2 2h5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"></path>' +
        "</svg>" +
        "<span>" + esc(origem) + "</span>" +
      "</div>" +
      '<strong class="object-popup-data-title">' +
        esc(titulo) +
      "</strong>" +
      '<div class="object-popup-data-fields">' +
        camposRegistroHtml(ref, campos) +
      "</div>" +
    "</article>"
  );
}

function conteudoAgregadoAreaHtml(areaObj) {
  return '<section class="regiao-conteudo" data-consulta-regiao="' + esc(areaObj.id) + '"></section>';
}

/* =========================================================
   POPUP / TOOLTIP
   ========================================================= */

function popupObjeto(
  obj,
  cat,
  noPainel = false
) {
  let html =
    '<div class="object-popup">' +
      '<header class="object-popup-header">' +
        '<span class="object-popup-eyebrow">Objeto do mapa</span>' +
        "<h3>" +
          esc(tituloObjeto(obj)) +
        "</h3>" +
        '<span class="object-popup-type">' +
          esc(cat.nome) +
        "</span>" +
      "</header>" +
      '<div class="consulta-toolbar">' +
      (noPainel ? "" : '<button type="button" data-consulta-abrir="' + esc(obj.id) + '">Abrir no painel</button>') +
      '<button type="button" data-editar-objeto="' + esc(obj.id) + '">Editar objeto</button></div>' +
      '<div class="object-popup-body">' +

    (
      cat.comportamento === "portal" &&
      obj.portalDestinoNome
        ? '<p class="object-popup-destination"><strong>Destino:</strong> ' +
          esc(obj.portalDestinoNome) +
          (obj.portalDestinoAreaNome ? " → " + esc(obj.portalDestinoAreaNome) : "") +
          "</p>"
        : ""
    ) +

    detalhesObjetoHtml(obj);

  if (
    geometriaEfetiva(cat) ===
    "area"
  ) {
    html +=
      conteudoAgregadoAreaHtml(
        obj
      );
  }

  if (
    cat.comportamento === "portal" &&
    !obj.portalEntradaSomente
  ) {
    html +=
      '<div class="object-popup-actions object-popup-portal-actions">' +
        '<button class="object-popup-link-button object-popup-portal-button" type="button" data-consulta-portal="' + esc(obj.id) + '"' +
        (
          obj.portalDestinoMapaId
            ? ""
            : " disabled"
        ) +
        '>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M5 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5"></path>' +
            '<path d="m13 8 4 4-4 4M17 12H7"></path>' +
          "</svg>" +
          "<span>" +
            (
              obj.portalDestinoMapaId
                ? "Ir para o destino"
                : "Destino não definido"
            ) +
          "</span>" +
        "</button>" +
      "</div>";
  }

  if (cat.comportamento === "portal" && obj.portalEntradaSomente) html += '<p class="object-popup-destination">Somente chegada · sem passagem de retorno.</p>';
  if (cat.comportamentoLinha === "relacao") {
    html += '<p class="object-popup-destination" data-destino-conexao="' + esc(obj.id) + '">Consultando destino…</p><div class="object-popup-actions"><button type="button" class="object-popup-link-button object-popup-portal-button" data-consulta-conexao="' + esc(obj.id) + '">Ir para o destino</button></div>';
  }
  return html + "</div></div>";
}

function opcoesPopupObjeto() {
  const tamanho = atualizarLimitesConsulta();
  return {
    className: "atlas-object-popup",
    // reading.js posiciona sem animação, inclusive após expandir detalhes.
    autoPan: false,
    minWidth: Math.min(300, Math.max(120, tamanho.x - 48)),
    maxWidth: Math.min(390, Math.max(120, tamanho.x - 48)),
    autoPanPadding: L.point(12, 12)
  };
}

function tooltipLinha(
  obj,
  cat,
  nomeTrecho = ""
) {
  return (
    "<strong>" +
    esc(
      String(nomeTrecho).trim() ||
      tituloObjeto(obj)
    ) +
    "</strong><br>" +
    esc(cat.nome)
  );
}

/* =========================================================
   ESTILOS DE LINHA
   ========================================================= */

function larguraTelaCategoria(cat) {
  return medidaMapaParaTela(
    Number(cat.largura) ||
    24
  );
}

function dashArrayLinha(
  cat,
  larguraTela
) {
  const w =
    Math.max(
      1,
      larguraTela
    );

  if (
    cat.estiloLinha ===
    "tracejado"
  ) {
    return (
      (w * 2.4).toFixed(1) +
      " " +
      (w * 1.5).toFixed(1)
    );
  }

  if (
    cat.estiloLinha ===
    "pontilhado"
  ) {
    return (
      Math.max(
        1,
        w * 0.15
      ).toFixed(1) +
      " " +
      (w * 1.25).toFixed(1)
    );
  }

  if (
    cat.estiloLinha ===
    "traco-ponto"
  ) {
    return (
      (w * 2.5).toFixed(1) +
      " " +
      (w * 1.1).toFixed(1) +
      " " +
      Math.max(
        1,
        w * 0.18
      ).toFixed(1) +
      " " +
      (w * 1.1).toFixed(1)
    );
  }

  return null;
}

function opacidadeLinhaBase(cat) {
  return clamp(
    Number(
      cat.opacidade
    ) ||
    0.35,
    0.05,
    1
  );
}

function opacidadeLinhaHover(cat) {
  return clamp(
    opacidadeLinhaBase(
      cat
    ) +
    0.25,
    0.05,
    1
  );
}

/* =========================================================
   RENDER DO MAPA
   ========================================================= */

const temporizadoresCliquePortal =
  new Map();

function limparMapaRenderizado() {
  invalidarCacheRenderizacao();
  for (
    const timer of
    temporizadoresCliquePortal.values()
  ) {
    clearTimeout(timer);
  }
  temporizadoresCliquePortal.clear();

  for (
    const registro of
    layersObjetos.values()
  ) {
    for (
      const layer of
      registro.layers
    ) {
      if (
        mapa.hasLayer(layer)
      ) {
        mapa.removeLayer(layer);
      }
    }
  }

  layersObjetos.clear();

  linhasEscalaveis.length =
    0;

  labelsEscalaveis.length =
    0;

  if (
    imageOverlay &&
    mapa.hasLayer(
      imageOverlay
    )
  ) {
    mapa.removeLayer(
      imageOverlay
    );
  }

  imageOverlay = null;
}

function registrarObjetoLayers(
  obj,
  layers
) {
  layersObjetos.set(
    obj.id,
    {
      objeto: obj,
      layers
    }
  );
}

function cancelarCliquePendenteObjeto(
  obj
) {
  const timer =
    temporizadoresCliquePortal.get(
      obj.id
    );

  if (timer) {
    clearTimeout(timer);
    temporizadoresCliquePortal.delete(
      obj.id
    );
  }
}

function clicarObjeto(
  obj,
  cat,
  evento,
  layer
) {
  if (escolherLocalConexao(obj, evento)) return;
  if (
    ui.modo === "edicao"
  ) {
    L.DomEvent.stopPropagation(
      evento.originalEvent || evento
    );

    if (
      ui.ferramenta ===
      "selecionar"
    ) {
      selecionarObjeto(
        obj.id
      );
    }

    return;
  }

  /*
    Portal: o primeiro clique abre as informações. A travessia fica
    disponível como uma ação explícita dentro do popup.
  */
  if (
    cat.comportamento ===
    "portal"
  ) {
    L.DomEvent.stopPropagation(
      evento.originalEvent || evento
    );

    cancelarCliquePendenteObjeto(
      obj
    );
    layer.openPopup();
    return;
  }

  /*
    Em visualização:
    - Único e Área: clique abre popup.
    - Linha: informação principal é hover.
  */
  if (
    geometriaEfetiva(cat) !== "linha" || tipoMarcacao(cat) === "conexao"
  ) {
    layer.openPopup();
  }
}

function clicarDuasVezesObjeto(
  obj,
  evento
) {
  cancelarCliquePendenteObjeto(
    obj
  );

  L.DomEvent.stopPropagation(
    evento.originalEvent || evento
  );
  evento.originalEvent?.preventDefault();
  mapa.closePopup();

  if (editor.ativo) {
    definirPainelAberto(true);
    avisar("Salve ou cancele a edição atual antes de editar outro objeto.");
    return;
  }

  if (ui.modo !== "edicao") {
    setModo("edicao");
  }

  ui.ferramenta = "selecionar";
  atualizarFerramentas();
  selecionarObjeto(obj.id);
  editarObjetoSelecionado();
  definirPainelAberto(true);
}

function vincularInteracaoObjeto(
  layer,
  obj,
  cat
) {
  prepararAcessibilidadeObjeto(layer, obj);
  layer.on(
    "click",
    e =>
      clicarObjeto(
        obj,
        cat,
        e,
        layer
      )
  );

  layer.on(
    "dblclick",
    e =>
      clicarDuasVezesObjeto(
        obj,
        e
      )
  );
}

function criarIconeLeaflet(cat) {
  return L.divIcon({
    className: "",

    html:
      '<div class="marcador-icone" ' +
      'style="color:' +
      esc(cat.cor) +
      ';">' +
      iconeSvg(
        cat.icone
      ) +
      "</div>",

    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
}

function renderUnico(
  obj,
  cat
) {
  const marker =
    L.marker(
      pixelParaMapa(
        obj.x,
        obj.y
      ),
      {
        icon:
          criarIconeLeaflet(
            cat
          )
      }
    )
      .addTo(mapa)
      .bindPopup(
        popupObjeto(
          obj,
          cat
        ),
        opcoesPopupObjeto()
      );

  if (
    cat.comportamento ===
    "portal"
  ) {
    const mapaOrigemTooltip =
      mapaAtual;

    const origemInicial =
      obj.portalEntradaSomente
        ? obj.portalOrigemMapaNome ||
          "Origem desconhecida"
        : descreverLocalPortal(
            mapaOrigemTooltip,
            obj
          );

    const mapaDestinoInicial =
      obj.portalDestinoNome ||
      "Sem destino";

    const destinoInicial =
      obj.portalEntradaSomente
        ? descreverLocalPortal(
            mapaOrigemTooltip,
            obj
          )
        : obj.portalDestinoAreaNome
          ? `${obj.portalDestinoAreaNome} (${mapaDestinoInicial})`
          : mapaDestinoInicial;

    marker.bindTooltip(
      htmlRotaTooltipPortal(
        obj,
        cat,
        mapaOrigemTooltip,
        origemInicial,
        destinoInicial
      ),
      {
        direction: "top",
        offset: [0, -12],
        className:
          "portal-route-tooltip"
      }
    );

    resolverTooltipPortal(
      obj,
      cat,
      mapaOrigemTooltip
    )
      .then(html => {
        if (marker.getTooltip()) {
          marker.setTooltipContent(html);
        }
      })
      .catch(() => {});

  }

  vincularInteracaoObjeto(
    marker,
    obj,
    cat
  );

  registrarObjetoLayers(
    obj,
    [marker]
  );
}

function renderLinha(
  obj,
  cat
) {
  const pontos =
    pontosLinha(
      obj,
      cat
    );

  const criarTrecho =
    (
      pontosTrecho,
      nomeTrecho = ""
    ) => {
      const posicoes =
        pontosTrecho
          .filter(
            p =>
              Number.isFinite(p.x) &&
              Number.isFinite(p.y)
          )
          .map(
            p =>
              pixelParaMapa(
                p.x,
                p.y
              )
          );

      if (
        posicoes.length < 2
      ) {
        return null;
      }

      const larguraTela =
        larguraTelaCategoria(
          cat
        );

      const layer =
        L.polyline(
          posicoes,
          {
            color:
              cat.cor,

            weight:
              larguraTela,

            opacity:
              opacidadeLinhaBase(
                cat
              ),

            dashArray:
              dashArrayLinha(
                cat,
                larguraTela
              ),

            lineCap:
              cat.extremidade ===
              "reta"
                ? "butt"
                : "round",

            lineJoin:
              "round",

            interactive: true
          }
        )
          .addTo(mapa)
          .bindTooltip(
            tooltipLinha(
              obj,
              cat,
              nomeTrecho
            ),
            {
              sticky: true,
              direction: "top",
              className:
                "linha-tooltip"
            }
          );

      layer.on(
        "mouseover",
        () => {
          layer.setStyle({
            opacity:
              opacidadeLinhaHover(
                cat
              )
          });
        }
      );

      layer.on(
        "mouseout",
        () => {
          layer.setStyle({
            opacity:
              opacidadeLinhaBase(
                cat
              )
          });
        }
      );

      vincularInteracaoObjeto(
        layer,
        obj,
        cat
      );

      if (tipoMarcacao(cat) === "conexao") layer.bindPopup(popupObjeto(obj, cat), opcoesPopupObjeto());

      linhasEscalaveis.push({
        layer,
        cat
      });

      return layer;
    };

  const layers =
    [];

  if (linhaEntreMapas(obj) && pontos.length >= 2) {
    const fim = pontos[pontos.length - 1];
    const passagem = L.marker(pixelParaMapa(fim.x, fim.y), {
      icon: L.divIcon({
        className: "map-passage-marker", html: '<span aria-label="Passagem para outro mapa">↗</span>',
        iconSize: [30, 30], iconAnchor: [15, 15]
      })
    }).addTo(mapa).bindTooltip("Passagem entre mapas · clique para consultar");
    vincularPassagemLinha(passagem, obj, cat);
    layers.push(passagem);
  }

  const principal =
    criarTrecho(
      pontos
    );

  if (principal) {
    layers.push(
      principal
    );
  }

  for (
    const ramo of
    (linhaEntreMapas(obj) && obj.relacaoVersao !== 2 ? [] : obj.ramificacoes || [])
  ) {
    const branch =
      criarTrecho(
        caminhoRamificacao(
          ramo,
          pontos
        ),
        ramo.nome
      );

    if (branch) {
      layers.push(
        branch
      );
    }
  }

  if (layers.length) {
    registrarObjetoLayers(
      obj,
      layers
    );
  }
}

/* =========================================================
   LAYOUT DO INSPECTOR E RÓTULOS
   ========================================================= */

let inspectorTabs = null;
let inspectorPanels = null;
let typeCreationList = null;
let inspectorLayersList = null;
let labelControls = null;
let lineRelationControls = null;
let coordinatesPanel = null;
let coordinatesSummary = null;
let pixelsReference = null;
let measureReference = null;
let measureUnit = null;
let customUnitWrap = null;
let customUnit = null;
let captureCalibrationButton = null;
let calibrationStatus = null;
let removeCalibrationButton = null;

const UNIDADES_MEDIDA = [
  ["m", "Metros (m)"],
  ["km", "Quilômetros (km)"],
  ["cm", "Centímetros (cm)"],
  ["mm", "Milímetros (mm)"],
  ["ft", "Pés (ft)"],
  ["yd", "Jardas (yd)"],
  ["mi", "Milhas (mi)"]
];

const calibrationCaptureState = {
  ativa: false,
  pontos: [],
  grupo: null
};

function criarElementoInterface(tag, classe = "", html = "") {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (html) el.innerHTML = html;
  return el;
}

function formatarNumeroMedida(valor) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      maximumFractionDigits: 4
    }
  ).format(
    Number(valor) || 0
  );
}

function unidadeConhecida(unidade) {
  return UNIDADES_MEDIDA.some(
    ([id]) => id === unidade
  );
}

function atualizarCampoUnidade() {
  if (!customUnitWrap) {
    return;
  }

  customUnitWrap.hidden =
    measureUnit?.value !==
      "personalizada";
}

function limparCapturaCalibracao() {
  mapa
    ?.getContainer?.()
    ?.classList.remove(
      "map-calibrating"
    );

  if (
    calibrationCaptureState.grupo &&
    mapa.hasLayer(
      calibrationCaptureState.grupo
    )
  ) {
    mapa.removeLayer(
      calibrationCaptureState.grupo
    );
  }

  calibrationCaptureState.ativa =
    false;
  calibrationCaptureState.pontos =
    [];
  calibrationCaptureState.grupo =
    null;

  if (captureCalibrationButton) {
    captureCalibrationButton.textContent =
      "↔ Capturar dois pontos";
    captureCalibrationButton.classList.remove(
      "ativo"
    );
  }

  if (calibrationStatus) {
    calibrationStatus.textContent =
      "Você também pode informar os pixels manualmente.";
  }
}

function iniciarCapturaCalibracao() {
  limparCapturaCalibracao();

  calibrationCaptureState.ativa =
    true;
  calibrationCaptureState.grupo =
    L.layerGroup().addTo(mapa);

  mapa
    .getContainer()
    .classList.add(
      "map-calibrating"
    );

  captureCalibrationButton?.classList.add(
    "ativo"
  );

  if (captureCalibrationButton) {
    captureCalibrationButton.textContent =
      "× Cancelar captura";
  }

  if (calibrationStatus) {
    calibrationStatus.textContent =
      "Clique no primeiro ponto de referência do mapa.";
  }

  definirPainelAberto(false);
  status.textContent =
    "Calibração: clique no primeiro ponto de referência.";

  avisar("Clique no primeiro ponto de referência do mapa.");
}

function processarCliqueCalibracao(ponto, latlng) {
  if (!calibrationCaptureState.ativa) {
    return false;
  }

  calibrationCaptureState.pontos.push({
    x: ponto.x,
    y: ponto.y,
    latlng
  });

  L.circleMarker(
    latlng,
    {
      radius: 5,
      color: "#16d7ec",
      weight: 2,
      fillColor: "#0d161b",
      fillOpacity: 1,
      interactive: false
    }
  ).addTo(
    calibrationCaptureState.grupo
  );

  if (
    calibrationCaptureState.pontos.length ===
    1
  ) {
    if (calibrationStatus) {
      calibrationStatus.textContent =
        "Primeiro ponto registrado. Clique no segundo ponto.";
    }

    status.textContent =
      "Calibração: clique no segundo ponto de referência.";

    avisar("Primeiro ponto registrado. Clique no segundo ponto.");

    return true;
  }

  const [inicio, fim] =
    calibrationCaptureState.pontos;

  const distancia =
    Math.hypot(
      fim.x - inicio.x,
      fim.y - inicio.y
    );

  L.polyline(
    [inicio.latlng, fim.latlng],
    {
      color: "#16d7ec",
      weight: 2,
      dashArray: "5 5",
      interactive: false
    }
  ).addTo(
    calibrationCaptureState.grupo
  );

  calibrationCaptureState.ativa =
    false;

  mapa
    .getContainer()
    .classList.remove(
      "map-calibrating"
    );

  if (pixelsReference) {
    pixelsReference.value =
      String(
        Math.round(distancia * 100) /
        100
      );
  }

  if (captureCalibrationButton) {
    captureCalibrationButton.textContent =
      "↻ Capturar novamente";
    captureCalibrationButton.classList.remove(
      "ativo"
    );
  }

  if (calibrationStatus) {
    calibrationStatus.textContent =
      `${formatarNumeroMedida(distancia)} px capturados. Informe a medida real e salve.`;
  }

  status.textContent =
    `${formatarNumeroMedida(distancia)} px capturados para a calibração.`;

  definirPainelAberto(true);

  return true;
}

function renderizarPainelCoordenadas() {
  if (!coordinatesPanel) {
    return;
  }

  const calibracao =
    mapaAtual?.calibracaoMedida;

  if (calibracaoMedidaValida(calibracao)) {
    pixelsReference.value =
      String(calibracao.pixels);
    measureReference.value =
      String(calibracao.valor);

    if (
      unidadeConhecida(
        calibracao.unidade
      )
    ) {
      measureUnit.value =
        calibracao.unidade;
      customUnit.value =
        "";
    } else {
      measureUnit.value =
        "personalizada";
      customUnit.value =
        calibracao.unidade;
    }

    const porPixel =
      medidaPorPixel(calibracao);

    coordinatesSummary.innerHTML =
      `<strong>${formatarNumeroMedida(calibracao.pixels)} px = ${formatarNumeroMedida(calibracao.valor)} ${esc(calibracao.unidade)}</strong>` +
      `<small>1 px = ${formatarNumeroMedida(porPixel)} ${esc(calibracao.unidade)}</small>`;

    removeCalibrationButton.hidden =
      false;
  } else {
    pixelsReference.value =
      "";
    measureReference.value =
      "";
    measureUnit.value =
      "m";
    customUnit.value =
      "";
    coordinatesSummary.innerHTML =
      "<strong>Sem equivalência configurada</strong><small>Os cliques mostram apenas valores em pixels.</small>";
    removeCalibrationButton.hidden =
      true;
  }

  atualizarCampoUnidade();
}

async function salvarCalibracaoMedida() {
  if (!mapaAtual) {
    return;
  }

  const pixels =
    Number(pixelsReference.value);
  const valor =
    Number(measureReference.value);
  const unidade =
    measureUnit.value === "personalizada"
      ? customUnit.value.trim()
      : measureUnit.value;

  if (!(pixels > 0) || !(valor > 0)) {
    avisar("Informe valores maiores que zero para pixels e medida.");
    return;
  }

  if (!unidade) {
    avisar("Informe o nome ou símbolo da unidade personalizada.");
    return;
  }

  mapaAtual.calibracaoMedida = {
    pixels,
    valor,
    unidade
  };

  await dbSalvar(mapaAtual);
  limparCapturaCalibracao();
  renderizarPainelCoordenadas();
  definirPainelAberto(true);
  avisar("Equivalência de medida salva neste mapa.");
}

async function removerCalibracaoMedida() {
  if (!mapaAtual) {
    return;
  }

  delete mapaAtual.calibracaoMedida;
  await dbSalvar(mapaAtual);
  limparCapturaCalibracao();
  renderizarPainelCoordenadas();
  avisar("Equivalência removida.");
}

function criarHtmlCoordenadas(ponto) {
  const calibracao =
    mapaAtual?.calibracaoMedida;

  if (!calibracaoMedidaValida(calibracao)) {
    return (
      "<strong>Coordenadas</strong><br>" +
      `x: ${ponto.x} px<br>` +
      `y: ${ponto.y} px`
    );
  }

  const fator =
    medidaPorPixel(calibracao);
  const unidade =
    esc(calibracao.unidade);

  return (
    '<div class="coordinate-popup">' +
      "<strong>Coordenadas</strong>" +
      `<span>x: ${ponto.x} px · ${formatarNumeroMedida(ponto.x * fator)} ${unidade}</span>` +
      `<span>y: ${ponto.y} px · ${formatarNumeroMedida(ponto.y * fator)} ${unidade}</span>` +
      `<small>${formatarNumeroMedida(calibracao.pixels)} px = ${formatarNumeroMedida(calibracao.valor)} ${unidade}</small>` +
    "</div>"
  );
}

function montarPainelCoordenadas(panel) {
  coordinatesPanel =
    panel;

  panel.innerHTML = `
    <div class="inspector-section-head">
      <div>
        <small>REFERÊNCIA DO MAPA</small>
        <strong>Coordenadas e escala</strong>
      </div>
    </div>

    <p class="texto-ajuda">
      Clique no mapa para consultar X e Y. Configure uma equivalência para exibir pixels em metros ou outra unidade.
    </p>

    <div id="coordinatesSummary" class="coordinate-scale-summary"></div>

    <div class="coordinate-calibration-grid">
      <div class="campo">
        <label for="pixelsReference">Pixels de referência</label>
        <input id="pixelsReference" type="number" min="0.0001" step="any" placeholder="100">
      </div>

      <div class="campo">
        <label for="measureReference">Medida equivalente</label>
        <input id="measureReference" type="number" min="0.0001" step="any" placeholder="10">
      </div>
    </div>

    <div class="campo">
      <label for="measureUnit">Unidade</label>
      <select id="measureUnit">
        ${UNIDADES_MEDIDA.map(([id, nome]) => `<option value="${id}">${nome}</option>`).join("")}
        <option value="personalizada">Outra unidade…</option>
      </select>
    </div>

    <div id="customUnitWrap" class="campo" hidden>
      <label for="customUnit">Nome ou símbolo da unidade</label>
      <input id="customUnit" type="text" maxlength="20" placeholder="blocos, léguas…">
    </div>

    <div class="coordinate-calibration-actions">
      <button id="captureCalibrationButton" class="mini-botao" type="button">↔ Capturar dois pontos</button>
      <button id="saveCalibrationButton" class="mini-botao destaque" type="button">✓ Salvar equivalência</button>
    </div>

    <p id="calibrationStatus" class="texto-ajuda compacto">
      Você também pode informar os pixels manualmente.
    </p>

    <button id="removeCalibrationButton" class="mini-botao coordinate-remove-scale" type="button" hidden>
      Remover equivalência
    </button>
  `;

  coordinatesSummary =
    panel.querySelector("#coordinatesSummary");
  pixelsReference =
    panel.querySelector("#pixelsReference");
  measureReference =
    panel.querySelector("#measureReference");
  measureUnit =
    panel.querySelector("#measureUnit");
  customUnitWrap =
    panel.querySelector("#customUnitWrap");
  customUnit =
    panel.querySelector("#customUnit");
  captureCalibrationButton =
    panel.querySelector("#captureCalibrationButton");
  calibrationStatus =
    panel.querySelector("#calibrationStatus");
  removeCalibrationButton =
    panel.querySelector("#removeCalibrationButton");

  measureUnit.addEventListener(
    "change",
    atualizarCampoUnidade
  );

  captureCalibrationButton.addEventListener(
    "click",
    () => {
      if (calibrationCaptureState.ativa) {
        limparCapturaCalibracao();
      } else {
        iniciarCapturaCalibracao();
      }
    }
  );

  panel
    .querySelector("#saveCalibrationButton")
    .addEventListener(
      "click",
      salvarCalibracaoMedida
    );

  removeCalibrationButton.addEventListener(
    "click",
    removerCalibracaoMedida
  );

  renderizarPainelCoordenadas();
}

function montarLayoutInspector() {
  document.querySelector(
    ".brand-title"
  ).textContent =
    "Atlas Studio";

  const titlebar =
    painel.querySelector(
      ".inspector-titlebar"
    ) ||
    painel.querySelector(
      ".painel-cabecalho"
    );

  const titleWrap =
    criarElementoInterface(
      "div",
      "inspector-title-copy"
    );

  tituloPainel.parentNode.insertBefore(
    titleWrap,
    tituloPainel
  );

  titleWrap.appendChild(
    tituloPainel
  );

  /* Os controles de Visualização e Edição pertencem ao Inspector. */
  const modoSwitchInspector =
    modoVisualizacao
      ?.parentElement;

  if (
    modoSwitchInspector &&
    titlebar &&
    fecharPainel
  ) {
    modoSwitchInspector.classList.add(
      "inspector-mode-switch"
    );

    titlebar.insertBefore(
      modoSwitchInspector,
      fecharPainel
    );
  }

  const sub =
    criarElementoInterface(
      "small",
      "inspector-subtitle",
      "PROPRIEDADES"
    );

  sub.id =
    "inspectorSubtitle";

  titleWrap.appendChild(
    sub
  );

  const tabs =
    criarElementoInterface(
      "nav",
      "inspector-tabs"
    );

  const config = [
    [
      "propriedades",
      "✎",
      "Edição"
    ],
    [
      "camadas",
      "☰",
      "Camadas"
    ],
    [
      "criacao",
      "⊞",
      "Criação"
    ],
    [
      "dados",
      "▤",
      "Dados"
    ]
  ];

  const tabButtons = {};

  for (
    const [
      id,
      icon,
      label
    ] of
    config
  ) {
    const b =
      criarElementoInterface(
        "button",
        "inspector-tab",
        `<span aria-hidden="true">${icon}</span><span class="sr-only">${label}</span>`
      );

    b.type =
      "button";

    b.dataset.tab =
      id;

    const atalhos = {
      propriedades: "Ctrl + E",
      camadas: "Ctrl + Q",
      criacao: "Ctrl + A",
      dados: "Ctrl + D"
    };
    const rotuloComAtalho = atalhos[id]
      ? `${label} (${atalhos[id]})`
      : label;

    b.title = rotuloComAtalho;
    b.setAttribute("aria-label", rotuloComAtalho);

    b.addEventListener(
      "click",
      () =>
        definirAbaInspector(
          id
        )
    );

    tabs.appendChild(
      b
    );

    tabButtons[id] =
      b;
  }

  titlebar.insertAdjacentElement(
    "afterend",
    tabs
  );

  const props =
    criarElementoInterface(
      "section",
      "inspector-tab-panel"
    );

  props.dataset.panel =
    "propriedades";

  const layers =
    criarElementoInterface(
      "section",
      "inspector-tab-panel"
    );

  layers.dataset.panel =
    "camadas";

  layers.hidden =
    true;

  const creation =
    criarElementoInterface(
      "section",
      "inspector-tab-panel"
    );

  creation.dataset.panel =
    "criacao";

  creation.hidden =
    true;

  const data =
    criarElementoInterface(
      "section",
      "inspector-tab-panel"
    );

  data.dataset.panel =
    "dados";

  data.hidden =
    true;

  const coordinates =
    criarElementoInterface(
      "section",
      "inspector-tab-panel"
    );

  coordinates.dataset.panel =
    "coordenadas";

  coordinates.hidden =
    true;

  const scroll =
    criarElementoInterface(
      "div",
      "inspector-scroll"
    );

  painelEdicao.append(
    status,
    scroll
  );

  scroll.append(
    props,
    layers,
    creation,
    data,
    coordinates
  );

  props.append(
    painelInicioEdicao,
    selecaoObjeto,
    editorObjetoWrap
  );

  creation.append(
    modalCategoria
  );

  data.append(
    painelDadosEdicao
  );

  painelDadosEdicao.hidden =
    false;

  importarPlanilha.style.display =
    "";

  montarPainelCoordenadas(
    coordinates
  );


  const actionbar =
    criarElementoInterface(
      "footer",
      "inspector-actionbar"
    );

  const actionLeft =
    criarElementoInterface(
      "div",
      "inspector-action-left"
    );

  const actionRight =
    criarElementoInterface(
      "div",
      "inspector-action-right"
    );

  for (
    const botao of
    [
      apagarRail,
      cancelarRail,
      salvarRail
    ]
  ) {
    botao.classList.add(
      "inspector-action-button"
    );
  }

  apagarRail.classList.add(
    "action-danger"
  );

  salvarRail.classList.add(
    "action-save"
  );

  actionLeft.append(
    apagarRail
  );

  actionRight.append(
    cancelarRail,
    salvarRail
  );

  actionbar.append(
    actionLeft,
    actionRight
  );

  painelEdicao.appendChild(
    actionbar
  );

  if (removerObjeto) {
    removerObjeto.style.display =
      "";
  }

  const icon =
    painelInicioEdicao.querySelector(
      ".empty-editor-icon"
    );

  if (icon) {
    icon.textContent =
      "➤";
  }

  const mt =
    document.getElementById(
      "mensagemInicioTitulo"
    );

  const mx =
    document.getElementById(
      "mensagemInicioTexto"
    );

  if (mt) {
    mt.textContent =
      "Nenhum objeto em edição";
  }

  if (mx) {
    mx.textContent =
      "Clique diretamente em um objeto do mapa. Depois use Editar para alterar seus dados ou geometria.";
  }

  const firstCat =
    document.getElementById(
      "criarPrimeiraCategoria"
    );

  if (firstCat) {
    firstCat.style.display =
      "none";
  }

  layers.innerHTML = `
    <div class="inspector-section-head">
      <div>
        <small>ORGANIZAÇÃO</small>
        <strong>Camadas</strong>
      </div>
    </div>
    <p class="texto-ajuda">
      Oculte categorias temporariamente sem apagar objetos.
    </p>
    <div id="inspectorLayersList" class="inspector-layers-list"></div>
  `;

  inspectorLayersList =
    layers.querySelector(
      "#inspectorLayersList"
    );

  const createHeader =
    criarElementoInterface(
      "div",
      "type-creation-home"
    );

  createHeader.innerHTML = `
    <div class="inspector-section-head">
      <div>
        <small>FERRAMENTAS</small>
        <strong>Criar no mapa</strong>
      </div>

      <button
        id="newTypeAction"
        class="mini-botao"
        type="button"
        hidden
      >
        ＋ Criar tipo
      </button>
    </div>

    <p class="texto-ajuda">
      Selecione um tipo já criado para adicionar um objeto no mapa.
    </p>

    <div
      id="typeCreationEmpty"
      class="types-empty-state"
      hidden
    >
      Nenhum tipo criado ainda.
    </div>

    <div
      id="typeCreationList"
      class="type-creation-list"
    ></div>
  `;

  creation.insertBefore(
    createHeader,
    modalCategoria
  );

  typeCreationList =
    creation.querySelector(
      "#typeCreationList"
    );

  creation
    .querySelector(
      "#newTypeAction"
    )
    .addEventListener(
      "click",
      () =>
        abrirModalCategoria()
    );


  const dataTitle =
    painelDadosEdicao.querySelector(
      ".inline-editor-title"
    );

  if (dataTitle) {
    dataTitle.style.display =
      "none";
  }

  montarControlesRotulo();
  montarControlesRelacaoLinha();

  inspectorTabs =
    tabButtons;

  inspectorPanels = {
    propriedades:
      props,

    camadas:
      layers,

    criacao:
      creation,

    dados:
      data,

    coordenadas:
      coordinates
  };

  definirAbaInspector(
    "propriedades"
  );

  renderizarCriacaoTipos();
  renderizarCamadasInspector();

  setTimeout(
    () =>
      mapa.invalidateSize(),
    0
  );
}

function definirAbaInspector(tab) {
  ui.inspectorTab = tab;
  if (!inspectorPanels) return;
  for (const [id,panelEl] of Object.entries(inspectorPanels)) {
    panelEl.hidden = id !== tab;
    inspectorTabs[id]?.classList.toggle('ativo', id === tab);
  }
  const titles = {
    propriedades:['Edição','PROPRIEDADES'],
    camadas:['Camadas','VISIBILIDADE'],
    criacao:['Criação','FERRAMENTAS'],
    dados:['Dados','FONTES DE DADOS'],
    coordenadas:['Coordenadas','ESCALA E MEDIDA']
  };
  const pair = titles[tab] || titles.propriedades;
  tituloPainel.textContent=pair[0];
  const sub=document.getElementById('inspectorSubtitle'); if(sub) sub.textContent=pair[1];
  if (tab==='camadas') renderizarCamadasInspector();
  if (tab==='criacao') renderizarCriacaoTipos();
  if (tab==='dados') {
    painelDadosEdicao.hidden = false;
    importarPlanilha.style.display = "";
    atualizarFontesDadosUI();
  }
  if (tab==='coordenadas') {
    renderizarPainelCoordenadas();
  }

  atualizarAcoesRail();
}

function renderizarCriacaoTipos() {
  renderBarraCriacaoRapida();

  if (
    !typeCreationList ||
    !mapaAtual
  ) {
    return;
  }

  const cats =
    mapaAtual.categorias ||
    [];

  const empty =
    document.getElementById(
      "typeCreationEmpty"
    );

  empty.hidden =
    cats.length > 0;

  typeCreationList.hidden =
    false;

  typeCreationList.innerHTML =
    "";

  for (const cat of cats) {
    const card =
      criarElementoInterface(
        "div",
        "type-create-card"
      );

    const criar =
      criarElementoInterface(
        "button",
        "type-create-main"
      );

    criar.type =
      "button";

    const visual =
      geometriaEfetiva(cat) ===
        "unico"
        ? iconeSvg(
            cat.icone
          )
        : geometriaEfetiva(cat) ===
          "linha"
          ? "━━"
          : "▣";

    criar.innerHTML =
      `<span class="type-create-icon" style="color:${esc(cat.cor)}">${visual}</span>` +
      `<span class="type-create-copy"><strong>${esc(cat.nome)}</strong><small>${
        cat.comportamento === "portal"
          ? "Conexão · Passagem"
          : geometriaEfetiva(cat) === "unico"
            ? "Ponto"
            : geometriaEfetiva(cat) === "linha"
              ? (
                  cat.comportamentoLinha === "relacao"
                    ? "Conexão · Caminho"
                    : "Linha"
                )
              : "Área"
      }</small></span>`;

    criar.title =
      "Criar objeto deste tipo";

    criar.addEventListener(
      "click",
      () => {
        ui.categoriaSelecionadaId =
          cat.id;

        ui.ferramenta =
          "criar";

        atualizarFerramentas();

        iniciarCriacaoObjeto(
          cat.id
        );
      }
    );

    const editar =
      criarElementoInterface(
        "button",
        "type-edit-action",
        "✎"
      );

    editar.type =
      "button";

    editar.title =
      "Editar tipo";

    editar.addEventListener(
      "click",
      () =>
        abrirModalCategoria(
          cat
        )
    );

    card.append(
      criar,
      editar
    );

    typeCreationList.appendChild(
      card
    );
  }

  const novo =
    criarElementoInterface(
      "button",
      "type-new-action"
    );

  novo.type =
    "button";

  novo.innerHTML =
    '<span>＋</span><strong>Criar novo tipo</strong>';

  novo.addEventListener(
    "click",
    () =>
      abrirModalCategoria()
  );

  typeCreationList.appendChild(
    novo
  );
}

function chaveGrupoCriacaoRapida(
  cat
) {
  if (tipoMarcacao(cat) === "conexao") return "conexao:" + (geometriaEfetiva(cat) === "unico" ? cat.icone || "portal" : "caminho");
  if (
    geometriaEfetiva(cat) ===
    "unico"
  ) {
    return `unico:${
      cat.icone || "pin"
    }`;
  }

  return geometriaEfetiva(cat) ===
    "linha"
    ? "linha"
    : "area";
}

function visualCategoriaRapida(
  cat
) {
  if (
    geometriaEfetiva(cat) ===
    "unico"
  ) {
    return iconeSvg(
      cat.icone
    );
  }

  if (
    geometriaEfetiva(cat) ===
    "linha"
  ) {
    return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 18 9 7l6 7 6-10"></path></svg>';
  }

  return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 5 13 2 2 11-11 2-5-8Z"></path></svg>';
}

function descricaoCategoriaRapida(
  cat
) {
  if (
    cat.comportamento ===
    "portal"
  ) {
    return "Conexão · Passagem";
  }

  if (
    geometriaEfetiva(cat) ===
    "unico"
  ) {
    return "Ponto";
  }

  if (
    geometriaEfetiva(cat) ===
    "linha"
  ) {
    return cat.comportamentoLinha ===
      "relacao"
      ? "Conexão · Caminho"
      : "Linha";
  }

  return "Área";
}

function fecharMenuGrupoCriacaoRapida() {
  if (!menuGrupoCriacaoRapida) {
    return;
  }

  menuGrupoCriacaoRapida.hidden =
    true;

  menuGrupoCriacaoRapida.innerHTML =
    "";

  delete menuGrupoCriacaoRapida
    .dataset.quickGroup;

  for (
    const trigger of
    tiposCriacaoRapida
      ?.querySelectorAll(
        "[data-quick-group]"
      ) || []
  ) {
    trigger.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}

function abrirMenuGrupoCriacaoRapida(
  chave,
  trigger
) {
  if (
    !menuGrupoCriacaoRapida ||
    !barraCriacaoRapida
  ) {
    return;
  }

  if (
    !menuGrupoCriacaoRapida.hidden &&
    menuGrupoCriacaoRapida
      .dataset.quickGroup ===
      chave
  ) {
    fecharMenuGrupoCriacaoRapida();
    return;
  }

  fecharMenuGrupoCriacaoRapida();

  const cats =
    (
      mapaAtual?.categorias ||
      []
    ).filter(
      cat =>
        chaveGrupoCriacaoRapida(
          cat
        ) === chave
    );

  if (cats.length < 2) {
    return;
  }

  const fragmento =
    document.createDocumentFragment();

  for (const cat of cats) {
    const opcao =
      criarElementoInterface(
        "button",
        "quick-create-choice"
      );

    opcao.type =
      "button";

    opcao.dataset.quickCategory =
      cat.id;

    opcao.setAttribute(
      "role",
      "menuitem"
    );

    opcao.classList.toggle(
      "ativo",
      editor.ativo &&
        editor.categoriaId ===
          cat.id &&
        !editor.editandoId
    );

    opcao.innerHTML =
      `<span class="quick-create-choice-icon" style="color:${esc(
        cat.cor || "#D7DDE3"
      )}">${visualCategoriaRapida(
        cat
      )}</span>` +
      `<span class="quick-create-choice-copy"><strong>${esc(
        cat.nome
      )}</strong><small>${esc(
        descricaoCategoriaRapida(
          cat
        )
      )}</small></span>`;

    fragmento.appendChild(
      opcao
    );
  }

  menuGrupoCriacaoRapida.appendChild(
    fragmento
  );

  menuGrupoCriacaoRapida.dataset.quickGroup =
    chave;

  menuGrupoCriacaoRapida.hidden =
    false;

  trigger.setAttribute(
    "aria-expanded",
    "true"
  );

  const barraRect =
    barraCriacaoRapida.getBoundingClientRect();

  const triggerRect =
    trigger.getBoundingClientRect();

  const menuRect =
    menuGrupoCriacaoRapida.getBoundingClientRect();

  const centroDesejado =
    triggerRect.left +
    triggerRect.width / 2 -
    barraRect.left;

  const metadeMenu =
    menuRect.width / 2;

  const centroLimitado =
    clamp(
      centroDesejado,
      Math.min(
        metadeMenu + 6,
        barraRect.width / 2
      ),
      Math.max(
        Math.min(
          metadeMenu + 6,
          barraRect.width / 2
        ),
        barraRect.width -
          metadeMenu -
          6
      )
    );

  menuGrupoCriacaoRapida.style.left =
    `${centroLimitado}px`;
}

function renderBarraCriacaoRapida() {
  if (!tiposCriacaoRapida) {
    return;
  }

  fecharMenuGrupoCriacaoRapida();

  tiposCriacaoRapida.innerHTML = "";

  const cats =
    mapaAtual?.categorias ||
    [];

  if (!cats.length) {
    const vazio =
      criarElementoInterface(
        "span",
        "quick-create-empty",
        "Nenhum tipo criado"
      );

    tiposCriacaoRapida.appendChild(
      vazio
    );

    return;
  }

  const fragmento =
    document.createDocumentFragment();

  const grupos =
    new Map();

  for (const cat of cats) {
    const chave =
      chaveGrupoCriacaoRapida(
        cat
      );

    if (!grupos.has(chave)) {
      grupos.set(
        chave,
        []
      );
    }

    grupos.get(chave).push(
      cat
    );
  }

  for (
    const [
      chave,
      categorias
    ] of grupos
  ) {
    const ativa =
      categorias.find(
        cat =>
          editor.ativo &&
          editor.categoriaId ===
            cat.id &&
          !editor.editandoId
      );

    const cat =
      ativa ||
      categorias[0];

    const botao =
      criarElementoInterface(
        "button",
        "quick-create-type"
      );

    botao.type = "button";

    if (
      categorias.length === 1
    ) {
      botao.dataset.quickCategory =
        cat.id;

      botao.title =
        `Criar ${cat.nome}`;
    } else {
      botao.dataset.quickGroup =
        chave;

      botao.title =
        `Escolher entre ${categorias.length} tipos com este ícone`;

      botao.setAttribute(
        "aria-haspopup",
        "menu"
      );

      botao.setAttribute(
        "aria-expanded",
        "false"
      );
    }

    botao.setAttribute(
      "aria-label",
      botao.title
    );
    botao.style.setProperty(
      "--quick-color",
      cat.cor || "#D7DDE3"
    );
    botao.classList.toggle(
      "ativo",
      Boolean(ativa)
    );

    botao.innerHTML =
      visualCategoriaRapida(
        cat
      );

    if (
      categorias.length > 1
    ) {
      botao.insertAdjacentHTML(
        "beforeend",
        `<span class="quick-create-count" aria-hidden="true">${categorias.length}</span>`
      );
    }

    fragmento.appendChild(
      botao
    );
  }

  tiposCriacaoRapida.appendChild(
    fragmento
  );
}

function definirBarraCriacaoRapidaAberta(aberta) {
  if (!barraCriacaoRapida) {
    return;
  }

  barraCriacaoRapida.hidden =
    !aberta;

  if (aberta) {
    renderBarraCriacaoRapida();
  } else {
    fecharMenuGrupoCriacaoRapida();
  }
}

function renderizarCamadasInspector() {
  renderArvoreCamadas(
    inspectorLayersList
  );
}

function renderLegendaCamadas() {
  renderArvoreCamadas(
    legendaAutomatica
  );
}

function renderArvoreCamadas(container) {
  if (
    !container ||
    !mapaAtual
  ) {
    return;
  }

  container.innerHTML =
    "";

  /*
    Camada existe porque existe objeto.
    Categoria vazia NÃO aparece aqui.
  */
  const grupos =
    (mapaAtual.categorias || [])
      .map(
        cat => ({
          cat,
          objetos:
            mapaAtual.objetos.filter(
              obj =>
                obj.categoriaId ===
                cat.id
            )
        })
      )
      .filter(
        grupo =>
          grupo.objetos.length > 0
      );

  if (!grupos.length) {
    container.innerHTML =
      '<div class="status">Nenhum objeto foi colocado no mapa ainda.</div>';

    return;
  }

  for (const grupo of grupos) {
    const {
      cat,
      objetos
    } =
      grupo;

    const categoriaOculta =
      ui.camadasOcultas.has(
        cat.id
      );

    const ocultosIndividuais =
      objetos.filter(
        obj =>
          ui.objetosOcultos.has(
            obj.id
          )
      ).length;
    const objetosVisiveis =
      categoriaOculta
        ? 0
        : objetos.length -
          ocultosIndividuais;

    const detalhes =
      criarElementoInterface(
        "details",
        "layer-group"
      );

    const chaveCamada =
      `${mapaAtual.id}:${cat.id}`;

    detalhes.open =
      ui.camadasAbertas.has(
        chaveCamada
      );

    detalhes.addEventListener(
      "toggle",
      () => {
        if (!detalhes.isConnected) return;

        if (detalhes.open) {
          ui.camadasAbertas.add(chaveCamada);
        } else {
          ui.camadasAbertas.delete(chaveCamada);
        }
      }
    );

    const resumo =
      criarElementoInterface(
        "summary",
        "layer-group-summary"
      );

    const master =
      document.createElement(
        "input"
      );

    master.type =
      "checkbox";

    master.checked =
      objetosVisiveis > 0;

    master.indeterminate =
      objetosVisiveis > 0 &&
      objetosVisiveis <
        objetos.length;

    master.setAttribute(
      "aria-checked",
      master.indeterminate
        ? "mixed"
        : String(master.checked)
    );

    master.title =
      "Mostrar / ocultar todos";

    master.addEventListener(
      "click",
      e =>
        e.stopPropagation()
    );

    master.addEventListener(
      "change",
      () => {
        if (master.checked) {
          ui.camadasOcultas.delete(
            cat.id
          );

          for (
            const obj of
            objetos
          ) {
            ui.objetosOcultos.delete(
              obj.id
            );
          }
        } else {
          ui.camadasOcultas.add(
            cat.id
          );

          for (
            const obj of
            objetos
          ) {
            ui.objetosOcultos.add(
              obj.id
            );
          }
        }

        aplicarVisibilidadeCamadas();
        renderizarCamadasInspector();
        renderLegendaCamadas();
      }
    );

    const titulo =
      criarElementoInterface(
        "div",
        "layer-title"
      );

    titulo.innerHTML =
      `<strong>${esc(cat.nome)}</strong>` +
      `<small>${objetos.length} objeto(s)</small>`;

    const visualCategoria =
      criarElementoInterface(
        "span",
        "layer-category-visual"
      );

    visualCategoria.style.color =
      cat.cor || "#5b57ff";

    visualCategoria.innerHTML =
      geometriaEfetiva(cat) === "unico"
        ? iconeSvg(cat.icone)
        : geometriaEfetiva(cat) === "linha"
          ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 16c4-8 7 4 16-8"></path></svg>'
          : '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 17 2-10 9-3 3 12-8 4Z"></path></svg>';

    resumo.append(
      visualCategoria,
      titulo,
      master
    );

    const lista =
      criarElementoInterface(
        "div",
        "layer-items"
      );

    for (const obj of objetos) {
      const linha =
        criarElementoInterface(
          "div",
          "layer-item"
        );

      const controleVisibilidade =
        criarElementoInterface(
          "label",
          "layer-visibility"
        );

      const check =
        document.createElement(
          "input"
        );

      check.type =
        "checkbox";

      check.checked =
        !categoriaOculta &&
        !ui.objetosOcultos.has(
          obj.id
        );

      check.addEventListener(
        "change",
        () => {
          /* Alterar um objeto individual mantém sua categoria expandida. */
          ui.camadasOcultas.delete(
            cat.id
          );

          if (check.checked) {
            /* Se a categoria estava totalmente desligada, registra os
               demais objetos como ocultos antes de revelar somente este. */
            if (categoriaOculta) {
              for (
                const outro of
                objetos
              ) {
                if (outro.id !== obj.id) {
                  ui.objetosOcultos.add(
                    outro.id
                  );
                }
              }
            }

            ui.objetosOcultos.delete(
              obj.id
            );
          } else {
            ui.objetosOcultos.add(
              obj.id
            );
          }

          const todosOcultos =
            objetos.every(
              item =>
                ui.objetosOcultos.has(
                  item.id
                )
            );

          if (todosOcultos) {
            ui.camadasOcultas.add(
              cat.id
            );
          } else {
            ui.camadasOcultas.delete(
              cat.id
            );
          }

          aplicarVisibilidadeCamadas();
          renderizarCamadasInspector();
          renderLegendaCamadas();
        }
      );

      const nome =
        document.createElement(
          "span"
        );

      nome.textContent =
        tituloObjeto(
          obj
        ) ||
        "Objeto sem nome";

      controleVisibilidade.append(
        check,
        nome
      );

      const localizar =
        criarElementoInterface(
          "button",
          "layer-focus",
          '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>'
        );

      localizar.type = "button";
      localizar.title = `Localizar ${tituloObjeto(obj) || "objeto"} no mapa`;
      localizar.setAttribute("aria-label", localizar.title);
      localizar.addEventListener("click", () => focarObjetoNoMapa(obj.id));

      linha.append(
        controleVisibilidade,
        localizar
      );

      lista.appendChild(
        linha
      );
    }

    detalhes.append(
      resumo,
      lista
    );

    container.appendChild(
      detalhes
    );
  }
}

function aplicarVisibilidadeCamadas() {
  for (
    const registro of
    layersObjetos.values()
  ) {
    const hidden =
      ui.camadasOcultas.has(
        registro.objeto.categoriaId
      ) ||
      ui.objetosOcultos.has(
        registro.objeto.id
      );

    for (
      const layer of
      registro.layers
    ) {
      if (hidden) {
        if (
          mapa.hasLayer(
            layer
          )
        ) {
          mapa.removeLayer(
            layer
          );
        }
      } else if (
        !mapa.hasLayer(
          layer
        )
      ) {
        layer.addTo(
          mapa
        );
      }
    }
  }
}

function focarObjetoNoMapa(objetoId, opcoes = {}) {
  const obj =
    objetoPorId(objetoId);

  if (!obj) return;

  /* A localização revela temporariamente objetos ocultos. */
  ui.camadasOcultas.delete(obj.categoriaId);
  ui.objetosOcultos.delete(obj.id);
  aplicarVisibilidadeCamadas();

  if (ui.modo === "edicao" && opcoes.selecionar !== false) {
    ui.ferramenta = "selecionar";
    atualizarFerramentas();
    selecionarObjeto(obj.id);
    mostrarEstadoPainel("selecionado");
  }

  let pontos = [];

  if (Number.isFinite(Number(obj.x)) && Number.isFinite(Number(obj.y))) {
    pontos = [{ x: Number(obj.x), y: Number(obj.y) }];
  } else if (Array.isArray(obj.area)) {
    pontos = obj.area;
  } else if (Array.isArray(obj.pontos)) {
    pontos = obj.pontos;
  }

  const latlngs =
    pontos
      .filter(p => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
      .map(p => pixelParaMapa(Number(p.x), Number(p.y)));

  if (latlngs.length === 1) {
    const zoom = Math.max(mapa.getZoom(), 0);
    const tamanho = mapa.getSize();
    const deslocamento = opcoes.areaVisivel
      ? L.point((tamanho.x - opcoes.areaVisivel.x) / 2, (tamanho.y - opcoes.areaVisivel.y) / 2)
      : L.point(0, 0);
    mapa.flyTo(
      mapa.unproject(mapa.project(latlngs[0], zoom).add(deslocamento), zoom),
      zoom,
      { animate: true, duration: .55 }
    );
  } else if (latlngs.length > 1) {
    mapa.flyToBounds(
      L.latLngBounds(latlngs),
      { padding: [70, 70], maxZoom: 2, duration: .55 }
    );
  }

  const registro =
    layersObjetos.get(obj.id);

  for (const layer of registro?.layers || []) {
    const elemento = layer.getElement?.();
    if (!elemento) continue;

    elemento.classList.remove("layer-focus-flash");
    void elemento.getBoundingClientRect();
    elemento.classList.add("layer-focus-flash");

    setTimeout(
      () => elemento.classList.remove("layer-focus-flash"),
      1900
    );
  }

  renderizarCamadasInspector();
  renderLegendaCamadas();
}

function montarControlesRotulo() {
  const form =
    formObjeto;

  const firstDetails =
    form.querySelector(
      ".clean-details"
    );

  if (!firstDetails) {
    return;
  }

  const d =
    criarElementoInterface(
      "details",
      "clean-details label-settings"
    );

  d.id =
    "labelDetails";

  d.open =
    true;

  d.innerHTML = `
    <summary>
      Título no mapa
      <span>Área</span>
    </summary>

    <input
      id="labelVisible"
      type="checkbox"
      checked
      hidden
    >

    <div class="campo">
      <label>Origem do tamanho</label>

      <div class="segmented-control label-size-mode">
        <button
          id="labelSizeType"
          class="ativo"
          type="button"
        >
          Padrão do tipo
        </button>

        <button
          id="labelSizeObject"
          type="button"
        >
          Tamanho próprio
        </button>
      </div>

      <small
        id="labelSizeHelper"
        class="field-helper"
      ></small>
    </div>

    <div id="labelSizeField" class="campo">
      <label for="labelSize">
        Tamanho da fonte
      </label>

      <input
        id="labelSize"
        type="number"
        min="4"
        max="80"
        value="14"
      >
    </div>

    <div class="campo">
      <label for="labelColor">
        Cor do título
      </label>

      <input
        id="labelColor"
        type="text"
        maxlength="7"
        value="#FFFFFF"
      >
    </div>

    <div class="campo">
      <label>Posição</label>

      <div class="segmented-control">
        <button
          id="labelAuto"
          class="ativo"
          type="button"
        >
          Centralizar automaticamente
        </button>

        <button
          id="labelManual"
          type="button"
        >
          Posicionar no mapa
        </button>
      </div>
    </div>

    <small class="field-helper">
      Em “Posicionar no mapa”, o título aparece sobre o mapa e pode ser arrastado
      exatamente como os pontos da Área.
    </small>
  `;

  firstDetails.insertAdjacentElement(
    "afterend",
    d
  );

  labelControls = {
    wrap:
      d,

    visible:
      d.querySelector(
        "#labelVisible"
      ),

    size:
      d.querySelector(
        "#labelSize"
      ),

    sizeField:
      d.querySelector(
        "#labelSizeField"
      ),

    sizeType:
      d.querySelector(
        "#labelSizeType"
      ),

    sizeObject:
      d.querySelector(
        "#labelSizeObject"
      ),

    sizeHelper:
      d.querySelector(
        "#labelSizeHelper"
      ),

    color:
      d.querySelector(
        "#labelColor"
      ),

    auto:
      d.querySelector(
        "#labelAuto"
      ),

    manual:
      d.querySelector(
        "#labelManual"
      ),

    reposition:
      null
  };

  labelControls.sizeType.addEventListener(
    "click",
    () =>
      definirModoTamanhoRotulo(
        "tipo"
      )
  );

  labelControls.sizeObject.addEventListener(
    "click",
    () =>
      definirModoTamanhoRotulo(
        "objeto"
      )
  );

  labelControls.auto.addEventListener(
    "click",
    () =>
      definirModoRotulo(
        "automatico"
      )
  );

  labelControls.manual.addEventListener(
    "click",
    () => {
      definirModoRotulo(
        "manual"
      );

      garantirRotuloManual();

      avisar(
        "Arraste o título diretamente no mapa."
      );
    }
  );

  for (
    const el of
    [
      labelControls.size,
      labelControls.color
    ]
  ) {
    el.addEventListener(
      "input",
      atualizarPreviewRotulo
    );
  }

  nomeObjeto.addEventListener(
    "input",
    () => {
      if (
        editor.ativo &&
        editor.label &&
        modoRotulo() ===
          "manual"
      ) {
        criarHandleLabel();
      }
    }
  );
}

function modoRotulo() {
  return labelControls?.manual.classList.contains(
    "ativo"
  )
    ? "manual"
    : "automatico";
}

function modoTamanhoRotulo() {
  return labelControls
    ?.sizeObject
    ?.classList.contains(
      "ativo"
    )
    ? "objeto"
    : "tipo";
}

function definirModoTamanhoRotulo(
  mode,
  atualizarPreview = true
) {
  if (!labelControls) {
    return;
  }

  const proprio =
    mode ===
    "objeto";

  labelControls.sizeType.classList.toggle(
    "ativo",
    !proprio
  );

  labelControls.sizeObject.classList.toggle(
    "ativo",
    proprio
  );

  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  const tamanhoPadrao =
    clamp(
      Number(
        cat?.tamanhoFonte
      ) || 14,
      4,
      80
    );

  labelControls.size.disabled =
    !proprio;

  if (!proprio) {
    labelControls.size.value =
      String(
        tamanhoPadrao
      );
  }

  labelControls.sizeHelper.textContent =
    proprio
      ? "Este objeto usa um tamanho independente do Tipo."
      : `Seguindo o padrão do Tipo (${tamanhoPadrao}px).`;

  if (atualizarPreview) {
    atualizarPreviewRotulo();
  }
}

function definirModoRotulo(
  mode
) {
  if (!labelControls) {
    return;
  }

  const manual =
    mode ===
    "manual";

  labelControls.manual.classList.toggle(
    "ativo",
    manual
  );

  labelControls.auto.classList.toggle(
    "ativo",
    !manual
  );

  /* Mantém o título visível mesmo quando faltam configurações. */
  labelControls.visible.checked =
    true;

  if (manual) {
    garantirRotuloManual();
  } else {
    atualizarPreviewRotulo();
  }
}

function configuracaoRotulo(
  obj = null,
  cat = null
) {
  const r =
    obj?.rotulo ||
    {};

  const tamanhoPadrao =
    clamp(
      Number(
        cat?.tamanhoFonte
      ) || 14,
      4,
      80
    );

  const tamanhoObjeto =
    Number(
      r.tamanho
    );

  const tamanhoReferencia =
    categoryEditSnapshot?.id ===
      cat?.id
      ? clamp(
          Number(
            categoryEditSnapshot
              .tamanhoFonte
          ) || 14,
          4,
          80
        )
      : tamanhoPadrao;

  const tamanhoPersonalizado =
    r.modoTamanho ===
      "objeto" ||
    (
      r.modoTamanho !==
        "tipo" &&
      r.tamanhoPersonalizado ===
        true
    ) ||
    (
      r.modoTamanho !==
        "tipo" &&
      r.tamanhoPersonalizado !==
        false &&
      Number.isFinite(
        tamanhoObjeto
      ) &&
      tamanhoObjeto !==
        tamanhoReferencia
    );

  return {
    exibir:
      true,

    tamanho:
      tamanhoPersonalizado
        ? clamp(
            tamanhoObjeto,
            4,
            80
          )
        : tamanhoPadrao,

    tamanhoPersonalizado,

    cor:
      /^#[0-9a-f]{6}$/i.test(
        r.cor ||
        ""
      )
        ? r.cor
        : "#FFFFFF",

    modo:
      r.modo ||
      (
        obj?.label
          ? "manual"
          : "automatico"
      )
  };
}

function carregarControlesRotulo(
  obj,
  cat
) {
  if (!labelControls) {
    return;
  }

  const c =
    configuracaoRotulo(
      obj,
      cat
    );

  labelControls.wrap.hidden =
    geometriaEfetiva(cat) !==
    "area";

  labelControls.visible.checked =
    true;

  labelControls.size.value =
    String(
      c.tamanho
    );

  definirModoTamanhoRotulo(
    c.tamanhoPersonalizado
      ? "objeto"
      : "tipo",
    false
  );

  labelControls.color.value =
    c.cor;

  definirModoRotulo(
    c.modo
  );
}

function garantirRotuloManual() {
  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  if (
    !editor.ativo ||
    geometriaEfetiva(cat) !==
      "area" ||
    !editor.pontos.length
  ) {
    return;
  }

  if (!editor.label) {
    const s =
      editor.pontos.reduce(
        (a, p) => ({
          x:
            a.x +
            p.x,

          y:
            a.y +
            p.y
        }),
        {
          x: 0,
          y: 0
        }
      );

    editor.label = {
      x:
        Math.round(
          s.x /
          editor.pontos.length
        ),

      y:
        Math.round(
          s.y /
          editor.pontos.length
        )
    };
  }

  criarHandleLabel();
}

function rotuloObjetoInspector(
  obj,
  cat
) {
  return configuracaoRotulo(
    obj,
    cat
  );
}

function tamanhoRotuloTela(
  obj,
  cat
) {
  const c =
    rotuloObjetoInspector(
      obj,
      cat
    );

  const escalaMapa =
    medidaMapaParaTela(
      1
    );

  /*
    Mantém o título proporcional ao zoom sem achatar todos os
    tamanhos no mesmo mínimo quando o mapa está afastado.
  */
  const escalaLegivel =
    Math.max(
      escalaMapa,
      0.5
    );

  return clamp(
    c.tamanho *
      escalaLegivel,
    6,
    64
  );
}


let mapasRelacaoLinha = [];
let pedidoRelacaoLinha = 0;

function categoriaEmMapa(
  mapaAlvo,
  categoriaId
) {
  return (
    mapaAlvo?.categorias ||
    []
  ).find(
    cat => cat.id === categoriaId
  );
}

function ancoraObjetoRelacao(
  mapaAlvo,
  obj
) {
  const cat =
    categoriaEmMapa(
      mapaAlvo,
      obj?.categoriaId
    );

  if (geometriaEfetiva(cat) === "linha" && cat.comportamentoLinha !== "relacao") {
    return pontoNoCaminho(obj?.pontos);
  }

  if (
    geometriaEfetiva(cat) === "unico" &&
    Number.isFinite(Number(obj?.x)) &&
    Number.isFinite(Number(obj?.y))
  ) {
    return {
      x: Number(obj.x),
      y: Number(obj.y)
    };
  }

  if (
    geometriaEfetiva(cat) !== "area" ||
    !Array.isArray(obj?.area) ||
    obj.area.length < 3
  ) {
    return null;
  }

  const pontos =
    obj.area.filter(
      ponto =>
        Number.isFinite(Number(ponto.x)) &&
        Number.isFinite(Number(ponto.y))
    );

  if (pontos.length < 3) {
    return null;
  }

  return pontoInteriorArea(pontos);
}

function objetosRelacionaveis(
  mapaAlvo
) {
  return (
    mapaAlvo?.objetos ||
    []
  ).filter(
    obj => Boolean(
      ancoraObjetoRelacao(
        mapaAlvo,
        obj
      )
    )
  );
}

function mapaRelacaoLinhaPorId(id) {
  if (
    mapaAtual?.id === id
  ) {
    return mapaAtual;
  }

  return mapasRelacaoLinha.find(
    mapaAlvo => mapaAlvo.id === id
  );
}

function montarControlesRelacaoLinha() {
  const firstDetails =
    formObjeto.querySelector(
      ".clean-details"
    );

  if (!firstDetails) {
    return;
  }

  const d =
    criarElementoInterface(
      "details",
      "clean-details line-relation-fields"
    );

  d.hidden =
    true;

  d.open =
    true;

  d.innerHTML = `
    <summary>
      Conexão
      <span>Caminho visível</span>
    </summary>

    <fieldset class="line-relation-endpoint">
      <legend>Origem</legend>
      <div class="campo">
        <label for="lineRelationOriginMap">Mapa</label>
        <select id="lineRelationOriginMap"></select>
      </div>
      <div class="campo">
        <label for="lineRelationOrigin">Local</label>
        <select id="lineRelationOrigin"></select>
      </div>
    </fieldset>

    <fieldset class="line-relation-endpoint">
      <legend>Destino</legend>
      <div class="campo">
        <label for="lineRelationDestinationMap">Mapa</label>
        <select id="lineRelationDestinationMap"></select>
      </div>
      <div class="campo">
        <label for="lineRelationDestination">Local</label>
        <select id="lineRelationDestination"></select>
      </div>
    </fieldset>

    <small class="field-helper">
      Escolha os locais de origem e destino. Entre mapas, o caminho termina em uma passagem. Pontos intermediários e ramificações continuam editáveis.
    </small>
    <div class="campo">
      <label for="lineRelationNavigation">Navegação</label>
      <select id="lineRelationNavigation">
        <option value="nenhuma">Somente conectar (sem chegada adicional)</option>
        <option value="ida">Somente ida</option>
        <option value="volta">Ida e volta</option>
      </select>
      <small>Ida e volta cria uma passagem de retorno no destino; somente ida cria uma chegada sem retorno.</small>
    </div>
  `;

  firstDetails.insertAdjacentElement(
    "afterend",
    d
  );

  lineRelationControls = {
    wrap:
      d,

    origemMapa:
      d.querySelector(
        "#lineRelationOriginMap"
      ),

    origem:
      d.querySelector(
        "#lineRelationOrigin"
      ),

    destino:
      d.querySelector(
        "#lineRelationDestination"
      ),

    destinoMapa:
      d.querySelector(
        "#lineRelationDestinationMap"
      )
  };

  lineRelationControls.origemMapa.addEventListener(
    "change",
    () => {
      preencherObjetosRelacaoLinha("origem");
      aplicarRelacaoLinha();
    }
  );

  lineRelationControls.destinoMapa.addEventListener(
    "change",
    () => {
      preencherObjetosRelacaoLinha("destino");
      aplicarRelacaoLinha();
    }
  );

  lineRelationControls.origem.addEventListener(
    "change",
    aplicarRelacaoLinha
  );

  lineRelationControls.destino.addEventListener(
    "change",
    aplicarRelacaoLinha
  );
}

function preencherMapasRelacaoLinha(
  chave,
  selecionado = ""
) {
  const select =
    lineRelationControls?.[
      `${chave}Mapa`
    ];

  if (!select) {
    return;
  }

  select.innerHTML = "";

  for (const mapaAlvo of mapasRelacaoLinha) {
    const option = document.createElement("option");
    option.value = mapaAlvo.id;
    option.textContent =
      mapaAlvo.nome +
      (
        mapaAlvo.id === mapaAtual?.id
          ? " (este mapa)"
          : ""
      );
    select.appendChild(option);
  }

  select.value =
    selecionado ||
    mapaAtual?.id ||
    mapasRelacaoLinha[0]?.id ||
    "";
  if (selecionado && !select.value) {
    select.add(new Option("Mapa ausente — escolha outro mapa", selecionado));
    select.value = selecionado;
  }
}

function preencherObjetosRelacaoLinha(chave, selecionado = "", ref = {}) {
  const select = lineRelationControls?.[chave];
  if (!select) return;
  const mapaAlvo = mapaRelacaoLinhaPorId(lineRelationControls[chave + "Mapa"].value);
  configurarSeletorConexao(select, mapaAlvo, selecionado, ref);
}

async function preencherRelacaoLinha(
  obj = null
) {
  if (!lineRelationControls) {
    return;
  }

  const pedido = ++pedidoRelacaoLinha;
  const mapaId = mapaAtual?.id;
  const categoriaId = editor.categoriaId;
  const mapas = await dbTodos();
  if (pedido !== pedidoRelacaoLinha || mapaAtual?.id !== mapaId || editor.categoriaId !== categoriaId) return false;
  mapasRelacaoLinha = mapas;

  const indiceAtual =
    mapasRelacaoLinha.findIndex(
      mapaAlvo => mapaAlvo.id === mapaAtual?.id
    );

  if (mapaAtual) {
    if (indiceAtual >= 0) {
      mapasRelacaoLinha[indiceAtual] = mapaAtual;
    } else {
      mapasRelacaoLinha.unshift(mapaAtual);
    }
  }

  mapasRelacaoLinha.sort(
    (a, b) =>
      String(a.nome).localeCompare(
        String(b.nome),
        "pt-BR"
      )
  );

  preencherMapasRelacaoLinha(
    "origem",
    obj?.relacaoOrigemMapaId || mapaAtual?.id || ""
  );
  preencherMapasRelacaoLinha(
    "destino",
    obj?.relacaoDestinoMapaId || mapaAtual?.id || ""
  );
  preencherObjetosRelacaoLinha(
    "origem",
    obj?.relacaoOrigemId || "",
    { posicao: obj?.relacaoOrigemPosicao, fracao: obj?.relacaoOrigemFracao }
  );
  preencherObjetosRelacaoLinha(
    "destino",
    obj?.relacaoDestinoId || "",
    { posicao: obj?.relacaoDestinoPosicao, fracao: obj?.relacaoDestinoFracao }
  );
  document.getElementById("lineRelationNavigation").value = obj?.conexaoNavegavel ? (obj.portalBidirecional === false ? "ida" : "volta") : "nenhuma";
  return true;
}

function carregarRelacaoLinha(
  obj,
  cat
) {
  if (!lineRelationControls) {
    return;
  }

  const ativa =
    geometriaEfetiva(cat) ===
      "linha" &&
    cat?.comportamentoLinha ===
      "relacao";

  lineRelationControls.wrap.hidden =
    !ativa;

  if (!ativa) {
    return;
  }

  return preencherRelacaoLinha(obj)
    .then(
      carregado => {
        if (carregado && obj) {
          aplicarRelacaoLinha();
        }
      }
    )
    .catch(
      () => avisar(
        "Não foi possível carregar os mapas da relação."
      )
    );
}

function aplicarRelacaoLinha() {
  const cat = categoriaPorId(editor.categoriaId);
  if (!editor.ativo || cat?.comportamentoLinha !== "relacao" || !lineRelationControls) return;
  const a = referenciaDoSeletor(lineRelationControls.origem), b = referenciaDoSeletor(lineRelationControls.destino);
  const mA = mapaRelacaoLinhaPorId(a.mapaId), mB = mapaRelacaoLinhaPorId(b.mapaId);
  let inicio = posicaoReferenciaConexao(mA, a), fim = posicaoReferenciaConexao(mB, b);
  if (!inicio || !fim || (a.mapaId !== mapaAtual.id && b.mapaId !== mapaAtual.id) ||
      a.mapaId === b.mapaId && a.objetoId && a.objetoId === b.objetoId) {
    editor.pontos = [];
    atualizarPreview(); atualizarAcoesRail();
    status.textContent = "Escolha dois locais diferentes, com pelo menos um neste mapa.";
    return;
  }
  const assinatura = JSON.stringify([a.mapaId, a.objetoId, b.mapaId, b.objetoId]);
  if (editor.relacaoAssinatura && editor.relacaoAssinatura !== assinatura) { editor.pontos = []; editor.ramificacoes = []; }
  editor.relacaoAssinatura = assinatura;
  const entreMapas = a.mapaId !== b.mapaId;
  if (entreMapas) {
    const pontos = pontosPassagemLinha({
      relacaoOrigemMapaId: a.mapaId, relacaoOrigemId: a.objetoId, relacaoOrigemPosicao: a.posicao, relacaoOrigemFracao: a.fracao,
      relacaoDestinoMapaId: b.mapaId, relacaoDestinoId: b.objetoId, relacaoDestinoPosicao: b.posicao, relacaoDestinoFracao: b.fracao,
      relacaoVersao: 2, pontos: editor.pontos
    });
    inicio = pontos[0]; fim = pontos[pontos.length - 1];
  }
  if (!inicio || !fim) return;
  if (editor.pontos.length >= 2) { editor.pontos[0] = inicio; editor.pontos[editor.pontos.length-1] = fim; }
  else editor.pontos = [inicio, fim];
  editor.verticeSelecionado = editor.ramoSelecionado = null;
  atualizarPreview(); atualizarAcoesRail();
  status.textContent = entreMapas ? "Arraste a extremidade livre para posicionar a passagem. Consulte e use Ir para o destino para atravessar."
    : "Conexão definida. Use os + nos segmentos para ajustar o trajeto.";
}

function pontosLinha(obj, cat) {
  if (cat?.comportamentoLinha === "relacao" && linhaEntreMapas(obj)) return pontosPassagemLinha(obj);
  const pontos = Array.isArray(obj?.pontos) ? clone(obj.pontos) : [];
  if (cat?.comportamentoLinha !== "relacao") return pontos;
  const refs = referenciasLinha(obj, mapaAtual?.id);
  const inicio = refs[0].mapaId === mapaAtual?.id ? posicaoReferenciaConexao(mapaAtual, refs[0]) : null;
  const fim = refs[1].mapaId === mapaAtual?.id ? posicaoReferenciaConexao(mapaAtual, refs[1]) : null;
  if (pontos.length >= 2) {
    if (inicio) pontos[0] = inicio;
    if (fim) pontos[pontos.length-1] = fim;
    return pontos;
  }
  return inicio && fim ? [inicio, fim] : pontos;
}

function caminhoRamificacao(
  ramo,
  pontosPrincipais
) {
  const origem =
    pontosPrincipais?.[
      ramo.origemIndice
    ];

  if (!origem) {
    return [];
  }

  return [
    clone(origem),
    ...(clone(
      ramo.pontos ||
      []
    ))
  ];
}

function ramificacaoPorId(id) {
  return (
    editor.ramificacoes ||
    []
  ).find(
    r => r.id === id
  );
}

function atualizarUIRamificacoes() {
  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  const linha =
    editor.ativo &&
    geometriaEfetiva(cat) ===
      "linha";

  controlesRamificacao.hidden =
    !linha;

  if (!linha) {
    return;
  }

  criarRamificacao.disabled =
    editor.verticeSelecionado ===
      null ||
    editor.ramoAtivo !==
      null;

  finalizarRamificacao.hidden =
    editor.ramoAtivo ===
      null;

  listaRamificacoes.innerHTML =
    "";

  for (
    let i = 0;
    i < editor.ramificacoes.length;
    i++
  ) {
    const ramo =
      editor.ramificacoes[i];

    const row =
      document.createElement(
        "div"
      );

    row.className =
      "branch-row";

    const detalhes =
      document.createElement(
        "span"
      );

    detalhes.className =
      "branch-details";

    const info =
      document.createElement(
        "span"
      );

    info.textContent =
      "Ramo " +
      (i + 1) +
      " · ponto " +
      (ramo.origemIndice + 1) +
      " · " +
      (ramo.pontos?.length || 0) +
      " ponto(s)";

    const nome =
      document.createElement(
        "input"
      );

    nome.type = "text";
    nome.className =
      "branch-name";
    nome.value =
      ramo.nome || "";
    nome.placeholder =
      "Mesmo nome do caminho principal";
    nome.setAttribute(
      "aria-label",
      "Nome do ramo " +
        (i + 1)
    );

    nome.addEventListener(
      "input",
      () => {
        ramo.nome =
          nome.value;

        atualizarAcoesRail();
      }
    );

    detalhes.append(
      info,
      nome
    );

    const continuar =
      document.createElement(
        "button"
      );

    continuar.type =
      "button";

    continuar.textContent =
      editor.ramoAtivo === ramo.id
        ? "Desenhando…"
        : "Continuar";

    continuar.disabled =
      editor.ramoAtivo !== null;

    continuar.addEventListener(
      "click",
      () => {
        editor.ramoAtivo =
          ramo.id;

        editor.linhaExtremidadeAtiva =
          null;

        editor.ramoSelecionado =
          null;

        status.textContent =
          "Clique no mapa para continuar este ramo.";

        atualizarUIRamificacoes();
      }
    );

    const excluir =
      document.createElement(
        "button"
      );

    excluir.type =
      "button";

    excluir.textContent =
      "×";

    excluir.title =
      "Excluir ramificação";

    excluir.addEventListener(
      "click",
      () => {
        editor.ramificacoes =
          editor.ramificacoes.filter(
            r => r.id !== ramo.id
          );

        if (
          editor.ramoAtivo ===
            ramo.id
        ) {
          editor.ramoAtivo =
            null;
        }

        editor.ramoSelecionado =
          null;

        atualizarPreview();
        atualizarUIRamificacoes();
      }
    );

    row.append(
      detalhes,
      continuar,
      excluir
    );

    listaRamificacoes.appendChild(
      row
    );
  }
}

function iniciarRamificacaoNoVertice(
  origemIndice
) {
  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  if (
    geometriaEfetiva(cat) !== "linha" ||
    !Number.isInteger(
      origemIndice
    ) ||
    !editor.pontos?.[
      origemIndice
    ]
  ) {
    return false;
  }

  if (editor.ramoAtivo !== null) {
    concluirRamificacaoEditor();
  }

  editor.verticeSelecionado =
    origemIndice;

  editor.ramoSelecionado =
    null;

  editor.linhaExtremidadeAtiva =
    null;

  const ramo = {
    id:
      "ramo-" +
      Date.now().toString(36) +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 7),

    origemIndice:
      origemIndice,

    nome: "",

    pontos: []
  };

  editor.ramificacoes.push(
    ramo
  );

  editor.ramoAtivo =
    ramo.id;

  editor.ramoSelecionado =
    null;

  status.textContent =
    "Ramificação iniciada. Clique no mapa para continuar; use o + de outro ponto para trocar a origem ou Esc para finalizar.";

  atualizarUIRamificacoes();
  atualizarPreview();

  atualizarSelecaoVerticeUI();
  atualizarAcoesRail();

  return true;
}

function iniciarRamificacao() {
  iniciarRamificacaoNoVertice(
    editor.verticeSelecionado
  );
}

function concluirRamificacaoEditor() {
  const ramo =
    ramificacaoPorId(
      editor.ramoAtivo
    );

  if (!ramo) {
    editor.ramoAtivo =
      null;

    atualizarUIRamificacoes();
    return;
  }

  if (
    !ramo.pontos?.length
  ) {
    editor.ramificacoes =
      editor.ramificacoes.filter(
        r => r.id !== ramo.id
      );
  }

  editor.ramoAtivo =
    null;

  editor.ramoSelecionado =
    null;

  status.textContent =
    "Ramificação finalizada. Você pode criar outra a partir de qualquer ponto da linha.";

  atualizarPreview();
  atualizarUIRamificacoes();
}

function htmlLabelArea(
  obj,
  cat
) {
  const cfg=rotuloObjetoInspector(obj,cat);
  if(!cfg.exibir)return "";
  return (
    '<div class="regiao-label" style="' +
    "transform:translate(-50%,-50%);" +
    "font-size:" + tamanhoRotuloTela(obj,cat) + "px;" +
    "color:" + cfg.cor + ";" +
    "border-color:" + cat.cor + "88;" +
    '">' + esc(tituloObjeto(obj)) + "</div>"
  );
}

function criarLabelArea(
  obj,
  cat,
  draggable = false
) {
  const cfg=rotuloObjetoInspector(obj,cat);
  let label=obj.label;
  if(cfg.modo!=="manual" || !label){
    const pts=Array.isArray(obj.area)?obj.area:[];
    if(pts.length){const s=pts.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0});label={x:Math.round(s.x/pts.length),y:Math.round(s.y/pts.length)};}
    else label={x:0,y:0};
  }

  const icon =
    L.divIcon({
      className:
        "regiao-label-wrapper",

      html:
        htmlLabelArea(
          obj,
          cat
        ),

      iconSize:
        [1, 1],

      iconAnchor:
        [0, 0]
    });

  return L.marker(
    pixelParaMapa(
      label.x,
      label.y
    ),
    {
      icon,
      draggable,
      interactive: true,
      keyboard: false,
      zIndexOffset:
        draggable
          ? 1600
          : 400
    }
  );
}

function atualizarHtmlLabel(
  registro
) {
  const el =
    registro.marker.getElement();

  if (!el) {
    return;
  }

  const label =
    el.querySelector(
      ".regiao-label"
    );

  if (!label) {
    return;
  }

  const cfg=rotuloObjetoInspector(registro.obj,registro.cat);
  label.style.fontSize=tamanhoRotuloTela(registro.obj,registro.cat)+"px";
  label.style.color=cfg.cor;
  label.style.display=cfg.exibir?"":"none";
}

function opacidadeArea(cat) {
  const valor =
    Number(
      cat?.opacidadeArea
    );

  return Number.isFinite(
    valor
  )
    ? clamp(
        valor,
        0,
        1
      )
    : 0.15;
}

function renderArea(
  obj,
  cat
) {
  const pontos =
    Array.isArray(obj.area)
      ? obj.area
      : [];

  const posicoes =
    pontos
      .filter(
        p =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y)
      )
      .map(
        p =>
          pixelParaMapa(
            p.x,
            p.y
          )
      );

  const label =
    criarLabelArea(
      obj,
      cat
    )
      .addTo(mapa)
      .bindPopup(
        popupObjeto(
          obj,
          cat
        ),
        opcoesPopupObjeto()
      );

  let area = null;

  if (
    posicoes.length >= 3
  ) {
    area =
      L.polygon(
        posicoes,
        {
          color:
            cat.cor,

          weight: 2,

          opacity:
            Math.max(
              0.18,
              opacidadeArea(
                cat
              )
            ),

          fillColor:
            cat.cor,

          fillOpacity:
            opacidadeArea(
              cat
            ),

          interactive: true
        }
      )
        .addTo(mapa)
        .bindPopup(
          popupObjeto(
            obj,
            cat
          ),
          opcoesPopupObjeto()
        );

    area.bringToBack();
  }

  function destaque(ativo) {
    if (area) {
      area.setStyle({
        opacity:
          ativo
            ? Math.min(
                1,
                opacidadeArea(
                  cat
                ) +
                0.45
              )
            : Math.max(
                0.18,
                opacidadeArea(
                  cat
                )
              ),

        fillOpacity:
          ativo
            ? Math.min(
                1,
                opacidadeArea(
                  cat
                ) +
                0.12
              )
            : opacidadeArea(
                cat
              )
      });
    }

    const root =
      label.getElement();

    const texto =
      root
        ? root.querySelector(
            ".regiao-label"
          )
        : null;

    if (texto) {
      texto.classList.toggle(
        "ativa",
        ativo
      );
    }
  }

  label.on(
    "mouseover",
    () => destaque(true)
  );

  label.on(
    "mouseout",
    () => destaque(false)
  );

  vincularInteracaoObjeto(
    label,
    obj,
    cat
  );

  const lista =
    [label];

  if (area) {
    area.on(
      "mouseover",
      () => destaque(true)
    );

    area.on(
      "mouseout",
      () => destaque(false)
    );

    vincularInteracaoObjeto(
      area,
      obj,
      cat
    );

    lista.push(area);
  }

  labelsEscalaveis.push({
    marker: label,
    cat,
    obj
  });

  registrarObjetoLayers(
    obj,
    lista
  );
}

function renderObjeto(obj) {
  const cat =
    categoriaPorId(
      obj.categoriaId
    );

  if (!cat) {
    return;
  }

  if (
    geometriaEfetiva(cat) ===
    "unico"
  ) {
    renderUnico(
      obj,
      cat
    );
  } else if (
    geometriaEfetiva(cat) ===
    "linha"
  ) {
    renderLinha(
      obj,
      cat
    );
  } else if (
    geometriaEfetiva(cat) ===
    "area"
  ) {
    renderArea(
      obj,
      cat
    );
  }
}

function renderMapaCompleto(opcoes = {}) {
  if (!mapaAtual) {
    return;
  }
  if (tentarRenderizacaoIncremental(opcoes)) return;

  /*
    Salvar/editar/remover objetos NÃO deve mexer na câmera.
    Só enquadramos o mapa quando ele ainda não possui câmera salva
    ou quando a chamada pede reset explícito.
  */
  const cameraAntes =
    mapa?._loaded
      ? {
          centro: mapa.getCenter(),
          zoom: mapa.getZoom()
        }
      : null;

  limparMapaRenderizado();

  const limites = [
    [0, 0],
    [
      mapaAtual.altura,
      mapaAtual.largura
    ]
  ];

  /*
    A imagem continua limitada a uma área controlada, mas ganha espaço
    de manobra para que suas bordas possam sair de baixo do Inspector.
  */
  const margemHorizontal =
    mapaAtual.largura * 1.5;
  const margemVertical =
    mapaAtual.altura * 0.85;

  const limitesNavegacao = [
    [
      -margemVertical,
      -margemHorizontal
    ],
    [
      mapaAtual.altura + margemVertical,
      mapaAtual.largura + margemHorizontal
    ]
  ];

  imageOverlay =
    L.imageOverlay(
      mapaAtual.imagem,
      limites
    )
      .addTo(mapa);

  mapa.setMaxBounds(
    limitesNavegacao
  );

  const cameraPersistida =
    cameraSalvaMapa(
      mapaAtual.id
    );

  if (
    opcoes.resetCamera === true
  ) {
    mapa.fitBounds(
      limites,
      {
        animate: false
      }
    );
  } else if (
    cameraAntes &&
    opcoes.preservarCamera !== false
  ) {
    mapa.setView(
      cameraAntes.centro,
      cameraAntes.zoom,
      {
        animate: false
      }
    );
  } else if (
    cameraPersistida
  ) {
    mapa.setView(
      [
        cameraPersistida.lat,
        cameraPersistida.lng
      ],
      cameraPersistida.zoom,
      {
        animate: false
      }
    );
  } else {
    mapa.fitBounds(
      limites,
      {
        animate: false
      }
    );
  }

  for (
    const obj of
    mapaAtual.objetos
  ) {
    renderObjeto(obj);
  }

  registrarRenderizacaoCompleta();
  finalizarRenderizacaoInterface();
}

function atualizarElementosEscalaveis() {
  for (
    const item of
    linhasEscalaveis
  ) {
    const largura =
      larguraTelaCategoria(
        item.cat
      );

    item.layer.setStyle({
      weight:
        largura,

      dashArray:
        dashArrayLinha(
          item.cat,
          largura
        )
    });
  }

  for (
    const item of
    labelsEscalaveis
  ) {
    atualizarHtmlLabel(
      item
    );
  }

  atualizarPreview(
    false
  );
}

mapa.on(
  "zoomend",
  atualizarElementosEscalaveis
);

mapa.on(
  "moveend",
  salvarCameraAtual
);

mapa.on(
  "zoomend",
  salvarCameraAtual
);
