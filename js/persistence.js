/* IndexedDB: abertura e migração do banco, consultas e transações de mapas e resumos. */
function abrirBanco() {
  return new Promise(
    (resolve, reject) => {
      const req =
        indexedDB.open(
          DB_NOME,
          DB_VERSAO
        );

      req.onupgradeneeded =
        function() {
          const banco =
            req.result;
          if (!banco.objectStoreNames.contains("rascunhos")) {
            banco.createObjectStore("rascunhos", { keyPath: "id" });
          }

          if (
            !banco.objectStoreNames.contains(
              STORE_MAPAS
            )
          ) {
            banco.createObjectStore(
              STORE_MAPAS,
              {
                keyPath: "id"
              }
            );
          }

          if (
            !banco.objectStoreNames.contains(
              STORE_PROJETOS
            )
          ) {
            banco.createObjectStore(
              STORE_PROJETOS,
              {
                keyPath: "id"
              }
            );
          }

          const mapas = req.transaction.objectStore(STORE_MAPAS);
          if (!mapas.indexNames.contains("projectId")) mapas.createIndex("projectId", "projectId");
          if (!banco.objectStoreNames.contains(STORE_RESUMOS)) {
            const resumos = banco.createObjectStore(STORE_RESUMOS, { keyPath: "id" });
            resumos.createIndex("projectId", "projectId");
            // Migração na própria transação: não modifica mapas ou imagens.
            const cursor = mapas.openCursor();
            cursor.onsuccess = () => {
              const item = cursor.result;
              if (!item) return;
              resumos.put(resumoMapa(item.value));
              item.continue();
            };
          }
        };

      req.onsuccess = () => {
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };

      req.onerror =
        () => reject(req.error);
      req.onblocked = () => avisar("Feche as outras abas do Atlas Studio para concluir a atualização do banco. Seus mapas serão preservados.");
    }
  );
}

function store(
  modo = "readonly"
) {
  return db
    .transaction(
      STORE_MAPAS,
      modo
    )
    .objectStore(
      STORE_MAPAS
    );
}

function dbTodos() {
  if (!projetoAtual) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const req = store().index("projectId").getAll(projetoAtual.id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function resumoMapa(mapaAlvo) {
  return { id: mapaAlvo.id, projectId: mapaAlvo.projectId, nome: mapaAlvo.nome,
    atualizadoEm: mapaAlvo.atualizadoEm, totalObjetos: mapaAlvo.objetos?.length || 0 };
}

function transacaoMapas(extras = []) {
  return db.transaction([STORE_MAPAS, STORE_RESUMOS, ...extras], "readwrite");
}

function gravarMapaNaTransacao(tx, mapaAlvo) {
  tx.objectStore(STORE_MAPAS).put(mapaAlvo);
  tx.objectStore(STORE_RESUMOS).put(resumoMapa(mapaAlvo));
}

function excluirMapaNaTransacao(tx, id) {
  tx.objectStore(STORE_MAPAS).delete(id);
  tx.objectStore(STORE_RESUMOS).delete(id);
}

function dbListarResumosMapas(global = false) {
  if (!global && !projetoAtual) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const resumoStore = db.transaction(STORE_RESUMOS).objectStore(STORE_RESUMOS);
    const req = global ? resumoStore.getAll() : resumoStore.index("projectId").getAll(projetoAtual.id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// API legada usada também pela suíte de regressão; novas listagens devem usar resumos.
function dbTodosGlobais() {
  return new Promise(
    (resolve, reject) => {
      const req =
        store().getAll();

      req.onsuccess =
        () => resolve(req.result);

      req.onerror =
        () => reject(req.error);
    }
  );
}

function dbPegar(id) {
  return new Promise(
    (resolve, reject) => {
      const req =
        store().get(id);

      req.onsuccess =
        () => {
          const resultado =
            req.result;

          resolve(
            !resultado ||
            !projetoAtual ||
            resultado.projectId ===
              projetoAtual.id
              ? resultado
              : undefined
          );
        };

      req.onerror =
        () => reject(req.error);
    }
  );
}

function dbPegarMapaGlobal(id) {
  return new Promise(
    (resolve, reject) => {
      const req =
        store().get(id);

      req.onsuccess =
        () => resolve(req.result);

      req.onerror =
        () => reject(req.error);
    }
  );
}

async function dbSalvar(
  objeto,
  opcoes = {}
) {
  if (
    projetoAtual?.id &&
    !opcoes.preservarProjeto
  ) {
    objeto.projectId =
      projetoAtual.id;
  }

  objeto.atualizadoEm =
    new Date().toISOString();

  objeto.versaoEditor = 12.5;

  const registrarHistorico =
    opcoes.historico !== false &&
    historicoGlobal.ativo &&
    !historicoGlobal.aplicando;
  const antes =
    registrarHistorico
      ? await dbPegarMapaGlobal(
          objeto.id
        )
      : null;

  mostrarEstadoSalvamento("salvando");
  try {
  await new Promise(
    (resolve, reject) => {
      const tx = transacaoMapas();
      gravarMapaNaTransacao(tx, objeto);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("Falha ao salvar o mapa."));
    }
  );
  mostrarEstadoSalvamento(sessaoRascunho ? "pendente" : "salvo");
  } catch (erro) {
    mostrarEstadoSalvamento("erro", "A edição continua aberta. Tente novamente; verifique o espaço disponível no navegador.");
    throw erro;
  }

  if (registrarHistorico) {
    registrarAlteracaoHistoricoGlobal(
      objeto.id,
      antes,
      objeto
    );
  }
}

function storeProjetos(
  modo = "readonly"
) {
  return db
    .transaction(
      STORE_PROJETOS,
      modo
    )
    .objectStore(
      STORE_PROJETOS
    );
}

function dbTodosProjetos() {
  return new Promise(
    (resolve, reject) => {
      const req =
        storeProjetos().getAll();

      req.onsuccess =
        () => resolve(req.result);

      req.onerror =
        () => reject(req.error);
    }
  );
}

function dbPegarProjeto(id) {
  return new Promise(
    (resolve, reject) => {
      const req =
        storeProjetos().get(id);

      req.onsuccess =
        () => resolve(req.result);

      req.onerror =
        () => reject(req.error);
    }
  );
}

function dbSalvarProjeto(projeto) {
  projeto.atualizadoEm =
    new Date().toISOString();

  return new Promise(
    (resolve, reject) => {
      const tx = db.transaction(STORE_PROJETOS, "readwrite");
      tx.objectStore(STORE_PROJETOS).put(projeto);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => {
        mostrarEstadoSalvamento("erro", "Não foi possível salvar os dados do projeto.");
        reject(tx.error || new Error("Falha ao salvar o projeto."));
      };
    }
  );
}

function dbExcluirProjeto(id) {
  return new Promise(
    (resolve, reject) => {
      const req =
        storeProjetos("readwrite")
          .delete(id);

      req.onsuccess =
        () => resolve();

      req.onerror =
        () => reject(req.error);
    }
  );
}

async function dbExcluir(
  id,
  opcoes = {}
) {
  const registrarHistorico =
    opcoes.historico !== false &&
    historicoGlobal.ativo &&
    !historicoGlobal.aplicando;
  const antes =
    registrarHistorico
      ? await dbPegarMapaGlobal(id)
      : null;

  await new Promise(
    (resolve, reject) => {
      const tx = transacaoMapas();
      excluirMapaNaTransacao(tx, id);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("Não foi possível excluir o mapa."));
    }
  );

  if (registrarHistorico) {
    registrarAlteracaoHistoricoGlobal(
      id,
      antes,
      null
    );
  }
}
