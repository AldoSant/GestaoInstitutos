import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const arquivo = resolve(process.argv[2] ?? ".private/importacoes/giw/relatorio-folha-atual.json");
const relatorio = JSON.parse(await readFile(arquivo, "utf8"));

console.log(JSON.stringify({
  modo: relatorio.mode,
  folhaHabilitada: relatorio.folhaHabilitada === true,
  campos: (relatorio.camposAntes ?? []).map((campo) => ({
    id: campo.id,
    name: campo.name,
    type: campo.type,
    possuiValor: campo.possuiValor === true,
  })),
  respostasRelatorio: (relatorio.respostas ?? []).map((resposta) => ({
    status: resposta.status,
    contentType: resposta.contentType,
    caminho: new URL(resposta.url).pathname,
  })),
}, null, 2));
