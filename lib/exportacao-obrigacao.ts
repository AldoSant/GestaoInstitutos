import { decimalParaInteiro } from "./dinheiro";

type Objeto = Record<string, unknown>;

type DadosEspelho = {
  obrigacao: {
    id: string;
    competencia: string;
    tipo: string;
    status: string;
    principal: string;
    juros: string;
    multa: string;
    total: string;
    valor_declarado: string | null;
    diferenca: string | null;
    perfil_instrumento?: "DCTFWEB_DARF" | "GPS_EXCECAO" | null;
    perfil_codigo_receita?: string | null;
    criado_em: Date;
  };
  itens: Array<{
    id: string;
    natureza: string;
    origem: string;
    descricao: string;
    base_calculo: string;
    aliquota: string | null;
    valor: string;
    snapshot: Record<string, unknown>;
    folha_numero: number | null;
    folha_revisao: number | null;
    folha_hash: string | null;
    termo_numero: string | null;
    meta_codigo: string | null;
  }>;
  documentos: Array<{
    tipo: string;
    referencia: string;
    valor_total: string;
    emitido_em: string;
    verificado: boolean;
    hash_sha256: string | null;
  }>;
};

const CABECALHO = [
  "obrigacao_id",
  "competencia",
  "tipo",
  "status",
  "instrumento_recolhimento",
  "codigo_receita",
  "folha_lote",
  "folha_revisao",
  "hash_folha",
  "termo",
  "meta",
  "matricula",
  "prestador",
  "cpf_cnpj",
  "natureza",
  "origem",
  "descricao",
  "base_calculo",
  "aliquota_percentual",
  "valor",
  "principal_obrigacao",
  "juros",
  "multa",
  "total_obrigacao",
  "valor_declarado",
  "diferenca",
  "documentos",
] as const;

function objeto(valor: unknown): Objeto {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Objeto)
    : {};
}

function texto(valor: unknown) {
  return typeof valor === "string" || typeof valor === "number"
    ? String(valor)
    : "";
}

function celula(valor: unknown) {
  let conteudo = texto(valor).replaceAll("\0", "").replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t]/.test(conteudo)) conteudo = `'${conteudo}`;
  return `"${conteudo.replaceAll('"', '""')}"`;
}

function decimalCsv(valor: string, escala: number) {
  const inteiro = decimalParaInteiro(valor, escala);
  const sinal = inteiro < 0 ? "-" : "";
  const absoluto = Math.abs(inteiro);
  const divisor = 10 ** escala;
  return `${sinal}${Math.floor(absoluto / divisor)},${String(
    absoluto % divisor,
  ).padStart(escala, "0")}`;
}

function moedaCsv(valor: string | null) {
  return valor === null ? "" : decimalCsv(valor, 2);
}

function documentosCsv(documentos: DadosEspelho["documentos"]) {
  return documentos
    .map(
      (documento) =>
        `${documento.tipo}:${documento.referencia}:${documento.emitido_em}:` +
        `${documento.valor_total}:${documento.verificado ? "VERIFICADO" : "PENDENTE"}:` +
        `${documento.hash_sha256 ?? "SEM_HASH"}`,
    )
    .join(" | ");
}

export function gerarCsvEspelhoObrigacao(dados: DadosEspelho) {
  if (!dados.obrigacao.id || dados.itens.length === 0) {
    throw new Error("A obrigação não possui conteúdo para o espelho.");
  }
  const documentos = documentosCsv(dados.documentos);
  const linhas = dados.itens.map((item) => {
    const snapshot = objeto(item.snapshot);
    const pessoa = objeto(snapshot.pessoa);
    const prestador = objeto(snapshot.prestador);
    const documento = texto(pessoa.cpf) || texto(pessoa.cnpj);
    return [
      celula(dados.obrigacao.id),
      celula(dados.obrigacao.competencia.slice(0, 7)),
      celula(dados.obrigacao.tipo),
      celula(dados.obrigacao.status),
      celula(dados.obrigacao.perfil_instrumento ?? "SEM_PERFIL_CONGELADO"),
      celula(dados.obrigacao.perfil_codigo_receita),
      item.folha_numero === null ? "" : String(item.folha_numero),
      item.folha_revisao === null ? "" : String(item.folha_revisao),
      celula(item.folha_hash),
      celula(item.termo_numero),
      celula(item.meta_codigo),
      celula(prestador.matricula),
      celula(pessoa.nome),
      celula(documento),
      celula(item.natureza),
      celula(item.origem),
      celula(item.descricao),
      moedaCsv(item.base_calculo),
      item.aliquota === null ? "" : decimalCsv(item.aliquota, 6),
      moedaCsv(item.valor),
      moedaCsv(dados.obrigacao.principal),
      moedaCsv(dados.obrigacao.juros),
      moedaCsv(dados.obrigacao.multa),
      moedaCsv(dados.obrigacao.total),
      moedaCsv(dados.obrigacao.valor_declarado),
      moedaCsv(dados.obrigacao.diferenca),
      celula(documentos),
    ].join(";");
  });
  return `\uFEFF${CABECALHO.join(";")}\r\n${linhas.join("\r\n")}\r\n`;
}
