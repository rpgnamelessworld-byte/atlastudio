export async function testarConfiabilidade({ avaliar, sessionId, recarregarEEsperar }) {
  const check = async expression => avaliar(sessionId, `(async () => {
    function assert(ok, mensagem) { if (!ok) throw new Error(mensagem); console.log("Confiabilidade:", mensagem); }
    ${expression}
    return true;
  })()`);

  await check(`
    const projeto = { id: "reliability-project", nome: "Confiabilidade", schemaVersion: 1 };
    await dbSalvarProjeto(projeto);
    await abrirProjeto(projeto.id);
    const categorias = [
      { id: "p", nome: "Ponto", geometria: "unico", cor: "#CC99FF", icone: "pin" },
      { id: "a", nome: "Região", geometria: "area", cor: "#CC99FF" },
      { id: "l", nome: "Ligação", geometria: "linha", comportamentoLinha: "relacao", cor: "#CC99FF", largura: 4 },
      { id: "portal-test", nome: "Portal", geometria: "unico", comportamento: "portal", cor: "#CC99FF", icone: "portal" }
    ];
    const imagem = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="#334455"/></svg>');
    const area = [{x:10,y:10},{x:310,y:10},{x:310,y:90},{x:90,y:90},{x:90,y:250},{x:310,y:250},{x:310,y:330},{x:10,y:330}];
    for (const id of ["reliability-a", "reliability-b"]) {
      await dbSalvar({ id, nome: id, largura: 1000, altura: 800, imagem, categorias: clone(categorias), fontesDados: [],
        objetos: [{id:"p1", categoriaId:"p", nome:"Marco", x:id.endsWith("a") ? 400 : 900, y:400},
          {id:"a1", categoriaId:"a", nome:"Área côncava", area}] });
    }
    await abrirMapa("reliability-a");
    const ancora = ancoraObjetoRelacao(mapaAtual, objetoPorId("a1"));
    assert(pontoDentroPoligono(ancora, area), "Âncora precisa ficar dentro da área côncava");
    setModo("edicao");
    iniciarCriacaoObjeto("l");
    await editor.carregamento;
    lineRelationControls.origem.value = "a1";
    lineRelationControls.destinoMapa.value = "reliability-b";
    preencherObjetosRelacaoLinha("destino", "p1");
    aplicarRelacaoLinha();
    assert(editor.pontos.length === 2 && editor.pontos[1].x !== 900, "Passagem não deve usar coordenadas remotas");
    nomeObjeto.value = "Travessia";
    await salvarObjetoAtual();
    await filaRascunhos;
    const linha = mapaAtual.objetos.find(o => o.nome === "Travessia");
    assert(linha.relacaoVersao === 2 && linha.relacaoDestinoMapaId === "reliability-b", "Referência remota salva");
    assert(layersObjetos.get(linha.id).layers.some(l => l.getElement?.()?.classList.contains("map-passage-marker")), "Passagem visível");
    const pacote = await montarBackupProjetoAtual();
    const importacao = prepararProjetoImportado(pacote, pacote.mapas.map(m => m.id));
    assert(verificarVinculosMapas(importacao.mapas).length === 0, "Backup remapeia todas as ligações");
    await persistirProjetoImportado(importacao);
    assert((await dbTodosGlobais()).some(m => m.projectId === importacao.projeto.id), "Restauração realmente persistida");
    const remoto = await dbPegar("reliability-b");
    remoto.nome = "Destino renomeado";
    remoto.objetos[0].nome = "Marco renomeado";
    remoto.objetos[0].x = 700;
    await dbSalvar(remoto);
    setModo("visualizacao");
    const marcador = layersObjetos.get(linha.id).layers.find(l => l.getElement?.()?.classList.contains("map-passage-marker"));
    marcador.openPopup();
    for(let i=0; i<100 && !marcador.getPopup().getElement()?.textContent.includes("Marco renomeado"); i++) await new Promise(r => setTimeout(r,10));
    assert(marcador.getPopup().getElement().textContent.includes("Destino renomeado"), "Passagem resolve nomes atuais");
    marcador.getPopup().getElement().querySelector("button.object-popup-link-button").click();
    for(let i=0; i<100 && mapaAtual.id !== "reliability-b"; i++) await new Promise(r => setTimeout(r,10));
    assert(mapaAtual.id === "reliability-b", "Botão abre o mapa remoto");
    await new Promise(r => setTimeout(r,150));
    await abrirMapa("reliability-a");
    setModo("edicao");
    iniciarCriacaoObjeto("l");
    await editor.carregamento;
    lineRelationControls.origem.value = "a1";
    lineRelationControls.destino.value = "p1";
    aplicarRelacaoLinha();
    nomeObjeto.value = "Ligação local";
    await salvarObjetoAtual();
    const local = mapaAtual.objetos.find(o => o.nome === "Ligação local");
    objetoPorId("p1").x = 420;
    assert(pontosLinha(local, categoriaPorId("l")).at(-1).x === 420, "Ligação local acompanha movimento");
    await dbSalvar(mapaAtual);
    const quebrado = clone(importacao.mapas);
    const destino = quebrado.find(m => m.id === quebrado.flatMap(m => m.objetos).find(o => o.nome === "Travessia").relacaoDestinoMapaId);
    destino.objetos = destino.objetos.filter(o => o.id !== "p1");
    assert(verificarVinculosMapas(quebrado).some(p => p.erro === "Objeto ausente"), "Diagnóstico de destino removido");
    const invalido = clone(pacote);
    invalido.mapas[0].objetos.push(clone(invalido.mapas[0].objetos[0]));
    let rejeitado = false;
    try { prepararProjetoImportado(invalido, []); } catch { rejeitado = true; }
    assert(rejeitado, "Backup com objetos duplicados deve ser rejeitado");
    const futuro = {...pacote, schemaVersion: 999};
    rejeitado = false;
    try { prepararProjetoImportado(futuro, []); } catch { rejeitado = true; }
    assert(rejeitado, "Versão futura deve ser rejeitada");
    const antes = await dbTodos();
    const antigos = antes.map(m => m.nome);
    const transacaoOriginal = db.transaction.bind(db);
    db.transaction = (...args) => {
      const tx = transacaoOriginal(...args);
      if (args[1] === "readwrite") queueMicrotask(() => tx.abort());
      return tx;
    };
    rejeitado = false;
    try { await salvarMapasAtomicos(antes.map(m => ({...m, nome:"NÃO SALVAR"}))); } catch { rejeitado = true; }
    finally { db.transaction = transacaoOriginal; }
    assert(rejeitado && (await dbTodos()).every((m,i) => m.nome === antigos[i]), "Abortar transação preserva todos os mapas");
    iniciarCriacaoObjeto("p");
    await Promise.resolve();
    nomeObjeto.value = "Rascunho após recarga";
    descricaoObjeto.value = "Texto ainda não confirmado";
    editor.pontos = [{x:500,y:500}];
    agendarRascunho();
    await preservarRascunhoAtual();
    assert((await listarRascunhos()).some(r => r.campos.some(c => c.valor === "Rascunho após recarga")), "Rascunho persistido");
    assert(!(await dbPegar(mapaAtual.id)).objetos.some(o => o.nome === "Rascunho após recarga"), "Rascunho não cria objeto antes de salvar");
  `);

  const restaurado = await recarregarEEsperar(sessionId, `mapaAtual?.id === "reliability-a" && !document.getElementById("recuperacaoRascunho").hidden`);
  if (!restaurado) throw new Error("Rascunho não oferecido após recarga");

  await check(`
    const r = (await listarRascunhos()).find(r => r.campos.some(c => c.valor === "Rascunho após recarga"));
    await restaurarRascunho(r);
    assert(nomeObjeto.value === "Rascunho após recarga" && editor.pontos[0].x === 500, "Restauração de texto e geometria");
    const salvarOriginal = salvarMapasAtomicos;
    salvarMapasAtomicos = async () => { throw new Error("Falha simulada"); };
    let falhou = false;
    const total = mapaAtual.objetos.length;
    try { await salvarObjetoAtual(); } catch { falhou = true; }
    finally { salvarMapasAtomicos = salvarOriginal; }
    assert(falhou && editor.ativo && nomeObjeto.value === "Rascunho após recarga" && mapaAtual.objetos.length === total, "Falha mantém edição aberta sem duplicar objeto");
    await salvarObjetoAtual();
    await filaRascunhos;
    assert((await dbPegar(mapaAtual.id)).objetos.filter(o => o.nome === "Rascunho após recarga").length === 1, "Nova tentativa grava exatamente um objeto");
    assert(!(await listarRascunhos()).some(d => d.id === r.id), "Salvar remove rascunho recuperado");
    iniciarCriacaoObjeto("p");
    await Promise.resolve();
    nomeObjeto.value = "Descartar este rascunho";
    await preservarRascunhoAtual();
    const id = sessaoRascunho.id;
    cancelarEdicaoObjeto();
    await filaRascunhos;
    assert(!(await listarRascunhos()).some(d => d.id === id), "Cancelar descarta rascunho ativo");
    iniciarCriacaoObjeto("portal-test");
    await editor.carregamento;
    nomeObjeto.value = "Portal transacional";
    editor.pontos = [{x:600,y:500}];
    portalMapaDestino.value = "reliability-b";
    await salvarObjetoAtual();
    const portal = mapaAtual.objetos.find(o => o.nome === "Portal transacional");
    const par = (await dbPegar("reliability-b")).objetos.find(o => o.id === portal.portalParObjetoId);
    assert(par?.portalParObjetoId === portal.id, "Portal e retorno gravados juntos");
    assert(verificarVinculosMapas(await dbTodos()).length === 0, "Projeto final sem vínculos quebrados");
    abrirModalCategoria();
    await Promise.resolve();
    nomeCategoria.value = "Tipo em rascunho";
    corHex.value = "#AABBCC";
    await preservarRascunhoAtual();
    const tipo = (await listarRascunhos()).find(r => r.tipo === "categoria" && r.campos.some(c => c.valor === "Tipo em rascunho"));
    assert(Boolean(tipo), "Rascunho de tipo incompleto é persistido");
    await abrirMapa("reliability-b");
    await abrirMapa("reliability-a");
    await restaurarRascunho(tipo);
    assert(nomeCategoria.value === "Tipo em rascunho" && corHex.value === "#AABBCC", "Recuperação de tipo após trocar mapa");
    fecharModalCategoria();
    await filaRascunhos;
    iniciarCriacaoObjeto("p");
    await Promise.resolve();
    nomeObjeto.value = "Sem posição ainda";
    let incompleto = false;
    try { await salvarProjetoAtual(); } catch { incompleto = true; }
    assert(incompleto && editor.ativo && !editor.pontos.length, "Salvar projeto não anuncia sucesso com formulário incompleto");
    const incompletoId = sessaoRascunho.id;
    await abrirMapa("reliability-b");
    assert((await listarRascunhos()).some(r => r.id === incompletoId), "Trocar mapa preserva rascunho incompleto");
  `);
  console.log("Confiabilidade aprovada: ligações locais/remotas, navegação, backup restaurado, validação, transações abortadas, falha e nova tentativa, rascunhos de objetos e tipos.");
}
