import { writeFileSync } from "node:fs";

export async function testarConsulta({ avaliar, enviar, sessionId }) {
  const check = code => avaliar(sessionId, `(async () => {
    const assert = (ok, mensagem) => { if (!ok) throw new Error(mensagem); };
    const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));
    ${code}
    return true;
  })()`);
  await check(`
    await dbSalvarProjeto({id:"reading-project", nome:"Leitura", schemaVersion:1});
    await abrirProjeto("reading-project");
    const categorias = [
      {id:"area",nome:"Região",geometria:"area",cor:"#AA99FF"},
      {id:"flora",nome:"Flora",geometria:"unico",icone:"pin",cor:"#99FFAA"},
      {id:"local",nome:"Locais",geometria:"unico",icone:"pin",cor:"#99AAFF"},
      {id:"portal",nome:"Portais",geometria:"unico",comportamento:"portal",icone:"portal",cor:"#CC99FF"}
    ];
    const objetos = [{id:"regiao",categoriaId:"area",nome:"Região de consulta",area:[{x:10,y:10},{x:990,y:10},{x:990,y:790},{x:10,y:790}]}];
    for(let i=0;i<240;i++) objetos.push({id:"item-"+i,categoriaId:i%2?"local":"flora",nome:"Item "+String(i).padStart(3,"0"),x:100+i%20*35,y:100+Math.floor(i/20)*40,descricao:("Descrição extensa com fungos e raízes. ").repeat(100)});
    objetos[5].entityRef = {sourceId:"fonte",recordId:"raro"};
    objetos.push({id:"portal-saida",categoriaId:"portal",nome:"Portal de saída",x:850,y:700,portalDestinoMapaId:"reading-destino",portalDestinoNome:"Destino",portalBidirecional:false});
    objetos.push({id:"chegada",categoriaId:"portal",nome:"Somente chegada",x:880,y:700,portalEntradaSomente:true});
    const imagem = "data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="#223344"/></svg>');
    await dbSalvar({id:"reading-mapa",nome:"Mapa de leitura",largura:1000,altura:800,imagem,categorias,objetos,fontesDados:[{id:"fonte",nome:"Botânica",titleColumn:"nome",headers:["nome","nota"],displayFields:[{column:"nota",label:"Nota"}],records:[{id:"raro",values:{nome:"Micélio raro",nota:"luminescência"}}]}]});
    await dbSalvar({id:"reading-destino",nome:"Destino",largura:1000,altura:800,imagem,categorias:[],objetos:[],fontesDados:[]});
    await abrirMapa("reading-mapa");
    setModo("visualizacao");
    definirPainelAberto(false);
  `);
  for (const [width,height] of [[1366,900],[390,844]]) {
    await enviar("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<700},sessionId);
    await check(`
      fecharConsultaNoPainel(false);
      mapa.invalidateSize();
      await esperar(100);
      // Com o mapa menor que a tela, maxBounds impede compensar o popup
      // movendo a câmera. A própria janela precisa continuar enquadrada.
      mapa.setZoom(-2, { animate: false });
      const layer = layersObjetos.get("regiao").layers[0];
      mapa.panBy([0, 100], { animate: true, duration: 1 });
      layer.openPopup();
      await esperar(350);
      const popup = layer.getPopup();
      const root = popup.getElement();
      let regiao = root.querySelector("[data-consulta-regiao]");
      // As camadas agora sobrevivem ao redesenho incremental, incluindo filtros.
      regiao.querySelector(".consulta-limpar").click();
      assert(regiao.querySelectorAll(".consulta-item").length===30,"Lista inicial limitada a 30 itens");
      assert(regiao.querySelector(".consulta-contagem").textContent.includes("242 de 242"),"Contagem total de região");
      const details = regiao.querySelector("details");
      // Reabrir a camada preservada também mantém os detalhes já expandidos.
      if (!details.open) details.querySelector("summary").click();
      await esperar(150);
      assert(details.open && details.querySelector(".regiao-detalhes").textContent.includes("Descrição extensa"),"Detalhes carregados sob demanda");
      popup.update();
      assert(details.isConnected && details.open,"Reposicionar mantém details aberto");
      const body = root.querySelector(".object-popup-body");
      assert(body.scrollHeight>body.clientHeight,"Conteúdo extenso tem rolagem interna");
      await esperar(350);
      const caixa = root.querySelector(".leaflet-popup-content-wrapper").getBoundingClientRect();
      const bounds = mapa.getContainer().getBoundingClientRect();
      assert(caixa.height<=422 && caixa.top>=bounds.top-2 && caixa.bottom<=bounds.bottom+2 && caixa.left>=bounds.left-2 && caixa.right<=bounds.right+2,"Popup compacto dentro do mapa em ${width}x${height}: "+JSON.stringify({caixa:caixa.toJSON(),bounds:bounds.toJSON(),limites:atualizarLimitesConsulta(),frame:framePopupConsulta,atual:popupConsultaAtual===popup,aberto:popup.isOpen(),animando:mapa._panAnim?._inProgress,visibilidade:document.visibilityState,autoPan:popup.options.autoPan,zoom:mapa.getZoom(),centro:mapa.getCenter(),limitesMapa:mapa.options.maxBounds,ancora:popup.getLatLng()}));
      const busca = regiao.querySelector("input");
      const tipo = regiao.querySelector("select");
      busca.value="luminescencia";
      busca.dispatchEvent(new Event("input",{bubbles:true}));
      assert(regiao.querySelectorAll(".consulta-item").length===1,"Busca encontra dados vinculados sem acentos");
      tipo.value="local";tipo.dispatchEvent(new Event("change",{bubbles:true}));
      assert(regiao.querySelector(".consulta-resultados").textContent.includes("Nenhum item"),"Filtros combinam busca e tipo");
      regiao.querySelector(".consulta-limpar").click();
      regiao.querySelector(".consulta-mais").click();
      assert(regiao.querySelectorAll(".consulta-item").length===60,"Mostrar mais carrega outro bloco");
      busca.value="Item 010";busca.dispatchEvent(new Event("input",{bubbles:true}));
      root.querySelector("[data-consulta-abrir]").click();
      await esperar(80);
      const painel=document.getElementById("painelConsulta");
      assert(!painel.hidden && consultaAberta.objetoId==="regiao","Abrir no painel funciona pelo botão");
      assert(painel.querySelector("input").value==="Item 010","Busca transferida para painel");
      painel.querySelector("[data-consulta-localizar]").click();
      await esperar(700);
      assert(!painel.hidden && painel.querySelector("input").value==="Item 010","Localizar mantém a consulta e seus filtros");
      const item = layersObjetos.get("item-10").layers[0].getElement().getBoundingClientRect();
      const rect = painel.getBoundingClientRect();
      assert(${width}>700 ? item.right < rect.left : item.bottom < rect.top,"Objeto localizado fica na parte descoberta do mapa");
      mapa.panBy([20,20],{animate:false});
      mapa.setZoom(mapa.getZoom()+.25,{animate:false});
      mapa.fire("click",{latlng:mapa.getCenter()});
      assert(!painel.hidden && painel.querySelector("input").value==="Item 010","Mover, ampliar e clicar preservam leitura");
      renderMapaCompleto();
      assert(painel.querySelector("input").value==="Item 010","Redesenhar preserva filtros");
      assert(rect.left>=0 && rect.right<=innerWidth && rect.bottom<=innerHeight && rect.height<=innerHeight*(innerWidth<700?.54:1),"Painel cabe na tela e reserva espaço para mapa");
      assert(document.documentElement.scrollWidth<=innerWidth,"Sem rolagem horizontal na página");
      const legenda = document.getElementById("abrirLegendaVisual").getBoundingClientRect();
      assert(legenda.right<=rect.left || legenda.bottom<=rect.top || legenda.top>=rect.bottom,"Atalho da legenda não sobrepõe a consulta");
      document.getElementById("fecharConsulta").click();
      assert(painel.hidden,"Consulta fecha explicitamente");
    `);
    for (const claro of [false, true]) {
      await check(`
        document.documentElement.classList.toggle("tema-claro", ${claro});
        abrirConsultaNoPainel("regiao"); await esperar(150);
        const painel = document.getElementById("painelConsulta");
        const primeiro = painel.querySelector(".consulta-item").getBoundingClientRect();
        assert(primeiro.top < painel.getBoundingClientRect().bottom - 40, "Primeiro resultado visível sem rolar no painel");
        assert(getComputedStyle(painel.querySelector("summary")).color === getComputedStyle(painel).color, "Texto dos itens acompanha o contraste do tema");
      `);
      if (process.argv.includes("--reading-screenshots")) {
        const captura = await enviar("Page.captureScreenshot", { format: "png" }, sessionId);
        writeFileSync(`/tmp/atlas-reading-${width}-${claro ? 'claro' : 'escuro'}.png`, Buffer.from(captura.data, "base64"));
        writeFileSync(`/tmp/atlas-reading-${width}.png`, Buffer.from(captura.data, "base64"));
      }
      await check(`fecharConsultaNoPainel(false);`);
    }
    console.log(`Consulta aprovada em ${width}×${height}: 242 itens, rolagem, filtros, dados, localização e leitura persistente.`);
  }
  await check(`
    setModo("visualizacao");
    const portal = layersObjetos.get("portal-saida").layers[0];
    portal.fire("click",{originalEvent:new MouseEvent("click")});
    await esperar(100);
    assert(mapaAtual.id==="reading-mapa","Clique em portal apenas consulta");
    portal.closePopup();portal.openPopup();portal.closePopup();portal.openPopup();
    portal.getPopup().getElement().querySelector("[data-consulta-abrir]").click();
    assert(!document.getElementById("painelConsulta").hidden,"Portal abre no painel");
    const original = navegarPortal;
    let chamadas=0;
    navegarPortal = async obj => { chamadas++; await original(obj); };
    document.getElementById("painelConsulta").querySelector("[data-consulta-portal]").click();
    for(let i=0;i<100 && mapaAtual.id!=="reading-destino";i++) await esperar(10);
    await esperar(100);
    navegarPortal=original;
    assert(chamadas===1 && mapaAtual.id==="reading-destino","Travessia explícita executada uma vez");
    assert(document.getElementById("painelConsulta").hidden,"Trocar mapa encerra consulta anterior");
    await abrirMapa("reading-mapa");
    abrirConsultaNoPainel("chegada");
    assert(!document.getElementById("painelConsulta").querySelector("[data-consulta-portal]"),"Chegada unidirecional não oferece travessia");
    fecharConsultaNoPainel(false);
  `);
}
