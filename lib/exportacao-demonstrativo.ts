import { decimalParaInteiro } from "./dinheiro";

type PagamentoExportacao = {
  tipo_pessoa: string;
  origem: string;
  beneficiario: string | null;
  matricula: string | null;
  documento_referencia: string | null;
  valor_bruto: string;
  total_retencoes: string;
  valor_liquido: string;
  retencoes: unknown;
};

type GuiaExportacao = {
  tipo: string;
  status: string;
  total: string;
  documentos: number;
  verificados: number;
};

function celula(valor: unknown) {
  let texto = String(valor ?? "").replaceAll("\0", "").replace(/\r\n?/gu, "\n");
  if (/^[=+\-@\t]/u.test(texto)) texto = `'${texto}`;
  return `"${texto.replaceAll('"', '""')}"`;
}

function moeda(valor: string) {
  const centavos = decimalParaInteiro(valor, 2);
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  return `${sinal}${Math.floor(absoluto / 100)},${String(absoluto % 100).padStart(2, "0")}`;
}

function resumoRetencoes(valor: unknown) {
  if (!Array.isArray(valor)) return "";
  return valor
    .map((item) => {
      const linha = item as { tributo?: unknown; valor?: unknown };
      return `${String(linha.tributo ?? "")}=${moeda(String(linha.valor ?? "0"))}`;
    })
    .join(" | ");
}

export function exportarDemonstrativoCsv(entrada: {
  competencia: string;
  numero: number;
  revisao: number;
  status: string;
  hash: string | null;
  pagamentos: readonly PagamentoExportacao[];
  guias: readonly GuiaExportacao[];
}) {
  const cabecalho = [
    "competencia",
    "demonstrativo",
    "revisao",
    "status",
    "natureza",
    "tipo_pessoa",
    "beneficiario_ou_guia",
    "matricula",
    "documento",
    "valor_bruto",
    "retencoes_detalhadas",
    "total_retencoes",
    "valor_liquido_ou_total_guia",
    "hash_demonstrativo",
  ].join(";");
  const base = [
    celula(entrada.competencia.slice(0, 7)),
    String(entrada.numero),
    String(entrada.revisao),
    celula(entrada.status),
  ];
  const pagamentos = entrada.pagamentos.map((item) =>
    [
      ...base,
      celula("PAGAMENTO_PRESTADOR"),
      celula(item.tipo_pessoa),
      celula(item.beneficiario),
      celula(item.matricula),
      celula(item.documento_referencia),
      moeda(item.valor_bruto),
      celula(resumoRetencoes(item.retencoes)),
      moeda(item.total_retencoes),
      moeda(item.valor_liquido),
      celula(entrada.hash),
    ].join(";"),
  );
  const guias = entrada.guias.map((item) =>
    [
      ...base,
      celula("GUIA_RECOLHIMENTO"),
      celula(""),
      celula(item.tipo),
      celula(""),
      celula(`${item.verificados}/${item.documentos} documento(s) verificado(s)`),
      "",
      celula(""),
      "",
      moeda(item.total),
      celula(entrada.hash),
    ].join(";"),
  );
  return `\uFEFF${[cabecalho, ...pagamentos, ...guias].join("\r\n")}\r\n`;
}
