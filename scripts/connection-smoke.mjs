import { writeFileSync } from "node:fs";

export async function testarConexoes({ avaliar, enviar, sessionId }) {
  await enviar("Emulation.setDeviceMetricsOverride", { width: 1366, height: 844, deviceScaleFactor: 1, mobile: false }, sessionId);
  await avaliar(sessionId, '(' + verificarConexoes.toString() + ')()');
  await avaliar(sessionId, '(' + verificarNavegacaoEPares.toString() + ')()');
  for (const width of [1366, 390]) {
    await enviar("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width < 700 }, sessionId);
    for (const claro of [false, true]) {
      await avaliar(sessionId, `document.documentElement.classList.toggle('tema-claro', ${claro}); void mapa.invalidateSize();`);
      for (const cenario of ['simples', 'conexao', 'painel', 'selecao', 'edicao', 'formulario', 'formulario-destino', 'formulario-passagem']) {
        await avaliar(sessionId, '(' + verificarAparenciaConexao.toString() + ')(' + JSON.stringify(cenario) + ')');
        if (process.argv.includes('--connection-screenshots')) {
          const shot = await enviar('Page.captureScreenshot', { format: 'png' }, sessionId);
          writeFileSync(`/tmp/atlas-conexao-${width}-${claro ? 'claro' : 'escuro'}-${cenario}.png`, Buffer.from(shot.data, 'base64'));
        }
      }
    }
  }
  console.log('Conexões aprovadas: quatro marcações, destinos Único/Área/Linha/posição, ida e volta, somente ida, exclusão de pares, ícones, seleção no mapa, cancelamento, backup, rascunho e painéis nos dois temas/tamanhos.');
}

async function verificarConexoes() {
  const assert = (ok, texto) => { if (!ok) throw new Error(texto); };
  cancelarEdicaoObjeto();
  const projeto = { id: 'connection-test', nome: 'Conexões', schemaVersion: 1 };
  await dbSalvarProjeto(projeto); await abrirProjeto(projeto.id);
  const categorias = [
    {id:'p',nome:'Cidades',geometria:'unico',icone:'portal',cor:'#CC99FF'},
    {id:'a',nome:'Regiões',geometria:'area',cor:'#99CCFF'},
    {id:'l',nome:'Estradas',geometria:'linha',cor:'#99CCFF',largura:4},
    {id:'c',nome:'Conexão caminho',geometria:'conexao',conexaoRepresentacao:'caminho',cor:'#CC99FF',largura:4},
    {id:'s',nome:'Conexão passagem',geometria:'conexao',conexaoRepresentacao:'passagem',icone:'portal',cor:'#CC99FF'}
  ];
  const imagem='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="#223344"/></svg>');
  for(const id of ['connection-a','connection-b']) await dbSalvar({id,nome:id,imagem,largura:1000,altura:800,categorias:clone(categorias),fontesDados:[],objetos:[
    {id:'p1',categoriaId:'p',nome:'Cidade Cogumelo',x:250,y:300},
    {id:'a1',categoriaId:'a',nome:'Floresta',area:[{x:20,y:20},{x:200,y:20},{x:200,y:200},{x:20,y:200}]},
    {id:'l1',categoriaId:'l',nome:'Estrada principal',pontos:[{x:300,y:400},{x:700,y:400}]}]});
  await abrirMapa('connection-a'); setModo('edicao');
  assert([...geometriaCategoria.options].map(o=>o.value).join(',')==='unico,linha,area,conexao','Quatro opções de marcação');
  abrirModalCategoria(); nomeCategoria.value='Nova passagem'; geometriaCategoria.value='conexao';
  document.getElementById('representacaoConexao').value='passagem'; atualizarCamposGeometria();
  assert(!campoIconeCategoria.hidden && campoComportamentoUnico.hidden,'Conexão oferece ícone sem comportamento Portal separado');
  await salvarCategoriaForm();
  assert(mapaAtual.categorias.some(c=>c.nome==='Nova passagem' && c.geometria==='conexao' && c.comportamento==='portal'),'Cadastro persiste a quarta marcação');
  iniciarCriacaoObjeto('c'); await editor.carregamento;
  lineRelationControls.origem.value='a1'; lineRelationControls.destino.value='l1';
  document.getElementById('lineRelationDestinationFracao').value='25'; aplicarRelacaoLinha();
  assert(editor.pontos.at(-1).x===400,'Encontro em posição escolhida na Linha');
  nomeObjeto.value='Caminho local'; await salvarObjetoAtual(); await filaRascunhos;
  const local=mapaAtual.objetos.find(o=>o.nome==='Caminho local');
  objetoPorId('l1').pontos[1].x=900;
  assert(pontosLinha(local,categoriaPorId('c')).at(-1).x===450,'Encontro acompanha ajuste da Linha');
  await dbSalvar(mapaAtual);
  iniciarCriacaoObjeto('c'); await editor.carregamento;
  lineRelationControls.origem.value='p1'; lineRelationControls.destinoMapa.value='connection-b';
  preencherObjetosRelacaoLinha('destino','a1'); aplicarRelacaoLinha();
  document.getElementById('lineRelationNavigation').value='volta'; nomeObjeto.value='Travessia com retorno';
  await salvarObjetoAtual(); await filaRascunhos;
  let caminho=mapaAtual.objetos.find(o=>o.nome==='Travessia com retorno');
  let destino=await dbPegar('connection-b');
  let retorno=destino.objetos.find(o=>o.id===caminho.portalParObjetoId);
  assert(retorno && retorno.portalParObjetoId===caminho.id,'Retorno recíproco do caminho');
  assert(destino.categorias.find(c=>c.id===retorno.categoriaId).conexaoRepresentacao==='passagem','Retorno não transforma o caminho em ponto');
  const n=destino.objetos.length;
  selecionarObjeto(caminho.id); editarObjetoSelecionado(); await editor.carregamento;
  nomeObjeto.value='Travessia atualizada'; await salvarObjetoAtual(); await filaRascunhos;
  assert((await dbPegar('connection-b')).objetos.length===n,'Editar caminho não duplica chegada');
  caminho=mapaAtual.objetos.find(o=>o.nome==='Travessia atualizada');
  await abrirMapa('connection-b'); setModo('edicao'); selecionarObjeto(retorno.id); editarObjetoSelecionado(); await editor.carregamento;
  editor.pontos=[{x:350,y:350}]; await salvarObjetoAtual(); await filaRascunhos;
  const fonte=await dbPegar('connection-a');
  assert(fonte.objetos.find(o=>o.id===caminho.id).pontos.length===2,'Editar retorno preserva geometria do caminho');
  await abrirMapa('connection-a'); setModo('edicao');
  iniciarCriacaoObjeto('s'); await editor.carregamento;
  portalMapaDestino.value='connection-b'; await atualizarAreasDestinoPortal('connection-b','p1');
  portalDirecao.value='bidirecional'; nomeObjeto.value='Passagem da cidade'; editor.pontos=[{x:450,y:300}];
  await salvarObjetoAtual(); await filaRascunhos;
  const passagem=mapaAtual.objetos.find(o=>o.nome==='Passagem da cidade');
  assert(passagem.portalDestinoObjetoId==='p1','Passagem aponta para objeto Único');
  selecionarObjeto(passagem.id); editarObjetoSelecionado(); await editor.carregamento; atualizarPreview();
  const handle=editor.handles[0].getElement().querySelector('.objeto-em-edicao');
  const esperado=document.createElement('div'); esperado.innerHTML=iconeSvg(categoriaPorId('s').icone);
  assert(handle.querySelector('svg').outerHTML===esperado.querySelector('svg').outerHTML,'Edição conserva o ícone real');
  assert(getComputedStyle(handle).color!=='rgba(0, 0, 0, 0)' && handle.getBoundingClientRect().width===44,'Ícone não fica invisível ou reduzido a uma bolinha');
  editor.pontos=[{x:650,y:600}]; cancelarEdicaoObjeto();
  assert(objetoPorId(passagem.id).x===450,'Cancelar preserva posição original');
  iniciarCriacaoObjeto('c'); await editor.carregamento;
  const e=seletoresConexao.get(lineRelationControls.origem); e.root.querySelector('button').click();
  layersObjetos.get('p1').layers[0].fire('click', {latlng:pixelParaMapa(250,300),originalEvent:new MouseEvent('click')});
  assert(lineRelationControls.origem.value==='p1' && !selecaoConexaoNoMapa,'Escolha encerra o modo de seleção');
  const seletorDestino = seletoresConexao.get(lineRelationControls.destino);
  for (const termo of ['estrada', 'ESTRADAS']) {
    seletorDestino.busca.value = termo; seletorDestino.busca.dispatchEvent(new Event('input', {bubbles:true}));
    assert([...lineRelationControls.destino.options].some(o=>o.value==='l1') && ![...lineRelationControls.destino.options].some(o=>o.value==='a1'), 'Busca filtra nome e categoria');
  }
  seletorDestino.root.querySelector('button').click();
  definirPainelAberto(false);
  mapa.invalidateSize();
  mapa.panTo(pixelParaMapa(450,400), {animate:false});
  const pontoLinha = mapa.latLngToContainerPoint(pixelParaMapa(450,400));
  const caixaMapa = mapa.getContainer().getBoundingClientRect();
  const alvoLinha = layersObjetos.get('l1').layers[0].getElement();
  alvoLinha.dispatchEvent(new MouseEvent('click', {clientX:caixaMapa.left+pontoLinha.x,clientY:caixaMapa.top+pontoLinha.y,bubbles:true}));
  assert(lineRelationControls.destino.value==='l1' && Math.abs(referenciaDoSeletor(lineRelationControls.destino).fracao - .25)<.001, 'Seleção na Linha define ponto de encontro: ' + JSON.stringify({ref:referenciaDoSeletor(lineRelationControls.destino),pontoLinha,caixaMapa:{left:caixaMapa.left,top:caixaMapa.top}}));
  seletorDestino.root.querySelector('button').click();
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
  assert(!selecaoConexaoNoMapa && editor.ativo, 'Escape cancela seleção sem abandonar formulário');
  configurarSeletorConexao(lineRelationControls.destino,mapaAtual,'@posicao',{posicao:{x:800,y:700}}); aplicarRelacaoLinha();
  nomeObjeto.value='Conexão por posição'; await preservarRascunhoAtual();
  const r=(await listarRascunhos()).find(r=>r.id===sessaoRascunho.id);
  cancelarEdicaoObjeto({preservarRascunho:true}); await restaurarRascunho(r);
  assert(referenciaDoSeletor(lineRelationControls.destino).posicao.x===800,'Rascunho recupera coordenadas de conexão');
  await salvarObjetoAtual(); await filaRascunhos;
  const pacote=await montarBackupProjetoAtual();
  const importado=prepararProjetoImportado(pacote,pacote.mapas.map(m=>m.id));
  assert(verificarVinculosMapas(importado.mapas).length===0,'Backup remapeia posições, objetos e pares de conexão');
  const ruim=clone(pacote); ruim.mapas[0].objetos[0].portalDestinoPosicao={x:null,y:1};
  let rejeitado=false; try{validarPacoteProjeto(ruim);}catch{rejeitado=true;}
  assert(rejeitado,'Backup rejeita coordenadas inválidas');
  setModo('visualizacao');
  const marker=layersObjetos.get(passagem.id).layers[0];
  marker.openPopup();
  assert(mapaAtual.id==='connection-a','Consulta não atravessa automaticamente');
  await navegarPortal(passagem);
  assert(mapaAtual.id==='connection-b','Travessia explícita funciona');
  await abrirMapa('connection-a'); setModo('visualizacao');
}

