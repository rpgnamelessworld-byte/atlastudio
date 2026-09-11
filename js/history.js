/* Histórico do projeto: snapshots, agrupamento de ações e limites de memória. */
const historicoGlobal = {
  limiteEntradas: 100,
  limiteBytes: 32 * 1024 * 1024,
  descartadas: 0,
  ativo: false,
  aplicando: false,
  desfazer: [],
  refazer: [],
  pendente: null,
  timer: null
};

const tamanhosSnapshotsHistorico = new WeakMap();
const imagensHistorico = new Map();

function estatisticasHistorico() {
  let bytesEstrutura = 0;
  const imagens = new Set();
  const snapshots = new Set();
  const entradas = [...historicoGlobal.desfazer, ...historicoGlobal.refazer];
  for (const entrada of entradas) {
    for (const alteracao of entrada.alteracoes) {
      if (alteracao.antes) snapshots.add(alteracao.antes);
      if (alteracao.depois) snapshots.add(alteracao.depois);
    }
  }
  if (historicoGlobal.pendente) {
    for (const valor of [...historicoGlobal.pendente.antes.values(), ...historicoGlobal.pendente.depois.values()]) if (valor) snapshots.add(valor);
  }
  for (const snapshot of snapshots) {
    if (!tamanhosSnapshotsHistorico.has(snapshot)) {
      const { imagem, ...estrutura } = snapshot;
      tamanhosSnapshotsHistorico.set(snapshot, JSON.stringify(estrutura).length * 2);
    }
    bytesEstrutura += tamanhosSnapshotsHistorico.get(snapshot);
    if (snapshot.imagem) imagens.add(snapshot.imagem);
  }
  const bytesImagens = [...imagens].reduce((soma, imagem) => soma + imagem.length * 2, 0);
  for (const imagem of imagensHistorico.keys()) if (!imagens.has(imagem)) imagensHistorico.delete(imagem);
  return { entradas: entradas.length, bytesEstimados: bytesEstrutura + bytesImagens, bytesEstrutura, bytesImagens,
    limiteBytes: historicoGlobal.limiteBytes, limiteEntradas: historicoGlobal.limiteEntradas, descartadas: historicoGlobal.descartadas };
}

function limitarHistoricoGlobal() {
  let estado = estatisticasHistorico();
  while (historicoGlobal.desfazer.length && (estado.entradas > estado.limiteEntradas || estado.bytesEstimados > estado.limiteBytes)) {
    historicoGlobal.desfazer.shift();
    historicoGlobal.descartadas++;
    estado = estatisticasHistorico();
  }
  // Uma operação maior que o orçamento é salva normalmente, mas não retida.
  if (!historicoGlobal.desfazer.length && estado.descartadas) avisar("Alteração salva. Esta operação excede o limite de memória para desfazer; exporte um backup para preservar versões anteriores.");
}

function cloneMapaHistorico(valor) {
  if (!valor) return null;

  /* A imagem costuma ser o trecho mais pesado do mapa e nunca é alterada
     durante a edição comum. Mantemos a mesma string imutável e clonamos
     profundamente apenas a estrutura editável. */
  let imagem = valor.imagem;
  if (imagem) {
    if (!imagensHistorico.has(imagem)) imagensHistorico.set(imagem, imagem);
    imagem = imagensHistorico.get(imagem);
  }
  const estrutura = {
    ...valor
  };

  delete estrutura.imagem;

  const copia = clone(estrutura);
  copia.imagem = imagem;
  return copia;
}

function finalizarHistoricoGlobalPendente() {
  clearTimeout(historicoGlobal.timer);
  historicoGlobal.timer = null;

  const pendente =
    historicoGlobal.pendente;

  if (!pendente) return null;

  historicoGlobal.pendente = null;

  const ids =
    new Set([
      ...pendente.antes.keys(),
      ...pendente.depois.keys()
    ]);
  const alteracoes =
    [...ids].map(id => ({
      id,
      antes:
        pendente.antes.has(id)
          ? pendente.antes.get(id)
          : null,
      depois:
        pendente.depois.has(id)
          ? pendente.depois.get(id)
          : null
    }));

  if (alteracoes.length) {
    historicoGlobal.desfazer.push({
      projectId: pendente.projectId,
      alteracoes
    });
    limitarHistoricoGlobal();
  }

  return alteracoes.length
    ? alteracoes
    : null;
}

