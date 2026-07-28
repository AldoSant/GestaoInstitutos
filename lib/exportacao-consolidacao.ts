import { decimalParaInteiro } from "./dinheiro";

type Diagnostico = {
  competencia: string;
  conflitos: Array<{
    pessoa_id: string;
    nome: string;
    documento: string;
    matricula: string;
    quantidade_vinculos: number;
    retribuicao_prevista: string;
    base_outras_fontes: string;
    medicao_pendente: boolean;
    hash_fontes?: string;
    fontes: Array<{
      vinculoId: string;
      termoNumero: string;
      metaCodigo: string;
      atividade: string;
      valorContratual: string;
      valorPrevisto: string;
      exigeMedicao: boolean;
      medicaoTipo: string | null;
      folhaNumero: number | null;
      folhaStatus: string | null;
    }>;
  }>;
};

type Caso = {
  hash_fontes: string;
  status: string;
  decisao: string | null;
  justificativa: string;
  responsavel: string | null;
  resolvido_em: Date | string | null;
};

const CABECALHO = [
  "competencia",
  "hash_fontes",
  "caso_status",
  "caso_decisao",
  "caso_responsavel",
  "caso_resolvido_em",
  "caso_justificativa",
  "pessoa_id",
  "nome",
  "cpf_cnpj",
  "matricula",
  "quantidade_vinculos",
  "retribuicao_total_prevista",
  "base_outras_fontes",
  "medicao_pendente",
  "vinculo_id",
  "termo",
  "meta",
  "atividade",
  "valor_contratual",
  "valor_previsto",
  "exige_medicao",
  "medicao_tipo",
  "folha_lote",
  "folha_status",
] as const;

function celula(valor: unknown) {
  let conteudo = String(valor ?? "")
    .replaceAll("\0", "")
    .replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t]/.test(conteudo)) conteudo = `'${conteudo}`;
  return `"${conteudo.replaceAll('"', '""')}"`;
}

function moeda(valor: string) {
  const centavos = decimalParaInteiro(valor, 2);
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  return `${sinal}${Math.floor(absoluto / 100)},${String(
    absoluto % 100,
  ).padStart(2, "0")}`;
}

export function gerarCsvDiagnosticoConsolidacao(
  diagnostico: Diagnostico,
  casos: Caso[] = [],
) {
  const casosAtuais = new Map(
    casos
      .filter((caso) => caso.status !== "INVALIDADO")
      .map((caso) => [caso.hash_fontes, caso]),
  );
  const linhas = diagnostico.conflitos.flatMap((pessoa) =>
    pessoa.fontes.map((fonte) => {
      const caso = pessoa.hash_fontes
        ? casosAtuais.get(pessoa.hash_fontes)
        : undefined;
      return [
        celula(diagnostico.competencia),
        celula(pessoa.hash_fontes),
        celula(caso?.status),
        celula(caso?.decisao),
        celula(caso?.responsavel),
        celula(caso?.resolvido_em ? new Date(caso.resolvido_em).toISOString() : ""),
        celula(caso?.justificativa),
        celula(pessoa.pessoa_id),
        celula(pessoa.nome),
        celula(pessoa.documento),
        celula(pessoa.matricula),
        String(pessoa.quantidade_vinculos),
        moeda(pessoa.retribuicao_prevista),
        moeda(pessoa.base_outras_fontes),
        pessoa.medicao_pendente ? "SIM" : "NAO",
        celula(fonte.vinculoId),
        celula(fonte.termoNumero),
        celula(fonte.metaCodigo),
        celula(fonte.atividade),
        moeda(fonte.valorContratual),
        moeda(fonte.valorPrevisto),
        fonte.exigeMedicao ? "SIM" : "NAO",
        celula(fonte.medicaoTipo),
        fonte.folhaNumero === null ? "" : String(fonte.folhaNumero),
        celula(fonte.folhaStatus),
      ].join(";");
    }),
  );
  return `\uFEFF${CABECALHO.join(";")}\r\n${linhas.join("\r\n")}${
    linhas.length > 0 ? "\r\n" : ""
  }`;
}
