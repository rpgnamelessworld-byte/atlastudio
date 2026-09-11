/*
  Edição e interação.
  Camadas, categorias, objetos, geometrias e comandos do mapa.
*/

/* =========================================================
   LEGENDA AUTOMÁTICA
   ========================================================= */


function categoriaObjetoNoMapa(mapaAlvo, obj) {
  return mapaAlvo?.categorias?.find(
    cat => cat.id === obj?.categoriaId
  ) || null;
}

function areaContendoPontoNoMapa(mapaAlvo, obj) {
  if (
    !mapaAlvo ||
    !Number.isFinite(Number(obj?.x)) ||
    !Number.isFinite(Number(obj?.y))
  ) {
    return null;
  }

  return (mapaAlvo.objetos || []).find(area => {
    const cat =
      categoriaObjetoNoMapa(mapaAlvo, area);

    return (
      geometriaEfetiva(cat) === "area" &&
      Array.isArray(area.area) &&
      area.area.length >= 3 &&
      pontoDentroPoligono(
        { x: Number(obj.x), y: Number(obj.y) },
        area.area
      )
    );
  }) || null;
}

function descreverLocalPortal(
  mapaAlvo,
  obj = null,
  areaId = "",
  areaNome = ""
) {
  const area =
    areaId
      ? (mapaAlvo?.objetos || []).find(item => item.id === areaId)
      : areaContendoPontoNoMapa(mapaAlvo, obj);

  const nomeArea =
    areaNome ||
    (area ? tituloObjetoEmMapa(mapaAlvo, area) : "");

  const nomeMapa =
    mapaAlvo?.nome ||
    "Mapa desconhecido";

  return nomeArea
    ? `${nomeArea} (${nomeMapa})`
    : nomeMapa;
}

function htmlRotaTooltipPortal(
  portal,
  categoria,
  mapaOrigem,
  origemLocal,
  destinoLocal
) {
  const direcao =
    portal.portalBidirecional === false
      ? "Unidirecional"
      : "Bidirecional";

  return (
    '<div class="portal-tooltip-content">' +
      '<div class="portal-tooltip-title">' +
        '<strong>' + esc(tituloObjetoEmMapa(mapaOrigem, portal)) + '</strong>' +
        '<span> · ' + esc(categoria.nome) + ' · ' + direcao + '</span>' +
      '</div>' +
      '<div class="portal-tooltip-rota">' +
        '<span>' + esc(origemLocal) + '</span>' +
        '<b aria-hidden="true">→</b>' +
        '<span>' + esc(destinoLocal) + '</span>' +
      '</div>' +
    '</div>'
  );
}

async function resolverTooltipPortal(
  portal,
  categoria,
  mapaOrigem
) {
  if (portal.portalEntradaSomente) {
    let mapaFonte =
      null;

    if (
      portal.portalOrigemMapaId ===
      mapaOrigem.id
    ) {
      mapaFonte =
        mapaOrigem;
    } else if (
      portal.portalOrigemMapaId
    ) {
      const brutoFonte =
        await dbPegar(
          portal.portalOrigemMapaId
        );

      if (brutoFonte) {
        mapaFonte =
          normalizarEstruturaMapa(brutoFonte);
      }
    }

    mapaFonte =
      mapaFonte ||
      {
        nome:
          portal.portalOrigemMapaNome ||
          "Origem desconhecida",
        objetos: [],
        categorias: []
      };

    const portalFonte =
      (mapaFonte.objetos || []).find(
        obj =>
          obj.id ===
          portal.portalOrigemObjetoId
      );

    return htmlRotaTooltipPortal(
      portal,
      categoria,
      mapaOrigem,
      descreverLocalPortal(
        mapaFonte,
        portalFonte
      ),
      descreverLocalPortal(
        mapaOrigem,
        portal
      )
    );
  }

  const origemLocal =
    descreverLocalPortal(
      mapaOrigem,
      portal
    );

  let mapaDestino =
    null;

  if (
    portal.portalDestinoMapaId ===
    mapaOrigem.id
  ) {
    mapaDestino =
      mapaOrigem;
  } else if (
    portal.portalDestinoMapaId
  ) {
    const bruto =
      await dbPegar(
        portal.portalDestinoMapaId
      );

    if (bruto) {
      mapaDestino =
        normalizarEstruturaMapa(bruto);
    }
  }

  mapaDestino =
    mapaDestino ||
    {
      nome:
        portal.portalDestinoNome ||
        "Sem destino",
      objetos: [],
      categorias: []
    };

  const portalPar =
    (mapaDestino.objetos || []).find(
      obj =>
        obj.id ===
        portal.portalParObjetoId
    );

  const destinoLocal =
    descreverLocalPortal(
      mapaDestino,
      portalPar,
      portal.portalDestinoAreaId || "",
      portal.portalDestinoAreaNome || ""
    );

  return htmlRotaTooltipPortal(
    portal,
    categoria,
    mapaOrigem,
    origemLocal,
    destinoLocal
  );
}

function atualizarLegenda() {
  renderLegendaCamadas();
}

/* =========================================================
   LISTA DE CATEGORIAS
   ========================================================= */

function atualizarCategoriasUI() {
  if (!mapaAtual) {
    return;
  }

  renderizarCriacaoTipos();
}

/* =========================================================
   MODAL DE CATEGORIA
   ========================================================= */

function montarBibliotecaIcones() {
  gradeIcones.innerHTML =
    "";

  for (
    const [
      id,
      nomeIcone,
      conteudo
    ] of
    ICONES
  ) {
    const btn =
      document.createElement(
        "button"
      );

    btn.type =
      "button";

    btn.className =
      "icone-opcao";

    btn.dataset.icone =
      id;

    btn.title =
      nomeIcone;

    btn.innerHTML =
      conteudo;

    btn.addEventListener(
      "click",
      () => {
        ui.iconeCategoria =
          id;

        atualizarSelecaoIcone();
        aplicarPreviewTipo();
      }
    );

    gradeIcones.appendChild(
      btn
    );
  }
}

function atualizarSelecaoIcone() {
  const botoes =
    gradeIcones.querySelectorAll(
      ".icone-opcao"
    );

  for (
    const btn of
    botoes
  ) {
    btn.classList.toggle(
      "ativo",
      btn.dataset.icone ===
        ui.iconeCategoria
    );

    btn.style.color =
      ui.corCategoria;
  }
}

function montarPaletaCores() {
  gradeCores.innerHTML =
    "";

  for (
    const cor of
    CORES_PADRAO
  ) {
    const btn =
      document.createElement(
        "button"
      );

    btn.type =
      "button";

    btn.className =
      "cor-opcao";

    btn.style.setProperty(
      "--cor",
      cor
    );

    btn.dataset.cor =
      cor;

    btn.title =
      cor;

    btn.addEventListener(
      "click",
      () => {
        ui.corCategoria =
          cor;

        corHex.value =
          cor;

        atualizarSelecaoCor();
        atualizarSelecaoIcone();
        aplicarPreviewTipo();
      }
    );

    gradeCores.appendChild(
      btn
    );
  }
}

function atualizarSelecaoCor() {
  const botoes =
    gradeCores.querySelectorAll(
      ".cor-opcao"
    );

  for (
    const btn of
    botoes
  ) {
    btn.classList.toggle(
      "ativo",
      btn.dataset.cor.toUpperCase() ===
        ui.corCategoria.toUpperCase()
    );
  }
}

function atualizarCamposGeometria() {
  const conexao = geometriaCategoria.value === "conexao";
  const representacao = document.getElementById("representacaoConexao");
  const geo = conexao ? (representacao.value === "passagem" ? "unico" : "linha") : geometriaCategoria.value;
  document.getElementById("campoRepresentacaoConexao").hidden = !conexao;
  representacao.disabled = geometriaCategoria.disabled;

  opcoesLinha.hidden =
    geo !==
    "linha";

  opcoesArea.hidden =
    geo !==
    "area";

  campoComportamentoUnico.hidden = true;
  campoComportamentoLinha.hidden = true;

  campoIconeCategoria.hidden =
    geo !==
    "unico";

  campoExibirEmAreasCategoria.hidden =
    geo !==
    "unico";

  if (
    geo !==
    "unico"
  ) {
    comportamentoCategoria.value =
      "";
  }

  if (
    geo !==
    "linha"
  ) {
    comportamentoLinhaCategoria.value =
      "";
  }
}

function aplicarPreviewTipo() {
  if (
    !ui.categoriaEditandoId ||
    !categoryEditSnapshot
  ) {
    return;
  }

  const cat =
    categoriaPorId(
      ui.categoriaEditandoId
    );

  if (!cat) {
    return;
  }

  const cor =
    corHex.value.trim()
      .toUpperCase();

  if (
    /^#[0-9A-F]{6}$/.test(
      cor
    )
  ) {
    cat.cor =
      cor;
  }

  if (
    geometriaEfetiva(cat) ===
      "unico"
  ) {
    cat.icone =
      ui.iconeCategoria;
  }

  if (
    geometriaEfetiva(cat) ===
      "linha"
  ) {
    cat.largura =
      clamp(
        Number(
          larguraLinha.value
        ) ||
        24,
        1,
        200
      );

    cat.estiloLinha =
      estiloLinha.value;

    cat.extremidade =
      extremidadeLinha.value;

    cat.opacidade =
      clamp(
        Number(
          opacidadeLinha.value
        ) /
        100,
        0.05,
        1
      );
  }

  if (
    geometriaEfetiva(cat) ===
      "area"
  ) {
    cat.tamanhoFonte =
      clamp(
        Number(
          tamanhoFonte.value
        ) || 14,
        4,
        80
      );

    cat.opacidadeArea =
      clamp(
        Number(
          areaOpacidade.value
        ) /
        100,
        0,
        1
      );
  }

  renderMapaCompleto();
}

function restaurarPreviewTipo() {
  if (
    !categoryEditSnapshot ||
    !ui.categoriaEditandoId
  ) {
    categoryEditSnapshot =
      null;

    return;
  }

  const indice =
    mapaAtual.categorias.findIndex(
      c =>
        c.id ===
        ui.categoriaEditandoId
    );

  if (
    indice >= 0
  ) {
    mapaAtual.categorias[indice] =
      clone(
        categoryEditSnapshot
      );
  }

  categoryEditSnapshot =
    null;

  renderMapaCompleto();
}

function abrirModalCategoria(
  cat = null,
  origem = "painel"
) {
  cadastroTipoPeloAtalho =
    origem === "atalho";

  categoriaObjetoRetornoId =
    origem === "objeto"
      ? ui.objetoSelecionadoId
      : null;

  categoryEditSnapshot =
    cat
      ? clone(cat)
      : null;

  ui.categoriaEditandoId =
    cat?.id ||
    null;

  tituloModalCategoria.textContent =
    cat
      ? "Editar tipo de marcação"
      : "Criar tipo de marcação";

  nomeCategoria.value =
    cat?.nome ||
    "";

  geometriaCategoria.value =
    tipoMarcacao(cat) ||
    "unico";
  document.getElementById("representacaoConexao").value = geometriaEfetiva(cat) === "unico" ? "passagem" : "caminho";

  const categoriaEmUso =
    Boolean(
      cat &&
      mapaAtual?.objetos?.some(
        obj =>
          obj.categoriaId === cat.id
      )
    );

  geometriaCategoria.disabled =
    categoriaEmUso;

  if (ajudaGeometriaCategoria) {
    ajudaGeometriaCategoria.hidden =
      !categoriaEmUso;
  }

  ui.iconeCategoria =
    cat?.icone ||
    "pin";

  ui.corCategoria =
    cat?.cor ||
    "#D7DDE3";

  corHex.value =
    ui.corCategoria;

  larguraLinha.value =
    String(
      cat?.largura ||
      24
    );

  estiloLinha.value =
    cat?.estiloLinha ||
    "continuo";

  extremidadeLinha.value =
    cat?.extremidade ||
    "arredondada";

  opacidadeLinha.value =
    String(
      Math.round(
        (
          cat?.opacidade ??
          0.35
        ) *
        100
      )
    );

  valorOpacidade.textContent =
    opacidadeLinha.value +
    "%";

  tamanhoFonte.value =
    String(
      cat?.tamanhoFonte ||
      14
    );

  exibirEmAreasCategoria.checked =
    cat?.exibirEmAreas !== false;

  if (comportamentoCategoria) {
    comportamentoCategoria.value =
      cat?.comportamento ||
      "";
  }

  comportamentoLinhaCategoria.value =
    cat?.comportamentoLinha ||
    "";

  areaOpacidade.value =
    String(
      Math.round(
        (
          cat?.opacidadeArea ??
          0.15
        ) *
        100
      )
    );

  valorOpacidadeArea.textContent =
    areaOpacidade.value +
    "%";

  atualizarCamposGeometria();
  atualizarSelecaoCor();
  atualizarSelecaoIcone();

  definirPainelAberto(true);
  mostrarEstadoPainel("categoria");
  iniciarSessaoRascunho("categoria");
}

