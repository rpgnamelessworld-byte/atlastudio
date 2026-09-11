/*
  Inicialização da aplicação.
  Preferências do Inspector, eventos da interface e fluxo de partida.
*/

/* =========================================================
   EVENTOS UI
   ========================================================= */

function limitarLarguraPainel(largura) {
  return Math.round(
    clamp(
      Number(largura) || 304,
      250,
      Math.min(540, window.innerWidth * .58)
    )
  );
}

function definirLarguraPainel(largura, salvar = true) {
  const valor = limitarLarguraPainel(largura);
  document.documentElement.style.setProperty("--inspector-width", `${valor}px`);
  redimensionarPainel?.setAttribute("aria-valuenow", String(valor));

  if (salvar) {
    localStorage.setItem("larguraPainel", String(valor));
  }

  return valor;
}

const larguraPainelSalva = Number(localStorage.getItem("larguraPainel"));
const larguraPainelInicial =
  !larguraPainelSalva || larguraPainelSalva === 320
    ? 304
    : larguraPainelSalva;

definirLarguraPainel(larguraPainelInicial, false);

if (redimensionarPainel) {
  let redimensionando = false;

  redimensionarPainel.addEventListener("pointerdown", e => {
    if (document.body.classList.contains("painel-fechado")) return;

    redimensionando = true;
    redimensionarPainel.setPointerCapture(e.pointerId);
    document.body.classList.add("redimensionando-painel");
    e.preventDefault();
  });

  redimensionarPainel.addEventListener("pointermove", e => {
    if (!redimensionando) return;
    const margemDireita = window.innerWidth - painel.getBoundingClientRect().right;
    definirLarguraPainel(window.innerWidth - e.clientX - margemDireita, false);
    mapa.invalidateSize({ pan: false, debounceMoveend: true });
  });

  const finalizarRedimensionamento = e => {
    if (!redimensionando) return;

    redimensionando = false;
    document.body.classList.remove("redimensionando-painel");
    localStorage.setItem(
      "larguraPainel",
      getComputedStyle(document.documentElement)
        .getPropertyValue("--inspector-width")
        .trim()
        .replace("px", "")
    );
    mapa.invalidateSize();

    if (e.pointerId !== undefined && redimensionarPainel.hasPointerCapture(e.pointerId)) {
      redimensionarPainel.releasePointerCapture(e.pointerId);
    }
  };

  redimensionarPainel.addEventListener("pointerup", finalizarRedimensionamento);
  redimensionarPainel.addEventListener("pointercancel", finalizarRedimensionamento);

  redimensionarPainel.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

    e.preventDefault();
    const atual = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--inspector-width"),
      10
    );
    definirLarguraPainel(atual + (e.key === "ArrowLeft" ? 16 : -16));
    mapa.invalidateSize();
  });
}

function alturaMaximaPainel() {
  const alturaDisponivel =
    painel.parentElement
      ?.getBoundingClientRect()
      ?.height ||
    (
      window.innerHeight -
      24
    );

  return Math.max(
    180,
    alturaDisponivel -
      16
  );
}

function limitarAlturaPainel(
  altura
) {
  const maxima =
    alturaMaximaPainel();

  return Math.round(
    clamp(
      Number(altura) || 480,
      Math.min(280, maxima),
      maxima
    )
  );
}

function definirAlturaPainel(
  altura,
  salvar = true
) {
  const valor =
    limitarAlturaPainel(
      altura
    );

  document.documentElement.style.setProperty(
    "--inspector-custom-height",
    `${valor}px`
  );

  painel.classList.add(
    "altura-personalizada"
  );

  redimensionarAlturaPainel?.setAttribute(
    "aria-valuenow",
    String(valor)
  );

  if (salvar) {
    localStorage.setItem(
      "alturaPainel",
      String(valor)
    );
  }

  return valor;
}

function restaurarAlturaAutomaticaPainel() {
  painel.classList.remove(
    "altura-personalizada"
  );

  document.documentElement.style.removeProperty(
    "--inspector-custom-height"
  );

  redimensionarAlturaPainel?.removeAttribute(
    "aria-valuenow"
  );

  localStorage.removeItem(
    "alturaPainel"
  );
}

const alturaPainelSalva =
  Number(
    localStorage.getItem(
      "alturaPainel"
    )
  );

if (
  Number.isFinite(
    alturaPainelSalva
  ) &&
  alturaPainelSalva > 0
) {
  definirAlturaPainel(
    alturaPainelSalva,
    false
  );
}

if (redimensionarAlturaPainel) {
  let redimensionandoAltura =
    false;

  let topoPainel =
    0;

  redimensionarAlturaPainel.addEventListener(
    "pointerdown",
    e => {
      if (
        document.body.classList.contains(
          "painel-fechado"
        )
      ) {
        return;
      }

      redimensionandoAltura =
        true;

      topoPainel =
        painel.getBoundingClientRect()
          .top;

      definirAlturaPainel(
        painel.getBoundingClientRect()
          .height,
        false
      );

      redimensionarAlturaPainel.setPointerCapture(
        e.pointerId
      );

      document.body.classList.add(
        "redimensionando-altura-painel"
      );

      e.preventDefault();
    }
  );

  redimensionarAlturaPainel.addEventListener(
    "pointermove",
    e => {
      if (!redimensionandoAltura) {
        return;
      }

      definirAlturaPainel(
        e.clientY -
          topoPainel,
        false
      );
    }
  );

  const finalizarAltura =
    e => {
      if (!redimensionandoAltura) {
        return;
      }

      redimensionandoAltura =
        false;

      document.body.classList.remove(
        "redimensionando-altura-painel"
      );

      localStorage.setItem(
        "alturaPainel",
        String(
          Math.round(
            painel.getBoundingClientRect()
              .height
          )
        )
      );

      if (
        e.pointerId !== undefined &&
        redimensionarAlturaPainel.hasPointerCapture(
          e.pointerId
        )
      ) {
        redimensionarAlturaPainel.releasePointerCapture(
          e.pointerId
        );
      }
    };

  redimensionarAlturaPainel.addEventListener(
    "pointerup",
    finalizarAltura
  );

  redimensionarAlturaPainel.addEventListener(
    "pointercancel",
    finalizarAltura
  );

  redimensionarAlturaPainel.addEventListener(
    "keydown",
    e => {
      if (
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown"
      ) {
        return;
      }

      e.preventDefault();

      definirAlturaPainel(
        painel.getBoundingClientRect()
          .height +
        (
          e.key === "ArrowDown"
            ? 24
            : -24
        )
      );
    }
  );

  redimensionarAlturaPainel.addEventListener(
    "dblclick",
    restaurarAlturaAutomaticaPainel
  );
}

function atualizarTamanhoMapaAposPainel() {
  const atualizar = () => {
    mapa.invalidateSize({ pan: false, animate: false });
  };

  atualizar();
  requestAnimationFrame(() => requestAnimationFrame(atualizar));
}

