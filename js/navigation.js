/* Câmera por mapa, seleção e carregamento de mapas do projeto. */
function chaveCameraMapa(id) {
  return "nameless-world-camera:" + String(id || "");
}

function salvarCameraAtual() {
  if (!mapaAtual || !mapa?._loaded) {
    return;
  }

  const centro = mapa.getCenter();

  localStorage.setItem(
    chaveCameraMapa(mapaAtual.id),
    JSON.stringify({
      lat: centro.lat,
      lng: centro.lng,
      zoom: mapa.getZoom()
    })
  );
}

function cameraSalvaMapa(id) {
  try {
    const valor =
      JSON.parse(
        localStorage.getItem(
          chaveCameraMapa(id)
        ) ||
        "null"
      );

    if (
      valor &&
      Number.isFinite(valor.lat) &&
      Number.isFinite(valor.lng) &&
      Number.isFinite(valor.zoom)
    ) {
      return valor;
    }
  } catch (erro) {}

  return null;
}

/* =========================================================
   MAPAS
   ========================================================= */

async function atualizarSeletorMapas() {
  const mapas =
    await dbListarResumosMapas();

  mapas.sort(
    (a, b) =>
      String(a.nome).localeCompare(
        String(b.nome),
        "pt-BR"
      )
  );

  seletorMapa.innerHTML =
    "";

  if (listaMapasBusca) {
    listaMapasBusca.innerHTML =
      "";
  }

  for (const m of mapas) {
    const option =
      document.createElement(
        "option"
      );

    option.value = m.id;
    option.textContent =
      m.nome;

    seletorMapa.appendChild(
      option
    );

    if (listaMapasBusca) {
      const sugestao =
        document.createElement("button");

      sugestao.type = "button";
      sugestao.className = "map-search-option";
      sugestao.dataset.mapaId = m.id;
      sugestao.dataset.mapaNome = m.nome;
      sugestao.setAttribute("role", "option");
      sugestao.textContent = m.nome;

      listaMapasBusca.appendChild(
        sugestao
      );
    }
  }

  if (mapaAtual) {
    seletorMapa.value =
      mapaAtual.id;

    if (buscaMapa) {
      buscaMapa.value =
        mapaAtual.nome;
    }
  } else if (buscaMapa) {
    buscaMapa.value =
      "";
  }
}

function definirListaMapasAberta(aberta) {
  if (!listaMapasBusca || !buscaMapa) return;

  listaMapasBusca.hidden = !aberta;
  buscaMapa.setAttribute("aria-expanded", String(aberta));
  abrirListaMapas?.setAttribute("aria-expanded", String(aberta));
}

function filtrarListaMapas() {
  if (!listaMapasBusca || !buscaMapa) return;

  const termo = buscaMapa.value.trim().toLocaleLowerCase("pt-BR");
  const opcoes = [...listaMapasBusca.querySelectorAll(".map-search-option")];

  for (const opcao of opcoes) {
    opcao.hidden = Boolean(termo) &&
      !opcao.dataset.mapaNome.toLocaleLowerCase("pt-BR").includes(termo);
  }

  definirListaMapasAberta(opcoes.some(opcao => !opcao.hidden));
}

async function selecionarMapaPelaBusca() {
  if (!buscaMapa) {
    return;
  }

  const termoOriginal =
    buscaMapa.value.trim();

  if (!termoOriginal) {
    return;
  }

  const termo =
    termoOriginal.toLocaleLowerCase(
      "pt-BR"
    );

  const mapas =
    await dbListarResumosMapas();

  let encontrado =
    mapas.find(
      m =>
        String(m.nome)
          .trim()
          .toLocaleLowerCase(
            "pt-BR"
          ) === termo
    );

  if (!encontrado) {
    const aproximados =
      mapas.filter(
        m =>
          String(m.nome)
            .toLocaleLowerCase(
              "pt-BR"
            )
            .includes(
              termo
            )
      );

    if (
      aproximados.length
    ) {
      encontrado =
        aproximados[0];
    }
  }

  if (!encontrado) {
    avisar(
      "Mapa não encontrado."
    );

    buscaMapa.value =
      mapaAtual?.nome ||
      "";

    return;
  }

  definirListaMapasAberta(false);

  await abrirMapa(
    encontrado.id
  );
}

