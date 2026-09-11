import { readFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(fileURLToPath(new URL("..", import.meta.url)));
const extensoesFonte = new Set([".css", ".html", ".js", ".mjs"]);

function listarFontes(diretorio = raiz) {
  return readdirSync(diretorio, { withFileTypes: true })
    .flatMap(entrada => {
      if (entrada.name === ".git" || entrada.name === "node_modules") return [];
      const caminho = resolve(diretorio, entrada.name);
      return entrada.isDirectory() ? listarFontes(caminho) : [caminho];
    })
    .filter(caminho => extensoesFonte.has(extname(caminho)));
}

const fontes = listarFontes();
const ler = caminho => readFileSync(caminho, "utf8");
const css = fontes.filter(caminho => extname(caminho) === ".css");
const executaveis = fontes.filter(caminho => [".html", ".js"].includes(extname(caminho)));
const corpusExecutavel = executaveis.map(ler).join("\n");
const corpusJs = executaveis.filter(caminho => extname(caminho) === ".js").map(ler).join("\n");
const cssSemComentarios = css.map(caminho => ler(caminho).replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
const corpusCompleto = `${corpusExecutavel}\n${cssSemComentarios}`;

function unicos(expressao, texto, grupo = 1) {
  return [...new Set([...texto.matchAll(expressao)].map(resultado => resultado[grupo]))].sort();
}

function ocorrencias(nome, texto) {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (texto.match(new RegExp(`(^|[^\\w-])${escapado}(?=$|[^\\w-])`, "g")) || []).length;
}

const classesCss = unicos(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g, cssSemComentarios);
const idsCss = unicos(/#([_a-zA-Z]+[_a-zA-Z0-9-]*)/g, cssSemComentarios)
  .filter(nome => !/^[0-9a-f]{3,8}$/i.test(nome));
const classesSemReferencia = classesCss.filter(nome =>
  !nome.startsWith("leaflet-") && ocorrencias(nome, corpusExecutavel) === 0
);
const idsSemReferencia = idsCss.filter(nome => ocorrencias(nome, corpusExecutavel) === 0);
const idsHtml = unicos(/\bid="([_a-zA-Z]+[_a-zA-Z0-9-]*)"/g, corpusExecutavel);
const idsHtmlSemReferencia = idsHtml.filter(nome => ocorrencias(nome, corpusCompleto) === 1);

const propriedadesDefinidas = unicos(/(--[_a-zA-Z]+[_a-zA-Z0-9-]*)\s*:/g, cssSemComentarios);
const propriedadesUsadas = new Set(unicos(/var\(\s*(--[_a-zA-Z]+[_a-zA-Z0-9-]*)/g, `${cssSemComentarios}\n${corpusExecutavel}`));
const propriedadesSemUso = propriedadesDefinidas.filter(nome => !propriedadesUsadas.has(nome));

const simbolosDeclarados = [
  ...unicos(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g, corpusJs),
  ...unicos(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, corpusJs)
];
const simbolosUnicos = [...new Set(simbolosDeclarados)].sort();
const simbolosUmaOcorrencia = simbolosUnicos.filter(nome =>
  ocorrencias(nome, corpusJs) === 1 &&
  !new RegExp(`\\(function\\s+${nome}\\s*\\(`).test(corpusJs)
);

function imprimir(titulo, itens) {
  console.log(`\n${titulo} (${itens.length})`);
  console.log(itens.length ? itens.join("\n") : "—");
}

console.log(`Auditoria estática: ${fontes.length} arquivos e ${fontes.reduce((total, caminho) => total + ler(caminho).split(/\r?\n/).length, 0)} linhas examinadas.`);
imprimir("Classes CSS sem referência literal em HTML/JavaScript", classesSemReferencia);
imprimir("IDs CSS sem referência literal em HTML/JavaScript", idsSemReferencia);
imprimir("IDs HTML sem referência em CSS, JavaScript, rótulos ou ARIA", idsHtmlSemReferencia);
imprimir("Propriedades CSS personalizadas definidas sem var(...)", propriedadesSemUso);
imprimir("Símbolos JavaScript declarados uma única vez (candidatos; exige revisão manual)", simbolosUmaOcorrencia);

console.log("\nObservação: o relatório é conservador e não remove nada. Classes de bibliotecas, nomes montados dinamicamente e callbacks podem exigir preservação manual.");