async function verificarNavegacaoEPares() {
  const assert = (ok, texto) => { if (!ok) throw new Error(texto); };
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const atravessar = async (obj, destino) => {
    setModo('visualizacao');
    const layer = layersObjetos.get(obj.id).layers[0];
    layer.openPopup();
    await esperar(100);
    const mapaAntes = mapaAtual.id;
    assert(mapaAntes !== destino, 'Abrir consulta mantém mapa de origem');
    layer.getPopup().getElement().querySelector('[data-consulta-portal], [data-consulta-conexao]').click();
    for (let i = 0; i < 100 && mapaAtual.id !== destino; i++) await esperar(20);
    await esperar(300);
    assert(mapaAtual.id === destino, 'Botão atravessa para ' + destino);
  };
  const remover = async obj => {
    setModo('edicao'); selecionarObjeto(obj.id);
    const removido = removerObjetoSelecionado();
    await esperar(30);
    assert(document.querySelector('.system-dialog[open]').textContent.includes('também será removido'), 'Exclusão informa remoção do par');
    document.querySelector('.system-dialog-confirm').click();
    await removido;
    assert(!objetoPorId(obj.id), 'Objeto excluído do mapa aberto');
    assert(!(await dbPegar(obj.portalParMapaId)).objetos.some(o => o.id === obj.portalParObjetoId), 'Par excluído do mapa remoto');
  };
  await abrirMapa('connection-a');
  const semPar = mapaAtual.objetos.find(o => o.nome === 'Caminho local');
  assert(!semPar.conexaoNavegavel && !semPar.portalParObjetoId, 'Somente conectar não cria chegada');
  const caminho = mapaAtual.objetos.find(o => o.nome === 'Travessia atualizada');
  await atravessar(caminho, 'connection-b');
  await atravessar(objetoPorId(caminho.portalParObjetoId), 'connection-a');

  for (const [local, ref, direcao] of [
    ['a1', {}, 'bidirecional'],
    ['l1', {fracao: .25}, 'unidirecional'],
    ['@posicao', {posicao: {x: 760, y: 620}}, 'bidirecional']
  ]) {
    setModo('edicao'); iniciarCriacaoObjeto('s'); await editor.carregamento;
    portalMapaDestino.value = 'connection-b';
    await atualizarAreasDestinoPortal('connection-b', local, ref);
    portalDirecao.value = direcao; nomeObjeto.value = 'Destino ' + local;
    editor.pontos = [{x: 500, y: 250}];
    await salvarObjetoAtual(); await filaRascunhos;
    const obj = mapaAtual.objetos.find(o => o.nome === 'Destino ' + local);
    const destino = await dbPegar('connection-b');
    const chegada = destino.objetos.find(o => o.id === obj.portalParObjetoId);
    const posicao = posicaoReferenciaConexao(destino, referenciaPortal(obj));
    assert(chegada.x === posicao.x && chegada.y === posicao.y, 'Chegada posicionada no destino ' + local);
    if (local === 'l1') assert(chegada.x === 400 && chegada.y === 400, 'Passagem respeita 25% da Linha');
    if (local === '@posicao') assert(chegada.x === 760 && chegada.y === 620, 'Passagem respeita posição livre');
    await atravessar(obj, 'connection-b');
    if (direcao === 'unidirecional') {
      assert(chegada.portalEntradaSomente && !chegada.portalDestinoMapaId, 'Somente ida cria chegada sem retorno');
      const layer = layersObjetos.get(chegada.id).layers[0]; layer.openPopup();
      assert(!layer.getPopup().getElement().querySelector('[data-consulta-portal]'), 'Chegada não oferece travessia de volta');
      await remover(chegada);
      await abrirMapa('connection-a');
    } else {
      await atravessar(objetoPorId(chegada.id), 'connection-a');
      await remover(obj);
    }
  }
  setModo('edicao'); selecionarObjeto(caminho.id); editarObjetoSelecionado(); await editor.carregamento;
  document.getElementById('lineRelationNavigation').value = 'ida';
  await salvarObjetoAtual(); await filaRascunhos;
  let chegada = (await dbPegar('connection-b')).objetos.find(o => o.id === caminho.portalParObjetoId);
  assert(chegada.portalEntradaSomente, 'Alterar caminho para somente ida remove retorno');
  selecionarObjeto(caminho.id); editarObjetoSelecionado(); await editor.carregamento;
  document.getElementById('lineRelationNavigation').value = 'nenhuma';
  await salvarObjetoAtual(); await filaRascunhos;
  assert(!(await dbPegar('connection-b')).objetos.some(o => o.id === chegada.id), 'Somente conectar remove chegada antiga');
  selecionarObjeto(caminho.id); editarObjetoSelecionado(); await editor.carregamento;
  document.getElementById('lineRelationNavigation').value = 'volta';
  await salvarObjetoAtual(); await filaRascunhos;
  const parId = objetoPorId(caminho.id).portalParObjetoId;
  await abrirMapa('connection-b');
  await remover(objetoPorId(parId));
  await abrirMapa('connection-a');
  assert(verificarVinculosMapas(await dbTodos()).length === 0, 'Exclusões mantêm projeto sem vínculos quebrados');
}