function mostrarTelaSemMapa() {
  fecharConsultaNoPainel(false);
  limparCapturaCalibracao();
  limparMapaRenderizado();
  limparEditorVisual();

  mapaAtual =
    null;

  localStorage.removeItem(
    CHAVE_ATUAL
  );

  ui.objetoSelecionadoId =
    null;

  ui.categoriaSelecionadaId =
    null;

  ui.ferramenta =
    "selecionar";

  editor.ativo =
    false;

  editor.editandoId =
    null;

  editor.categoriaId =
    null;

  editor.pontos =
    [];

  editor.label =
    null;

  editor.ramificacoes =
    [];

  editor.ramoAtivo =
    null;

  editor.linhaExtremidadeAtiva =
    null;

  editor.verticeSelecionado =
    null;

  formObjeto.hidden =
    true;

  editorObjetoWrap.hidden =
    true;

  modalCategoria.hidden =
    true;

  selecaoObjeto.hidden =
    true;

  controleVertice.hidden =
    true;

  grupoRelacoesArea.hidden =
    true;

  mapa.setMaxBounds(
    null
  );

  mapa.setView(
    [0, 0],
    0,
    {
      animate: false
    }
  );

  mapa.invalidateSize();

  document.body.classList.add(
    "sem-mapa"
  );

  if (estadoMapaVazioProjeto) {
    estadoMapaVazioProjeto.textContent =
      projetoAtual?.nome ||
      "Novo projeto";
  }

  if (estadoMapaVazio) {
    const nomeProjeto =
      projetoAtual?.nome ||
      "este projeto";

    estadoMapaVazio.setAttribute(
      "aria-label",
      `Criar o primeiro mapa de ${nomeProjeto}`
    );
  }

  renomearMapa.disabled =
    true;

  excluirMapa.disabled =
    true;

  exportarMapa.disabled =
    !projetoAtual;

  modoVisualizacao.disabled =
    true;

  modoEdicao.disabled =
    true;

  seletorMapa.innerHTML =
    "";

  if (listaMapasBusca) {
    listaMapasBusca.innerHTML =
      "";
  }

  if (buscaMapa) {
    buscaMapa.value =
      "";
  }

  legendaAutomatica.innerHTML =
    "";

  if (inspectorLayersList) {
    inspectorLayersList.innerHTML =
      "";
  }

  if (typeCreationList) {
    typeCreationList.innerHTML =
      "";
  }

  atualizarSelecaoVerticeUI();
  atualizarBarraStatus();
  atualizarAcoesRail();
}

async function abrirMapa(id) {
  await preservarRascunhoAtual();
  suspenderRascunhoCategoria();
  const bruto =
    await dbPegar(id);

  if (!bruto) {
    return;
  }

  limparCapturaCalibracao();

  const migrado =
    normalizarEstruturaMapa(bruto);

  await garantirFontesCompartilhadasNoMapa(
    migrado
  );

  await garantirCategoriasCompartilhadasNoMapa(
    migrado
  );

  mapaAtual =
    migrado;

  document.body.classList.remove(
    "sem-mapa"
  );

  renomearMapa.disabled =
    false;

  excluirMapa.disabled =
    false;

  exportarMapa.disabled =
    false;

  modoVisualizacao.disabled =
    false;

  modoEdicao.disabled =
    false;

  /*
    Persiste migração automaticamente.
  */
  await dbSalvar(
    mapaAtual,
    {
      historico: false
    }
  );

  localStorage.setItem(
    CHAVE_ATUAL,
    mapaAtual.id
  );

  ui.objetoSelecionadoId =
    null;

  cancelarEdicaoObjeto({ preservarRascunho: true });

  renderMapaCompleto({
    preservarCamera: false
  });

  await atualizarSeletorMapas();

  atualizarCategoriasUI();
  atualizarFontesDadosUI();
  atualizarLegenda();
  atualizarBarraStatus();
  renderizarPainelCoordenadas();
  await oferecerRascunhoAtual();
}