function definirPainelAberto(aberto, redimensionar = true) {
  document.body.classList.toggle("painel-fechado", !aberto);
  painel.classList.toggle("aberto", aberto);
  painel.setAttribute("aria-hidden", String(!aberto));

  if (redimensionar) {
    atualizarTamanhoMapaAposPainel();
  }

}

fecharPainel.addEventListener("click", () => {
  if (editor.ativo) {
    cancelarEdicaoObjeto();
  }

  definirPainelAberto(false);
});

/* O Inspector nasce oculto e é aberto pelas ações contextuais. */
definirPainelAberto(false, false);

/* =========================================================
   MENU CONTEXTUAL DO MAPA
   ========================================================= */

const mapStageContextual = document.querySelector(".map-stage");
const mapaContainer = mapa.getContainer();
let timerFecharMenuRadial = null;

function fecharMenuRadial(restaurarFoco = false) {
  if (!menuRadialMapa || menuRadialMapa.hidden) return;

  clearTimeout(timerFecharMenuRadial);
  menuRadialMapa.classList.remove("aberto");

  timerFecharMenuRadial = setTimeout(() => {
    menuRadialMapa.hidden = true;
  }, 120);

  if (restaurarFoco) {
    mapaContainer.focus({ preventScroll: true });
  }
}

function abrirMenuRadial(clientX, clientY, focarPrimeiro = false) {
  if (!menuRadialMapa || !mapStageContextual || !mapaAtual) {
    if (!mapaAtual) {
      avisar("Crie ou importe um mapa para acessar as ferramentas.");
    }
    return;
  }

  /* O clique direito sempre entra no contexto de edição. */
  if (
    ui.modo !== "edicao" &&
    !editor.ativo
  ) {
    setModo("edicao");

    definirPainelAberto(false, false);
  }

  const rect = mapStageContextual.getBoundingClientRect();
  const estiloRadial = getComputedStyle(menuRadialMapa);
  const larguraRadial = parseFloat(estiloRadial.width) || 280;
  const alturaRadial = parseFloat(estiloRadial.height) || 240;
  const margemX = larguraRadial / 2 + 8;
  const margemY = alturaRadial / 2 + 8;
  const minimoX = Math.min(margemX, rect.width / 2);
  const minimoY = Math.min(margemY, rect.height / 2);
  const maximoX = Math.max(minimoX, rect.width - margemX);
  const maximoY = Math.max(minimoY, rect.height - margemY);
  const x = clamp(clientX - rect.left, minimoX, maximoX);
  const y = clamp(clientY - rect.top, minimoY, maximoY);

  clearTimeout(timerFecharMenuRadial);
  menuRadialMapa.style.left = `${x}px`;
  menuRadialMapa.style.top = `${y}px`;
  menuRadialMapa.hidden = false;

  requestAnimationFrame(() => {
    menuRadialMapa.classList.add("aberto");

    if (focarPrimeiro) {
      menuRadialMapa.querySelector(".radial-action")?.focus({ preventScroll: true });
    }
  });
}

function abrirAbaPeloMenuRadial(tab) {
  setModo("edicao");

  if (!editor.ativo) {
    ui.ferramenta = "selecionar";
    atualizarFerramentas();
  }

  definirAbaInspector(tab);
  definirPainelAberto(true);
}

mapaContainer.addEventListener("contextmenu", e => {
  e.preventDefault();
  e.stopPropagation();

  /*
    O menu de contexto nativo costuma aparecer antes dos 2 s em telas touch.
    Nesses casos, o gesto personalizado abaixo controla a abertura do radial.
  */
  if (
    e.pointerType === "touch" ||
    e.sourceCapabilities?.firesTouchEvents
  ) {
    return;
  }

  abrirMenuRadial(e.clientX, e.clientY);
});

const consultaPonteiroTouch =
  window.matchMedia("(pointer: coarse)");
let ultimoToqueMapa = null;
let pressaoTouchMapa = null;
let ultimaAberturaCriacao = 0;

function abrirCriacaoRapidaMapa() {
  const agora = performance.now();

  /* Um duplo toque pode gerar também o evento dblclick do Leaflet. */
  if (agora - ultimaAberturaCriacao < 450) {
    return;
  }

  ultimaAberturaCriacao = agora;
  fecharMenuRadial();
  definirBarraCriacaoRapidaAberta(false);
  limparCapturaCalibracao();

  if (
    editor.ativo &&
    editor.editandoId
  ) {
    definirPainelAberto(true);
    avisar("Salve ou cancele a edição do objeto antes de iniciar outro.");
    return;
  }

  setModo("edicao");

  /* Reabrir Criação retoma a sessão atual em vez de descartá-la. */
  if (
    editor.ativo &&
    !editor.editandoId
  ) {
    ui.ferramenta =
      categoriaPorId(editor.categoriaId)
        ?.comportamento === "portal"
        ? "portal"
        : "criar";

    atualizarFerramentas();
    mostrarEstadoPainel("objeto");
    definirBarraCriacaoRapidaAberta(true);
    definirPainelAberto(true);
    return;
  }

  cancelarEdicaoObjeto();
  ui.ferramenta = "criar";
  atualizarFerramentas();
  definirBarraCriacaoRapidaAberta(true);

  definirPainelAberto(false);
}

function alvoBloqueiaGestoMapa(alvo, incluirObjetos = false) {
  if (!(alvo instanceof Element)) {
    return false;
  }

  const seletorBase =
    ".leaflet-control, .leaflet-popup, .leaflet-tooltip, .map-radial-menu";
  const seletor = incluirObjetos
    ? `${seletorBase}, .leaflet-marker-icon, .leaflet-interactive`
    : seletorBase;

  return Boolean(alvo.closest(seletor));
}

function cancelarPressaoTouchMapa() {
  if (!pressaoTouchMapa) {
    return;
  }

  clearTimeout(pressaoTouchMapa.timer);
  mapaContainer.classList.remove("touch-hold-pending");
}

function limparPressaoTouchMapa() {
  cancelarPressaoTouchMapa();
  pressaoTouchMapa = null;
}

function atualizarInteracaoTouchMapa() {
  const touch =
    consultaPonteiroTouch.matches;

  /* O duplo clique no mapa abre as ferramentas de criação. */
  mapa.doubleClickZoom.disable();

  const dica =
    document.querySelector(
      ".radial-shortcut-hint"
    );
  if (dica) {
    dica.textContent = touch
      ? "Segure 2 s: ferramentas · 2 toques: criar"
      : "Botão direito: ferramentas · 2 cliques: criar";
  }
}

atualizarInteracaoTouchMapa();
consultaPonteiroTouch.addEventListener?.(
  "change",
  atualizarInteracaoTouchMapa
);

