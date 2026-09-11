/* Rascunhos separados dos mapas: formulários incompletos não viram objetos salvos. */
let sessaoRascunho = null;
let timerRascunho = null;
let filaRascunhos = Promise.resolve();
let restaurandoRascunho = false;
let estadoPersistencia = "salvo";
const CAMPOS_EDITOR_RASCUNHO = ["editandoId", "categoriaId", "pontos", "label", "relacoes", "entityFieldColumns", "aguardandoLabel", "ramificacoes", "ramoAtivo", "ramoSelecionado", "verticeSelecionado", "linhaExtremidadeAtiva", "relacaoAssinatura"];

async function salvarMapasAtomicos(mapas, rascunhoId = null) {
  mostrarEstadoSalvamento("salvando");
  const antes = await Promise.all(mapas.map(m => dbPegarMapaGlobal(m.id)));
  try {
    await new Promise((resolve, reject) => {
      const tx = transacaoMapas(rascunhoId ? ["rascunhos"] : []);
      for (const m of mapas) {
        m.atualizadoEm = new Date().toISOString();
        gravarMapaNaTransacao(tx, m);
      }
      if (rascunhoId) tx.objectStore("rascunhos").delete(rascunhoId);
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("Não foi possível concluir o salvamento."));
    });
    for (let i = 0; i < mapas.length; i++) registrarAlteracaoHistoricoGlobal(mapas[i].id, antes[i], mapas[i]);
    if (rascunhoId) {
      try { localStorage.removeItem("atlas-rascunho-emergencia:" + rascunhoId); } catch {}
    }
    mostrarEstadoSalvamento(sessaoRascunho ? "pendente" : "salvo");
  } catch (erro) {
    mostrarEstadoSalvamento("erro", "Nenhuma parte desta operação foi salva. Sua edição continua aberta.");
    throw erro;
  }
}

function mostrarEstadoSalvamento(estado, detalhe = "") {
  estadoPersistencia = estado;
  const el = document.getElementById("estadoSalvamento");
  if (!el) return;
  el.dataset.estado = estado;
  el.textContent = ({ salvo: "Salvo neste navegador", pendente: "Alterações pendentes", salvando: "Salvando…", erro: "Falha ao salvar" })[estado];
  el.title = detalhe || "Salvar neste navegador não substitui exportar um backup.";
}

function camposFormularioRascunho(form) {
  return [...form.querySelectorAll("input[id], textarea[id], select[id]")]
    .filter(el => el.type !== "file")
    .map(el => ({ id: el.id, valor: el.value, marcado: el.checked }));
}

function capturarRascunho() {
  if (!sessaoRascunho || restaurandoRascunho) return null;
  const tipo = sessaoRascunho.tipo;
  if (tipo === "objeto" && !editor.ativo || tipo === "categoria" && modalCategoria.hidden) return null;
  const dados = tipo === "objeto"
    ? Object.fromEntries(CAMPOS_EDITOR_RASCUNHO.map(chave => [chave, editor[chave] ?? null]))
    : { categoriaId: ui.categoriaEditandoId, icone: ui.iconeCategoria, cor: ui.corCategoria };
  if (tipo === "objeto") dados.entityFieldColumns = camposMarcados(camposReferenciaObjeto);
  return clone({ id: sessaoRascunho.id, projectId: sessaoRascunho.projectId, mapaId: sessaoRascunho.mapaId,
    tipo, schemaVersion: 1, dados, campos: camposFormularioRascunho(tipo === "objeto" ? formObjeto : formCategoria) });
}

function iniciarSessaoRascunho(tipo = "objeto") {
  if (restaurandoRascunho) return;
  if (sessaoRascunho) void preservarRascunhoAtual().catch(() => {});
  sessaoRascunho = { id: crypto.randomUUID(), projectId: projetoAtual?.id, mapaId: mapaAtual?.id, tipo, base: "", gravado: "" };
  const sessao = sessaoRascunho;
  queueMicrotask(() => {
    if (sessaoRascunho !== sessao) return;
    sessao.base = JSON.stringify(capturarRascunho());
    mostrarEstadoSalvamento("salvo");
  });
}

function suspenderRascunhoCategoria() {
  if (sessaoRascunho?.tipo !== "categoria") return;
  fecharModalCategoria({ preservarRascunho: true });
  sessaoRascunho = null;
}

function transacaoRascunhos(acao) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("rascunhos", "readwrite");
    acao(tx.objectStore("rascunhos"));
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error || new Error("Falha no armazenamento do rascunho."));
  });
}

