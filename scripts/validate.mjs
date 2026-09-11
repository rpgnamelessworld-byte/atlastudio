import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = resolve(raiz, "index.html");
const adminHtmlPath = resolve(raiz, "admin.html");

const scripts = [
  "js/system-dialog.js",
  "js/core.js",
  "js/geometry.js",
  "js/persistence.js",
  "js/history.js",
  "js/projects.js",
  "js/navigation.js",
  "js/maps.js",
  "js/rendering.js",
  "js/editor.js",
  "js/data.js",
  "js/connections.js",
  "js/connection-editor.js",
  "js/recovery.js",
  "js/reading.js",
  "js/interaction.js",
  "js/bootstrap.js"
];

const estilos = [
  "css/base.css",
  "css/shell.css",
  "css/workflow.css",
  "css/inspector.css",
  "css/creation.css",
  "css/editor.css",
  "css/atlas-theme.css",
  "css/shared-components.css",
  "css/controls.css",
  "css/studio-interface.css",
  "css/components/reading.css"
];

const adminScripts = ["js/system-dialog.js", "js/admin.js"];
const adminEstilos = [
  "css/admin.css",
  "css/atlas-theme.css",
  "css/shared-components.css",
  "css/controls.css",
  "css/studio-interface.css"
];

const erros = [];
const html = readFileSync(htmlPath, "utf8");
const adminHtml = existsSync(adminHtmlPath)
  ? readFileSync(adminHtmlPath, "utf8")
  : "";

function validarOrdemArquivos(documento, esperados, expressao, contexto) {
  const encontrados = [...documento.matchAll(expressao)].map(([, arquivo]) => arquivo);

  if (JSON.stringify(encontrados) !== JSON.stringify(esperados)) {
    erros.push(
      `Ordem de ${contexto} incorreta. Esperado: ${esperados.join(" → ")}; ` +
      `encontrado: ${encontrados.join(" → ") || "nenhum"}.`
    );
  }
}

validarOrdemArquivos(
  html,
  estilos,
  /<link\b[^>]*\bhref="(css\/[^"]+\.css)"[^>]*>/g,
  "estilos do editor"
);

validarOrdemArquivos(
  html,
  scripts,
  /<script\b[^>]*\bsrc="(js\/[^"]+\.js)"[^>]*><\/script>/g,
  "scripts do editor"
);

if (!adminHtml) {
  erros.push("Arquivo ausente: admin.html");
}

for (const arquivo of [...scripts, ...estilos]) {
  if (!existsSync(resolve(raiz, arquivo))) {
    erros.push(`Arquivo ausente: ${arquivo}`);
  }

  if (!html.includes(`\"${arquivo}\"`)) {
    erros.push(`Arquivo não carregado pelo HTML: ${arquivo}`);
  }
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
const idsUnicos = new Set(ids);

for (const id of idsUnicos) {
  if (ids.filter(item => item === id).length > 1) {
    erros.push(`ID duplicado no HTML: ${id}`);
  }
}

const codigo = scripts
  .filter(arquivo => existsSync(resolve(raiz, arquivo)))
  .map(arquivo => readFileSync(resolve(raiz, arquivo), "utf8"))
  .join("\n");

const referenciasDom = [
  ...codigo.matchAll(/\$\("([^"]+)"\)/g)
].map(([, id]) => id);

for (const id of new Set(referenciasDom)) {
  if (!idsUnicos.has(id)) {
    erros.push(`Elemento referenciado pelo JavaScript não existe: #${id}`);
  }
}

for (const arquivo of [...adminScripts, ...adminEstilos]) {
  if (!existsSync(resolve(raiz, arquivo))) {
    erros.push(`Arquivo administrativo ausente: ${arquivo}`);
  }

  if (adminHtml && !adminHtml.includes(`\"${arquivo}\"`)) {
    erros.push(`Arquivo não carregado pelo admin.html: ${arquivo}`);
  }
}

validarOrdemArquivos(
  adminHtml,
  adminEstilos,
  /<link\b[^>]*\bhref="(css\/[^"]+\.css)"[^>]*>/g,
  "estilos da Administração"
);

validarOrdemArquivos(
  adminHtml,
  adminScripts,
  /<script\b[^>]*\bsrc="(js\/[^"]+\.js)"[^>]*><\/script>/g,
  "scripts da Administração"
);

const adminIds = [...adminHtml.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
const adminIdsUnicos = new Set(adminIds);

for (const id of adminIdsUnicos) {
  if (adminIds.filter(item => item === id).length > 1) {
    erros.push(`ID duplicado no admin.html: ${id}`);
  }
}

const adminCodigo = adminScripts
  .filter(arquivo => existsSync(resolve(raiz, arquivo)))
  .map(arquivo => readFileSync(resolve(raiz, arquivo), "utf8"))
  .join("\n");

const adminReferenciasDom = [
  ...adminCodigo.matchAll(/porId\("([^"]+)"\)/g)
].map(([, id]) => id);

for (const id of new Set(adminReferenciasDom)) {
  if (!adminIdsUnicos.has(id)) {
    erros.push(`Elemento administrativo referenciado pelo JavaScript não existe: #${id}`);
  }
}

for (const arquivo of scripts) {
  if (!existsSync(resolve(raiz, arquivo))) continue;

  const resultado = spawnSync(
    process.execPath,
    ["--check", resolve(raiz, arquivo)],
    { encoding: "utf8" }
  );

  if (resultado.status !== 0) {
    erros.push(`JavaScript inválido em ${arquivo}:\n${resultado.stderr.trim()}`);
  }
}

for (const arquivo of adminScripts) {
  if (!existsSync(resolve(raiz, arquivo))) continue;

  const resultado = spawnSync(
    process.execPath,
    ["--check", resolve(raiz, arquivo)],
    { encoding: "utf8" }
  );

  if (resultado.status !== 0) {
    erros.push(`JavaScript administrativo inválido em ${arquivo}:\n${resultado.stderr.trim()}`);
  }
}

if (erros.length) {
  console.error(erros.map(erro => `- ${erro}`).join("\n"));
  process.exit(1);
}

console.log(
  `Validação concluída: ${idsUnicos.size} IDs, ` +
  `${scripts.length} scripts e ${estilos.length} folhas de estilo no editor; ` +
  `${adminIdsUnicos.size} IDs, ${adminScripts.length} script e ` +
  `${adminEstilos.length} folha de estilo na Administração.`
);