function fecharModalCategoria(opcoes = {}) {
  if (!opcoes.preservarRascunho) descartarRascunhoAtivo("categoria");
  const voltarParaAtalho =
    cadastroTipoPeloAtalho;

  const objetoRetornoId =
    categoriaObjetoRetornoId;

  cadastroTipoPeloAtalho =
    false;

  categoriaObjetoRetornoId =
    null;

  restaurarPreviewTipo();

  modalCategoria.hidden =
    true;

  geometriaCategoria.disabled =
    false;

  if (ajudaGeometriaCategoria) {
    ajudaGeometriaCategoria.hidden =
      true;
  }

  ui.categoriaEditandoId =
    null;

  if (ui.modo === "edicao") {
    if (objetoRetornoId) {
      const objetoRetorno =
        objetoPorId(
          objetoRetornoId
        );

      if (objetoRetorno) {
        ui.objetoSelecionadoId =
          objetoRetorno.id;

        atualizarSelecaoObjetoUI();
        mostrarEstadoPainel("selecionado");
        definirPainelAberto(true);

        return "objeto";
      }

      ui.objetoSelecionadoId =
        null;

      mostrarEstadoPainel("inicio");
      definirPainelAberto(true);

      return "objeto-removido";
    }

    const creationHome =
      inspectorPanels
        ?.criacao
        ?.querySelector(
          ".type-creation-home"
        );

    if (creationHome) {
      creationHome.hidden =
        false;
    }

    definirAbaInspector("criacao");
    renderizarCriacaoTipos();

    if (voltarParaAtalho) {
      definirPainelAberto(false);
    }
  }

  return voltarParaAtalho
    ? "atalho"
    : "painel";
}

async function excluirCategoriaAtual() {
  const id =
    ui.categoriaEditandoId;

  if (!id) {
    return;
  }

  const cat =
    categoriaPorId(
      id
    );

  if (!cat) {
    return;
  }

  const objetos =
    mapaAtual.objetos.filter(
      obj =>
        obj.categoriaId ===
        id
    );

  const mensagem =
    objetos.length
      ? `Excluir o tipo "${cat.nome}" e também ${objetos.length} objeto(s) que usam esse tipo?`
      : `Excluir o tipo "${cat.nome}"?`;

  if (
    !await confirmarSistema(
      "Excluir tipo",
      mensagem,
      {
        rotuloConfirmar: "Excluir tipo",
        perigo: true
      }
    )
  ) {
    return;
  }

  mapaAtual.objetos =
    mapaAtual.objetos.filter(
      obj =>
        obj.categoriaId !==
        id
    );

  mapaAtual.categorias =
    mapaAtual.categorias.filter(
      c =>
        c.id !==
        id
    );

  categoryEditSnapshot =
    null;

  ui.categoriaEditandoId =
    null;

  await dbSalvar(
    mapaAtual
  );

  fecharModalCategoria();

  atualizarCategoriasUI();
  atualizarLegenda();
  renderMapaCompleto();
  renderizarCriacaoTipos();
  renderizarCamadasInspector();

  avisar(
    "Tipo excluído."
  );
}

async function salvarCategoriaForm() {
  await preservarRascunhoAtual();
  const nome =
    nomeCategoria.value.trim();

  if (!nome) {
    throw new Error(
      "Informe um nome para o tipo."
    );
  }

  const cor =
    corHex.value.trim()
      .toUpperCase();

  if (
    !/^#[0-9A-F]{6}$/.test(
      cor
    )
  ) {
    throw new Error(
      "Use uma cor hexadecimal como #D7DDE3."
    );
  }

  const conexao = geometriaCategoria.value === "conexao";
  const representacao = document.getElementById("representacaoConexao").value;
  const geo = conexao ? (representacao === "passagem" ? "unico" : "linha") : geometriaCategoria.value;

  const mapaAntes = clone(mapaAtual);
  try {
  let cat;

  if (
    ui.categoriaEditandoId
  ) {
    cat =
      categoriaPorId(
        ui.categoriaEditandoId
      );

    if (!cat) {
      throw new Error(
        "Tipo não encontrado."
      );
    }
  } else {
    const usados =
      new Set(
        mapaAtual.categorias.map(
          c => c.id
        )
      );

    cat = {
      id:
        idUnico(
          nome,
          usados
        )
    };

    mapaAtual.categorias.push(
      cat
    );
  }

  cat.nome =
    nome;

  cat.geometria =
    conexao ? "conexao" : geo;
  if (conexao) cat.conexaoRepresentacao = representacao;
  else delete cat.conexaoRepresentacao;

  cat.cor =
    cor;

  cat.exibirEmAreas =
    geo === "unico"
      ? exibirEmAreasCategoria.checked
      : false;

  if (
    geo ===
    "unico"
  ) {
    cat.icone =
      ui.iconeCategoria;

    if (
      conexao
    ) {
      cat.comportamento =
        "portal";
    } else {
      delete cat.comportamento;
    }

    delete cat.comportamentoLinha;
  } else if (
    geo ===
    "linha"
  ) {
    delete cat.icone;
    delete cat.comportamento;

    if (
      conexao
    ) {
      cat.comportamentoLinha =
        "relacao";
    } else {
      delete cat.comportamentoLinha;
    }
  } else {
    delete cat.icone;
    delete cat.comportamento;
    delete cat.comportamentoLinha;
  }

  if (
    geo === "linha"
  ) {
    cat.largura =
      clamp(
        Number(
          larguraLinha.value
        ) ||
        24,
        1,
        200
      );

    cat.estiloLinha =
      estiloLinha.value;

    cat.extremidade =
      extremidadeLinha.value;

    cat.opacidade =
      clamp(
        Number(
          opacidadeLinha.value
        ) /
        100,
        0.05,
        1
      );
  } else {
    delete cat.largura;
    delete cat.estiloLinha;
    delete cat.extremidade;
    delete cat.opacidade;
  }

  if (
    geo ===
    "area"
  ) {
    const tamanhoFonteAnterior =
      clamp(
        Number(
          categoryEditSnapshot
            ?.tamanhoFonte ??
          cat.tamanhoFonte
        ) || 14,
        4,
        80
      );

    cat.tamanhoFonte =
      clamp(
        Number(
          tamanhoFonte.value
        ) || 14,
        4,
        80
      );

    aplicarTamanhoPadraoCategoria(
      mapaAtual,
      cat.id,
      tamanhoFonteAnterior,
      cat.tamanhoFonte
    );

    cat.opacidadeArea =
      clamp(
        Number(
          areaOpacidade.value
        ) /
        100,
        0,
        1
      );
  } else {
    delete cat.tamanhoFonte;
    delete cat.opacidadeArea;
  }

  cat.atualizadoEm =
    Date.now();

  await dbSalvar(
    mapaAtual
  );

  await sincronizarCategoriasCompartilhadas();

  ui.categoriaSelecionadaId =
    cat.id;

  categoryEditSnapshot =
    null;

  const destinoAposSalvar =
    fecharModalCategoria();

  atualizarCategoriasUI();
  atualizarFontesDadosUI();
  atualizarLegenda();
  renderMapaCompleto();
  renderizarCriacaoTipos();
  if (destinoAposSalvar === "objeto") {
    atualizarSelecaoObjetoUI();
    mostrarEstadoPainel("selecionado");
    definirPainelAberto(true);
  } else if (destinoAposSalvar !== "objeto-removido") {
    definirAbaInspector("criacao");
    renderizarCriacaoTipos();
  }

  avisar(
    "Tipo salvo."
  );
  } catch (erro) {
    mapaAtual = mapaAntes;
    mostrarEstadoSalvamento("erro", "O formulário do tipo foi preservado. Tente salvar novamente.");
    throw erro;
  }
}



/* =========================================================
   ESTADOS DO INSPECTOR
   ========================================================= */

function mostrarEstadoPainel(
  estado
) {
  if (
    ui.modo !==
    "edicao"
  ) {
    return;
  }

  const props =
    inspectorPanels
      ?.propriedades;

  const creation =
    inspectorPanels
      ?.criacao;

  const creationHome =
    creation
      ?.querySelector(
        ".type-creation-home"
      );

  if (
    estado ===
    "categoria"
  ) {
    if (creationHome) {
      creationHome.hidden =
        true;
    }

    modalCategoria.hidden =
      false;

    definirAbaInspector(
      "criacao"
    );

    atualizarAcoesRail();

    return;
  }

  if (
    estado ===
    "dados"
  ) {
    definirAbaInspector(
      "dados"
    );

    atualizarAcoesRail();

    return;
  }

  painelInicioEdicao.hidden =
    true;

  selecaoObjeto.hidden =
    true;

  editorObjetoWrap.hidden =
    true;

  if (
    estado ===
    "objeto" &&
    editor.ativo &&
    !editor.editandoId
  ) {
    if (
      creation &&
      editorObjetoWrap.parentElement !==
        creation
    ) {
      creation.appendChild(
        editorObjetoWrap
      );
    }

    if (creationHome) {
      creationHome.hidden =
        true;
    }

    modalCategoria.hidden =
      true;

    editorObjetoWrap.hidden =
      false;

    definirAbaInspector(
      "criacao"
    );

    atualizarAcoesRail();

    return;
  }

  if (
    estado ===
    "objeto"
  ) {
    if (
      props &&
      editorObjetoWrap.parentElement !==
        props
    ) {
      props.appendChild(
        editorObjetoWrap
      );
    }

    editorObjetoWrap.hidden =
      false;

    definirAbaInspector(
      "propriedades"
    );

    atualizarAcoesRail();

    return;
  }

  if (creationHome) {
    creationHome.hidden =
      false;
  }

  if (
    estado ===
    "selecionado"
  ) {
    selecaoObjeto.hidden =
      false;
  } else {
    painelInicioEdicao.hidden =
      false;
  }

  definirAbaInspector(
    "propriedades"
  );

  atualizarAcoesRail();
}