async function verificarAparenciaConexao(cenario) {
  const assert=(ok,texto)=>{if(!ok)throw new Error(texto);};
  cancelarEdicaoObjeto(); fecharConsultaNoPainel(false); setModo('visualizacao'); definirPainelAberto(false);
  const obj=cenario === 'simples' ? objetoPorId('p1') : mapaAtual.objetos.find(o=>o.nome==='Passagem da cidade');
  mapa.panTo(pixelParaMapa(obj.x,obj.y)); layersObjetos.get(obj.id).layers[0].openPopup();
  await new Promise(r=>setTimeout(r,250));
  const root=document.querySelector('.leaflet-popup .object-popup');
  const buttons=[...root.querySelectorAll('.consulta-toolbar button')];
  assert(buttons.every(b=>b.getBoundingClientRect().height >= (innerWidth<700?44:36)),'Botões de consulta têm altura confortável');
  const rect=root.getBoundingClientRect();
  assert(rect.left>=0 && rect.right<=innerWidth+1 && rect.bottom<=innerHeight && rect.top>=0,'Popup dentro da tela');
  assert(root.scrollWidth<=root.clientWidth,'Popup sem overflow horizontal');
  if (cenario === 'simples' || cenario === 'conexao') return;
  if (cenario === 'painel') {
    root.querySelector('[data-consulta-abrir]').click();
    await new Promise(r=>setTimeout(r,200));
    const panel = document.getElementById('painelConsulta');
    const rect = panel.getBoundingClientRect();
    assert(rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, 'Consulta de conexão cabe na tela');
    assert(panel.querySelector('[data-consulta-portal]'), 'Painel mantém ação explícita de travessia');
    return;
  }
  mapa.closePopup(); setModo('edicao');
  if (cenario === 'selecao' || cenario === 'edicao') {
    selecionarObjeto(obj.id); definirPainelAberto(false);
    if (cenario === 'edicao') { editarObjetoSelecionado(); await editor.carregamento; definirPainelAberto(false); }
    await new Promise(r=>setTimeout(r,200));
    const icon = cenario === 'edicao' ? editor.handles[0].getElement().querySelector('.objeto-em-edicao') : layersObjetos.get(obj.id).layers[0].getElement().querySelector('.marcador-icone');
    assert(icon.querySelector('svg'), 'Ícone visível durante ' + cenario);
    assert(getComputedStyle(icon)[cenario === 'edicao' ? 'borderTopWidth' : 'outlineWidth'] === '2px', 'Contorno durante ' + cenario);
    return;
  }
  if (cenario === 'formulario-passagem') {
    iniciarCriacaoObjeto('s'); await editor.carregamento;
    portalMapaDestino.value = 'connection-a';
    await atualizarAreasDestinoPortal('connection-a', 'l1', {fracao: .25});
    definirPainelAberto(true);
    document.getElementById('grupoPortalAreaDestino').scrollIntoView({block: 'start'});
    await new Promise(r=>setTimeout(r,200));
    const form = document.getElementById('formObjeto');
    assert(form.scrollWidth <= form.clientWidth + 1, 'Formulário de passagem cabe na tela');
    return;
  }
  iniciarCriacaoObjeto('c'); await editor.carregamento;
  lineRelationControls.origem.value='p1'; lineRelationControls.destino.value='a1'; aplicarRelacaoLinha();
  definirPainelAberto(true);
  await new Promise(r=>setTimeout(r,200));
  const form=document.getElementById('formObjeto');
  assert(form.scrollWidth<=form.clientWidth+1,'Formulário de conexão não excede largura do painel');
  const fields=[...form.querySelectorAll('.line-relation-endpoint')];
  assert(fields.every(f=>getComputedStyle(f).borderLeftWidth==='0px'),'Sem caixas aninhadas nas extremidades');
  if (cenario === 'formulario-destino') {
    configurarSeletorConexao(lineRelationControls.destino, mapaAtual, '@posicao', {posicao:{x:800,y:700}});
    aplicarRelacaoLinha();
  }
  fields[cenario === 'formulario-destino' ? 1 : 0].scrollIntoView({block:'start'});
  await new Promise(r=>setTimeout(r,200));
}
