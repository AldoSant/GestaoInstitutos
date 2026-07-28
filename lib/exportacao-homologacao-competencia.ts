import type { HomologacaoCompetencia } from "@/db/homologacoes-competencia";

const CABECALHO = [
  "competencia",
  "versao",
  "hash_fontes",
  "homologacao_status",
  "responsavel",
  "decidido_em",
  "justificativa",
  "controle",
  "controle_status",
  "obrigatorio",
  "total",
  "conformes",
  "pendentes",
  "hash_evidencia",
  "detalhes_json",
] as const;

function celula(valor: unknown) {
  let conteudo = String(valor ?? "")
    .replaceAll("\0", "")
    .replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t]/.test(conteudo)) conteudo = `'${conteudo}`;
  return `"${conteudo.replaceAll('"', '""')}"`;
}

export function gerarCsvHomologacaoCompetencia(
  homologacao: HomologacaoCompetencia,
) {
  const linhas = homologacao.itens.map((item) =>
    [
      celula(homologacao.competencia.slice(0, 7)),
      String(homologacao.versao),
      celula(homologacao.hash_fontes),
      celula(homologacao.status),
      celula(homologacao.responsavel),
      celula(
        homologacao.decidido_em
          ? new Date(homologacao.decidido_em).toISOString()
          : "",
      ),
      celula(homologacao.justificativa),
      celula(item.tipo),
      celula(item.status),
      item.obrigatorio ? "SIM" : "NAO",
      String(item.total),
      String(item.conformes),
      String(item.pendentes),
      celula(item.hashEvidencia),
      celula(JSON.stringify(item.detalhes)),
    ].join(";"),
  );
  return `\uFEFF${CABECALHO.join(";")}\r\n${linhas.join("\r\n")}${
    linhas.length ? "\r\n" : ""
  }`;
}