mapaContainer.addEventListener(
  "pointerdown",
  evento => {
    if (
      evento.pointerType !== "touch" ||
      !mapaAtual ||
      alvoBloqueiaGestoMapa(evento.target)
    ) {
      limparPressaoTouchMapa();
      return;
    }

    limparPressaoTouchMapa();

    const rect = mapaContainer.getBoundingClientRect();
    mapaContainer.style.setProperty(
      "--touch-hold-x",
      `${evento.clientX - rect.left}px`
    );
    mapaContainer.style.setProperty(
      "--touch-hold-y",
      `${evento.clientY - rect.top}px`
    );
    mapaContainer.classList.add("touch-hold-pending");

    const pressao = {
      pointerId: evento.pointerId,
      x: evento.clientX,
      y: evento.clientY,
      aberta: false,
      timer: null
    };

    pressao.timer = setTimeout(() => {
      if (pressaoTouchMapa !== pressao) {
        return;
      }

      pressao.aberta = true;
      ultimoToqueMapa = null;
      mapaContainer.classList.remove("touch-hold-pending");
      abrirMenuRadial(pressao.x, pressao.y);
    }, 2000);

    pressaoTouchMapa = pressao;
  },
  true
);

mapaContainer.addEventListener(
  "pointermove",
  evento => {
    if (
      !pressaoTouchMapa ||
      evento.pointerId !== pressaoTouchMapa.pointerId
    ) {
      return;
    }

    if (
      Math.hypot(
        evento.clientX - pressaoTouchMapa.x,
        evento.clientY - pressaoTouchMapa.y
      ) > 14
    ) {
      limparPressaoTouchMapa();
      ultimoToqueMapa = null;
    }
  },
  true
);

mapaContainer.addEventListener(
  "pointerup",
  evento => {
    const pressao =
      pressaoTouchMapa &&
      evento.pointerId === pressaoTouchMapa.pointerId
        ? pressaoTouchMapa
        : null;

    if (pressao?.aberta) {
      evento.preventDefault();
      evento.stopPropagation();
      limparPressaoTouchMapa();
      ultimoToqueMapa = null;
      return;
    }

    limparPressaoTouchMapa();

    if (
      evento.pointerType !== "touch" ||
      !mapaAtual ||
      alvoBloqueiaGestoMapa(evento.target, true)
    ) {
      ultimoToqueMapa = null;
      return;
    }

    const agora = performance.now();
    const toque = {
      instante: agora,
      x: evento.clientX,
      y: evento.clientY
    };
    const repetido =
      ultimoToqueMapa &&
      agora - ultimoToqueMapa.instante <= 380 &&
      Math.hypot(
        evento.clientX - ultimoToqueMapa.x,
        evento.clientY - ultimoToqueMapa.y
      ) <= 28;

    if (repetido) {
      evento.preventDefault();
      evento.stopPropagation();
      ultimoToqueMapa = null;
      abrirCriacaoRapidaMapa();
      return;
    }

    ultimoToqueMapa = toque;
  },
  true
);

mapaContainer.addEventListener(
  "pointercancel",
  () => {
    limparPressaoTouchMapa();
    ultimoToqueMapa = null;
  },
  true
);

mapa.on("dblclick", evento => {
  const original = evento.originalEvent;

  if (
    alvoBloqueiaGestoMapa(
      original?.target,
      true
    )
  ) {
    return;
  }

  original?.preventDefault();
  abrirCriacaoRapidaMapa();
});

menuRadialMapa?.addEventListener("contextmenu", e => e.preventDefault());

menuRadialMapa?.addEventListener("click", e => {
  const botao = e.target.closest("[data-radial-action]");
  if (!botao) return;

  const acao = botao.dataset.radialAction;
  fecharMenuRadial();
  definirBarraCriacaoRapidaAberta(false);

  if (acao !== "coordenadas") {
    limparCapturaCalibracao();
  }

  if (acao === "legenda") {
    setModo("visualizacao");
    definirPainelAberto(true);
    return;
  }

  if (acao === "coordenadas") {
    setModo("edicao");
    setFerramenta("coordenada");
    definirAbaInspector("coordenadas");
    renderizarPainelCoordenadas();
    definirPainelAberto(true);

    return;
  }

  if (acao === "criacao") {
    abrirCriacaoRapidaMapa();
    return;
  }

  if (acao === "edicao") {
    setModo("edicao");
    setFerramenta("selecionar");

    if (ui.objetoSelecionadoId) {
      mostrarEstadoPainel("selecionado");
      definirPainelAberto(true);
    } else {
      definirPainelAberto(false);
      avisar("Modo de edição ativo. Clique em um objeto para abrir o editor.");
    }

    return;
  }

  abrirAbaPeloMenuRadial(acao);
});

function iniciarCategoriaRapida(
  categoriaId
) {
  if (!categoriaId || !categoriaPorId(categoriaId)) {
    return;
  }

  fecharMenuGrupoCriacaoRapida();

  if (ui.modo !== "edicao") {
    setModo("edicao");
  }

  ui.categoriaSelecionadaId = categoriaId;
  ui.ferramenta = "criar";
  atualizarFerramentas();
  iniciarCriacaoObjeto(categoriaId);
  renderBarraCriacaoRapida();
  definirPainelAberto(true);
}

tiposCriacaoRapida?.addEventListener("click", e => {
  const grupo =
    e.target.closest(
      "[data-quick-group]"
    );

  if (grupo) {
    abrirMenuGrupoCriacaoRapida(
      grupo.dataset.quickGroup,
      grupo
    );

    return;
  }

  const botao =
    e.target.closest(
      "[data-quick-category]"
    );

  iniciarCategoriaRapida(
    botao?.dataset.quickCategory
  );
});

menuGrupoCriacaoRapida?.addEventListener("click", e => {
  const botao =
    e.target.closest(
      "[data-quick-category]"
    );

  iniciarCategoriaRapida(
    botao?.dataset.quickCategory
  );
});

selecaoRapida?.addEventListener("click", () => {
  setFerramenta("selecionar");
  definirBarraCriacaoRapidaAberta(false);

  definirPainelAberto(false);
});

novoTipoRapido?.addEventListener("click", () => {
  fecharMenuGrupoCriacaoRapida();

  if (editor.ativo) {
    cancelarEdicaoObjeto();
  }

  if (!modalCategoria.hidden) {
    fecharModalCategoria();
  }

  abrirModalCategoria(null, "atalho");
});

gerenciarTiposRapido?.addEventListener("click", () => {
  fecharMenuGrupoCriacaoRapida();

  if (editor.ativo) {
    cancelarEdicaoObjeto();
  }

  if (!modalCategoria.hidden) {
    fecharModalCategoria();
  }

  cadastroTipoPeloAtalho = false;
  modalCategoria.hidden = true;

  const creationHome =
    inspectorPanels
      ?.criacao
      ?.querySelector(".type-creation-home");

  if (creationHome) {
    creationHome.hidden = false;
  }

  definirAbaInspector("criacao");
  renderizarCriacaoTipos();
  definirPainelAberto(true);
});