function atualizarAcoesRail() {
  atualizarInteracaoVisivel();
  if (!salvarRail) {
    return;
  }

  const actionbar =
    document.querySelector(
      ".inspector-actionbar"
    );

  const categoriaNaTela =
    !modalCategoria.hidden &&
    ui.inspectorTab ===
      "criacao";

  const objetoNaTela =
    editor.ativo &&
    (
      (
        editor.editandoId &&
        ui.inspectorTab ===
          "propriedades"
      ) ||
      (
        !editor.editandoId &&
        ui.inspectorTab ===
          "criacao"
      )
    );

  if (actionbar) {
    actionbar.hidden =
      !categoriaNaTela &&
      !objetoNaTela;
  }

  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  let geometriaValida =
    false;

  if (
    objetoNaTela &&
    cat
  ) {
    if (
      geometriaEfetiva(cat) ===
      "unico"
    ) {
      geometriaValida =
        editor.pontos.length ===
        1;
    } else if (
      geometriaEfetiva(cat) ===
      "linha"
    ) {
      geometriaValida =
        editor.pontos.length >=
        2;
    } else if (
      geometriaEfetiva(cat) ===
      "area"
    ) {
      geometriaValida =
        editor.pontos.length >=
        3;
    }
  }

  salvarRail.disabled =
    categoriaNaTela
      ? false
      : !geometriaValida;

  cancelarRail.disabled =
    !categoriaNaTela &&
    !objetoNaTela;

  const editandoTipoExistente =
    categoriaNaTela &&
    !!ui.categoriaEditandoId;

  const removendoVertice =
    objetoNaTela &&
    (
      editor.ramoSelecionado !==
        null ||
      (
        editor.verticeSelecionado !==
          null &&
        !verticeLinhaAncorado(
          editor.verticeSelecionado
        )
      )
    );

  apagarRail.disabled =
    !editandoTipoExistente &&
    !removendoVertice;

  const apagarRailLabel =
    editandoTipoExistente
      ? "Excluir tipo"
      : "Excluir ponto";
  apagarRail.title = apagarRailLabel;
  const apagarRailTexto = apagarRail.querySelector(".sr-only");
  if (apagarRailTexto) apagarRailTexto.textContent = apagarRailLabel;

  const salvarRailLabel =
    categoriaNaTela
      ? "Salvar tipo"
      : (
          editor.editandoId
            ? "Salvar alterações"
            : "Salvar"
        );
  salvarRail.title = salvarRailLabel;
  const salvarRailTexto = salvarRail.querySelector(".sr-only");
  if (salvarRailTexto) salvarRailTexto.textContent = salvarRailLabel;

  if (
    contextoGeometria
  ) {
    if (
      objetoNaTela &&
      cat &&
      (
        geometriaEfetiva(cat) ===
          "linha" ||
        geometriaEfetiva(cat) ===
          "area"
      )
    ) {
      contextoGeometria.hidden =
        false;

      contextoGeometriaTexto.textContent =
        cat.nome +
        " • " +
        editor.pontos.length +
        " ponto(s)" +
        (
          editor.verticeSelecionado !==
            null
            ? " • ponto " +
              (
                editor.verticeSelecionado +
                1
              ) +
              " selecionado"
            : ""
        );
    } else {
      contextoGeometria.hidden =
        true;
    }
  }
}

/* =========================================================
   MODO VISUALIZAÇÃO / EDIÇÃO
   ========================================================= */

function setModo(modo) {
  ui.modo =
    modo;

  document.body.classList.toggle(
    "modo-edicao",
    modo === "edicao"
  );

  document.body.classList.toggle(
    "modo-visualizacao",
    modo === "visualizacao"
  );

  modoVisualizacao.classList.toggle(
    "ativo",
    modo === "visualizacao"
  );

  modoEdicao.classList.toggle(
    "ativo",
    modo === "edicao"
  );

  painelVisualizacao.hidden =
    modo !== "visualizacao";

  painelEdicao.hidden =
    modo !== "edicao";

  if (modo === "visualizacao") {
    tituloPainel.textContent="Legenda";
    const sub=document.getElementById("inspectorSubtitle"); if(sub) sub.textContent="CAMADAS DO MAPA";
  } else {
    definirAbaInspector(ui.inspectorTab || "propriedades");
  }

  if (
    modo === "visualizacao"
  ) {
    definirBarraCriacaoRapidaAberta(false);
    limparCapturaCalibracao();
    void preservarRascunhoAtual().catch(() => {});
    cancelarEdicaoObjeto({ preservarRascunho: true });

    ui.ferramenta =
      "selecionar";

    atualizarLegenda();
  } else {
    definirPainelAberto(true);
  }

  atualizarFerramentas();
  renderMapaCompleto();
  renderizarCriacaoTipos();
  atualizarBarraStatus();

  if (modo === "edicao") {
    definirAbaInspector("propriedades");
    mostrarEstadoPainel(ui.objetoSelecionadoId ? "selecionado" : "inicio");
    renderizarCriacaoTipos(); renderizarCamadasInspector();
  }

  setTimeout(() => mapa.invalidateSize(), 340);
}

function atualizarFerramentas() {
  renderizarCriacaoTipos();
  atualizarAcoesRail();
}

function setFerramenta(ferramenta) {
  if (ferramenta !== "coordenada") {
    limparCapturaCalibracao();
  }

  ui.ferramenta =
    ferramenta;

  cancelarEdicaoObjeto();

  atualizarFerramentas();

  if (
    ferramenta ===
    "selecionar"
  ) {
    status.textContent =
      "Clique em um objeto para selecioná-lo.";
  } else if (
    ferramenta ===
    "coordenada"
  ) {
    status.textContent =
      "Clique no mapa para consultar X e Y.";
  } else if (
    ferramenta ===
    "portal"
  ) {
    iniciarCriacaoPortal();
  } else {
    if (
      ui.categoriaSelecionadaId
    ) {
      iniciarCriacaoObjeto(
        ui.categoriaSelecionadaId
      );
    } else {
      status.textContent =
        "Escolha um tipo de marcação e depois clique no mapa.";
    }
  }
}


function iniciarCriacaoPortal() {
  if (!mapaAtual) {
    return;
  }

  const cat =
    garantirCategoriaPortal(
      mapaAtual
    );

  ui.ferramenta =
    "portal";

  ui.categoriaSelecionadaId =
    null;

  atualizarFerramentas();

  iniciarCriacaoObjeto(
    cat.id
  );

  nomeObjeto.value =
    "Passagem";

  status.textContent =
    "Escolha o destino e clique no mapa para posicionar a passagem.";
}

/* =========================================================
   SELEÇÃO DE OBJETO
   ========================================================= */

function selecionarObjeto(id) {
  ui.objetoSelecionadoId =
    id;

  atualizarSelecaoObjetoUI();
  atualizarBarraStatus();

  if (
    ui.modo === "edicao" &&
    ui.ferramenta === "selecionar"
  ) {
    mostrarEstadoPainel(
      "selecionado"
    );
    definirPainelAberto(true);
  }

  atualizarAcoesRail();
}

function atualizarSelecaoObjetoUI() {
  atualizarDestaquesInteracao();
  const obj =
    objetoPorId(
      ui.objetoSelecionadoId
    );

  if (!obj) {
    selecaoObjeto.hidden =
      true;

    if (
      ui.modo === "edicao" &&
      !editor.ativo &&
      modalCategoria.hidden
    ) {
      mostrarEstadoPainel(
        "inicio"
      );
    }

    atualizarAcoesRail();
    return;
  }

  const cat =
    categoriaPorId(
      obj.categoriaId
    );

  selecaoObjeto.hidden =
    false;

  objetoNome.textContent =
    tituloObjeto(obj);

  objetoCategoria.textContent =
    cat?.nome ||
    "Tipo desconhecido";
}

async function removerObjetoSelecionado() {
  const obj =
    objetoPorId(
      ui.objetoSelecionadoId
    );

  if (!obj) {
    return;
  }

  const temParPortal =
    Boolean(
      obj.portalParMapaId &&
      obj.portalParObjetoId
    );

  if (
    !await confirmarSistema(
      "Remover objeto",
      'Remover "' +
      (obj.nome || "Objeto") +
      '"?' +
      (
        temParPortal
          ? "\n\nA passagem ou o caminho conectado no outro mapa também será removido."
          : ""
      ),
      {
        rotuloConfirmar: "Remover objeto",
        perigo: true
      }
    )
  ) {
    return;
  }

  if (temParPortal) {
    await removerPortalReciproco(
      obj
    );
  }

  const categoriaLocalId =
    obj.categoriaId;

  mapaAtual.objetos =
    mapaAtual.objetos.filter(
      o => o.id !== obj.id
    );

  const categoriaLocal =
    mapaAtual.categorias.find(
      c =>
        c.id ===
        categoriaLocalId
    );

  if (
    categoriaLocal?.portalCriadaAutomaticamente &&
    !mapaAtual.objetos.some(
      o =>
        o.categoriaId ===
        categoriaLocalId
    )
  ) {
    mapaAtual.categorias =
      mapaAtual.categorias.filter(
        c =>
          c.id !==
          categoriaLocalId
      );
  }

  ui.objetoSelecionadoId =
    null;

  await dbSalvar(
    mapaAtual
  );

  cancelarEdicaoObjeto();
  renderMapaCompleto();
  atualizarBarraStatus();

  avisar(
    temParPortal
      ? "Conexão e retorno removidos."
      : "Objeto removido."
  );
}

/* =========================================================
   EDITOR DE OBJETO
   ========================================================= */

function limparEditorVisual() {
  ocultarAlcaInsercaoEditor();

  if (
    editor.preview &&
    mapa.hasLayer(
      editor.preview
    )
  ) {
    mapa.removeLayer(
      editor.preview
    );
  }

  editor.preview =
    null;

  for (
    const h of
    editor.handles
  ) {
    if (
      mapa.hasLayer(h)
    ) {
      mapa.removeLayer(h);
    }
  }

  for (
    const h of
    editor.plusHandles
  ) {
    if (
      mapa.hasLayer(h)
    ) {
      mapa.removeLayer(h);
    }
  }

  editor.handles = [];
  editor.plusHandles = [];

  for (
    const h of
    editor.branchHandles ||
    []
  ) {
    if (
      mapa.hasLayer(h)
    ) {
      mapa.removeLayer(h);
    }
  }

  editor.branchHandles = [];

  if (
    editor.labelHandle &&
    mapa.hasLayer(
      editor.labelHandle
    )
  ) {
    mapa.removeLayer(
      editor.labelHandle
    );
  }

  editor.labelHandle =
    null;
}

function resetCamposObjeto() {
  nomeObjeto.value = "";
  descricaoObjeto.value = "";
  linkObjeto.value = "";
  textoLinkObjeto.value =
    "Clique aqui";

  fonteObjeto.value = "";
  registroObjeto.innerHTML =
    '<option value="">Nenhum</option>';
  registroObjeto.disabled = true;

  editor.relacoes = [];
  editor.entityFieldColumns =
    null;

  grupoPortal.hidden = true;
  portalMapaDestino.innerHTML =
    '<option value="">Sem destino por enquanto</option>';

  if (portalDirecao) {
    portalDirecao.value =
      "bidirecional";
  }

  renderRelacoesEditor();
}

