import { mkdtempSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testarConfiabilidade } from "./reliability-smoke.mjs";
import { testarConsulta } from "./reading-smoke.mjs";
import { medirDesempenho } from "./performance-smoke.mjs";
import { testarOtimizacoes } from "./optimization-smoke.mjs";
import { testarConexoes } from "./connection-smoke.mjs";

const url = process.argv[2] || "http://127.0.0.1:4173/index.html";
const perfil = mkdtempSync(join(tmpdir(), "atlas-smoke-"));
const chrome = spawn(
  process.env.CHROME_BIN || "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--remote-debugging-pipe",
    `--user-data-dir=${perfil}`,
    "about:blank"
  ],
  { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] }
);

let proximoId = 1;
let buffer = Buffer.alloc(0);
const pendentes = new Map();
const erros = [];

chrome.stderr.on("data", () => {});
chrome.stdio[4].on("data", dados => {
  buffer = Buffer.concat([buffer, dados]);
  let fim;
  while ((fim = buffer.indexOf(0)) >= 0) {
    const texto = buffer.subarray(0, fim).toString("utf8");
    buffer = buffer.subarray(fim + 1);
    if (!texto) continue;
    const mensagem = JSON.parse(texto);
    if (mensagem.id && pendentes.has(mensagem.id)) {
      const { resolve, reject } = pendentes.get(mensagem.id);
      pendentes.delete(mensagem.id);
      mensagem.error ? reject(new Error(mensagem.error.message)) : resolve(mensagem.result);
      continue;
    }
    if (mensagem.method === "Runtime.exceptionThrown") {
      erros.push(mensagem.params.exceptionDetails.text || "Exceção JavaScript");
    }
    if (mensagem.method === "Log.entryAdded" && mensagem.params.entry.level === "error") {
      erros.push(mensagem.params.entry.text);
    }
    if (mensagem.method === "Runtime.consoleAPICalled") {
      const linha = mensagem.params.args.map(arg => arg.value || "").join(" ");
      if (linha.startsWith("Confiabilidade:")) console.log(linha);
    }
  }
});

function enviar(method, params = {}, sessionId) {
  const id = proximoId++;
  const mensagem = { id, method, params };
  if (sessionId) mensagem.sessionId = sessionId;
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject });
    chrome.stdio[3].write(`${JSON.stringify(mensagem)}\0`);
  });
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function avaliar(sessionId, expression) {
  let temporizador;
  const limite = new Promise((_, reject) => { temporizador = setTimeout(() => reject(new Error("Tempo excedido ao avaliar o cenário no navegador.")), 45000); });
  const resposta = await Promise.race([enviar(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  ), limite]).finally(() => clearTimeout(temporizador));
  if (resposta.exceptionDetails) {
    throw new Error(
      resposta.exceptionDetails.exception?.description ||
      resposta.exceptionDetails.text ||
      "Falha ao avaliar a página"
    );
  }
  return resposta.result.value;
}

async function confirmarHover(sessionId, seletor) {
  const antes = await avaliar(
    sessionId,
    `(() => {
      const elemento = document.querySelector(${JSON.stringify(seletor)});
      if (!elemento) return null;
      if ("disabled" in elemento) elemento.disabled = false;
      const caixa = elemento.getBoundingClientRect();
      const estilo = getComputedStyle(elemento);
      return {
        x: caixa.left + caixa.width / 2,
        y: caixa.top + caixa.height / 2,
        fundo: estilo.backgroundColor,
        borda: estilo.borderColor,
        cor: estilo.color,
        sombra: estilo.boxShadow
      };
    })()`
  );
  if (!antes) return false;

  await enviar(
    "Input.dispatchMouseEvent",
    { type: "mouseMoved", x: antes.x, y: antes.y },
    sessionId
  );
  await esperar(180);

  const depois = await avaliar(
    sessionId,
    `(() => {
      const estilo = getComputedStyle(document.querySelector(${JSON.stringify(seletor)}));
      return {
        fundo: estilo.backgroundColor,
        borda: estilo.borderColor,
        cor: estilo.color,
        sombra: estilo.boxShadow
      };
    })()`
  );

  await enviar(
    "Input.dispatchMouseEvent",
    { type: "mouseMoved", x: 0, y: 0 },
    sessionId
  );
  await esperar(180);

  return ["fundo", "borda", "cor", "sombra"]
    .some(propriedade => antes[propriedade] !== depois[propriedade]);
}