fecharCriacaoRapida?.addEventListener("click", () => {
  definirBarraCriacaoRapidaAberta(false);
});

abrirLegendaVisual?.addEventListener("click", () => {
  definirBarraCriacaoRapidaAberta(false);
  setModo("visualizacao");
  definirPainelAberto(true);
});

fecharMenuRadialBotao?.addEventListener(
  "click",
  () => {
    fecharMenuRadialBotao.classList.add(
      "selecionado"
    );

    setTimeout(
      () => {
        fecharMenuRadial(true);

        setTimeout(
          () =>
            fecharMenuRadialBotao.classList.remove(
              "selecionado"
            ),
          130
        );
      },
      90
    );
  }
);

document.addEventListener("pointerdown", e => {
  if (!menuRadialMapa?.hidden && !menuRadialMapa.contains(e.target)) {
    fecharMenuRadial();
  }

  if (
    !menuGrupoCriacaoRapida?.hidden &&
    !menuGrupoCriacaoRapida.contains(
      e.target
    ) &&
    !e.target.closest(
      "[data-quick-group]"
    )
  ) {
    fecharMenuGrupoCriacaoRapida();
  }
});

document.addEventListener("keydown", e => {
  if (
    e.key === "Escape" &&
    !menuGrupoCriacaoRapida?.hidden
  ) {
    e.preventDefault();
    e.stopImmediatePropagation();
    fecharMenuGrupoCriacaoRapida();
    return;
  }

  if (e.key === "Escape" && !menuRadialMapa?.hidden) {
    e.preventDefault();
    e.stopImmediatePropagation();
    fecharMenuRadial(true);
    return;
  }

  if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && mapaAtual) {
    e.preventDefault();
    const rect = mapStageContextual.getBoundingClientRect();
    abrirMenuRadial(rect.left + rect.width / 2, rect.top + rect.height / 2, true);
  }
}, true);

window.addEventListener("resize", () => {
  fecharMenuRadial();
  fecharMenuGrupoCriacaoRapida();

  if (
    painel.classList.contains(
      "altura-personalizada"
    )
  ) {
    definirAlturaPainel(
      painel.getBoundingClientRect()
        .height,
      false
    );
  }
});

painel.addEventListener(
  "click",
  e =>
    e.stopPropagation()
);

modoVisualizacao.addEventListener(
  "click",
  () => {
    definirBarraCriacaoRapidaAberta(false);
    setModo(
      "visualizacao"
    );
  }
);

modoEdicao.addEventListener(
  "click",
  () =>
    setModo(
      "edicao"
    )
);


/* =========================================================
   AÇÕES CONTEXTUAIS DE EDIÇÃO
   ========================================================= */

salvarRail.addEventListener(
  "click",
  () => {
    if (
      !modalCategoria.hidden
    ) {
      formCategoria.requestSubmit();

      return;
    }

    if (
      editor.ativo
    ) {
      formObjeto.requestSubmit();

      return;
    }

    avisar(
      "Não há alterações para salvar."
    );
  }
);

apagarRail.addEventListener(
  "click",
  async () => {
    if (
      !modalCategoria.hidden &&
      ui.inspectorTab ===
        "criacao" &&
      ui.categoriaEditandoId
    ) {
      await excluirCategoriaAtual();

      return;
    }

    if (
      editor.ativo &&
      editor.verticeSelecionado !==
        null
    ) {
      removerVerticeSelecionadoAtual();
      atualizarAcoesRail();

      return;
    }
  }
);

cancelarRail.addEventListener(
  "click",
  () => {
    if (
      !modalCategoria.hidden
    ) {
      fecharModalCategoria();
      return;
    }

    if (editor.ativo) {
      cancelarEdicaoObjeto();
    }
  }
);

criarPrimeiraCategoria.addEventListener(
  "click",
  () => {
    abrirModalCategoria();
  }
);

criarMapaDestinoPortal.addEventListener(
  "click",
  () => {
    arquivoNovoMapaPortal.click();
  }
);

arquivoNovoMapaPortal.addEventListener(
  "change",
  async () => {
    const file =
      arquivoNovoMapaPortal.files[0];

    arquivoNovoMapaPortal.value =
      "";

    if (!file) {
      return;
    }

    const nome =
      await solicitarTextoSistema(
        "Novo mapa de destino",
        "Defina o nome do mapa que receberá o Portal.",
        file.name.replace(
          /\.[^.]+$/,
          ""
        ),
        {
          rotuloCampo: "Nome do mapa",
          rotuloConfirmar: "Criar mapa"
        }
      );

    if (!nome) {
      return;
    }

    try {
      await criarMapaDestinoSemTrocar(
        nome.trim(),
        file
      );
    } catch (erro) {
      avisar(
        erro.message
      );
    }
  }
);

portalMapaDestino.addEventListener(
  "change",
  () => {
    atualizarAreasDestinoPortal(
      portalMapaDestino.value
    );
  }
);

fecharCategoria.addEventListener(
  "click",
  fecharModalCategoria
);

modalCategoria.addEventListener(
  "click",
  e => {
    if (
      e.target ===
      modalCategoria
    ) {
      fecharModalCategoria();
    }
  }
);

criarRamificacao.addEventListener(
  "click",
  iniciarRamificacao
);

finalizarRamificacao.addEventListener(
  "click",
  concluirRamificacaoEditor
);

geometriaCategoria.addEventListener(
  "change",
  () => {
    atualizarCamposGeometria();
    aplicarPreviewTipo();
  }
);

document.getElementById("representacaoConexao").addEventListener("change", () => {
  atualizarCamposGeometria();
  aplicarPreviewTipo();
});

comportamentoCategoria.addEventListener(
  "change",
  atualizarCamposGeometria
);

comportamentoLinhaCategoria.addEventListener(
  "change",
  atualizarCamposGeometria
);

larguraLinha.addEventListener(
  "input",
  aplicarPreviewTipo
);

estiloLinha.addEventListener(
  "change",
  aplicarPreviewTipo
);

extremidadeLinha.addEventListener(
  "change",
  aplicarPreviewTipo
);

opacidadeLinha.addEventListener(
  "input",
  () => {
    valorOpacidade.textContent =
      opacidadeLinha.value +
      "%";

    aplicarPreviewTipo();
  }
);

areaOpacidade.addEventListener(
  "input",
  () => {
    valorOpacidadeArea.textContent =
      areaOpacidade.value +
      "%";

    aplicarPreviewTipo();
  }
);

tamanhoFonte.addEventListener(
  "input",
  aplicarPreviewTipo
);