function cancelarEdicaoObjeto(opcoes = {}) {
  cancelarSelecaoConexao();
  if (!opcoes.preservarRascunho) descartarRascunhoAtivo();
  else if (sessaoRascunho?.tipo === "objeto") sessaoRascunho = null;
  const eraCriacao =
    editor.ativo &&
    !editor.editandoId;

  const eraEdicao =
    editor.ativo &&
    !!editor.editandoId;

  limparEditorVisual();

  editor.ativo =
    false;

  editor.editandoId =
    null;

  editor.categoriaId =
    null;

  editor.pontos = [];
  editor.label = null;

  editor.aguardandoLabel =
    false;

  editor.verticeSelecionado =
    null;

  editor.ramificacoes = [];
  editor.ramoAtivo = null;
  editor.ramoSelecionado = null;
  editor.linhaExtremidadeAtiva = null;
  editor.historicoRefazer = [];
  editor.relacaoAssinatura = null;

  limparCursorCriacao();

  formObjeto.hidden =
    true;

  controleVertice.hidden =
    true;

  grupoRelacoesArea.hidden =
    true;

  resetCamposObjeto();

  atualizarSelecaoVerticeUI();

  if (
    ui.modo === "edicao"
  ) {
    if (
      eraCriacao &&
      !ui.objetoSelecionadoId
    ) {
      const home =
        inspectorPanels
          ?.criacao
          ?.querySelector(
            ".type-creation-home"
          );

      if (home) {
        home.hidden =
          false;
      }

      definirAbaInspector(
        "criacao"
      );

      renderizarCriacaoTipos();

      if (
        barraCriacaoRapida &&
        !barraCriacaoRapida.hidden
      ) {
        definirPainelAberto(false);
      }
    } else {
      mostrarEstadoPainel(
        ui.objetoSelecionadoId
          ? "selecionado"
          : "inicio"
      );
    }
  }

  if (
    eraEdicao &&
    mapaAtual
  ) {
    renderMapaCompleto();
  }

  atualizarAcoesRail();
}

let cursorCriacaoPreview = null;

function ocultarPreviewCursorCriacao() {
  if (cursorCriacaoPreview) {
    cursorCriacaoPreview.hidden = true;
  }
}

function posicionarPreviewCursorCriacao(evento) {
  const container =
    mapa?.getContainer?.();

  if (
    !container ||
    !cursorCriacaoPreview ||
    !container.classList.contains("creation-cursor-active") ||
    evento.pointerType === "touch" ||
    evento.target instanceof Element &&
      evento.target.closest(
        ".leaflet-control, .leaflet-marker-icon"
      )
  ) {
    ocultarPreviewCursorCriacao();
    return;
  }

  const limites =
    container.getBoundingClientRect();
  const x =
    evento.clientX - limites.left;
  const y =
    evento.clientY - limites.top;

  cursorCriacaoPreview.style.transform =
    `translate3d(${x}px, ${y}px, 0)`;

  cursorCriacaoPreview.classList.toggle(
    "label-left",
    x > limites.width - 235
  );

  cursorCriacaoPreview.classList.toggle(
    "label-top",
    y > limites.height - 70
  );

  cursorCriacaoPreview.hidden = false;
}

function vincularEventosCursorCriacao(container) {
  if (
    container.dataset.atlasCreationCursor ===
    "true"
  ) {
    return;
  }

  container.dataset.atlasCreationCursor =
    "true";

  container.addEventListener(
    "pointermove",
    posicionarPreviewCursorCriacao
  );

  container.addEventListener(
    "pointerleave",
    ocultarPreviewCursorCriacao
  );
}

function garantirPreviewCursorCriacao(container) {
  if (
    cursorCriacaoPreview?.isConnected
  ) {
    return cursorCriacaoPreview;
  }

  cursorCriacaoPreview =
    document.createElement("div");

  cursorCriacaoPreview.className =
    "map-creation-cursor";

  cursorCriacaoPreview.setAttribute(
    "aria-hidden",
    "true"
  );

  cursorCriacaoPreview.hidden = true;
  container.appendChild(cursorCriacaoPreview);

  return cursorCriacaoPreview;
}

function atualizarCursorCriacao() {
  const container =
    mapa?.getContainer?.();

  if (!container) {
    return;
  }

  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  const linhaPorRelacao =
    geometriaEfetiva(cat) === "linha" &&
    cat?.comportamentoLinha ===
      "relacao";

  const criando =
    editor.ativo &&
    !editor.editandoId &&
    Boolean(cat) &&
    !linhaPorRelacao &&
    (
      geometriaEfetiva(cat) !== "unico" ||
      editor.pontos.length === 0
    );

  container.classList.toggle(
    "awaiting-map-position",
    criando &&
      geometriaEfetiva(cat) === "unico"
  );

  container.classList.toggle(
    "creation-cursor-active",
    criando
  );

  container.classList.remove(
    "creation-cursor-point",
    "creation-cursor-path"
  );

  if (!criando) {
    ocultarPreviewCursorCriacao();
    return;
  }

  container.classList.add(
    geometriaEfetiva(cat) === "unico"
      ? "creation-cursor-point"
      : "creation-cursor-path"
  );

  vincularEventosCursorCriacao(
    container
  );

  const preview =
    garantirPreviewCursorCriacao(
      container
    );

  const cor =
    /^#[0-9a-f]{6}$/i.test(cat.cor)
      ? cat.cor
      : "#7772ff";

  preview.style.setProperty(
    "--creation-cursor-color",
    cor
  );

  preview.dataset.geometry =
    geometriaEfetiva(cat);

  if (
    geometriaEfetiva(cat) === "unico"
  ) {
    preview.innerHTML =
      '<span class="creation-cursor-marker">' +
        iconeSvg(cat.icone) +
      "</span>" +
      '<span class="creation-cursor-label">' +
        esc(cat.nome || "Novo objeto") +
        " · clique para posicionar" +
      "</span>";
  } else {
    const ramoAtivo =
      ramificacaoPorId(
        editor.ramoAtivo
      );
    const continuandoInicio =
      geometriaEfetiva(cat) === "linha" &&
      editor.linhaExtremidadeAtiva ===
        "inicio";
    const proximoVertice =
      ramoAtivo
        ? (ramoAtivo.pontos?.length || 0) + 1
        : editor.pontos.length + 1;
    const acao =
      geometriaEfetiva(cat) === "area"
        ? "Adicionar vértice da área"
        : ramoAtivo
          ? "Adicionar ponto à ramificação"
          : continuandoInicio
            ? "Continuar linha pelo início"
            : "Adicionar ponto da linha";

    preview.innerHTML =
      '<span class="creation-cursor-target">' +
        '<svg viewBox="0 0 36 36">' +
          '<circle cx="18" cy="18" r="10"></circle>' +
          '<path d="M18 2v7M18 27v7M2 18h7M27 18h7"></path>' +
        "</svg>" +
        '<b>' + proximoVertice + "</b>" +
      "</span>" +
      '<span class="creation-cursor-label">' +
        acao +
      "</span>";
  }
}

function limparCursorCriacao() {
  mapa?.getContainer?.()
    ?.classList.remove(
      "awaiting-map-position",
      "creation-cursor-active",
      "creation-cursor-point",
      "creation-cursor-path"
    );

  cursorCriacaoPreview?.remove();
  cursorCriacaoPreview = null;
}

function iniciarCriacaoObjeto(
  categoriaId
) {
  const cat =
    categoriaPorId(
      categoriaId
    );

  if (!cat) {
    return;
  }

  limparEditorVisual();

  ui.objetoSelecionadoId =
    null;

  atualizarSelecaoObjetoUI();

  editor.ativo = true;
  iniciarSessaoRascunho();
  editor.relacaoAssinatura = null;
  editor.editandoId = null;
  editor.categoriaId = cat.id;
  editor.pontos = [];
  editor.label = null;
  editor.relacoes = [];
  editor.ramificacoes = [];
  editor.ramoAtivo = null;
  editor.ramoSelecionado = null;
  editor.linhaExtremidadeAtiva = null;
  editor.historicoRefazer = [];
  editor.aguardandoLabel = false;
  editor.verticeSelecionado = null;

  resetCamposObjeto();
  editor.entityFieldColumns =
    null;
  carregarControlesRotulo(null,cat);
  editor.carregamento = carregarRelacaoLinha(null, cat);

  atualizarFontesObjeto();
  atualizarFontesRelacao();

  formObjeto.hidden = false;
  editorObjetoWrap.hidden = false;

  modoObjetoLabel.textContent =
    "Criação";

  tituloFormularioObjeto.textContent =
    "Novo " +
    cat.nome;

  controleVertice.hidden =
    geometriaEfetiva(cat) === "unico";

  /* Vínculos de dados podem ser usados por qualquer objeto. */
  grupoRelacoesArea.hidden =
    false;

  grupoPortal.hidden =
    cat.comportamento !== "portal";

  mostrarEstadoPainel(
    "objeto"
  );

  if (
    cat.comportamento ===
    "portal"
  ) {
    editor.carregamento = atualizarDestinosPortal();
  }

  status.textContent =
    cat.comportamento === "portal"
      ? "Destino opcional. Mova a passagem com o ponteiro, clique para posicionar e depois use Salvar."
      : geometriaEfetiva(cat) === "unico"
        ? "O marcador acompanha o ponteiro. Clique no mapa para posicioná-lo."
        : geometriaEfetiva(cat) === "linha"
          ? (
              cat.comportamentoLinha === "relacao"
                ? "Selecione Local A e Local B no Inspector para criar a relação."
                : "Use a mira para adicionar os pontos que desenham a linha."
            )
          : "Use a mira para adicionar os vértices ao redor da área.";

  atualizarPreview();
  atualizarCursorCriacao();
  atualizarUIRamificacoes();
}

function editarObjetoSelecionado() {
  const obj =
    objetoPorId(
      ui.objetoSelecionadoId
    );

  if (!obj) {
    return;
  }

  const cat =
    categoriaPorId(
      obj.categoriaId
    );

  if (!cat) {
    return;
  }

  limparEditorVisual();
  limparCursorCriacao();

  const registroOriginal =
    layersObjetos.get(
      obj.id
    );

  if (registroOriginal) {
    for (
      const layer of
      registroOriginal.layers
    ) {
      if (
        mapa.hasLayer(layer)
      ) {
        mapa.removeLayer(layer);
      }
    }
  }

  editor.ativo = true;
  iniciarSessaoRascunho();
  editor.relacaoAssinatura = null;
  editor.editandoId = obj.id;
  editor.categoriaId = cat.id;
  editor.verticeSelecionado = null;
  editor.aguardandoLabel = false;
  editor.relacoes =
    clone(
      obj.relacoes ||
      []
    );

  editor.ramificacoes =
    clone(
      obj.ramificacoes ||
      []
    );
  if (linhaEntreMapas(obj) && obj.relacaoVersao !== 2) editor.ramificacoes = [];

  editor.ramoAtivo =
    null;

  editor.ramoSelecionado =
    null;

  editor.linhaExtremidadeAtiva =
    null;

  editor.historicoRefazer = [];

  nomeObjeto.value =
    obj.nome ||
    tituloObjeto(obj) ||
    "";

  descricaoObjeto.value =
    obj.descricao ||
    "";

  linkObjeto.value =
    obj.link ||
    "";

  textoLinkObjeto.value =
    obj.textoLink ||
    "Clique aqui";

  carregarControlesRotulo(obj,cat);

  editor.entityFieldColumns =
    Array.isArray(
      obj.entityFieldColumns
    )
      ? clone(
          obj.entityFieldColumns
        )
      : null;

  atualizarFontesObjeto(
    obj.entityRef ||
    null,
    editor.entityFieldColumns
  );

  atualizarFontesRelacao();
  renderRelacoesEditor();

  if (geometriaEfetiva(cat) === "unico") {
    editor.pontos = [
      {
        x: obj.x,
        y: obj.y
      }
    ];
    editor.label = null;
  } else if (geometriaEfetiva(cat) === "linha") {
    editor.pontos =
      pontosLinha(
        obj,
        cat
      );
    editor.label = null;
  } else {
    editor.pontos =
      clone(
        obj.area ||
        []
      );

    editor.label =
      clone(
        obj.label ||
        {
          x: 0,
          y: 0
        }
      );
  }

  editor.carregamento = carregarRelacaoLinha(
    obj,
    cat
  );

  formObjeto.hidden = false;
  editorObjetoWrap.hidden = false;

  modoObjetoLabel.textContent =
    "Edição";

  tituloFormularioObjeto.textContent =
    tituloObjeto(obj) ||
    cat.nome;

  controleVertice.hidden =
    geometriaEfetiva(cat) === "unico";

  grupoRelacoesArea.hidden =
    false;

  grupoPortal.hidden =
    cat.comportamento !== "portal";

  mostrarEstadoPainel(
    "objeto"
  );

  if (
    cat.comportamento ===
    "portal"
  ) {
    if (portalDirecao) {
      portalDirecao.value =
        obj.portalBidirecional === false
          ? "unidirecional"
          : "bidirecional";
    }

    const mapaPortalEdicao =
      obj.portalDestinoMapaId ||
      (
        obj.portalEntradaSomente
          ? obj.portalOrigemMapaId
          : ""
      ) ||
      "";

    editor.carregamento = atualizarDestinosPortal(
      mapaPortalEdicao
    )
      .then(
        () =>
          atualizarAreasDestinoPortal(
            mapaPortalEdicao,
            obj.portalDestinoObjetoId || obj.portalDestinoAreaId || "",
            { posicao: obj.portalDestinoPosicao, fracao: obj.portalDestinoFracao }
          )
      );
  }

  status.textContent =
    geometriaEfetiva(cat) === "unico"
      ? "Arraste o marcador para reposicioná-lo ou altere o registro vinculado."
      : "Arraste, remova ou insira pontos diretamente.";

  atualizarPreview();
  atualizarUIRamificacoes();

  if (geometriaEfetiva(cat) === "area" && modoRotulo()==="manual") {
    garantirRotuloManual();
  }
}

