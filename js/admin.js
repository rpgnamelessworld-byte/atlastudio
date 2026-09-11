/* Administração local de usuários e políticas.
   Lê mapas do banco principal e grava os cadastros em um banco separado.
   As políticas cadastradas não são aplicadas aos comandos do editor. */

(function iniciarModuloAdministrativo() {
  "use strict";

  const ATLAS_DB_NAME = "nameless-world-map-editor";
  const ATLAS_STORE_MAPS = "mapas";
  const ATLAS_STORE_PROJECTS = "projetos";
  const ADMIN_DB_NAME = "atlas-studio-administracao";
  const ADMIN_DB_VERSION = 1;
  const ADMIN_STORE = "configuracoes";
  const ADMIN_STATE_ID = "estado-principal";

  const PERMISSION_GROUPS = [
    {
      title: "Modos de trabalho",
      items: ["modoEdicao", "modoVisualizacao"]
    },
    {
      title: "Ações no mapa",
      items: [
        "criarMapa",
        "renomearMapa",
        "excluirMapa",
        "exportarBackup",
        "importarBackup",
        "alternarTema"
      ]
    },
    {
      title: "Painéis e ferramentas",
      items: [
        "painelCamadas",
        "painelCriacao",
        "painelDados",
        "ferramentaCoordenadas",
        "painelLegenda",
        "editarTipos"
      ]
    },
    {
      title: "Fontes e Portais",
      items: ["gerenciarFontes", "portaisEntreMapas"]
    }
  ];

  const PERMISSION_LABELS = {
    modoEdicao: "Modo Edição",
    modoVisualizacao: "Modo Visualização",
    criarMapa: "Criar mapa",
    renomearMapa: "Renomear mapa",
    excluirMapa: "Excluir mapa",
    exportarBackup: "Exportar backup",
    importarBackup: "Importar backup",
    alternarTema: "Alternar tema",
    painelCamadas: "Painel de Camadas",
    painelCriacao: "Painel de Criação",
    painelDados: "Painel de Dados",
    ferramentaCoordenadas: "Ferramenta de coordenadas",
    painelLegenda: "Painel de Legenda",
    editarTipos: "Editar Tipos de marcação",
    gerenciarFontes: "Gerenciar Fontes de dados",
    portaisEntreMapas: "Portais entre mapas"
  };

  const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);

  const PROFILE_PRESETS = {
    editor: criarPermissoes([
      "modoEdicao",
      "modoVisualizacao",
      "criarMapa",
      "renomearMapa",
      "exportarBackup",
      "alternarTema",
      "painelCamadas",
      "painelCriacao",
      "painelDados",
      "ferramentaCoordenadas",
      "painelLegenda",
      "editarTipos",
      "gerenciarFontes",
      "portaisEntreMapas"
    ]),
    visualizador: criarPermissoes([
      "modoVisualizacao",
      "painelCamadas",
      "ferramentaCoordenadas",
      "painelLegenda"
    ]),
    restrito: criarPermissoes(["modoVisualizacao"])
  };

  const MAP_ICON = `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z"></path>
      <path d="M9 4v14M15 6v14"></path>
    </svg>
  `;

  const CHEVRON_ICON = `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m9 6 6 6-6 6"></path>
    </svg>
  `;

  const dom = {};
  const projetoFiltroId = new URLSearchParams(window.location.search).get("project");
  let mapas = [];
  let mapasGlobais = [];
  let projetoContexto = null;
  let estado = null;
  let bancoAdmin = null;
  let abaAtual = "permissions";
  let buscaUsuario = "";
  let alteracoesPendentes = false;
  let carregando = false;
  let toastTimer = null;
  const gruposAbertos = new Set();

  function criarPermissoes(ativas) {
    const conjunto = new Set(ativas);
    return ALL_PERMISSION_KEYS.reduce((resultado, chave) => {
      resultado[chave] = conjunto.has(chave);
      return resultado;
    }, {});
  }

  function clone(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function escapar(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function gerarId(prefixo = "local") {
    if (globalThis.crypto?.randomUUID) {
      return `${prefixo}-${crypto.randomUUID()}`;
    }

    return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function iniciais(nome) {
    return String(nome || "Usuário")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(parte => parte[0])
      .join("")
      .toUpperCase();
  }

  function nomePerfil(perfil) {
    if (perfil === "editor") return "Editor";
    if (perfil === "visualizador") return "Visualizador";
    return "Restrito";
  }

  function geometriaNome(geometria) {
    if (geometria === "conexao") return "Conexão";
    if (geometria === "linha") return "Linha";
    if (geometria === "area") return "Área";
    return "Ponto";
  }

  function chaveObjeto(objeto, indice) {
    return String(objeto?.id || `objeto-${indice + 1}`);
  }

  function tituloObjeto(objeto, indice) {
    const nome = String(objeto?.nome || "").trim();
    return nome || `Objeto ${indice + 1}`;
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function abrirBancoAtlas() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ATLAS_DB_NAME);

      request.onupgradeneeded = () => {
        const banco = request.result;
        if (!banco.objectStoreNames.contains(ATLAS_STORE_MAPS)) {
          banco.createObjectStore(ATLAS_STORE_MAPS, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function abrirBancoAdmin() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ADMIN_DB_NAME, ADMIN_DB_VERSION);

      request.onupgradeneeded = () => {
        const banco = request.result;
        if (!banco.objectStoreNames.contains(ADMIN_STORE)) {
          banco.createObjectStore(ADMIN_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function carregarMapasAtlas() {
    const banco = await abrirBancoAtlas();

    try {
      return await new Promise((resolve, reject) => {
        const resultado = [];
        const transaction = banco.transaction(ATLAS_STORE_MAPS, "readonly");
        const store = transaction.objectStore(ATLAS_STORE_MAPS);
        const request = store.openCursor();

        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;

          const mapa = cursor.value || {};
          resultado.push({
            id: String(mapa.id || cursor.key),
            nome: String(mapa.nome || "Mapa sem nome"),
            projectId: String(mapa.projectId || ""),
            atualizadoEm: mapa.atualizadoEm || null,
            categorias: Array.isArray(mapa.categorias) ? clone(mapa.categorias) : [],
            objetos: Array.isArray(mapa.objetos) ? clone(mapa.objetos) : []
          });

          cursor.continue();
        };

        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => {
          resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
          resolve(resultado);
        };
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      banco.close();
    }
  }

  async function carregarProjetoContexto() {
    if (!projetoFiltroId) return null;

    const banco = await abrirBancoAtlas();

    try {
      if (!banco.objectStoreNames.contains(ATLAS_STORE_PROJECTS)) {
        return { id: projetoFiltroId, nome: "Projeto selecionado" };
      }

      const transaction = banco.transaction(ATLAS_STORE_PROJECTS, "readonly");
      const projeto = await requestPromise(
        transaction.objectStore(ATLAS_STORE_PROJECTS).get(projetoFiltroId)
      );

      return projeto || { id: projetoFiltroId, nome: "Projeto selecionado" };
    } finally {
      banco.close();
    }
  }

  async function lerEstadoAdmin() {
    const transaction = bancoAdmin.transaction(ADMIN_STORE, "readonly");
    return requestPromise(transaction.objectStore(ADMIN_STORE).get(ADMIN_STATE_ID));
  }

  async function gravarEstadoAdmin() {
    const pacote = {
      ...clone(estado),
      id: ADMIN_STATE_ID,
      schemaVersion: 1,
      atualizadoEm: new Date().toISOString()
    };

    const transaction = bancoAdmin.transaction(ADMIN_STORE, "readwrite");
    await requestPromise(transaction.objectStore(ADMIN_STORE).put(pacote));
    estado.atualizadoEm = pacote.atualizadoEm;
  }

  function valorVisibilidadePadrao(perfil) {
    return perfil !== "restrito";
  }

  function criarUsuarioAdministradorLocal() {
    return {
      id: gerarId("administrador"),
      nome: "Administrador local",
      email: "admin.local@atlas",
      perfil: "editor",
      origem: "local",
      proprietario: true,
      status: "configuração provisória",
      permissoes: clone(PROFILE_PRESETS.editor),
      mapas: mapasGlobais.map(mapa => mapa.id),
      visibilidade: {}
    };
  }

  function criarEstadoInicial() {
    const administrador = criarUsuarioAdministradorLocal();
    return {
      id: ADMIN_STATE_ID,
      schemaVersion: 1,
      usuarioAtualId: administrador.id,
      usuarios: [administrador],
      atualizadoEm: null
    };
  }

  function normalizarUsuario(usuario) {
    const perfil = ["editor", "visualizador", "restrito"].includes(usuario?.perfil)
      ? usuario.perfil
      : "restrito";
    const permissoes = {};

    for (const chave of ALL_PERMISSION_KEYS) {
      permissoes[chave] = typeof usuario?.permissoes?.[chave] === "boolean"
        ? usuario.permissoes[chave]
        : PROFILE_PRESETS[perfil][chave];
    }

    return {
      id: String(usuario?.id || gerarId("usuario")),
      nome: String(usuario?.nome || usuario?.name || "Usuário local").trim() || "Usuário local",
      email: String(usuario?.email || "usuario.local@atlas").trim(),
      perfil,
      origem: String(usuario?.origem || "local"),
      proprietario: usuario?.proprietario === true,
      status: String(usuario?.status || "configuração provisória"),
      permissoes,
      mapas: Array.isArray(usuario?.mapas) ? usuario.mapas.map(String) : [],
      visibilidade: usuario?.visibilidade && typeof usuario.visibilidade === "object"
        ? usuario.visibilidade
        : {}
    };
  }

  function reconciliarVisibilidadeUsuario(usuario) {
    const mapasValidos = new Set(mapasGlobais.map(mapa => mapa.id));
    usuario.mapas = [...new Set(usuario.mapas)].filter(id => mapasValidos.has(id));

    const visibilidadeNova = {};

    for (const mapa of mapasGlobais) {
      const anteriorMapa = usuario.visibilidade?.[mapa.id] || {};
      const categorias = {};

      for (const categoria of mapa.categorias) {
        const categoriaId = String(categoria.id || categoria.nome || "tipo");
        const anteriorCategoria = anteriorMapa[categoriaId] || {};
        const objetos = {};
        const objetosCategoria = mapa.objetos.filter(objeto => String(objeto.categoriaId) === categoriaId);

        objetosCategoria.forEach((objeto, indice) => {
          const objetoId = chaveObjeto(objeto, indice);
          objetos[objetoId] = typeof anteriorCategoria[objetoId] === "boolean"
            ? anteriorCategoria[objetoId]
            : valorVisibilidadePadrao(usuario.perfil);
        });

        categorias[categoriaId] = objetos;
      }

      visibilidadeNova[mapa.id] = categorias;
    }

    usuario.visibilidade = visibilidadeNova;
  }

  function normalizarEstado(estadoBruto) {
    const usuariosBrutos = Array.isArray(estadoBruto?.usuarios) && estadoBruto.usuarios.length
      ? estadoBruto.usuarios
      : [criarUsuarioAdministradorLocal()];
    const usuarios = usuariosBrutos.map(normalizarUsuario);

    const mapasConhecidos = new Set(
      Array.isArray(estadoBruto?.mapasConhecidos)
        ? estadoBruto.mapasConhecidos.map(String)
        : usuarios.flatMap(usuario => usuario.mapas)
    );

    const mapasNovos = mapasGlobais
      .map(mapa => mapa.id)
      .filter(id => !mapasConhecidos.has(id));

    /* O administrador principal recebe mapas novos sem reativar os revogados. */
    for (const usuario of usuarios) {
      if (usuario.proprietario && mapasNovos.length) {
        usuario.mapas = [...new Set([...usuario.mapas, ...mapasNovos])];
      }
    }

    for (const usuario of usuarios) {
      reconciliarVisibilidadeUsuario(usuario);
    }

    let usuarioAtualId = String(estadoBruto?.usuarioAtualId || "");
    if (!usuarios.some(usuario => usuario.id === usuarioAtualId)) {
      usuarioAtualId = usuarios[0].id;
    }

    return {
      id: ADMIN_STATE_ID,
      schemaVersion: 1,
      usuarioAtualId,
      usuarios,
      mapasConhecidos: mapasGlobais.map(mapa => mapa.id),
      atualizadoEm: estadoBruto?.atualizadoEm || null
    };
  }

  function usuarioAtual() {
    return estado?.usuarios.find(usuario => usuario.id === estado.usuarioAtualId) || estado?.usuarios[0] || null;
  }

  function mapaPorId(id) {
    return mapasGlobais.find(mapa => mapa.id === id) || null;
  }

  function marcarAlterado(alterado = true) {
    alteracoesPendentes = alterado;
    dom.save.disabled = !alterado || carregando;
    dom.syncState.textContent = alterado
      ? "Alterações administrativas não salvas"
      : `${mapas.length} mapa(s) sincronizado(s) · políticas locais salvas, não aplicadas`;
    dom.syncState.classList.toggle("pending", alterado);
  }

  function mostrarToast(mensagem, tipo = "normal") {
    clearTimeout(toastTimer);
    dom.toast.textContent = mensagem;
    dom.toast.classList.toggle("error", tipo === "erro");
    dom.toast.classList.add("show");
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 2200);
  }

  function renderizarUsuarios() {
    const termo = buscaUsuario.trim().toLocaleLowerCase("pt-BR");
    const usuarios = estado.usuarios.filter(usuario => {
      if (!termo) return true;
      return `${usuario.nome} ${usuario.email}`.toLocaleLowerCase("pt-BR").includes(termo);
    });

    dom.userList.innerHTML = "";
    dom.userCount.textContent = `Usuários locais · ${estado.usuarios.length}`;

    if (!usuarios.length) {
      const vazio = document.createElement("p");
      vazio.className = "admin-empty-users";
      vazio.textContent = "Nenhum usuário corresponde à busca.";
      dom.userList.appendChild(vazio);
      return;
    }

    for (const usuario of usuarios) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `admin-user-item${usuario.id === estado.usuarioAtualId ? " active" : ""}`;
      item.dataset.userId = usuario.id;
      item.innerHTML = `
        <span class="admin-avatar">${escapar(iniciais(usuario.nome))}</span>
        <span class="admin-user-copy">
          <span class="admin-user-name">${escapar(usuario.nome)}</span>
          <span class="admin-user-email">${escapar(usuario.email)}</span>
        </span>
        <span class="profile-badge ${escapar(usuario.perfil)}">${escapar(nomePerfil(usuario.perfil))}</span>
      `;
      item.addEventListener("click", () => {
        estado.usuarioAtualId = usuario.id;
        renderizarTudo();
      });
      dom.userList.appendChild(item);
    }
  }

  function contarVisibilidade(usuario) {
    let visiveis = 0;
    let total = 0;

    const idsNoContexto = projetoFiltroId
      ? usuario.mapas.filter(id => mapas.some(mapa => mapa.id === id))
      : usuario.mapas;

    for (const mapaId of idsNoContexto) {
      const mapa = mapaPorId(mapaId);
      if (!mapa) continue;

      const estadoMapa = usuario.visibilidade?.[mapa.id] || {};
      mapa.categorias.forEach(categoria => {
        const categoriaId = String(categoria.id || categoria.nome || "tipo");
        const estadoCategoria = estadoMapa[categoriaId] || {};
        const objetos = mapa.objetos.filter(objeto => String(objeto.categoriaId) === categoriaId);

        objetos.forEach((objeto, indice) => {
          total++;
          if (estadoCategoria[chaveObjeto(objeto, indice)] !== false) visiveis++;
        });
      });
    }

    return { visiveis, total };
  }

  function renderizarCabecalho() {
    const usuario = usuarioAtual();
    if (!usuario) return;

    dom.whoAvatar.textContent = iniciais(usuario.nome);
    dom.whoName.textContent = usuario.nome;
    dom.whoEmail.textContent = usuario.email;
    dom.whoStatus.textContent = usuario.status;
    dom.whoSource.textContent = usuario.origem === "externo" ? "Migrado" : "Local";

    document.querySelectorAll(".profile-button").forEach(botao => {
      botao.classList.toggle("selected", botao.dataset.profile === usuario.perfil);
    });

    const permissoesAtivas = Object.values(usuario.permissoes).filter(Boolean).length;
    const visibilidade = contarVisibilidade(usuario);

    dom.permissionCount.textContent = `(${permissoesAtivas}/${ALL_PERMISSION_KEYS.length})`;
    const mapasAcessiveisNoContexto = mapas.filter(mapa => usuario.mapas.includes(mapa.id)).length;
    dom.mapCount.textContent = `(${mapasAcessiveisNoContexto}/${mapas.length})`;
    dom.visibilityCount.textContent = `(${visibilidade.visiveis}/${visibilidade.total})`;
    dom.statPermissions.textContent = permissoesAtivas;
    dom.statMaps.textContent = mapasAcessiveisNoContexto;
    dom.statProfile.textContent = nomePerfil(usuario.perfil);
    dom.statProfile.className = `profile-status ${usuario.perfil}`;
    dom.deleteUser.disabled = usuario.proprietario || estado.usuarios.length <= 1;
    dom.deleteUser.title = usuario.proprietario
      ? "O administrador local principal não pode ser excluído"
      : "Excluir usuário local";
  }

  function criarSwitch(ativo, rotulo, pequeno = false) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = `admin-switch${ativo ? " on" : ""}${pequeno ? " small" : ""}`;
    botao.setAttribute("role", "switch");
    botao.setAttribute("aria-checked", String(ativo));
    botao.setAttribute("aria-label", rotulo);
    return botao;
  }

  function renderizarPermissoes() {
    const usuario = usuarioAtual();
    const container = dom.permissionsPanel;
    container.innerHTML = "";

    const intro = document.createElement("div");
    intro.className = "admin-panel-intro";
    intro.innerHTML = `
      <div>
        <h2>Permissões funcionais</h2>
        <p>Estas políticas já podem ser configuradas e persistidas, mas só serão aplicadas ao editor após a integração com o sistema de usuários autenticados.</p>
      </div>
    `;
    container.appendChild(intro);

    for (const grupo of PERMISSION_GROUPS) {
      const titulo = document.createElement("p");
      titulo.className = "admin-section-title";
      titulo.textContent = grupo.title;
      container.appendChild(titulo);

      const card = document.createElement("div");
      card.className = "permission-card";

      for (const chave of grupo.items) {
        const ativo = Boolean(usuario.permissoes[chave]);
        const linha = document.createElement("div");
        linha.className = `permission-row${ativo ? " on" : ""}`;

        const copia = document.createElement("div");
        copia.className = "permission-copy";
        copia.innerHTML = `<span class="permission-dot"></span><span class="permission-name">${escapar(PERMISSION_LABELS[chave])}</span>`;

        const switchPermissao = criarSwitch(ativo, PERMISSION_LABELS[chave]);
        switchPermissao.addEventListener("click", () => {
          usuario.permissoes[chave] = !usuario.permissoes[chave];
          marcarAlterado();
          renderizarPermissoes();
          renderizarCabecalho();
        });

        linha.append(copia, switchPermissao);
        card.appendChild(linha);
      }

      container.appendChild(card);
    }
  }

  function renderizarMapas() {
    const usuario = usuarioAtual();
    const container = dom.mapsPanel;
    container.innerHTML = "";

    const intro = document.createElement("div");
    intro.className = "admin-panel-intro";
    intro.innerHTML = `
      <div>
        <h2>Mapas reais deste navegador</h2>
        <p>O acesso usa o identificador interno do mapa. Renomear um mapa no Atlas Studio não perde esta configuração.</p>
      </div>
    `;
    container.appendChild(intro);

    if (!mapas.length) {
      const vazio = document.createElement("div");
      vazio.className = "admin-empty-state";
      vazio.innerHTML = "<strong>Nenhum mapa encontrado</strong>Crie ou importe um mapa no Atlas Studio e use “Atualizar dados do Atlas”.";
      container.appendChild(vazio);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "map-grid";

    for (const mapa of mapas) {
      const acessivel = usuario.mapas.includes(mapa.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `map-card${acessivel ? " on" : ""}`;
      card.setAttribute("aria-pressed", String(acessivel));
      card.innerHTML = `
        <span class="map-card-icon">${MAP_ICON}</span>
        <span class="map-card-copy">
          <span class="map-card-name">${escapar(mapa.nome)}</span>
          <span class="map-card-meta">${mapa.categorias.length} Tipo(s) · ${mapa.objetos.length} objeto(s)</span>
        </span>
        <span class="map-access-state">${acessivel ? "Acessível" : "Sem acesso"}</span>
      `;

      card.addEventListener("click", () => {
        if (usuario.mapas.includes(mapa.id)) {
          usuario.mapas = usuario.mapas.filter(id => id !== mapa.id);
        } else {
          usuario.mapas.push(mapa.id);
        }

        reconciliarVisibilidadeUsuario(usuario);
        marcarAlterado();
        renderizarMapas();
        renderizarVisibilidade();
        renderizarCabecalho();
      });

      grid.appendChild(card);
    }

    container.appendChild(grid);
  }

  function renderizarVisibilidade() {
    const usuario = usuarioAtual();
    const container = dom.visibilityPanel;
    container.innerHTML = "";

    const intro = document.createElement("div");
    intro.className = "admin-panel-intro";
    intro.innerHTML = `
      <div>
        <h2>Visibilidade por Tipo e objeto</h2>
        <p>A árvore abaixo reflete as Camadas e os objetos existentes agora nos mapas liberados para este usuário.</p>
      </div>
    `;
    container.appendChild(intro);

    const mapasAcessiveis = usuario.mapas
      .map(mapaPorId)
      .filter(mapa => mapa && (!projetoFiltroId || mapa.projectId === projetoFiltroId));

    if (!mapasAcessiveis.length) {
      const vazio = document.createElement("div");
      vazio.className = "admin-empty-state";
      vazio.innerHTML = "<strong>Nenhum mapa acessível</strong>Libere pelo menos um mapa na aba “Mapas acessíveis” para configurar Tipos e objetos.";
      container.appendChild(vazio);
      return;
    }

    let encontrouObjetos = false;

    for (const mapa of mapasAcessiveis) {
      const categoriasComObjetos = mapa.categorias
        .map(categoria => {
          const categoriaId = String(categoria.id || categoria.nome || "tipo");
          const objetos = mapa.objetos.filter(objeto => String(objeto.categoriaId) === categoriaId);
          return { categoria, categoriaId, objetos };
        })
        .filter(grupo => grupo.objetos.length > 0);

      const secao = document.createElement("section");
      secao.className = "visibility-map";

      const cabecalho = document.createElement("header");
      cabecalho.className = "visibility-map-head";
      cabecalho.innerHTML = `<strong>${escapar(mapa.nome)}</strong><span>${categoriasComObjetos.length} Camada(s) · ${mapa.objetos.length} objeto(s)</span>`;
      secao.appendChild(cabecalho);

      if (!categoriasComObjetos.length) {
        const vazio = document.createElement("div");
        vazio.className = "visibility-object-row";
        vazio.innerHTML = '<span class="visibility-object-copy"><strong>Nenhum objeto colocado neste mapa.</strong></span>';
        secao.appendChild(vazio);
      }

      for (const grupo of categoriasComObjetos) {
        encontrouObjetos = true;
        const estadoCategoria = usuario.visibilidade[mapa.id][grupo.categoriaId];
        const valores = grupo.objetos.map((objeto, indice) => estadoCategoria[chaveObjeto(objeto, indice)] !== false);
        const todosAtivos = valores.every(Boolean);
        const todosInativos = valores.every(valor => !valor);
        const misto = !todosAtivos && !todosInativos;
        const chaveGrupo = `${mapa.id}::${grupo.categoriaId}`;
        const aberto = gruposAbertos.has(chaveGrupo);

        const linhaCategoria = document.createElement("div");
        linhaCategoria.className = "visibility-category-row";

        const chevron = document.createElement("button");
        chevron.type = "button";
        chevron.className = `visibility-chevron${aberto ? " expanded" : ""}`;
        chevron.setAttribute("aria-expanded", String(aberto));
        chevron.setAttribute("aria-label", `${aberto ? "Recolher" : "Expandir"} ${grupo.categoria.nome}`);
        chevron.innerHTML = CHEVRON_ICON;

        const nome = document.createElement("span");
        nome.className = "visibility-category-name";
        nome.textContent = grupo.categoria.nome || "Tipo sem nome";

        const contador = document.createElement("span");
        contador.className = "visibility-category-count";
        contador.textContent = `${valores.filter(Boolean).length}/${valores.length} visíveis`;

        const switchCategoria = criarSwitch(todosAtivos, `Visibilidade de ${grupo.categoria.nome}`);
        switchCategoria.classList.toggle("mixed", misto);
        switchCategoria.setAttribute("aria-checked", misto ? "mixed" : String(todosAtivos));

        linhaCategoria.append(chevron, nome, contador, switchCategoria);
        secao.appendChild(linhaCategoria);

        const lista = document.createElement("div");
        lista.className = "visibility-objects";
        lista.hidden = !aberto;

        grupo.objetos.forEach((objeto, indice) => {
          const objetoId = chaveObjeto(objeto, indice);
          const ativo = estadoCategoria[objetoId] !== false;
          const linhaObjeto = document.createElement("div");
          linhaObjeto.className = "visibility-object-row";
          linhaObjeto.innerHTML = `
            <span class="visibility-object-copy">
              <strong>${escapar(tituloObjeto(objeto, indice))}</strong>
              <small>${escapar(geometriaNome(grupo.categoria.geometria))} · ID ${escapar(objetoId)}</small>
            </span>
          `;

          const switchObjeto = criarSwitch(ativo, `Visibilidade de ${tituloObjeto(objeto, indice)}`, true);
          switchObjeto.addEventListener("click", () => {
            estadoCategoria[objetoId] = !ativo;
            marcarAlterado();
            renderizarVisibilidade();
            renderizarCabecalho();
          });

          linhaObjeto.appendChild(switchObjeto);
          lista.appendChild(linhaObjeto);
        });

        chevron.addEventListener("click", () => {
          if (gruposAbertos.has(chaveGrupo)) gruposAbertos.delete(chaveGrupo);
          else gruposAbertos.add(chaveGrupo);
          renderizarVisibilidade();
        });

        switchCategoria.addEventListener("click", () => {
          const proximo = !todosAtivos;
          grupo.objetos.forEach((objeto, indice) => {
            estadoCategoria[chaveObjeto(objeto, indice)] = proximo;
          });
          marcarAlterado();
          renderizarVisibilidade();
          renderizarCabecalho();
        });

        secao.appendChild(lista);
      }

      container.appendChild(secao);
    }

    if (!encontrouObjetos) {
      const observacao = document.createElement("div");
      observacao.className = "admin-empty-state";
      observacao.innerHTML = "<strong>Os mapas acessíveis ainda estão vazios</strong>As Camadas aparecerão automaticamente quando objetos forem criados no Atlas Studio e os dados forem atualizados.";
      container.appendChild(observacao);
    }
  }

  function renderizarTudo() {
    if (dom.projectContext) {
      dom.projectContext.hidden = !projetoFiltroId;
      dom.projectContext.innerHTML = projetoFiltroId
        ? '<span>Filtrando por projeto:</span><strong>' +
          escapar(projetoContexto?.nome || "Projeto selecionado") +
          '</strong><a href="admin.html" aria-label="Remover filtro do projeto">×</a>'
        : "";
    }
    renderizarUsuarios();
    renderizarCabecalho();
    renderizarPermissoes();
    renderizarMapas();
    renderizarVisibilidade();
  }

  function aplicarPerfil(perfil) {
    const usuario = usuarioAtual();
    usuario.perfil = perfil;
    usuario.permissoes = clone(PROFILE_PRESETS[perfil]);
    usuario.visibilidade = {};
    reconciliarVisibilidadeUsuario(usuario);
    marcarAlterado();
    renderizarTudo();
  }

  function abrirCadastroUsuario() {
    dom.userForm.reset();
    dom.userProfile.value = "restrito";
    dom.userDialog.showModal();
    requestAnimationFrame(() => dom.userName.focus());
  }

  function fecharCadastroUsuario() {
    if (dom.userDialog.open) dom.userDialog.close();
  }

  function adicionarUsuario(evento) {
    evento.preventDefault();
    const nome = dom.userName.value.trim();
    const email = dom.userEmail.value.trim();
    const perfil = dom.userProfile.value;

    if (!nome || !email) return;

    const duplicado = estado.usuarios.some(usuario => usuario.email.toLocaleLowerCase("pt-BR") === email.toLocaleLowerCase("pt-BR"));
    if (duplicado) {
      dom.userEmail.setCustomValidity("Já existe um usuário local com este e-mail.");
      dom.userEmail.reportValidity();
      return;
    }

    dom.userEmail.setCustomValidity("");
    const usuario = normalizarUsuario({
      id: gerarId("usuario"),
      nome,
      email,
      perfil,
      origem: "local",
      status: "nunca acessou",
      permissoes: clone(PROFILE_PRESETS[perfil]),
      mapas: [],
      visibilidade: {}
    });
    reconciliarVisibilidadeUsuario(usuario);
    estado.usuarios.push(usuario);
    estado.usuarioAtualId = usuario.id;
    buscaUsuario = "";
    dom.userSearch.value = "";
    fecharCadastroUsuario();
    marcarAlterado();
    renderizarTudo();
    mostrarToast("Usuário local adicionado. Salve as políticas para confirmar.");
  }

  async function excluirUsuarioAtual() {
    const usuario = usuarioAtual();
    if (!usuario || usuario.proprietario || estado.usuarios.length <= 1) return;

    if (
      !await confirmarSistema(
        "Excluir usuário local",
        `Excluir o usuário “${usuario.nome}” e todas as suas políticas?`,
        {
          rotuloConfirmar: "Excluir usuário",
          perigo: true
        }
      )
    ) return;

    estado.usuarios = estado.usuarios.filter(item => item.id !== usuario.id);
    estado.usuarioAtualId = estado.usuarios[0].id;
    marcarAlterado();
    renderizarTudo();
    mostrarToast("Usuário local removido. Salve as políticas para confirmar.");
  }

  async function salvarPoliticas() {
    if (!alteracoesPendentes || carregando) return;

    carregando = true;
    dom.save.disabled = true;

    try {
      await gravarEstadoAdmin();
      marcarAlterado(false);
      mostrarToast("Políticas salvas neste navegador. Ainda não são aplicadas ao editor.");
    } catch (erro) {
      console.error(erro);
      marcarAlterado(true);
      mostrarToast("Não foi possível salvar as políticas.", "erro");
    } finally {
      carregando = false;
      dom.save.disabled = !alteracoesPendentes;
    }
  }

  async function atualizarDadosAtlas() {
    if (carregando) return;

    const tinhaAlteracoesPendentes = alteracoesPendentes;
    carregando = true;
    dom.refreshMaps.disabled = true;
    dom.syncState.textContent = "Atualizando mapas, Tipos e objetos…";

    try {
      mapasGlobais = await carregarMapasAtlas();
      mapas = projetoFiltroId
        ? mapasGlobais.filter(mapa => mapa.projectId === projetoFiltroId)
        : mapasGlobais;
      estado = normalizarEstado(estado);

      /* Atualizar a árvore não confirma silenciosamente edições pendentes. */
      if (!tinhaAlteracoesPendentes) {
        await gravarEstadoAdmin();
      }

      renderizarTudo();
      marcarAlterado(tinhaAlteracoesPendentes);
      mostrarToast("Dados do Atlas Studio atualizados.");
    } catch (erro) {
      console.error(erro);
      mostrarToast("Não foi possível atualizar os dados do Atlas.", "erro");
      dom.syncState.textContent = "Falha ao sincronizar os mapas locais";
    } finally {
      carregando = false;
      dom.refreshMaps.disabled = false;
      dom.save.disabled = !alteracoesPendentes;
    }
  }

  function aplicarTema(tema, salvar = true) {
    const claro = tema === "claro";
    document.documentElement.classList.toggle("tema-claro", claro);
    document.documentElement.style.colorScheme = claro ? "light" : "dark";
    dom.themeIcon.textContent = claro ? "☾" : "☼";
    dom.theme.title = claro ? "Ativar modo escuro" : "Ativar modo claro";
    dom.theme.setAttribute("aria-label", dom.theme.title);

    if (salvar) localStorage.setItem("temaInterface", tema);
  }

  function selecionarAba(nome) {
    abaAtual = nome;
    document.querySelectorAll(".admin-tab").forEach(botao => {
      botao.classList.toggle("active", botao.dataset.tab === nome);
    });
    document.querySelectorAll("[data-panel]").forEach(painel => {
      painel.hidden = painel.dataset.panel !== nome;
    });
  }

  function registrarEventos() {
    dom.globalSearch?.addEventListener("input", evento => {
      buscaUsuario = evento.target.value;
      dom.userSearch.value = buscaUsuario;
      renderizarUsuarios();
    });

    dom.userSearch.addEventListener("input", evento => {
      buscaUsuario = evento.target.value;
      if (dom.globalSearch) dom.globalSearch.value = buscaUsuario;
      renderizarUsuarios();
    });

    dom.addUser.addEventListener("click", abrirCadastroUsuario);
    dom.closeUserDialog.addEventListener("click", fecharCadastroUsuario);
    dom.cancelUser.addEventListener("click", fecharCadastroUsuario);
    dom.userForm.addEventListener("submit", adicionarUsuario);
    dom.userEmail.addEventListener("input", () => dom.userEmail.setCustomValidity(""));
    dom.deleteUser.addEventListener("click", excluirUsuarioAtual);
    dom.save.addEventListener("click", salvarPoliticas);
    dom.refreshMaps.addEventListener("click", atualizarDadosAtlas);

    document.querySelectorAll(".profile-button").forEach(botao => {
      botao.addEventListener("click", () => aplicarPerfil(botao.dataset.profile));
    });

    document.querySelectorAll(".admin-tab").forEach(botao => {
      botao.addEventListener("click", () => selecionarAba(botao.dataset.tab));
    });

    dom.theme.addEventListener("click", () => {
      const tema = document.documentElement.classList.contains("tema-claro") ? "escuro" : "claro";
      aplicarTema(tema);
    });

    window.addEventListener("beforeunload", evento => {
      if (!alteracoesPendentes) return;
      evento.preventDefault();
      evento.returnValue = "";
    });
  }

  function capturarDom() {
    const porId = id => document.getElementById(id);
    Object.assign(dom, {
      syncState: porId("adminSyncState"),
      theme: porId("adminTheme"),
      themeIcon: document.querySelector(".admin-theme-icon"),
      userCount: porId("adminUserCount"),
      userSearch: porId("adminUserSearch"),
      userList: porId("adminUserList"),
      addUser: porId("adminAddUser"),
      whoAvatar: porId("adminWhoAvatar"),
      whoName: porId("adminWhoName"),
      whoEmail: porId("adminWhoEmail"),
      whoStatus: porId("adminWhoStatus"),
      whoSource: porId("adminWhoSource"),
      deleteUser: porId("adminDeleteUser"),
      save: porId("adminSave"),
      permissionCount: porId("adminPermissionCount"),
      mapCount: porId("adminMapCount"),
      visibilityCount: porId("adminVisibilityCount"),
      permissionsPanel: porId("adminPermissionsPanel"),
      mapsPanel: porId("adminMapsPanel"),
      visibilityPanel: porId("adminVisibilityPanel"),
      statPermissions: porId("adminStatPermissions"),
      statMaps: porId("adminStatMaps"),
      statProfile: porId("adminStatProfile"),
      refreshMaps: porId("adminRefreshMaps"),
      userDialog: porId("adminUserDialog"),
      userForm: porId("adminUserForm"),
      closeUserDialog: porId("adminCloseUserDialog"),
      cancelUser: porId("adminCancelUser"),
      userName: porId("adminUserName"),
      userEmail: porId("adminUserEmail"),
      userProfile: porId("adminUserProfile"),
      toast: porId("adminToast"),
      globalSearch: porId("adminGlobalSearch"),
      projectContext: porId("adminProjectContext")
    });
  }

  async function iniciar() {
    capturarDom();
    aplicarTema(localStorage.getItem("temaInterface") === "escuro" ? "escuro" : "claro", false);
    registrarEventos();
    selecionarAba(abaAtual);

    carregando = true;

    try {
      [mapasGlobais, bancoAdmin, projetoContexto] = await Promise.all([
        carregarMapasAtlas(),
        abrirBancoAdmin(),
        carregarProjetoContexto()
      ]);
      mapas = projetoFiltroId
        ? mapasGlobais.filter(mapa => mapa.projectId === projetoFiltroId)
        : mapasGlobais;
      const salvo = await lerEstadoAdmin();
      estado = normalizarEstado(salvo || criarEstadoInicial());

      /* Salva também a primeira configuração e reconciliações de schema. */
      await gravarEstadoAdmin();
      renderizarTudo();
      marcarAlterado(false);
    } catch (erro) {
      console.error(erro);
      dom.syncState.textContent = "Não foi possível abrir o armazenamento local";
      dom.permissionsPanel.innerHTML = `
        <div class="admin-error-state">
          <strong>Falha ao iniciar a Administração</strong>
          O editor de mapas não foi alterado. Recarregue a página ou verifique se o navegador permite IndexedDB neste endereço.
        </div>
      `;
      mostrarToast("Falha ao abrir o painel administrativo.", "erro");
    } finally {
      carregando = false;
      dom.save.disabled = !alteracoesPendentes;
    }
  }

  iniciar();
})();