corHex.addEventListener(
  "input",
  () => {
    const valor =
      corHex.value.trim();

    if (
      /^#[0-9a-fA-F]{6}$/.test(
        valor
      )
    ) {
      ui.corCategoria =
        valor.toUpperCase();

      atualizarSelecaoCor();
      atualizarSelecaoIcone();
      aplicarPreviewTipo();
    }
  }
);

formCategoria.addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    try {
      await salvarCategoriaForm();
    } catch (erro) {
      avisar(
        erro.message
      );
    }
  }
);

editarObjeto.addEventListener(
  "click",
  editarObjetoSelecionado
);

editarCategoriaObjeto?.addEventListener(
  "click",
  () => {
    const obj =
      objetoPorId(
        ui.objetoSelecionadoId
      );

    const cat =
      categoriaPorId(
        obj?.categoriaId
      );

    if (!obj || !cat) {
      avisar("Não foi possível localizar o Tipo deste objeto.");
      return;
    }

    abrirModalCategoria(
      cat,
      "objeto"
    );
  }
);

removerObjeto.addEventListener(
  "click",
  removerObjetoSelecionado
);

removerVertice.addEventListener(
  "click",
  removerVerticeSelecionadoAtual
);

function estadoGeometriaParaRefazer() {
  return {
    pontos: clone(editor.pontos || []),
    label: clone(editor.label),
    aguardandoLabel: !!editor.aguardandoLabel
  };
}

function restaurarEstadoGeometria(estado) {
  if (!estado) return false;

  editor.pontos = clone(estado.pontos || []);
  editor.label = clone(estado.label);
  editor.aguardandoLabel = !!estado.aguardandoLabel;
  editor.verticeSelecionado = null;
  editor.ramoSelecionado = null;

  atualizarSelecaoVerticeUI();
  atualizarPreview();
  atualizarAcoesRail();
  atualizarCursorCriacao();

  return true;
}

function desfazerUltimoPontoGeometria() {
  const cat =
    categoriaPorId(
      editor.categoriaId
    );

  if (
    !editor.ativo ||
    !cat ||
    !editor.pontos?.length ||
    (
      geometriaEfetiva(cat) === "linha" &&
      cat.comportamentoLinha === "relacao"
    )
  ) {
    return false;
  }

  editor.historicoRefazer =
    Array.isArray(editor.historicoRefazer)
      ? editor.historicoRefazer
      : [];

  editor.historicoRefazer.push(
    estadoGeometriaParaRefazer()
  );

  if (
    geometriaEfetiva(cat) ===
      "area" &&
    editor.label
  ) {
    editor.label =
      null;

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

    editor.aguardandoLabel =
      true;

    status.textContent =
      "Clique no mapa para reposicionar o nome.";

    atualizarAcoesRail();
    return true;
  }

  editor.pontos.pop();

  editor.verticeSelecionado =
    null;

  atualizarSelecaoVerticeUI();
  atualizarPreview();
  atualizarAcoesRail();
  atualizarCursorCriacao();

  return true;
}

function refazerUltimoPontoGeometria() {
  if (
    !editor.ativo ||
    !Array.isArray(editor.historicoRefazer) ||
    !editor.historicoRefazer.length
  ) {
    return false;
  }

  const estado = editor.historicoRefazer.pop();
  const restaurado = restaurarEstadoGeometria(estado);

  if (restaurado) {
    status.textContent = "Último ponto restaurado.";
  }

  return restaurado;
}

function geometriaLocalPodeUsarHistorico() {
  const categoria =
    categoriaPorId(
      editor.categoriaId
    );

  return !(
    geometriaEfetiva(categoria) === "linha" &&
    categoria?.comportamentoLinha ===
      "relacao"
  );
}

function desfazerGeometriaSeAplicavel() {
  return (
    geometriaLocalPodeUsarHistorico() &&
    desfazerUltimoPontoGeometria()
  );
}

function refazerGeometriaSeAplicavel() {
  return (
    geometriaLocalPodeUsarHistorico() &&
    refazerUltimoPontoGeometria()
  );
}

nomeObjeto.addEventListener(
  "input",
  () => {
    const cat =
      categoriaPorId(
        editor.categoriaId
      );

    if (
      geometriaEfetiva(cat) ===
        "area"
    ) {
      atualizarPreviewRotulo();
    }
  }
);

formObjeto.addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    try {
      await salvarObjetoAtual();
    } catch (erro) {
      avisar(
        erro.message
      );
    }
  }
);

importarPlanilha.addEventListener(
  "click",
  () => {
    if (
      typeof XLSX ===
      "undefined"
    ) {
      avisar(
        "A biblioteca de planilhas não foi carregada. Verifique a conexão com a internet."
      );
      return;
    }

    importador.modo =
      "novo";
    importador.fonteId =
      null;
    arquivoPlanilha.click();
  }
);

arquivoPlanilha.addEventListener(
  "change",
  () => {
    const file =
      arquivoPlanilha.files[0];

    arquivoPlanilha.value =
      "";

    if (!file) {
      return;
    }

    if (
      typeof XLSX ===
      "undefined"
    ) {
      avisar(
        "A biblioteca de planilhas não foi carregada."
      );
      return;
    }

    const reader =
      new FileReader();

    reader.onload =
      () => {
        try {
          importador.workbook =
            XLSX.read(
              reader.result,
              {
                type: "array"
              }
            );

          importador.arquivoNome =
            file.name;

          abrirModalFonteNovo();
        } catch (erro) {
          avisar(
            "Não foi possível ler a planilha: " +
            erro.message
          );
        }
      };

    reader.readAsArrayBuffer(
      file
    );
  }
);

abaFonteDados.addEventListener(
  "change",
  () => {
    const antiga =
      importador.modo ===
      "atualizar"
        ? fontePorId(
            importador.fonteId
          )
        : null;

    atualizarAbaImportacao(
      antiga
    );
  }
);

fecharFonteDados.addEventListener(
  "click",
  fecharModalFonteDados
);

cancelarFonteDados.addEventListener(
  "click",
  fecharModalFonteDados
);

modalFonteDados.addEventListener(
  "click",
  e => {
    if (
      e.target ===
      modalFonteDados
    ) {
      fecharModalFonteDados();
    }
  }
);

formFonteDados.addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    try {
      await salvarFonteDadosForm();
    } catch (erro) {
      avisar(
        erro.message
      );
    }
  }
);

fonteObjeto.addEventListener(
  "change",
  () => {
    atualizarRegistrosObjeto();
    editor.entityFieldColumns =
      null;
    renderCamposReferenciaObjeto();
  }
);

registroObjeto.addEventListener(
  "change",
  () => {
    if (
      !editor.editandoId &&
      registroObjeto.value
    ) {
      const titulo =
        tituloRegistro({
          sourceId:
            fonteObjeto.value,
          recordId:
            registroObjeto.value
        });

      if (titulo) {
        nomeObjeto.value =
          titulo;
      }
    }
  }
);