function selecionarVertice(indice) {
  editor.ramoSelecionado =
    null;

  editor.verticeSelecionado =
    indice;

  atualizarSelecaoVerticeUI();

  redesenharHandles();
  atualizarAcoesRail();
}

function atualizarSelecaoVerticeUI() {
  if (
    editor.ramoSelecionado
  ) {
    const ramo =
      ramificacaoPorId(
        editor.ramoSelecionado.ramoId
      );

    const ramoIndex =
      editor.ramificacoes.findIndex(
        r => r.id ===
          editor.ramoSelecionado.ramoId
      );

    if (ramo) {
      verticeSelecionado.textContent =
        "Ramo " +
        (ramoIndex + 1) +
        " · ponto " +
        (editor.ramoSelecionado.indice + 1) +
        " selecionado";

      removerVertice.disabled =
        false;

      return;
    }
  }

  const indice =
    editor.verticeSelecionado;

  if (
    indice === null ||
    indice === undefined
  ) {
    verticeSelecionado.textContent =
      "Nenhum ponto selecionado";

    removerVertice.disabled =
      true;

    atualizarUIRamificacoes();
    return;
  }

  verticeSelecionado.textContent =
    "Ponto " +
    (indice + 1) +
    (
      verticeLinhaAncorado(
        indice
      )
        ? " · ligado ao local"
        : ""
    ) +
    " selecionado";

  removerVertice.disabled =
    verticeLinhaAncorado(
      indice
    );

  atualizarUIRamificacoes();
}

function verticeLinhaAncorado(
  indice
) {
  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  return (
    geometriaEfetiva(cat) === "linha" &&
    cat?.comportamentoLinha === "relacao" &&
    (
      indice === 0 ||
      (indice === editor.pontos.length - 1 &&
        lineRelationControls?.origemMapa.value === lineRelationControls?.destinoMapa.value)
    )
  );
}

function criarHandleVertice(
  ponto,
  indice
) {
  const categoria =
    categoriaPorId(
      editor.categoriaId
    );
  const objetoPontual =
    geometriaEfetiva(categoria) ===
    "unico";
  const objetoLinha =
    geometriaEfetiva(categoria) ===
    "linha";
  const permiteContinuarLinha =
    objetoLinha &&
    categoria?.comportamentoLinha !==
      "relacao" &&
    editor.pontos.length >= 2 &&
    (
      indice === 0 ||
      indice ===
        editor.pontos.length - 1
    );
  const selecionado =
    editor.verticeSelecionado ===
    indice;

  const ancorado =
    verticeLinhaAncorado(
      indice
    );

  const icon =
    L.divIcon({
      className: "",

      html:
        '<div class="editor-vertex-wrap">' +
        '<div class="editor-ponto' +
        (
          selecionado
            ? " selecionado"
            : ""
        ) +
        (
          ancorado
            ? " ancorado"
            : ""
        ) +
        (
          objetoPontual
            ? " objeto-em-edicao"
            : ""
        ) +
        '"' + (objetoPontual ? ' style="--creation-cursor-color:' + esc(categoria.cor) + '" data-estado="' + (editor.editandoId ? 'edicao' : 'criacao') + '"' : '') + '>' +
        (
          objetoPontual
            ? iconeSvg(categoria.icone)
            : indice + 1
        ) +
        "</div>" +
        (
          objetoLinha
            ? '<button class="editor-branch-shortcut" type="button"' +
              ' title="Criar ramificação a partir deste ponto"' +
              ' aria-label="Criar ramificação a partir do ponto ' +
              (indice + 1) +
              '">+</button>'
            : ""
        ) +
        (
          permiteContinuarLinha
            ? '<button class="editor-line-continue-shortcut" type="button"' +
              ' title="Continuar a linha principal por este extremo"' +
              ' aria-label="Continuar a linha principal pelo ponto ' +
              (indice + 1) +
              '">' +
              (indice === 0 ? "←" : "→") +
              "</button>"
            : ""
        ) +
        "</div>",

      iconSize:
        objetoPontual ? [44, 44] : [20, 20],

      iconAnchor:
        objetoPontual ? [22, 22] : [10, 10]
    });

  const marker =
    L.marker(
      pixelParaMapa(
        ponto.x,
        ponto.y
      ),
      {
        icon,
        draggable:
          !ancorado,
        interactive: true,
        keyboard: false,
        zIndexOffset: 1400
      }
    );

  prepararTecladoHandle(marker, indice, ancorado, objetoPontual);

  marker.on(
    "click",
    e => {
      L.DomEvent.stopPropagation(
        e
      );

      if (
        editor.ramoAtivo !== null
      ) {
        concluirRamificacaoEditor();
      }

      editor.ramoSelecionado =
        null;

      editor.linhaExtremidadeAtiva =
        null;

      selecionarVertice(
        indice
      );

      atualizarUIRamificacoes();
    }
  );

  if (objetoLinha) {
    marker.on(
      "add",
      () => {
        const atalho =
          marker
            .getElement?.()
            ?.querySelector(
              ".editor-branch-shortcut"
            );

        if (!atalho) {
          return;
        }

        L.DomEvent.disableClickPropagation(
          atalho
        );

        L.DomEvent.on(
          atalho,
          "click",
          e => {
            L.DomEvent.preventDefault(e);
            L.DomEvent.stopPropagation(e);

            iniciarRamificacaoNoVertice(
              indice
            );
          }
        );
      }
    );
  }

  if (permiteContinuarLinha) {
    marker.on(
      "add",
      () => {
        const atalho =
          marker
            .getElement?.()
            ?.querySelector(
              ".editor-line-continue-shortcut"
            );

        if (!atalho) {
          return;
        }

        L.DomEvent.disableClickPropagation(
          atalho
        );

        L.DomEvent.on(
          atalho,
          "click",
          e => {
            L.DomEvent.preventDefault(e);
            L.DomEvent.stopPropagation(e);

            if (
              editor.ramoAtivo !== null
            ) {
              concluirRamificacaoEditor();
            }

            editor.linhaExtremidadeAtiva =
              indice === 0
                ? "inicio"
                : "fim";

            selecionarVertice(
              indice
            );

            status.textContent =
              indice === 0
                ? "Continuando pelo início. Clique no mapa para adicionar o próximo ponto."
                : "Continuando pelo fim. Clique no mapa para adicionar o próximo ponto.";

            atualizarCursorCriacao();
          }
        );
      }
    );
  }

  if (!ancorado) {
    marker.on(
      "dragstart",
      () => {
        editor.ramoSelecionado =
          null;

        editor.linhaExtremidadeAtiva =
          null;

        editor.verticeSelecionado =
          indice;

        atualizarSelecaoVerticeUI();
        atualizarAcoesRail();
      }
    );

    marker.on(
      "drag",
      e => {
        editor.pontos[indice] =
          mapaParaPixel(
            e.target.getLatLng()
          );

        atualizarPreview(
          false
        );
      }
    );

    marker.on(
      "dragend",
      e => {
        editor.pontos[indice] =
          mapaParaPixel(
            e.target.getLatLng()
          );

        atualizarPreview();
      }
    );
  }

  return marker;
}

function criarHandleRamo(
  ramo,
  ponto,
  indice,
  numeroRamo
) {
  const selecionado =
    editor.ramoSelecionado?.ramoId ===
      ramo.id &&
    editor.ramoSelecionado?.indice ===
      indice;

  const icon =
    L.divIcon({
      className: "",
      html:
        '<div class="editor-ponto branch-point-handle' +
        (
          selecionado
            ? " selecionado"
            : ""
        ) +
        '">R' +
        numeroRamo +
        "." +
        (indice + 1) +
        "</div>",
      iconSize:
        [28, 20],
      iconAnchor:
        [14, 10]
    });

  const marker =
    L.marker(
      pixelParaMapa(
        ponto.x,
        ponto.y
      ),
      {
        icon,
        draggable: true,
        interactive: true,
        keyboard: false,
        zIndexOffset: 1450
      }
    );

  marker.on(
    "click",
    e => {
      L.DomEvent.stopPropagation(
        e
      );

      editor.verticeSelecionado =
        null;

      editor.linhaExtremidadeAtiva =
        null;

      editor.ramoSelecionado = {
        ramoId:
          ramo.id,
        indice
      };

      atualizarSelecaoVerticeUI();
      atualizarAcoesRail();
      redesenharHandles();
    }
  );

  marker.on(
    "drag",
    e => {
      ramo.pontos[indice] =
        mapaParaPixel(
          e.target.getLatLng()
        );

      atualizarPreview(
        false
      );
    }
  );

  marker.on(
    "dragend",
    e => {
      ramo.pontos[indice] =
        mapaParaPixel(
          e.target.getLatLng()
        );

      atualizarPreview();
    }
  );

  return marker;
}

function criarPlusRamoHandle(
  ponto,
  ramo,
  indiceInsercao,
  segmentoId
) {
  const icon =
    L.divIcon({
      className: "",
      html:
        '<div class="editor-plus branch-add-handle">+</div>',
      iconSize:
        [14, 14],
      iconAnchor:
        [7, 7]
    });

  const marker =
    L.marker(
      pixelParaMapa(
        ponto.x,
        ponto.y
      ),
      {
        icon,
        interactive: true,
        keyboard: false,
        zIndexOffset: 1510
      }
    );

  marker.atlasSegmentoId =
    segmentoId;

  marker.on(
    "mouseover",
    () =>
      mostrarAlcaInsercaoEditor(
        marker
      )
  );

  marker.on(
    "mouseout",
    () =>
      programarOcultarAlcaInsercao(
        marker
      )
  );

  marker.on(
    "click",
    e => {
      L.DomEvent.stopPropagation(
        e
      );

      invalidarHistoricoRefazerGeometria();

      ramo.pontos.splice(
        indiceInsercao,
        0,
        clone(ponto)
      );

      editor.verticeSelecionado =
        null;

      editor.linhaExtremidadeAtiva =
        null;

      editor.ramoSelecionado = {
        ramoId:
          ramo.id,
        indice:
          indiceInsercao
      };

      atualizarPreview();
      atualizarSelecaoVerticeUI();
      atualizarAcoesRail();
    }
  );

  return marker;
}

