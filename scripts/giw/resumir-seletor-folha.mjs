import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const arquivo = resolve(process.argv[2] ?? ".private/importacoes/giw/seletor-folha-atual.json");
const relatorio = JSON.parse(await readFile(arquivo, "utf8"));
const resposta = relatorio.respostas?.find((item) => /search\.do/i.test(item.url));
const corpo = typeof resposta?.corpo === "string" ? resposta.corpo : "";
const tags = [...corpo.matchAll(/<\/?([A-Za-z][\w:-]*)\b/g)].map((match) => match[1]);
const atributos = [...corpo.matchAll(/\s([A-Za-z][\w:-]*)=(?:"[^"]*"|'[^']*')/g)]
  .map((match) => match[1]);

console.log(JSON.stringify({
  modo: relatorio.mode,
  statusBusca: resposta?.status ?? null,
  tamanhoResposta: corpo.length,
  formato: corpo.trimStart().startsWith("<") ? "XML/HTML" : corpo.trimStart().startsWith("{") || corpo.trimStart().startsWith("[") ? "JSON" : "OUTRO",
  tags: [...new Set(tags)].sort(),
  atributos: [...new Set(atributos)].sort(),
  // Apenas marcadores estruturais: nenhum valor cadastral é emitido.
  quantidadeElementos: (corpo.match(/<[^/!][^>]*>/g) ?? []).length,
}, null, 2));