async function aguardarAplicacao(sessionId) {
  // O perfil isolado precisa baixar Leaflet, fontes e SheetJS das CDNs.
  for (let tentativa = 0; tentativa < 300; tentativa += 1) {
    const pronta = await avaliar(
      sessionId,
      `document.readyState === "complete" &&
       document.body.dataset.atlasReady === "true" &&
       typeof abrirMenuRadial === "function" &&
       Boolean(document.getElementById("menuRadialMapa"))`
    );
    if (pronta) return;
    await esperar(100);
  }
  throw new Error("A aplicação não concluiu a inicialização. " + erros.join(" | "));
}

async function recarregarEEsperar(sessionId, expression) {
  await enviar("Page.reload", { ignoreCache: true }, sessionId);
  await esperar(180);
  await aguardarAplicacao(sessionId);

  for (let tentativa = 0; tentativa < 80; tentativa += 1) {
    if (await avaliar(sessionId, expression)) return true;
    await esperar(100);
  }
  return false;
}

async function executar() {
  await enviar("Browser.getVersion");
  const { targetId } = await enviar("Target.createTarget", { url });
  const { sessionId } = await enviar("Target.attachToTarget", { targetId, flatten: true });
  await enviar("Page.enable", {}, sessionId);
  await enviar("Runtime.enable", {}, sessionId);
  await enviar("Log.enable", {}, sessionId);
  await aguardarAplicacao(sessionId);

  if (process.argv.includes("--performance-only")) {
    await medirDesempenho({ avaliar, sessionId });
    if (erros.length) throw new Error(erros.join(" | "));
    return;
  }

  if (process.argv.includes("--connection-only")) {
    await testarConexoes({ avaliar, enviar, sessionId });
    if (erros.length) throw new Error(erros.join(" | "));
    return;
  }

  if (process.argv.includes("--optimization-only")) {
    await testarOtimizacoes({ avaliar, sessionId });
    if (erros.length) throw new Error(erros.join(" | "));
    return;
  }

  if (process.argv.includes("--reading-only")) {
    await testarConsulta({ avaliar, enviar, sessionId });
    if (erros.length) throw new Error(erros.join(" | "));
    return;
  }

  if (process.argv.includes("--reliability-only")) {
    await enviar("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
    await avaliar(sessionId, "void mapa.invalidateSize()");
    await testarConfiabilidade({ avaliar, sessionId, recarregarEEsperar });
    if (erros.length) throw new Error(erros.join(" | "));
    return;
  }

  const estrutural = await avaliar(
    sessionId,
    `(() => {
      const radial = document.getElementById("menuRadialMapa");
      const acoes = [...radial.querySelectorAll("[data-radial-action]")];
      return {
        radialSemRaiosAntigos: !radial.querySelector(".radial-spokes"),
        seisAcoesRadiais: acoes.length === 6,
        controlesDuplicadosAusentes: !document.querySelector(".legacy-object-actions"),
        inspectorComAcoes: ["salvarRail", "cancelarRail", "apagarRail"].every(id => document.getElementById(id)),
        administracaoLigada: [...document.querySelectorAll('a[href^="admin.html"]')].length >= 2,
        alternanciaTemaDisponivel: Boolean(document.getElementById("alternarTema"))
      };
    })()`
  );

  const falhasEstruturais = Object.entries(estrutural)
    .filter(([, passou]) => !passou)
    .map(([nome]) => nome);
  if (falhasEstruturais.length) {
    throw new Error(`Falhas estruturais: ${falhasEstruturais.join(", ")}`);
  }

  const temaEditor = await avaliar(
    sessionId,
    `(() => {
      const antes = document.documentElement.classList.contains("tema-claro");
      document.getElementById("alternarTema").click();
      const depois = document.documentElement.classList.contains("tema-claro");
      document.getElementById("alternarTema").click();
      return antes !== depois;
    })()`
  );
  if (!temaEditor) throw new Error("A alternância de tema do editor não respondeu.");

  const geometriaEditor = await avaliar(
    sessionId,
    `(() => {
      document.body.classList.remove("projects-visible", "painel-fechado");
      document.body.classList.add("modo-visualizacao");
      const painel = document.getElementById("painel");
      const controles = [...painel.querySelectorAll(
        ".inspector-titlebar .inspector-mode-switch button, " +
        ".inspector-titlebar > .fechar"
      )];
      const caixasControles = controles.map(controle => {
        const caixa = controle.getBoundingClientRect();
        return {
          id: controle.id,
          topo: caixa.top,
          altura: caixa.height,
          centro: caixa.top + caixa.height / 2
        };
      });
      const centros = caixasControles.map(caixa => caixa.centro);
      const zoom = document.querySelector(".leaflet-control-zoom").getBoundingClientRect();
      const mapa = document.querySelector(".workspace").getBoundingClientRect();
      return {
        larguraPainel: Math.round(painel.getBoundingClientRect().width),
        tresControles: controles.length === 3,
        diferencaVertical: Math.max(...centros) - Math.min(...centros),
        caixasControles,
        respiroZoom: Math.round(zoom.top - mapa.top)
      };
    })()`
  );
  if (
    geometriaEditor.larguraPainel !== 304 ||
    !geometriaEditor.tresControles ||
    geometriaEditor.diferencaVertical > 1 ||
    geometriaEditor.respiroZoom < 18
  ) {
    throw new Error(`Geometria do editor incorreta: ${JSON.stringify(geometriaEditor)}`);
  }

  const radial = await avaliar(
    sessionId,
    `(() => {
      mapaAtual = { id: "smoke", nome: "Smoke", categorias: [], objetos: [] };
      ui.modo = "edicao";
      document.body.classList.remove("projects-visible");
      document.body.classList.add("modo-edicao");
      abrirMenuRadial(500, 400, true);
      const menu = document.getElementById("menuRadialMapa");
      const estilo = getComputedStyle(menu);
      const botoes = [...menu.querySelectorAll(".radial-action")];
      return new Promise(resolve => requestAnimationFrame(() => resolve({
        aberto: menu.classList.contains("aberto") && !menu.hidden,
        largura: Math.round(parseFloat(estilo.width)),
        altura: Math.round(parseFloat(estilo.height)),
        botoes: botoes.map(botao => {
          const r = botao.getBoundingClientRect();
          return { largura: Math.round(r.width), altura: Math.round(r.height) };
        })
      })));
    })()`
  );

  if (!radial.aberto || radial.largura !== 340 || radial.altura !== 300) {
    throw new Error(`Menu radial fora do padrão: ${JSON.stringify(radial)}`);
  }
  if (radial.botoes.some(botao => botao.largura !== 80 || botao.altura !== 68)) {
    throw new Error(`Área de interação radial incorreta: ${JSON.stringify(radial.botoes)}`);
  }

  for (const [largura, altura] of [[768, 1024], [390, 844]]) {
    await enviar(
      "Emulation.setDeviceMetricsOverride",
      { width: largura, height: altura, deviceScaleFactor: 1, mobile: largura < 500 },
      sessionId
    );
    const responsivo = await avaliar(
      sessionId,
      `(() => {
        const radial = document.getElementById("menuRadialMapa");
        const painel = document.getElementById("painel");
        const barra = document.getElementById("barraCriacaoRapida");
        const barraEstavaOculta = barra.hidden;
        const tinhaModoEdicao = document.body.classList.contains("modo-edicao");
        const tinhaPainelFechado = document.body.classList.contains("painel-fechado");
        const alturaPainel = painel.getBoundingClientRect().height;
        const projetos = document.getElementById("gerenciadorProjetos");
        const projetosEstavamOcultos = projetos.hidden;
        const tinhaProjetosVisiveis = document.body.classList.contains("projects-visible");

        document.body.classList.add("projects-visible");
        projetos.hidden = false;

        const barraBiblioteca = document.querySelector("body.projects-visible > .topbar");
        const vistaBiblioteca = document.querySelector("body.projects-visible > .projects-view");
        const bibliotecaMobile = innerWidth > 390 || (
          Math.round(barraBiblioteca.getBoundingClientRect().width) === innerWidth &&
          Math.round(barraBiblioteca.getBoundingClientRect().height) === 54 &&
          Math.round(vistaBiblioteca.getBoundingClientRect().left) === 0 &&
          Math.round(vistaBiblioteca.getBoundingClientRect().width) === innerWidth
        );

        document.body.classList.toggle("projects-visible", tinhaProjetosVisiveis);
        projetos.hidden = projetosEstavamOcultos;

        barra.hidden = false;
        document.body.classList.add("modo-edicao", "painel-fechado");

        const botaoRapido = barra.querySelector(".quick-create-action");
        const resultado = {
          semOverflowHorizontal: document.documentElement.scrollWidth <= innerWidth,
          menuPrincipal: Boolean(document.getElementById("abrirMenuPrincipal")),
          legenda: Boolean(document.getElementById("abrirLegendaVisual")),
          radial: document.querySelectorAll("[data-radial-action]").length === 6,
          radialMobileCompacto: innerWidth > 390 || radial.getBoundingClientRect().width <= 280,
          painelMobileCompacto: innerWidth > 390 || alturaPainel <= innerHeight * .60,
          barraMobileCompacta: innerWidth > 390 || (
            barra.getBoundingClientRect().height <= 42 &&
            Math.round(botaoRapido.getBoundingClientRect().width) === 32
          ),
          bibliotecaMobile
        };

        barra.hidden = barraEstavaOculta;
        document.body.classList.toggle("modo-edicao", tinhaModoEdicao);
        document.body.classList.toggle("painel-fechado", tinhaPainelFechado);

        return resultado;
      })()`
    );
    if (Object.values(responsivo).some(valor => !valor)) {
      throw new Error(`Falha responsiva em ${largura}x${altura}: ${JSON.stringify(responsivo)}`);
    }
  }

  const adminUrl = new URL("admin.html", url).href;
  const { targetId: adminTargetId } = await enviar("Target.createTarget", { url: adminUrl });
  const { sessionId: adminSessionId } = await enviar(
    "Target.attachToTarget",
    { targetId: adminTargetId, flatten: true }
  );
  await enviar("Runtime.enable", {}, adminSessionId);
  await enviar("Log.enable", {}, adminSessionId);
  for (let tentativa = 0; tentativa < 80; tentativa += 1) {
    const pronta = await avaliar(
      adminSessionId,
      `document.readyState === "complete" &&
       Boolean(document.getElementById("adminTheme")) &&
       document.querySelectorAll(".admin-tab").length === 3`
    );
    if (pronta) break;
    if (tentativa === 79) throw new Error("A Administração não concluiu a inicialização.");
    await esperar(100);
  }
  const administracao = await avaliar(
    adminSessionId,
    `(() => ({
      voltaAoEditor: Boolean(document.querySelector('a[href^="index.html"]')),
      alternaTema: Boolean(document.getElementById("adminTheme")),
      temaResponde: (() => {
        const antes = document.documentElement.classList.contains("tema-claro");
        document.getElementById("adminTheme").click();
        const mudou = antes !== document.documentElement.classList.contains("tema-claro");
        document.getElementById("adminTheme").click();
        return mudou;
      })(),
      tresAbas: document.querySelectorAll(".admin-tab").length === 3,
      tresPaineis: document.querySelectorAll("[data-panel]").length === 3,
      semOverflowHorizontal: document.documentElement.scrollWidth <= innerWidth
    }))()`
  );
  if (Object.values(administracao).some(valor => !valor)) {
    throw new Error(`Falha na Administração: ${JSON.stringify(administracao)}`);
  }

  await enviar(
    "Emulation.setDeviceMetricsOverride",
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
    adminSessionId
  );
  const administracaoMobile = await avaliar(
    adminSessionId,
    `(() => {
      const barra = document.querySelector(".admin-app-sidebar").getBoundingClientRect();
      const workspace = document.querySelector(".admin-workspace").getBoundingClientRect();
      const layout = document.querySelector(".admin-layout");
      const estiloLayout = getComputedStyle(layout);
      return {
        barraHorizontal: Math.round(barra.width) === innerWidth && Math.round(barra.height) === 54,
        workspaceInteiro: Math.round(workspace.left) === 0 && Math.round(workspace.width) === innerWidth,
        layoutUmaColuna: estiloLayout.display !== "grid" || estiloLayout.gridTemplateColumns.split(" ").length === 1,
        semOverflowHorizontal: document.documentElement.scrollWidth <= innerWidth
      };
    })()`
  );
  if (Object.values(administracaoMobile).some(valor => !valor)) {
    throw new Error(`Administração mobile incorreta: ${JSON.stringify(administracaoMobile)}`);
  }

  await enviar(
    "Emulation.setDeviceMetricsOverride",
    { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false },
    adminSessionId
  );
  await enviar("Target.activateTarget", { targetId: adminTargetId });
  const alvosHover = [
    ".admin-app-nav a:not(.active)",
    ".admin-user-item",
    ".profile-button:not(.selected)",
    ".admin-tab:not(.active)",
    ".admin-delete-button"
  ];
  await avaliar(
    adminSessionId,
    `document.querySelector(".admin-delete-button").disabled = false`
  );
  for (const seletor of alvosHover) {
    let hoverRespondeu = false;
    for (let tentativa = 0; tentativa < 3 && !hoverRespondeu; tentativa += 1) {
      hoverRespondeu = await confirmarHover(adminSessionId, seletor);
    }
    if (!hoverRespondeu) {
      throw new Error(`Hover sem retorno visual: ${seletor}`);
    }
  }

  const projetoRecargaId = "smoke-reload-project";
  // A Administração abriu outra aba. Voltar ao editor permite que animações
  // e requestAnimationFrame rodem como na interação real do usuário.
  await enviar("Target.activateTarget", { targetId });
  await testarConfiabilidade({ avaliar, sessionId, recarregarEEsperar });
  await testarOtimizacoes({ avaliar, sessionId });
  await testarConsulta({ avaliar, enviar, sessionId });
  await testarConexoes({ avaliar, enviar, sessionId });
  const abriuProjetoRecarga = await avaliar(
    sessionId,
    `(async () => {
      const projeto = {
        id: ${JSON.stringify(projetoRecargaId)},
        nome: "Projeto de recarga",
        descricao: "Valida a restauração da tela atual.",
        criadoEm: new Date().toISOString(),
        schemaVersion: 1
      };
      await dbSalvarProjeto(projeto);
      await abrirProjeto(projeto.id);
      return projetoAtual?.id === projeto.id &&
        !document.body.classList.contains("projects-visible");
    })()`
  );
  if (!abriuProjetoRecarga) {
    throw new Error("Não foi possível preparar o projeto para testar a recarga.");
  }

  const projetoRestaurado = await recarregarEEsperar(
    sessionId,
    `projetoAtual?.id === ${JSON.stringify(projetoRecargaId)} &&
     !document.body.classList.contains("projects-visible") &&
     document.getElementById("gerenciadorProjetos").hidden`
  );
  if (!projetoRestaurado) {
    throw new Error("A recarga não restaurou a tela do projeto ativo.");
  }

  await avaliar(sessionId, "mostrarGerenciadorProjetos()");
  const bibliotecaRestaurada = await recarregarEEsperar(
    sessionId,
    `location.hash === "#projetos" &&
     document.body.classList.contains("projects-visible") &&
     !document.getElementById("gerenciadorProjetos").hidden`
  );
  if (!bibliotecaRestaurada) {
    throw new Error("A recarga não preservou a Biblioteca de projetos.");
  }

  if (erros.length) throw new Error(`Erros no navegador: ${erros.join(" | ")}`);
  console.log("Smoke no Chrome concluído: editor, radial, Administração, recarga de tela e layouts 768×1024/390×844 aprovados.");
}

try {
  await executar();
} finally {
  if (chrome.exitCode === null) {
    const encerrado = new Promise(resolve => chrome.once("exit", resolve));
    chrome.kill("SIGTERM");
    await Promise.race([encerrado, esperar(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
      await Promise.race([encerrado, esperar(1000)]);
    }
  }
  try {
    rmSync(perfil, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 150
    });
  } catch (erro) {
    console.warn(`Aviso: não foi possível apagar o perfil temporário ${perfil}: ${erro.message}`);
  }
}
