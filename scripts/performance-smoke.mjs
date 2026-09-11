import { writeFileSync } from "node:fs";

async function medirProjeto({ nome, mapas, objetos }) {
  const projeto = {id:"perf-"+nome,nome:"Medição "+nome,schemaVersion:1};
  await dbSalvarProjeto(projeto);
  projetoAtual = projeto;
  desativarHistoricoGlobal();
  const imagem = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#223344"/></svg>') + "#" + "x".repeat(1024*1024);
  const categorias = [{id:"ponto",nome:"Locais",geometria:"unico",icone:"pin",cor:"#99AAFF"}];
  for(let m=0;m<mapas;m++) {
    await dbSalvar({id:projeto.id+"-"+m,nome:"Mapa "+m,projectId:projeto.id,imagem,largura:1600,altura:1000,categorias,
      objetos:Array.from({length:objetos},(_,i)=>({id:"obj-"+i,categoriaId:"ponto",nome:"Objeto "+i,x:50+i%40*35,y:50+Math.floor(i/40)*20})),fontesDados:[]},{historico:false});
  }
  const mediana = valores => [...valores].sort((a,b)=>a-b)[Math.floor(valores.length/2)];
  const listar = () => typeof dbListarResumosMapas === "function" ? dbListarResumosMapas() : dbTodos();
  await listar();
  const leituras=[];
  let resumo;
  for(let i=0;i<5;i++){const t=performance.now();resumo=await listar();leituras.push(performance.now()-t);}
  mapaAtual=await dbPegar(projeto.id+"-0");
  document.body.classList.remove("projects-visible", "sem-mapa");
  document.body.classList.add("modo-visualizacao", "painel-fechado");
  mapa.invalidateSize({animate:false});
  ui.modo="visualizacao";editor.ativo=false;editor.editandoId=null;
  renderMapaCompleto({forcarCompleto:true,resetCamera:true});
  const identidade=layersObjetos.get("obj-1").layers[0];
  const imagemOriginal=imageOverlay;
  const renders=[];
  for(let i=0;i<5;i++){
    mapaAtual.objetos[0].nome="Alterado "+i;
    const t=performance.now();renderMapaCompleto();mapa.getContainer().getBoundingClientRect();
    renders.push(performance.now()-t);
    await new Promise(r=>requestAnimationFrame(r));
  }
  const camadasPreservadas=layersObjetos.get("obj-1").layers[0]===identidade;
  const fundoPreservado=imageOverlay===imagemOriginal;
  iniciarHistoricoGlobal();
  const antes=cloneMapaHistorico(mapaAtual);
  for(let i=0;i<110;i++){
    mapaAtual.objetos[0].nome="Histórico "+i;
    registrarAlteracaoHistoricoGlobal(mapaAtual.id,antes,mapaAtual);
    finalizarHistoricoGlobalPendente();
  }
  const memoria=typeof estatisticasHistorico === "function" ? estatisticasHistorico() : {entradas:historicoGlobal.desfazer.length};
  desativarHistoricoGlobal();
  return {projeto:nome,mapas,objetosPorMapa:objetos,listagemMs:mediana(leituras),listagemAmostras:leituras,bytesListagem:JSON.stringify(resumo).length*2,
    atualizacaoMs:mediana(renders),atualizacaoAmostras:renders,camadasPreservadas,fundoPreservado,historico:memoria,
    ambiente:{userAgent:navigator.userAgent,largura:innerWidth,altura:innerHeight}};
}

export async function medirDesempenho({ avaliar, sessionId }) {
  const resultados = [];
  for (const [nome, mapas, objetos] of [["pequeno",4,100],["medio",12,500],["grande",30,1500]]) {
    const resultado = await avaliar(sessionId, "("+medirProjeto.toString()+")("+JSON.stringify({nome,mapas,objetos})+")");
    resultados.push(resultado);
    console.log("Desempenho: " + JSON.stringify(resultado));
  }
  const parametro = process.argv.find(arg => arg.startsWith("--performance-output="));
  if (parametro) writeFileSync(parametro.slice("--performance-output=".length), JSON.stringify(resultados,null,2)+"\n");
  return resultados;
}
