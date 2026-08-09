import type { MemoriaGpsIndividual } from "./memoria-gps";

const CABECALHO = [
  "ordem",
  "competencia",
  "vencimento",
  "codigo_receita",
  "identificador_nit_pis_pasep",
  "prestador",
  "principal_inss",
  "juros_multa",
  "total_conferencia",
  "linha_digitavel",
  "fonte_folha_item",
] as const;

function celula(valor: string | number) {
  let conteudo = String(valor).replaceAll("\0", "").replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t]/.test(conteudo)) conteudo = `'${conteudo}`;
  return `"${conteudo.replaceAll('"', '""')}"`;
}

function moedaCsv(centavos: number) {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, "0")}`;
}

export function gerarCsvMemoriasGps(memorias: MemoriaGpsIndividual[]) {
  if (memorias.length === 0) {
    throw new Error("Não há memórias GPS para exportar.");
  }
  const ids = new Set<string>();
  const linhas = memorias.map((item, indice) => {
    if (ids.has(item.itemId)) throw new Error("Há item GPS duplicado no CSV.");
    ids.add(item.itemId);
    return [
      String(indice + 1),
      celula(item.competencia.slice(0, 7)),
      celula(item.vencimento),
      celula(item.codigoReceita),
      celula(item.identificador),
      celula(item.nome),
      moedaCsv(item.valorCentavos),
      "0,00",
      moedaCsv(item.valorCentavos),
      celula(item.linhaDigitavel),
      celula(item.itemId),
    ].join(";");
  });
  return `\uFEFF${CABECALHO.join(";")}\r\n${linhas.join("\r\n")}\r\n`;
}
