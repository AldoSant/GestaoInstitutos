import type { SimulacaoConsolidacaoFiscal } from "@/db/simulacoes-consolidacao";

const CABECALHO = [
  "competencia",
  "simulacao_id",
  "versao",
  "status",
  "hash_resultado",
  "hash_fontes",
  "pessoa_id",
  "nome",
  "cpf_cnpj",
  "vinculo_id",
  "termo",
  "meta",
  "atividade",
  "total_proventos",
  "descontos_eventos",
  "base_inss_bruta",
  "base_inss_rateada",
  "inss_rateado",
  "base_irrf_bruta",
  "base_irrf_rateada",
  "irrf_bruto_rateado",
  "irrf_reducao_rateada",
  "irrf_rateado",
  "total_descontos",
  "total_liquido",
  "responsavel",
  "decidido_em",
  "justificativa",
] as const;

function celula(valor: unknown) {
  let conteudo = String(valor ?? "")
    .replaceAll("\0", "")
    .replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t]/.test(conteudo)) conteudo = `'${conteudo}`;
  return `"${conteudo.replaceAll('"', '""')}"`;
}

function moeda(valor: string) {
  return valor.replace(".", ",");
}

function origem(snapshot: Record<string, unknown>) {
  const valor = snapshot.origem;
  return valor && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : {};
}

export function gerarCsvSimulacoesConsolidacao(
  simulacoes: SimulacaoConsolidacaoFiscal[],
) {
  const linhas = simulacoes.flatMap((simulacao) =>
    simulacao.fontes.map((fonte) => {
      const dados = origem(fonte.snapshot);
      return [
        celula(simulacao.competencia.slice(0, 7)),
        celula(simulacao.id),
        String(simulacao.versao),
        celula(simulacao.status),
        celula(simulacao.hash_resultado),
        celula(simulacao.hash_fontes),
        celula(simulacao.pessoa_id),
        celula(simulacao.nome),
        celula(simulacao.documento),
        celula(fonte.vinculoId),
        celula(dados.termoNumero),
        celula(dados.metaCodigo),
        celula(dados.atividade),
        moeda(fonte.totalProventos),
        moeda(fonte.descontosEventos),
        moeda(fonte.baseInssBruta),
        moeda(fonte.baseInssRateada),
        moeda(fonte.valorInssRateado),
        moeda(fonte.baseIrrfBruta),
        moeda(fonte.baseIrrfRateada),
        moeda(fonte.irrfBrutoRateado),
        moeda(fonte.irrfReducaoRateada),
        moeda(fonte.valorIrrfRateado),
        moeda(fonte.totalDescontos),
        moeda(fonte.totalLiquido),
        celula(simulacao.responsavel),
        celula(
          simulacao.decidido_em
            ? new Date(simulacao.decidido_em).toISOString()
            : "",
        ),
        celula(simulacao.justificativa),
      ].join(";");
    }),
  );
  return `\uFEFF${CABECALHO.join(";")}\r\n${linhas.join("\r\n")}${
    linhas.length > 0 ? "\r\n" : ""
  }`;
}