function midpoint(a, b) {
  return {
    x:
      Math.round(
        (a.x + b.x) / 2
      ),

    y:
      Math.round(
        (a.y + b.y) / 2
      )
  };
}

let timerOcultarAlcaInsercao =
  null;

let alcaInsercaoAtiva =
  null;

function ocultarAlcaInsercaoEditor() {
  clearTimeout(
    timerOcultarAlcaInsercao
  );

  alcaInsercaoAtiva
    ?.getElement?.()
    ?.classList.remove(
      "editor-insert-handle-active"
    );

  alcaInsercaoAtiva =
    null;
}

function mostrarAlcaInsercaoEditor(
  handle
) {
  clearTimeout(
    timerOcultarAlcaInsercao
  );

  if (
    alcaInsercaoAtiva &&
    alcaInsercaoAtiva !==
      handle
  ) {
    alcaInsercaoAtiva
      .getElement?.()
      ?.classList.remove(
        "editor-insert-handle-active"
      );
  }

  alcaInsercaoAtiva =
    handle;

  handle
    ?.getElement?.()
    ?.classList.add(
      "editor-insert-handle-active"
    );
}

function programarOcultarAlcaInsercao(
  handle
) {
  clearTimeout(
    timerOcultarAlcaInsercao
  );

  timerOcultarAlcaInsercao =
    setTimeout(
      () => {
        if (
          alcaInsercaoAtiva !==
          handle
        ) {
          return;
        }

        ocultarAlcaInsercaoEditor();
      },
      220
    );
}

function configurarHoverInsercao(
  layer,
  handle
) {
  if (!handle) {
    return layer;
  }

  layer.on(
    "mouseover",
    () =>
      mostrarAlcaInsercaoEditor(
        handle
      )
  );

  layer.on(
    "mouseout",
    () =>
      programarOcultarAlcaInsercao(
        handle
      )
  );

  layer.on(
    "click",
    e =>
      L.DomEvent.stopPropagation(
        e
      )
  );

  return layer;
}

function alcaInsercaoPorSegmento(
  segmentoId
) {
  return (
    editor.plusHandles ||
    []
  ).find(
    handle =>
      handle.atlasSegmentoId ===
      segmentoId
  ) || null;
}

function criarHoverSegmento(
  inicio,
  fim,
  segmentoId,
  largura = 18
) {
  return configurarHoverInsercao(
    L.polyline(
      [
        inicio,
        fim
      ],
      {
        color:
          "#000000",
        weight:
          Math.max(
            Number(largura) ||
              0,
            18
          ),
        opacity: 0,
        interactive: true,
        bubblingMouseEvents:
          false,
        className:
          "editor-insertion-guide"
      }
    ),
    alcaInsercaoPorSegmento(
      segmentoId
    )
  );
}

function criarPlusHandle(
  ponto,
  indiceInsercao,
  segmentoId
) {
  const icon =
    L.divIcon({
      className: "",

      html:
        '<div class="editor-plus">+</div>',

      iconSize:
        [14, 14],

      iconAnchor:
        [7, 7]
    });

  const marker =
    L.marker(
      pixelParaMapa(
        ponto.x,
        ponto.y
      ),
      {
        icon,
        interactive: true,
        keyboard: false,
        zIndexOffset: 1500
      }
    );

  marker.atlasSegmentoId =
    segmentoId;

  marker.on(
    "mouseover",
    () =>
      mostrarAlcaInsercaoEditor(
        marker
      )
  );

  marker.on(
    "mouseout",
    () =>
      programarOcultarAlcaInsercao(
        marker
      )
  );

  marker.on(
    "click",
    e => {
      L.DomEvent.stopPropagation(
        e
      );

      invalidarHistoricoRefazerGeometria();

      editor.pontos.splice(
        indiceInsercao,
        0,
        clone(ponto)
      );

      for (
        const ramo of
        editor.ramificacoes ||
        []
      ) {
        if (
          ramo.origemIndice >=
          indiceInsercao
        ) {
          ramo.origemIndice++;
        }
      }

      editor.verticeSelecionado =
        indiceInsercao;

      editor.linhaExtremidadeAtiva =
        null;

      atualizarPreview();

      atualizarSelecaoVerticeUI();
      atualizarAcoesRail();

      status.textContent =
        "Novo ponto inserido entre os vértices. Arraste-o para ajustar o contorno.";
    }
  );

  return marker;
}

function redesenharHandles() {
  ocultarAlcaInsercaoEditor();

  for (
    const h of
    editor.handles
  ) {
    if (
      mapa.hasLayer(h)
    ) {
      mapa.removeLayer(h);
    }
  }

  for (
    const h of
    editor.plusHandles
  ) {
    if (
      mapa.hasLayer(h)
    ) {
      mapa.removeLayer(h);
    }
  }

  for (
    const h of
    editor.branchHandles ||
    []
  ) {
    if (
      mapa.hasLayer(h)
    ) {
      mapa.removeLayer(h);
    }
  }

  editor.handles = [];
  editor.plusHandles = [];
  editor.branchHandles = [];

  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  if (!cat) {
    return;
  }

  for (
    let i = 0;
    i < editor.pontos.length;
    i++
  ) {
    const h =
      criarHandleVertice(
        editor.pontos[i],
        i
      );

    h.addTo(mapa);

    editor.handles.push(
      h
    );
  }

  if (
    geometriaEfetiva(cat) === "linha" ||
    geometriaEfetiva(cat) === "area"
  ) {
    for (
      let i = 0;
      i < editor.pontos.length - 1;
      i++
    ) {
      const meio =
        midpoint(
          editor.pontos[i],
          editor.pontos[i + 1]
        );

      const h =
        criarPlusHandle(
          meio,
          i + 1,
          `principal:${i}`
        );

      h.addTo(mapa);

      editor.plusHandles.push(
        h
      );
    }
  }

  if (
    geometriaEfetiva(cat) === "area" &&
    editor.pontos.length >= 3
  ) {
    const meio =
      midpoint(
        editor.pontos[
          editor.pontos.length - 1
        ],
        editor.pontos[0]
      );

    const h =
      criarPlusHandle(
        meio,
        editor.pontos.length,
        `principal:${
          editor.pontos.length -
          1
        }`
      );

    h.addTo(mapa);

    editor.plusHandles.push(
      h
    );
  }

  if (
    geometriaEfetiva(cat) === "linha"
  ) {
    editor.ramificacoes.forEach(
      (ramo, ramoIndex) => {
        const origem =
          editor.pontos[
            ramo.origemIndice
          ];

        if (!origem) {
          return;
        }

        ramo.pontos =
          Array.isArray(
            ramo.pontos
          )
            ? ramo.pontos
            : [];

        for (
          let i = 0;
          i < ramo.pontos.length;
          i++
        ) {
          const h =
            criarHandleRamo(
              ramo,
              ramo.pontos[i],
              i,
              ramoIndex + 1
            );

          h.addTo(mapa);

          editor.branchHandles.push(
            h
          );
        }

        const caminho =
          [
            origem,
            ...ramo.pontos
          ];

        for (
          let i = 0;
          i < caminho.length - 1;
          i++
        ) {
          const meio =
            midpoint(
              caminho[i],
              caminho[i + 1]
            );

          const indiceInsercao =
            i;

          const h =
            criarPlusRamoHandle(
              meio,
              ramo,
              indiceInsercao,
              `ramo:${
                ramo.id
              }:${i}`
            );

          h.addTo(mapa);

          editor.plusHandles.push(
            h
          );
        }
      }
    );
  }

  atualizarUIRamificacoes();
}

function removerVerticeSelecionadoAtual() {
  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  if (!cat) {
    return;
  }

  if (
    editor.ramoSelecionado
  ) {
    const ramo =
      ramificacaoPorId(
        editor.ramoSelecionado.ramoId
      );

    if (!ramo) {
      editor.ramoSelecionado =
        null;

      atualizarSelecaoVerticeUI();
      return;
    }

    invalidarHistoricoRefazerGeometria();

    ramo.pontos.splice(
      editor.ramoSelecionado.indice,
      1
    );

    editor.ramoSelecionado =
      null;

    if (!ramo.pontos.length) {
      editor.ramificacoes =
        editor.ramificacoes.filter(
          r => r.id !== ramo.id
        );

      if (
        editor.ramoAtivo === ramo.id
      ) {
        editor.ramoAtivo =
          null;
      }
    }

    atualizarPreview();
    atualizarSelecaoVerticeUI();
    atualizarAcoesRail();
    return;
  }

  const indice =
    editor.verticeSelecionado;

  if (
    indice === null ||
    indice === undefined
  ) {
    return;
  }

  if (
    verticeLinhaAncorado(
      indice
    )
  ) {
    avisar(
      "Este ponto está ligado a um Local e acompanha sua posição automaticamente."
    );

    return;
  }

  if (
    editor.ramificacoes.some(
      r =>
        r.origemIndice ===
        indice
    )
  ) {
    avisar(
      "Este ponto possui ramificações. Exclua ou mova as ramificações antes de remover o ponto."
    );

    return;
  }

  const minimo =
    geometriaEfetiva(cat) ===
    "area"
      ? 3
      : 2;

  if (
    editor.pontos.length <=
    minimo
  ) {
    avisar(
      geometriaEfetiva(cat) === "area"
        ? "Uma área precisa de pelo menos 3 pontos."
        : "Uma linha precisa de pelo menos 2 pontos."
    );

    return;
  }

  invalidarHistoricoRefazerGeometria();

  editor.pontos.splice(
    indice,
    1
  );

  for (
    const ramo of
    editor.ramificacoes
  ) {
    if (
      ramo.origemIndice >
      indice
    ) {
      ramo.origemIndice--;
    }
  }

  editor.verticeSelecionado =
    null;

  atualizarSelecaoVerticeUI();
  atualizarPreview();
  atualizarAcoesRail();
}