function agendarRascunho() {
  if (restaurandoRascunho || !sessaoRascunho) return;
  const dados = capturarRascunho();
  if (!dados || JSON.stringify(dados) === sessaoRascunho.base) return;
  if (estadoPersistencia !== "erro") mostrarEstadoSalvamento("pendente", "A edição permanece em rascunho até você salvar.");
  clearTimeout(timerRascunho);
  timerRascunho = setTimeout(() => preservarRascunhoAtual().catch(() => {}), 400);
}

async function preservarRascunhoAtual() {
  clearTimeout(timerRascunho);
  const sessao = sessaoRascunho;
  const dados = capturarRascunho();
  if (!db || !dados || !dados.projectId) return;
  const assinatura = JSON.stringify(dados);
  if (assinatura === sessao.base || assinatura === sessao.gravado) return filaRascunhos;
  dados.atualizadoEm = new Date().toISOString();
  const escrita = filaRascunhos.catch(() => {}).then(() => transacaoRascunhos(store => store.put(dados)));
  filaRascunhos = escrita;
  try {
    await escrita;
    sessao.gravado = assinatura;
    try { localStorage.removeItem("atlas-rascunho-emergencia:" + sessao.id); } catch {}
    if (sessaoRascunho === sessao && estadoPersistencia !== "erro") {
      mostrarEstadoSalvamento("pendente", "Rascunho recuperável salvo neste navegador. Use Salvar para concluir a edição.");
    }
  } catch (erro) {
    mostrarEstadoSalvamento("erro", "Não foi possível guardar o rascunho. Sua edição continua aberta; tente salvar ou liberar espaço.");
    throw erro;
  }
}

function descartarRascunhoAtivo(tipo = "objeto") {
  if (!sessaoRascunho || sessaoRascunho.tipo !== tipo || restaurandoRascunho) return;
  const id = sessaoRascunho.id;
  sessaoRascunho = null;
  clearTimeout(timerRascunho);
  filaRascunhos = filaRascunhos.catch(() => {}).then(() => transacaoRascunhos(store => store.delete(id)));
  filaRascunhos.then(() => {
    localStorage.removeItem("atlas-rascunho-emergencia:" + id);
    if (!sessaoRascunho) mostrarEstadoSalvamento("salvo");
    return oferecerRascunhoAtual();
  }).catch(() => mostrarEstadoSalvamento("erro", "A edição foi encerrada, mas não foi possível remover o rascunho antigo."));
}