fonteRelacao.addEventListener(
  "change",
  () => {
    atualizarRegistrosRelacao();
    renderCamposRelacaoObjeto();
  }
);

adicionarRelacao.addEventListener(
  "click",
  adicionarRelacaoAtual
);

/* =========================================================
   PESQUISA GLOBAL DE OBJETOS — CTRL + F
   ========================================================= */

let indiceBuscaObjetos = [];
let resultadosAtuaisBuscaObjetos = [];
let indiceAtivoBuscaObjetos = -1;
let focoAntesDaBuscaObjetos = null;
let versaoCarregamentoBuscaObjetos = 0;

function normalizarTextoBuscaObjetos(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function textoDadosObjetoParaBusca(mapaOrigem, obj) {
  const referencias = [
    obj.entityRef,
    ...(Array.isArray(obj.relacoes) ? obj.relacoes : [])
      .map(relacao => relacao?.entityRef)
  ].filter(Boolean);

  const valores = [];

  for (const ref of referencias) {
    const fonte = (mapaOrigem.fontesDados || []).find(
      item => item.id === ref.sourceId
    );
    const registro = fonte?.records?.find(
      item => String(item.id) === String(ref.recordId)
    );

    if (fonte?.nome) valores.push(fonte.nome);
    if (registro?.values) valores.push(...Object.values(registro.values));
  }

  return valores.join(" ");
}

async function montarIndiceBuscaObjetos() {
  const mapasDoProjeto = await dbTodos();
  const itens = [];

  for (const mapaOrigem of mapasDoProjeto) {
    for (const obj of mapaOrigem.objetos || []) {
      const cat = (mapaOrigem.categorias || []).find(
        item => item.id === obj.categoriaId
      );
      const titulo = tituloObjetoEmMapa(mapaOrigem, obj) || "Sem nome";
      const tipo = cat?.nome || "Tipo não encontrado";
      const mapaNome = mapaOrigem.nome || "Mapa sem nome";
      const texto = [
        titulo,
        obj.nome,
        obj.descricao,
        tipo,
        mapaNome,
        textoDadosObjetoParaBusca(mapaOrigem, obj)
      ].join(" ");

      itens.push({
        mapaId: mapaOrigem.id,
        mapaNome,
        objetoId: obj.id,
        titulo,
        tipo,
        icone: cat?.icone || "pin",
        cor: /^#[0-9a-f]{6}$/i.test(cat?.cor || "")
          ? cat.cor
          : "#8CA2AD",
        tituloNormalizado: normalizarTextoBuscaObjetos(titulo),
        tipoNormalizado: normalizarTextoBuscaObjetos(tipo),
        mapaNormalizado: normalizarTextoBuscaObjetos(mapaNome),
        textoNormalizado: normalizarTextoBuscaObjetos(texto)
      });
    }
  }

  return itens.sort((a, b) =>
    a.titulo.localeCompare(b.titulo, "pt-BR") ||
    a.mapaNome.localeCompare(b.mapaNome, "pt-BR")
  );
}

function pontuacaoResultadoBuscaObjetos(item, termo) {
  if (!termo) return 0;
  if (item.tituloNormalizado === termo) return 0;
  if (item.tituloNormalizado.startsWith(termo)) return 1;
  if (item.tituloNormalizado.includes(termo)) return 2;
  if (item.tipoNormalizado.startsWith(termo)) return 3;
  if (item.mapaNormalizado.startsWith(termo)) return 4;
  return 5;
}

function definirResultadoAtivoBuscaObjetos(indice, focar = false) {
  const botoes = [
    ...resultadosBuscaObjetos.querySelectorAll(".object-search-result")
  ];

  if (!botoes.length) {
    indiceAtivoBuscaObjetos = -1;
    buscaObjetosInput.removeAttribute("aria-activedescendant");
    return;
  }

  indiceAtivoBuscaObjetos =
    (indice + botoes.length) % botoes.length;

  botoes.forEach((botao, posicao) => {
    const ativo = posicao === indiceAtivoBuscaObjetos;
    botao.classList.toggle("ativo", ativo);
    botao.setAttribute("aria-selected", String(ativo));
  });

  const atual = botoes[indiceAtivoBuscaObjetos];
  buscaObjetosInput.setAttribute("aria-activedescendant", atual.id);
  atual.scrollIntoView({ block: "nearest" });
  if (focar) atual.focus();
}

function renderResultadosBuscaObjetos() {
  const termo = normalizarTextoBuscaObjetos(buscaObjetosInput.value);
  const limite = 40;

  resultadosAtuaisBuscaObjetos = indiceBuscaObjetos
    .filter(item => !termo || item.textoNormalizado.includes(termo))
    .sort((a, b) =>
      pontuacaoResultadoBuscaObjetos(a, termo) -
        pontuacaoResultadoBuscaObjetos(b, termo) ||
      a.titulo.localeCompare(b.titulo, "pt-BR")
    )
    .slice(0, limite);

  resultadosBuscaObjetos.innerHTML = "";

  resultadosAtuaisBuscaObjetos.forEach((item, indice) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.id = `resultado-busca-objeto-${indice}`;
    botao.className = "object-search-result";
    botao.dataset.indice = String(indice);
    botao.setAttribute("role", "option");
    botao.setAttribute("aria-selected", "false");
    botao.innerHTML =
      '<span class="object-search-result-icon" style="color:' +
        esc(item.cor) +
      '">' +
        iconeSvg(item.icone) +
      "</span>" +
      '<span class="object-search-result-main">' +
        '<strong class="object-search-result-title">' +
          esc(item.titulo) +
        "</strong>" +
        '<small class="object-search-result-meta">' +
          esc(item.tipo) +
        "</small>" +
      "</span>" +
      '<span class="object-search-result-map" title="' +
        esc(item.mapaNome) +
      '">' +
        esc(item.mapaNome) +
      "</span>";

    resultadosBuscaObjetos.appendChild(botao);
  });

  const encontrou = resultadosAtuaisBuscaObjetos.length > 0;
  estadoBuscaObjetos.hidden = encontrou;
  estadoBuscaObjetos.textContent = indiceBuscaObjetos.length
    ? "Nenhum objeto corresponde à pesquisa."
    : "Nenhum objeto foi criado no projeto ainda.";

  definirResultadoAtivoBuscaObjetos(encontrou ? 0 : -1);
}

function fecharPesquisaObjetos(restaurarFoco = true) {
  if (buscaObjetosOverlay.hidden) return;

  buscaObjetosOverlay.hidden = true;
  buscaObjetosInput.setAttribute("aria-expanded", "false");
  versaoCarregamentoBuscaObjetos++;

  if (
    restaurarFoco &&
    focoAntesDaBuscaObjetos instanceof HTMLElement &&
    focoAntesDaBuscaObjetos.isConnected
  ) {
    focoAntesDaBuscaObjetos.focus();
  }
}