function atualizarPreviewRotulo() {
  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  if (
    !editor.ativo ||
    geometriaEfetiva(cat) !== "area" ||
    editor.pontos.length < 3 ||
    !labelControls
  ) {
    if (
      editor.labelHandle &&
      mapa.hasLayer(
        editor.labelHandle
      )
    ) {
      mapa.removeLayer(
        editor.labelHandle
      );
    }

    editor.labelHandle =
      null;

    return;
  }

  if (
    editor.labelHandle &&
    mapa.hasLayer(
      editor.labelHandle
    )
  ) {
    mapa.removeLayer(
      editor.labelHandle
    );
  }

  const manual =
    modoRotulo() ===
    "manual";

  if (
    manual &&
    !editor.label
  ) {
    const s =
      editor.pontos.reduce(
        (a, p) => ({
          x: a.x + p.x,
          y: a.y + p.y
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

  const tamanhoProprio =
    modoTamanhoRotulo() ===
    "objeto";

  const tempObj = {
    nome:
      nomeObjeto.value ||
      "NOVA ÁREA",

    area:
      clone(
        editor.pontos
      ),

    label:
      manual
        ? clone(
            editor.label
          )
        : null,

    rotulo: {
      exibir: true,
      modoTamanho:
        tamanhoProprio
          ? "objeto"
          : "tipo",
      tamanhoPersonalizado:
        tamanhoProprio,
      tamanho:
        Number(
          labelControls.size.value
        ) ||
        14,
      cor:
        /^#[0-9a-f]{6}$/i.test(
          labelControls.color.value
        )
          ? labelControls.color.value
          : "#FFFFFF",
      modo:
        manual
          ? "manual"
          : "automatico"
    }
  };

  const marker =
    criarLabelArea(
      tempObj,
      cat,
      manual
    );

  if (manual) {
    marker.on(
      "drag",
      e => {
        editor.label =
          mapaParaPixel(
            e.target.getLatLng()
          );
      }
    );

    marker.on(
      "dragend",
      e => {
        editor.label =
          mapaParaPixel(
            e.target.getLatLng()
          );
      }
    );
  }

  marker.addTo(mapa);

  editor.labelHandle =
    marker;
}

function criarHandleLabel() {
  atualizarPreviewRotulo();
}

function atualizarPreview(
  redesenhar = true
) {
  if (
    editor.preview &&
    mapa.hasLayer(
      editor.preview
    )
  ) {
    mapa.removeLayer(
      editor.preview
    );
  }

  editor.preview =
    null;

  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  if (!cat) {
    atualizarCursorCriacao();
    return;
  }

  atualizarCursorCriacao();

  if (redesenhar) {
    redesenharHandles();
  }

  if (
    !editor.pontos.length
  ) {
    atualizarPreviewRotulo();
    return;
  }

  const posicoes =
    editor.pontos.map(
      p =>
        pixelParaMapa(
          p.x,
          p.y
        )
    );

  if (
    geometriaEfetiva(cat) ===
    "unico"
  ) {
    // O handle já contém o ícone real e permite reposicionar o objeto.
    return;
  }

  if (
    geometriaEfetiva(cat) ===
    "linha"
  ) {
    const largura =
      larguraTelaCategoria(
        cat
      );

    if (
      posicoes.length === 1
    ) {
      editor.preview =
        L.circleMarker(
          posicoes[0],
          {
            radius:
              largura / 2,
            color:
              cat.cor,
            weight: 2,
            opacity: 0.72,
            fillColor:
              cat.cor,
            fillOpacity: 0.22,
            interactive: false
          }
        )
          .addTo(mapa);
    } else {
      const layers = [];

      layers.push(
        L.polyline(
          posicoes,
          {
            color:
              cat.cor,
            weight:
              largura,
            opacity:
              opacidadeLinhaBase(
                cat
              ),
            dashArray:
              dashArrayLinha(
                cat,
                largura
              ),
            lineCap:
              cat.extremidade ===
              "reta"
                ? "butt"
                : "round",
            lineJoin:
              "round",
            interactive: false
          }
        )
      );

      for (
        let i = 0;
        i < posicoes.length - 1;
        i++
      ) {
        layers.push(
          criarHoverSegmento(
            posicoes[i],
            posicoes[i + 1],
            `principal:${i}`,
            largura
          )
        );
      }

      for (
        const ramo of
        editor.ramificacoes ||
        []
      ) {
        const caminho =
          caminhoRamificacao(
            ramo,
            editor.pontos
          );

        if (
          caminho.length < 2
        ) {
          continue;
        }

        const posicoesRamo =
          caminho.map(
            p =>
              pixelParaMapa(
                p.x,
                p.y
              )
          );

        layers.push(
          L.polyline(
            posicoesRamo,
            {
              color:
                cat.cor,
              weight:
                largura,
              opacity:
                opacidadeLinhaBase(
                  cat
                ),
              dashArray:
                dashArrayLinha(
                  cat,
                  largura
                ),
              lineCap:
                cat.extremidade ===
                "reta"
                  ? "butt"
                  : "round",
              lineJoin:
                "round",
              interactive: false
            }
          )
        );

        for (
          let i = 0;
          i <
            posicoesRamo.length -
              1;
          i++
        ) {
          layers.push(
            criarHoverSegmento(
              posicoesRamo[i],
              posicoesRamo[i + 1],
              `ramo:${
                ramo.id
              }:${i}`,
              largura
            )
          );
        }
      }

      editor.preview =
        L.layerGroup(
          layers
        )
          .addTo(mapa);
    }

    return;
  }

  if (
    geometriaEfetiva(cat) ===
    "area"
  ) {
    if (
      posicoes.length === 1
    ) {
      editor.preview =
        L.circleMarker(
          posicoes[0],
          {
            radius: 5,
            color:
              cat.cor,
            weight: 2,
            opacity: 0.8,
            fillColor:
              cat.cor,
            fillOpacity: 0.20,
            interactive: false
          }
        )
          .addTo(mapa);
    } else if (
      posicoes.length === 2
    ) {
      editor.preview =
        L.layerGroup(
          [
            L.polyline(
              posicoes,
              {
                color:
                  cat.cor,
                weight: 2,
                opacity: 0.72,
                dashArray:
                  "6 5",
                interactive: false
              }
            ),
            criarHoverSegmento(
              posicoes[0],
              posicoes[1],
              "principal:0"
            )
          ]
        )
          .addTo(mapa);
    } else {
      const layers = [
          L.polygon(
            posicoes,
            {
              color:
                cat.cor,
              weight: 2,
              opacity: 0.72,
              dashArray:
                "6 5",
              fillColor:
                cat.cor,
              fillOpacity:
                opacidadeArea(
                  cat
                ),
              interactive: false
            }
          )
      ];

      for (
        let i = 0;
        i < posicoes.length;
        i++
      ) {
        layers.push(
          criarHoverSegmento(
            posicoes[i],
            posicoes[
              (i + 1) %
              posicoes.length
            ],
            `principal:${i}`
          )
        );
      }

      editor.preview =
        L.layerGroup(
          layers
        )
          .addTo(mapa);
    }

    atualizarPreviewRotulo();
  }
}

function objetoDoFormulario() {
  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  if (!cat) {
    throw new Error(
      "Escolha um tipo de marcação."
    );
  }

  const objetoAnterior =
    editor.editandoId
      ? objetoPorId(
          editor.editandoId
        )
      : null;

  let entityRef = null;

  if (
    fonteObjeto.value &&
    registroObjeto.value
  ) {
    entityRef = {
      sourceId:
        fonteObjeto.value,
      recordId:
        registroObjeto.value
    };
  }

  const tituloReferencia =
    tituloRegistro(entityRef);

  const tituloLocal =
    nomeObjeto.value.trim();

  const titulo =
    tituloLocal ||
    tituloReferencia ||
    cat.nome ||
    "Objeto";

  const ids =
    new Set(
      mapaAtual.objetos
        .filter(
          o =>
            o.id !==
            editor.editandoId
        )
        .map(
          o => o.id
        )
    );

  const tamanhoPadraoRotulo =
    clamp(
      Number(
        cat.tamanhoFonte
      ) || 14,
      4,
      80
    );

  const tamanhoPersonalizado =
    Boolean(
      labelControls &&
      modoTamanhoRotulo() ===
        "objeto"
    );

  const tamanhoRotulo =
    tamanhoPersonalizado
      ? clamp(
          Number(
            labelControls
              .size.value
          ) ||
          Number(
            cat.tamanhoFonte
          ) ||
          14,
          4,
          80
        )
      : tamanhoPadraoRotulo;

  const obj = {
    id:
      editor.editandoId ||
      idUnico(
        titulo,
        ids
      ),

    categoriaId:
      cat.id,

    nome:
      tituloLocal,

    descricao:
      descricaoObjeto.value.trim(),

    rotulo: {
      exibir: labelControls ? labelControls.visible.checked : true,
      tamanho:
        tamanhoRotulo,
      tamanhoPersonalizado:
        tamanhoPersonalizado,
      modoTamanho:
        tamanhoPersonalizado
          ? "objeto"
          : "tipo",
      cor: labelControls && /^#[0-9a-f]{6}$/i.test(labelControls.color.value) ? labelControls.color.value.toUpperCase() : "#FFFFFF",
      modo: labelControls ? modoRotulo() : "automatico"
    }
  };

  if (entityRef) {
    obj.entityRef =
      entityRef;

    obj.entityFieldColumns =
      camposMarcados(
        camposReferenciaObjeto
      );
  }

  obj.relacoes =
    clone(
      editor.relacoes ||
      []
    );

  if (
    cat.comportamento ===
    "portal"
  ) {
    const destino =
      portalMapaDestino.value;

    obj.portalBidirecional =
      portalDirecao?.value !==
      "unidirecional";

    const manterComoEntrada =
      objetoAnterior?.portalEntradaSomente &&
      !obj.portalBidirecional;

    if (manterComoEntrada) {
      obj.portalEntradaSomente =
        true;

      obj.portalOrigemMapaId =
        objetoAnterior.portalOrigemMapaId ||
        objetoAnterior.portalParMapaId ||
        "";

      obj.portalOrigemMapaNome =
        objetoAnterior.portalOrigemMapaNome ||
        "";

      obj.portalOrigemObjetoId =
        objetoAnterior.portalOrigemObjetoId ||
        objetoAnterior.portalParObjetoId ||
        "";

      obj.portalParMapaId =
        objetoAnterior.portalParMapaId ||
        obj.portalOrigemMapaId;

      obj.portalParObjetoId =
        objetoAnterior.portalParObjetoId ||
        obj.portalOrigemObjetoId;
    }

    /* O Portal pode ser salvo sem destino durante a prototipagem. */
    if (
      destino &&
      !manterComoEntrada
    ) {
      obj.portalDestinoMapaId =
        destino;

      obj.portalDestinoNome =
        destino === mapaAtual.id
          ? mapaAtual.nome
          : portalMapaDestino.options[
              portalMapaDestino.selectedIndex
            ]?.textContent ||
            "Outro mapa";

      if (
        portalAreaDestino?.value
      ) {
        const ref = referenciaDoSeletor(portalAreaDestino);
        obj.portalDestinoObjetoId = ref.objetoId;
        obj.portalDestinoPosicao = ref.posicao;
        obj.portalDestinoFracao = ref.fracao;
        if (ref.objetoId) {
          obj.portalDestinoAreaNome = portalAreaDestino.selectedOptions[0]?.textContent || "";
          const alvo = seletoresConexao.get(portalAreaDestino)?.mapa;
          if (geometriaEfetiva(categoriaEmMapa(alvo, alvo?.objetos?.find(o => o.id === ref.objetoId)?.categoriaId)) === "area") obj.portalDestinoAreaId = ref.objetoId;
        }
      }
    }
  }

  const link =
    linkObjeto.value.trim();

  if (link) {
    if (!linkSeguro(link)) {
      throw new Error(
        "O link informado não é permitido."
      );
    }

    obj.link = link;

    const texto =
      textoLinkObjeto.value.trim();

    if (texto) {
      obj.textoLink = texto;
    }
  }

  if (geometriaEfetiva(cat) === "unico") {
    if (editor.pontos.length !== 1) {
      throw new Error(
        "Clique no mapa para posicionar o marcador."
      );
    }

    obj.x = editor.pontos[0].x;
    obj.y = editor.pontos[0].y;
  }

  if (geometriaEfetiva(cat) === "linha") {
    if (
      cat.comportamentoLinha ===
        "relacao"
    ) {
      const origemId =
        lineRelationControls
          ?.origem
          ?.value ||
        "";

      const destinoId =
        lineRelationControls
          ?.destino
          ?.value ||
        "";

      const origemMapaId =
        lineRelationControls
          ?.origemMapa
          ?.value ||
        mapaAtual.id;

      const destinoMapaId =
        lineRelationControls
          ?.destinoMapa
          ?.value ||
        mapaAtual.id;

      if (
        !origemId ||
        !destinoId ||
        (
          origemMapaId === destinoMapaId &&
          origemId === destinoId && origemId !== "@posicao"
        )
      ) {
        throw new Error(
          "Escolha dois objetos ou regiões diferentes para criar a relação."
        );
      }

      obj.relacaoOrigemMapaId =
        origemMapaId;

      obj.relacaoOrigemId =
        origemId === "@posicao" ? "" : origemId;

      obj.relacaoDestinoMapaId =
        destinoMapaId;

      obj.relacaoDestinoId =
        destinoId === "@posicao" ? "" : destinoId;
      const refA = referenciaDoSeletor(lineRelationControls.origem);
      const refB = referenciaDoSeletor(lineRelationControls.destino);
      obj.relacaoOrigemPosicao = refA.posicao;
      obj.relacaoDestinoPosicao = refB.posicao;
      obj.relacaoOrigemFracao = refA.fracao;
      obj.relacaoDestinoFracao = refB.fracao;
      const navegacao = document.getElementById("lineRelationNavigation").value;
      obj.conexaoNavegavel = navegacao !== "nenhuma";
      obj.portalBidirecional = navegacao === "volta";

      obj.relacaoVersao = 2;

      if (origemMapaId !== mapaAtual.id && destinoMapaId !== mapaAtual.id) {
        throw new Error("Uma extremidade da ligação precisa pertencer a este mapa.");
      }

      aplicarRelacaoLinha();
    } else {
      delete obj.relacaoOrigemMapaId;
      delete obj.relacaoOrigemId;
      delete obj.relacaoDestinoMapaId;
      delete obj.relacaoDestinoId;
    }

    if (editor.pontos.length < 2) {
      throw new Error(
        "Uma linha precisa de pelo menos 2 pontos."
      );
    }

    obj.pontos =
      clone(
        editor.pontos
      );

    obj.ramificacoes =
      clone(
        (
          editor.ramificacoes ||
          []
        ).filter(
          ramo =>
            Array.isArray(
              ramo.pontos
            ) &&
            ramo.pontos.length > 0
        )
      );
  }

  if (geometriaEfetiva(cat) === "area") {
    if (editor.pontos.length < 3) {
      throw new Error(
        "Uma área precisa de pelo menos 3 pontos."
      );
    }

    obj.area =
      clone(
        editor.pontos
      );

    /*
      O rótulo também deixa de ser obrigatório:
      se não for posicionado manualmente, usa o centro médio do polígono.
    */
    if (!editor.label) {
      const soma =
        editor.pontos.reduce(
          (acc, p) => ({
            x: acc.x + p.x,
            y: acc.y + p.y
          }),
          {
            x: 0,
            y: 0
          }
        );

      editor.label = {
        x:
          Math.round(
            soma.x /
            editor.pontos.length
          ),

        y:
          Math.round(
            soma.y /
            editor.pontos.length
          )
      };
    }

    if (obj.rotulo.modo === "manual") {
      if (!editor.label) garantirRotuloManual();
      obj.label = clone(editor.label);
    } else {
      delete obj.label;
    }
  }

  return obj;
}

async function salvarObjetoAtual() {
  await editor.carregamento;
  await preservarRascunhoAtual();
  const categoria = categoriaPorId(editor.categoriaId);
  if (categoria?.comportamentoLinha === "relacao") {
    for (const select of [lineRelationControls.origem, lineRelationControls.destino]) {
      const ref = referenciaDoSeletor(select);
      const alvo = await resolverReferenciaMapa(ref);
      if (!posicaoReferenciaConexao(alvo.mapa, ref)) throw new Error("Um dos destinos da conexão foi removido ou não tem posição válida. Escolha outro destino.");
    }
  }
  if (categoria?.comportamento === "portal" && portalMapaDestino.value) {
    const ref = referenciaDoSeletor(portalAreaDestino);
    const alvo = await resolverReferenciaMapa({ ...ref, mapaId: portalMapaDestino.value });
    if (!alvo.mapa || !posicaoReferenciaConexao(alvo.mapa, ref)) throw new Error("Escolha um local de chegada válido antes de salvar a conexão.");
  }
  const portalAnterior =
    editor.editandoId
      ? clone(
          objetoPorId(
            editor.editandoId
          )
        )
      : null;

  const obj =
    objetoDoFormulario();

  const cat =
    categoriaPorId(
      obj.categoriaId
    );

  const mapaAntes = clone(mapaAtual);
  let portalReciproco = null;
  try {

  if (
    editor.editandoId
  ) {
    const indice =
      mapaAtual.objetos.findIndex(
        o =>
          o.id ===
          editor.editandoId
      );

    mapaAtual.objetos[indice] =
      obj;
  } else {
    mapaAtual.objetos.push(
      obj
    );
  }

  const pendentes = new Map();

  if (
    cat?.comportamento ===
    "portal"
  ) {
    portalReciproco =
      await sincronizarPortalReciproco(
        obj,
        cat,
        portalAnterior,
        pendentes
      );

    /*
      O sincronizador grava no objeto original os IDs do par.
      Persistimos essa associação no mapa de origem.
    */
  }
  if (cat?.comportamentoLinha === "relacao") portalReciproco = await sincronizarCaminhoReciproco(obj, cat, portalAnterior, pendentes);
  pendentes.set(mapaAtual.id, mapaAtual);
  await salvarMapasAtomicos([...pendentes.values()], sessaoRascunho?.id);
  } catch (erro) {
    mapaAtual = mapaAntes;
    mostrarEstadoSalvamento("erro", "Sua edição e o rascunho foram preservados. Tente salvar novamente.");
    throw erro;
  }

  ui.objetoSelecionadoId =
    obj.id;

  cancelarEdicaoObjeto();

  ui.ferramenta =
    "selecionar";

  atualizarFerramentas();

  renderMapaCompleto();

  selecionarObjeto(
    obj.id
  );

  mostrarEstadoPainel(
    "selecionado"
  );

  if (
    portalReciproco?.criado
  ) {
    avisar(
      "Objeto salvo. Passagem de retorno criada em " +
      portalReciproco.mapaNome +
      "."
    );
  } else {
    avisar(
      "Objeto salvo."
    );
  }
}

/* =========================================================
   CLIQUE NO MAPA
   ========================================================= */

mapa.on(
  "click",
  e => {
    if (escolherLocalConexao(null, e)) return;
    if (
      !mapaAtual ||
      ui.modo !==
      "edicao"
    ) {
      return;
    }

    const ponto =
      mapaParaPixel(
        e.latlng
      );

    if (
      ui.ferramenta ===
      "coordenada"
    ) {
      if (
        processarCliqueCalibracao(
          ponto,
          e.latlng
        )
      ) {
        return;
      }

      L.popup()
        .setLatLng(
          e.latlng
        )
        .setContent(
          criarHtmlCoordenadas(
            ponto
          )
        )
        .openOn(mapa);

      return;
    }

    if (
      ui.ferramenta !==
        "criar" &&
      ui.ferramenta !==
        "portal" &&
      !editor.editandoId
    ) {
      return;
    }

    const cat =
      categoriaPorId(
        editor.categoriaId
      );

    if (!cat) {
      return;
    }

    if (
      geometriaEfetiva(cat) ===
      "unico"
    ) {
      invalidarHistoricoRefazerGeometria();

      editor.pontos = [
        ponto
      ];

      atualizarPreview();

      status.textContent =
        "Posição escolhida. Clique em Salvar.";

      atualizarAcoesRail();
      atualizarCursorCriacao();

      return;
    }

    if (
      geometriaEfetiva(cat) ===
        "linha" &&
      editor.ramoAtivo
    ) {
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

      invalidarHistoricoRefazerGeometria();

      ramo.pontos.push(
        ponto
      );

      editor.verticeSelecionado =
        null;

      editor.ramoSelecionado = {
        ramoId:
          ramo.id,
        indice:
          ramo.pontos.length - 1
      };

      atualizarPreview();
      atualizarSelecaoVerticeUI();
      atualizarAcoesRail();

      status.textContent =
        "Ponto adicionado ao ramo. Continue clicando, use o + de outro ponto para iniciar outro ramo ou Esc para finalizar.";

      return;
    }

    if (
      geometriaEfetiva(cat) ===
      "linha"
    ) {
      if (
        cat.comportamentoLinha ===
          "relacao"
      ) {
        avisar(
          "A ligação direta usa Local A e Local B. Para criar desvios, use os + entre os pontos; para bifurcar, selecione um ponto e crie uma ramificação."
        );

        return;
      }

      invalidarHistoricoRefazerGeometria();

      if (
        editor.linhaExtremidadeAtiva ===
          "inicio"
      ) {
        editor.pontos.unshift(
          ponto
        );

        for (
          const ramo of
          editor.ramificacoes || []
        ) {
          ramo.origemIndice++;
        }

        editor.verticeSelecionado =
          0;
      } else {
        editor.pontos.push(
          ponto
        );

        editor.linhaExtremidadeAtiva =
          "fim";
        editor.verticeSelecionado =
          editor.pontos.length - 1;
      }

      atualizarPreview();
      atualizarSelecaoVerticeUI();
      atualizarAcoesRail();

      return;
    }

    if (
      geometriaEfetiva(cat) ===
      "area"
    ) {
      if (
        editor.aguardandoLabel
      ) {
        invalidarHistoricoRefazerGeometria();

        editor.label =
          ponto;

        editor.aguardandoLabel =
          false;

        criarHandleLabel();

        status.textContent =
          "Nome posicionado. Clique em Salvar novamente.";

        return;
      }

      invalidarHistoricoRefazerGeometria();

      editor.pontos.push(
        ponto
      );

      atualizarPreview();
      atualizarAcoesRail();

      if (
        modoRotulo() ===
          "manual" &&
        editor.pontos.length >=
          3
      ) {
        garantirRotuloManual();
      }

      if (
        editor.pontos.length >=
        3
      ) {
        status.textContent =
          "Área pronta para salvar. Use os botões + entre os pontos para refinar o contorno.";
      } else {
        status.textContent =
          "Área com " +
          editor.pontos.length +
          " ponto(s). Adicione pelo menos 3 pontos. Os + aparecem entre os pontos já criados.";
      }
    }
  }
);


mapa.on(
  "mousemove",
  e => {
    if (!mapaAtual) {
      return;
    }

    atualizarBarraStatus(
      mapaParaPixel(
        e.latlng
      )
    );
  }
);

mapa.on(
  "movestart zoomstart",
  ocultarPreviewCursorCriacao
);

mapa.on(
  "zoomend",
  () => {
    atualizarBarraStatus();
  }
);

/* =========================================================
   TECLADO
   ========================================================= */

document.addEventListener(
  "keydown",
  e => {
    const alvo =
      e.target instanceof HTMLElement
        ? e.target
        : document.activeElement;

    const digitando =
      alvo instanceof HTMLElement &&
      (
        alvo.matches(
          "input, textarea, select"
        ) ||
        alvo.isContentEditable
      );

    const teclaExcluir =
      e.key === "Delete";

    const editandoVertice =
      editor.ativo &&
      (
        editor.verticeSelecionado !==
          null ||
        editor.ramoSelecionado !==
          null
      );

    if (
      !digitando &&
      (
        teclaExcluir ||
        e.key === "Backspace"
      ) &&
      editandoVertice
    ) {
      e.preventDefault();

      removerVerticeSelecionadoAtual();
      return;
    }

    if (
      !digitando &&
      teclaExcluir &&
      ui.modo === "edicao" &&
      ui.objetoSelecionadoId &&
      modalCategoria.hidden &&
      modalFonteDados.hidden &&
      buscaObjetosOverlay.hidden &&
      !document.body.classList.contains(
        "projects-visible"
      ) &&
      !document.querySelector(
        "dialog[open]"
      )
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      removerObjetoSelecionado();
      return;
    }

    if (
      e.key ===
      "Escape"
    ) {
      if (
        editor.ativo &&
        editor.ramoAtivo !== null
      ) {
        e.preventDefault();
        concluirRamificacaoEditor();
      } else if (
        !modalCategoria.hidden
      ) {
        fecharModalCategoria();
      } else if (
        editor.ativo
      ) {
        cancelarEdicaoObjeto();
      }
    }
  }
);