async function listarRascunhos() {
  await filaRascunhos.catch(() => {});
  return new Promise((resolve, reject) => {
    const req = db.transaction("rascunhos").objectStore("rascunhos").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function oferecerRascunhoAtual() {
  const el = document.getElementById("recuperacaoRascunho");
  if (!el || !db) return;
  const mapaId = mapaAtual?.id;
  const projectId = projetoAtual?.id;
  const rascunhos = (await listarRascunhos()).filter(r => r.mapaId === mapaId && r.projectId === projectId && r.id !== sessaoRascunho?.id);
  if (mapaId !== mapaAtual?.id || projectId !== projetoAtual?.id) return;
  el.replaceChildren();
  el.hidden = !rascunhos.length;
  for (const r of rascunhos) {
    const row = document.createElement("div");
    const texto = document.createElement("span");
    texto.textContent = `Rascunho de ${r.tipo === "objeto" ? "objeto" : "tipo"} · ${new Date(r.atualizadoEm).toLocaleString("pt-BR")}`;
    const restaurar = document.createElement("button");
    restaurar.type = "button";
    restaurar.textContent = "Recuperar";
    restaurar.onclick = () => restaurarRascunho(r).catch(erro => avisar(erro.message));
    const descartar = document.createElement("button");
    descartar.type = "button";
    descartar.textContent = "Descartar";
    descartar.onclick = async () => {
      await transacaoRascunhos(store => store.delete(r.id));
      localStorage.removeItem("atlas-rascunho-emergencia:" + r.id);
      await oferecerRascunhoAtual();
    };
    row.append(texto, restaurar, descartar);
    el.appendChild(row);
  }
  atualizarIndicadorBackup();
}

async function restaurarRascunho(r) {
  if (r.schemaVersion !== 1 || r.mapaId !== mapaAtual?.id || r.projectId !== projetoAtual?.id) throw new Error("Este rascunho não pertence ao mapa aberto ou tem uma versão incompatível.");
  const cat = categoriaPorId(r.dados.categoriaId);
  if (r.tipo === "objeto" && !cat) throw new Error("O tipo deste rascunho foi removido. O rascunho foi preservado.");
  if (r.tipo === "categoria" && r.dados.categoriaId && !cat) throw new Error("O tipo deste rascunho foi removido.");
  if (r.dados.editandoId && !objetoPorId(r.dados.editandoId)) throw new Error("O objeto deste rascunho foi removido. O rascunho foi preservado.");
  await preservarRascunhoAtual();
  cancelarEdicaoObjeto({ preservarRascunho: true });
  restaurandoRascunho = true;
  try {
    setModo("edicao");
    if (r.tipo === "categoria") {
      abrirModalCategoria(cat || null);
      ui.iconeCategoria = r.dados.icone;
      ui.corCategoria = r.dados.cor;
    } else {
      ui.ferramenta = "criar";
      if (r.dados.editandoId) {
        ui.objetoSelecionadoId = r.dados.editandoId;
        editarObjetoSelecionado();
      } else iniciarCriacaoObjeto(r.dados.categoriaId);
      await editor.carregamento;
      Object.assign(editor, clone(r.dados));
      const valor = id => r.campos.find(c => c.id === id)?.valor || "";
      atualizarFontesObjeto(valor("fonteObjeto") ? { sourceId: valor("fonteObjeto"), recordId: valor("registroObjeto") } : null, r.dados.entityFieldColumns);
      await atualizarDestinosPortal(valor("portalMapaDestino"));
      await atualizarAreasDestinoPortal(valor("portalMapaDestino"), valor("portalAreaDestino"));
      await preencherRelacaoLinha({ relacaoOrigemMapaId: valor("lineRelationOriginMap"), relacaoOrigemId: valor("lineRelationOrigin"), relacaoDestinoMapaId: valor("lineRelationDestinationMap"), relacaoDestinoId: valor("lineRelationDestination") });
    }
    for (const campo of r.campos) {
      const el = document.getElementById(campo.id);
      if (!el || el.type === "file" || !el.closest(r.tipo === "objeto" ? "#formObjeto" : "#formCategoria")) continue;
      el.value = campo.valor;
      if (typeof campo.marcado === "boolean") el.checked = campo.marcado;
    }
    sessaoRascunho = { id: r.id, projectId: r.projectId, mapaId: r.mapaId, tipo: r.tipo, base: "", gravado: "" };
    if (r.tipo === "objeto") {
      renderRelacoesEditor();
      atualizarPreview();
      atualizarSelecaoVerticeUI();
    } else {
      atualizarCamposGeometria();
      atualizarSelecaoIcone();
      atualizarSelecaoCor();
      aplicarPreviewTipo();
    }
    atualizarAcoesRail();
    definirPainelAberto(true);
    mostrarEstadoSalvamento("pendente", "Rascunho recuperado. Revise e salve para concluir.");
  } finally {
    restaurandoRascunho = false;
  }
  await oferecerRascunhoAtual();
}

function atualizarIndicadorBackup() {
  const el = document.getElementById("ultimoBackup");
  if (!el) return;
  const data = projetoAtual?.ultimoBackupExportadoEm;
  el.textContent = data ? "Última exportação: " + new Date(data).toLocaleString("pt-BR") : "Nenhum backup exportado registrado";
}

async function recuperarEmergencias() {
  for (const chave of Object.keys(localStorage).filter(k => k.startsWith("atlas-rascunho-emergencia:"))) {
    try {
      const r = JSON.parse(localStorage.getItem(chave));
      if (r?.schemaVersion !== 1 || !r.id || !r.projectId || !r.mapaId) continue;
      await transacaoRascunhos(store => store.put(r));
      localStorage.removeItem(chave);
    } catch (erro) {
      mostrarEstadoSalvamento("erro", "Um rascunho de recuperação não pôde ser carregado; sua cópia foi preservada.");
    }
  }
}

for (const evento of ["input", "change", "pointerup", "keyup", "click"]) {
  document.addEventListener(evento, () => queueMicrotask(agendarRascunho));
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void preservarRascunhoAtual().catch(() => {});
});
window.addEventListener("beforeunload", e => {
  const r = capturarRascunho();
  if (!r || JSON.stringify(r) === sessaoRascunho.base || JSON.stringify(r) === sessaoRascunho.gravado) return;
  try {
    localStorage.setItem("atlas-rascunho-emergencia:" + r.id, JSON.stringify({ ...r, atualizadoEm: new Date().toISOString() }));
  } catch (erro) {
    e.preventDefault();
    e.returnValue = "";
  }
});