async function abrirPesquisaObjetos() {
  if (!buscaObjetosOverlay.hidden) {
    buscaObjetosInput.focus();
    buscaObjetosInput.select();
    return;
  }

  definirMenuPrincipalAberto(false);
  definirListaMapasAberta(false);
  focoAntesDaBuscaObjetos = document.activeElement;
  buscaObjetosOverlay.hidden = false;
  buscaObjetosInput.setAttribute("aria-expanded", "true");
  buscaObjetosInput.value = "";
  resultadosBuscaObjetos.innerHTML = "";
  estadoBuscaObjetos.hidden = false;
  estadoBuscaObjetos.textContent = "Carregando objetos...";

  requestAnimationFrame(() => buscaObjetosInput.focus());

  const versao = ++versaoCarregamentoBuscaObjetos;

  try {
    const novoIndice = await montarIndiceBuscaObjetos();
    if (versao !== versaoCarregamentoBuscaObjetos) return;

    indiceBuscaObjetos = novoIndice;
    renderResultadosBuscaObjetos();
  } catch (erro) {
    if (versao !== versaoCarregamentoBuscaObjetos) return;

    indiceBuscaObjetos = [];
    resultadosAtuaisBuscaObjetos = [];
    resultadosBuscaObjetos.innerHTML = "";
    estadoBuscaObjetos.hidden = false;
    estadoBuscaObjetos.textContent = "Não foi possível carregar os objetos.";
  }
}

async function abrirResultadoBuscaObjetos(indice) {
  const item = resultadosAtuaisBuscaObjetos[indice];
  if (!item) return;

  if (editor.ativo || !modalCategoria.hidden || !modalFonteDados.hidden) {
    fecharPesquisaObjetos(false);
    avisar("Salve ou cancele a edição atual antes de localizar outro objeto.");
    return;
  }

  fecharPesquisaObjetos(false);

  if (mapaAtual?.id !== item.mapaId) {
    await abrirMapa(item.mapaId);
  }

  if (!mapaAtual || mapaAtual.id !== item.mapaId || !objetoPorId(item.objetoId)) {
    avisar("O objeto pesquisado não está mais disponível.");
    return;
  }

  setModo("visualizacao");
  definirPainelAberto(false);
  focarObjetoNoMapa(item.objetoId);
  avisar(`${item.titulo} · ${item.mapaNome}`);
}

pesquisarObjetos?.addEventListener(
  "click",
  () => {
    if (
      document.body.classList.contains(
        "projects-visible"
      )
    ) {
      focarBuscaProjetos();
      return;
    }

    abrirPesquisaObjetos();
  }
);
fecharBuscaObjetos?.addEventListener("click", () => fecharPesquisaObjetos());

buscaObjetosOverlay?.addEventListener("pointerdown", evento => {
  if (evento.target === buscaObjetosOverlay) fecharPesquisaObjetos();
});

buscaObjetosInput?.addEventListener("input", renderResultadosBuscaObjetos);

buscaObjetosInput?.addEventListener("keydown", evento => {
  if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
    evento.preventDefault();
    definirResultadoAtivoBuscaObjetos(
      indiceAtivoBuscaObjetos + (evento.key === "ArrowDown" ? 1 : -1)
    );
    return;
  }

  if (evento.key === "Enter") {
    evento.preventDefault();
    abrirResultadoBuscaObjetos(
      indiceAtivoBuscaObjetos >= 0 ? indiceAtivoBuscaObjetos : 0
    );
  }
});

resultadosBuscaObjetos?.addEventListener("pointermove", evento => {
  const opcao = evento.target.closest(".object-search-result");
  if (!opcao) return;
  definirResultadoAtivoBuscaObjetos(Number(opcao.dataset.indice));
});

resultadosBuscaObjetos?.addEventListener("click", evento => {
  const opcao = evento.target.closest(".object-search-result");
  if (!opcao) return;
  abrirResultadoBuscaObjetos(Number(opcao.dataset.indice));
});

function acionarFerramentaPorAtalho(acao) {
  if (!mapaAtual) {
    if (acao === "criacao" && projetoAtual) {
      abrirSeletorNovoMapa();
      return;
    }

    avisar("Crie ou importe um mapa para acessar as ferramentas.");
    return;
  }

  menuRadialMapa
    ?.querySelector(`[data-radial-action="${acao}"]`)
    ?.click();
}

function abrirSeletorNovoMapa() {
  if (
    !projetoAtual ||
    document.body.classList.contains("projects-visible") ||
    document.querySelector(".system-dialog[open]")
  ) {
    return false;
  }

  arquivoNovoMapa.click();
  return true;
}

/* Um novo gesto encerra o agrupamento da ação anterior. Salvamentos
   encadeados sem outro gesto (como os dois lados de um Portal) continuam
   formando uma única entrada no histórico. */
document.addEventListener(
  "pointerdown",
  () => {
    finalizarHistoricoGlobalPendente();
  },
  true
);

document.addEventListener(
  "keydown",
  async evento => {
    const tecla = evento.key.toLocaleLowerCase("pt-BR");
    const modificadorComando =
      (evento.ctrlKey || evento.metaKey) &&
      !evento.altKey &&
      !evento.shiftKey;
    const comandoDesfazer =
      modificadorComando &&
      tecla === "z";
    const comandoRefazer =
      (evento.ctrlKey || evento.metaKey) &&
      !evento.altKey &&
      (
        tecla === "y" ||
        (
          tecla === "z" &&
          evento.shiftKey
        )
      );
    const atalhoPesquisa =
      modificadorComando &&
      tecla === "f";
    const atalhoPrimeiroMapa =
      modificadorComando &&
      tecla === "a" &&
      !mapaAtual &&
      Boolean(projetoAtual) &&
      !document.body.classList.contains("projects-visible") &&
      !document.querySelector(".system-dialog[open]");

    /* No projeto vazio, Ctrl + A precisa funcionar mesmo quando a busca
       de mapas ainda está focada. Em formulários e diálogos, o atalho
       continua reservado para selecionar o texto. */
    if (atalhoPrimeiroMapa) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      abrirSeletorNovoMapa();
      return;
    }

    if (atalhoPesquisa) {
      evento.preventDefault();
      evento.stopImmediatePropagation();

      if (
        document.body.classList.contains(
          "projects-visible"
        )
      ) {
        focarBuscaProjetos();
        return;
      }

      abrirPesquisaObjetos();
      return;
    }

    const alvo = evento.target;
    const digitando =
      alvo instanceof HTMLElement &&
      (
        alvo.matches("input, textarea, select") ||
        alvo.isContentEditable
      );

    if (
      (comandoDesfazer || comandoRefazer) &&
      !digitando &&
      !document.querySelector(".system-dialog[open]")
    ) {
      evento.preventDefault();
      evento.stopImmediatePropagation();

      if (comandoDesfazer) {
        if (!desfazerGeometriaSeAplicavel()) {
          await desfazerHistoricoGlobal();
        }
      } else if (!refazerGeometriaSeAplicavel()) {
        await refazerHistoricoGlobal();
      }

      return;
    }

    if (modificadorComando) {

      /* Ctrl + S salva inclusive durante o preenchimento do formulário.
         Os demais atalhos preservam a edição normal de texto. */
      if (tecla === "s" || !digitando) {
        const acoes = {
          a: "criacao",
          d: "dados",
          q: "camadas",
          e: "edicao",
          l: "legenda"
        };

        if (tecla === "s") {
          evento.preventDefault();
          evento.stopImmediatePropagation();
          try {
            await salvarProjetoAtual();
          } catch (erro) {
            avisar(
              erro.message ||
              "Não foi possível salvar o projeto."
            );
          }
          return;
        }

        if (acoes[tecla]) {
          evento.preventDefault();
          evento.stopImmediatePropagation();
          acionarFerramentaPorAtalho(acoes[tecla]);
          return;
        }
      }
    }

    if (evento.key === "Escape" && !buscaObjetosOverlay.hidden) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      fecharPesquisaObjetos();
    }
  },
  true
);