function registrarAlteracaoHistoricoGlobal(
  id,
  antes,
  depois
) {
  if (
    !historicoGlobal.ativo ||
    historicoGlobal.aplicando ||
    !projetoAtual?.id
  ) {
    return;
  }

  let pendente =
    historicoGlobal.pendente;

  if (
    !pendente ||
    pendente.projectId !==
      projetoAtual.id
  ) {
    finalizarHistoricoGlobalPendente();

    pendente = {
      projectId: projetoAtual.id,
      antes: new Map(),
      depois: new Map()
    };

    historicoGlobal.pendente =
      pendente;
  }

  if (!pendente.antes.has(id)) {
    pendente.antes.set(
      id,
      cloneMapaHistorico(antes)
    );
  }

  pendente.depois.set(
    id,
    cloneMapaHistorico(depois)
  );

  historicoGlobal.refazer = [];

  clearTimeout(historicoGlobal.timer);
  historicoGlobal.timer =
    setTimeout(
      finalizarHistoricoGlobalPendente,
      700
    );

  // O orçamento é aplicado ao finalizar o gesto, nunca no meio de um lote
  // atômico (por exemplo, um portal e seu retorno em mapas distintos).

}

function iniciarHistoricoGlobal() {
  imagensHistorico.clear();
  historicoGlobal.descartadas = 0;
  clearTimeout(historicoGlobal.timer);
  historicoGlobal.ativo = true;
  historicoGlobal.aplicando = false;
  historicoGlobal.desfazer = [];
  historicoGlobal.refazer = [];
  historicoGlobal.pendente = null;
  historicoGlobal.timer = null;
}

function desativarHistoricoGlobal() {
  imagensHistorico.clear();
  clearTimeout(historicoGlobal.timer);
  historicoGlobal.ativo = false;
  historicoGlobal.aplicando = false;
  historicoGlobal.desfazer = [];
  historicoGlobal.refazer = [];
  historicoGlobal.pendente = null;
  historicoGlobal.timer = null;
}

function aplicarSnapshotsMapas(alteracoes, campo) {
  return new Promise(
    (resolve, reject) => {
      const transacao = transacaoMapas();

      for (const alteracao of alteracoes) {
        const valor =
          alteracao[campo];

        if (valor) {
          gravarMapaNaTransacao(transacao, cloneMapaHistorico(valor));
        } else {
          excluirMapaNaTransacao(transacao, alteracao.id);
        }
      }

      transacao.oncomplete =
        () => resolve();
      transacao.onerror =
        () => reject(transacao.error);
      transacao.onabort =
        () => reject(
          transacao.error ||
          new Error("Não foi possível restaurar o histórico.")
        );
    }
  );
}

async function atualizarInterfaceAposHistorico() {
  if (!projetoAtual) return;

  if (editor.ativo) {
    cancelarEdicaoObjeto();
  }

  const mapas =
    await dbListarResumosMapas();
  const idAtual =
    mapaAtual?.id;
  const destino =
    mapas.find(
      item => item.id === idAtual
    ) || mapas[0];

  if (destino) {
    await abrirMapa(destino.id);
  } else {
    mostrarTelaSemMapa();
    await atualizarSeletorMapas();
  }
}

async function desfazerHistoricoGlobal() {
  finalizarHistoricoGlobalPendente();

  const entrada =
    historicoGlobal.desfazer.pop();

  if (!entrada) {
    avisar("Não há mais ações para desfazer.");
    return false;
  }

  historicoGlobal.aplicando = true;

  try {
    await aplicarSnapshotsMapas(
      entrada.alteracoes,
      "antes"
    );
    historicoGlobal.refazer.push(
      entrada
    );
    await atualizarInterfaceAposHistorico();
    avisar("Última ação desfeita.");
    return true;
  } catch (erro) {
    historicoGlobal.desfazer.push(
      entrada
    );
    avisar(
      erro.message ||
      "Não foi possível desfazer a ação."
    );
    return false;
  } finally {
    historicoGlobal.aplicando = false;
  }
}

async function refazerHistoricoGlobal() {
  finalizarHistoricoGlobalPendente();

  const entrada =
    historicoGlobal.refazer.pop();

  if (!entrada) {
    avisar("Não há mais ações para refazer.");
    return false;
  }

  historicoGlobal.aplicando = true;

  try {
    await aplicarSnapshotsMapas(
      entrada.alteracoes,
      "depois"
    );
    historicoGlobal.desfazer.push(
      entrada
    );
    await atualizarInterfaceAposHistorico();
    avisar("Última ação refeita.");
    return true;
  } catch (erro) {
    historicoGlobal.refazer.push(
      entrada
    );
    avisar(
      erro.message ||
      "Não foi possível refazer a ação."
    );
    return false;
  } finally {
    historicoGlobal.aplicando = false;
  }
}