novoMapa.addEventListener(
  "click",
  abrirSeletorNovoMapa
);

estadoMapaVazio?.addEventListener(
  "click",
  abrirSeletorNovoMapa
);

arquivoNovoMapa.addEventListener(
  "change",
  async () => {
    const file =
      arquivoNovoMapa.files[0];

    arquivoNovoMapa.value =
      "";

    if (!file) {
      return;
    }

    const nome =
      await solicitarTextoSistema(
        "Criar mapa",
        "Escolha um nome para o mapa importado.",
        file.name.replace(
          /\.[^.]+$/,
          ""
        ),
        {
          rotuloCampo: "Nome do mapa",
          rotuloConfirmar: "Criar mapa"
        }
      );

    if (!nome) {
      return;
    }

    try {
      await criarNovoMapa(
        nome.trim(),
        file
      );
    } catch (erro) {
      avisar(
        erro.message
      );
    }
  }
);

seletorMapa.addEventListener(
  "change",
  async () => {
    await abrirMapa(
      seletorMapa.value
    );
  }
);

if (buscaMapa) {
  buscaMapa.addEventListener(
    "input",
    filtrarListaMapas
  );

  buscaMapa.addEventListener(
    "keydown",
    e => {
      if (e.key === "Escape") {
        definirListaMapasAberta(false);
        buscaMapa.value = mapaAtual?.nome || "";
        buscaMapa.blur();
        return;
      }

      if (
        e.key ===
        "Enter"
      ) {
        e.preventDefault();

        selecionarMapaPelaBusca();
      }
    }
  );

  buscaMapa.addEventListener(
    "focus",
    () => buscaMapa.select()
  );
}

abrirListaMapas?.addEventListener("click", () => {
  const estavaAberta = !listaMapasBusca.hidden;

  if (estavaAberta) {
    definirListaMapasAberta(false);
    return;
  }

  for (const opcao of listaMapasBusca.querySelectorAll(".map-search-option")) {
    opcao.hidden = false;
  }

  definirListaMapasAberta(true);
  buscaMapa.focus();
});

listaMapasBusca?.addEventListener("click", async e => {
  const opcao = e.target.closest(".map-search-option");
  if (!opcao) return;

  definirListaMapasAberta(false);
  await abrirMapa(opcao.dataset.mapaId);
});

/* Mantém o foco no campo até o clique escolher a opção. */
listaMapasBusca?.addEventListener("pointerdown", e => e.preventDefault());

document.addEventListener("pointerdown", e => {
  if (!e.target.closest(".map-search-wrap")) {
    definirListaMapasAberta(false);
  }
});

renomearMapa.addEventListener(
  "click",
  async () => {
    if (!mapaAtual) {
      return;
    }

    const nome =
      await solicitarTextoSistema(
        "Renomear mapa",
        "Informe o novo nome do mapa.",
        mapaAtual.nome,
        {
          rotuloCampo: "Novo nome",
          rotuloConfirmar: "Renomear"
        }
      );

    if (!nome) {
      return;
    }

    mapaAtual.nome =
      nome.trim();

    await dbSalvar(
      mapaAtual
    );

    await atualizarSeletorMapas();

    avisar(
      "Mapa renomeado."
    );
  }
);

excluirMapa.addEventListener(
  "click",
  async () => {
    if (!mapaAtual) {
      return;
    }

    if (
      !await confirmarSistema(
        "Excluir mapa",
        'Excluir o mapa "' +
        mapaAtual.nome +
        '" e todo o conteúdo dele?',
        {
          rotuloConfirmar: "Excluir mapa",
          perigo: true
        }
      )
    ) {
      return;
    }

    await dbExcluir(
      mapaAtual.id
    );

    const mapas =
      await dbListarResumosMapas();

    mapaAtual =
      null;

    if (
      mapas.length
    ) {
      await abrirMapa(
        mapas[0].id
      );
    } else {
      mostrarTelaSemMapa();
      await atualizarSeletorMapas();
    }

    avisar(
      "Mapa excluído."
    );
  }
);

exportarMapa.addEventListener(
  "click",
  async () => {
    try {
      await exportarBackupAtual();
    } catch (erro) {
      avisar(
        erro.message ||
        "Não foi possível exportar o projeto."
      );
    }
  }
);

salvarProjeto?.addEventListener(
  "click",
  async () => {
    try {
      await salvarProjetoAtual();
    } catch (erro) {
      avisar(
        erro.message ||
        "Não foi possível salvar o projeto."
      );
    }
  }
);

importarMapa.addEventListener(
  "click",
  () => {
    arquivoImportar.click();
  }
);

arquivoImportar.addEventListener(
  "change",
  async () => {
    const file =
      arquivoImportar.files[0];

    arquivoImportar.value =
      "";

    if (file) {
      await importarBackupArquivo(
        file
      );
    }
  }
);

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function iniciar() {
  montarBibliotecaIcones();
  montarPaletaCores();
  montarLayoutInspector();

  db =
    await abrirBanco();

  await garantirEstruturaProjetos();
  await recuperarEmergencias();
  await restaurarTelaInicial();

  atualizarCategoriasUI();
  atualizarFontesDadosUI();
  atualizarLegenda();
  atualizarSelecaoVerticeUI();
  atualizarAcoesRail();
  document.body.dataset.atlasReady = "true";
}

document.getElementById("verificarVinculos").addEventListener("click", () => {
  definirMenuPrincipalAberto(false);
  mostrarVerificacaoVinculos().catch(erro => avisar(erro.message));
});

iniciar()
  .catch(
    erro => {
      console.error(
        erro
      );

      avisar(
        "Erro ao iniciar: " +
        erro.message
      );
    }
  );
