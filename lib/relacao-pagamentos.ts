import { createHash } from "node:crypto";
import { decimalParaInteiro } from "./dinheiro";

export type ContaPagamento = {
  agencia: string | null;
  agenciaLegacyId: string | null;
  numero: string | null;
  digito: string | null;
  variacao: string | null;
  tipo: string | null;
} | null;

export type ItemRelacaoPagamento = {
  id: string;
  nome: string;
  documento: string | null;
  matricula: string;
  atividade: string;
  totalLiquido: string;
  conta: ContaPagamento;
};

type ItemFolhaPagamento = {
  id: string;
  total_liquido: string;
  snapshots: unknown;
};

function texto(valor: string | null | undefined) {
  return valor?.trim() ?? "";
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : null;
}

function textoOuNulo(valor: unknown) {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

export function extrairItemRelacaoPagamento(
  item: ItemFolhaPagamento,
): ItemRelacaoPagamento {
  const snapshots = objeto(item.snapshots);
  const pessoa = objeto(snapshots?.pessoa);
  const prestador = objeto(snapshots?.prestador);
  const vinculo = objeto(snapshots?.vinculo);
  const conta = objeto(snapshots?.contaBancaria);
  return {
    id: item.id,
    nome: textoOuNulo(pessoa?.nome) ?? "Prestador não identificado",
    documento: textoOuNulo(pessoa?.cpf) ?? textoOuNulo(pessoa?.cnpj),
    matricula: textoOuNulo(prestador?.matricula) ?? "—",
    atividade: textoOuNulo(vinculo?.atividade) ?? "—",
    totalLiquido: item.total_liquido,
    conta: conta
      ? {
          agencia: textoOuNulo(conta.agencia),
          agenciaLegacyId: textoOuNulo(conta.agenciaLegacyId),
          numero: textoOuNulo(conta.numero),
          digito: textoOuNulo(conta.digito),
          variacao: textoOuNulo(conta.variacao),
          tipo: textoOuNulo(conta.tipo),
        }
      : null,
  };
}

function protegerCelula(valor: string) {
  const limpa = valor.replaceAll("\r", " ").replaceAll("\n", " ");
  return /^[=+\-@]/.test(limpa) ? `'${limpa}` : limpa;
}

function csvCelula(valor: string) {
  const seguro = protegerCelula(valor);
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

function moedaCsv(centavos: number) {
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  return `${sinal}${Math.floor(absoluto / 100)},${String(absoluto % 100).padStart(2, "0")}`;
}

export function montarRelacaoPagamentos(itens: ItemRelacaoPagamento[]) {
  if (itens.length === 0) {
    throw new Error("A Folha não possui itens para a relação de pagamentos.");
  }
  const ids = new Set<string>();
  let totalLiquidoCentavos = 0;
  const linhas = [...itens]
    .sort(
      (a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR") ||
        a.matricula.localeCompare(b.matricula, "pt-BR") ||
        a.id.localeCompare(b.id),
    )
    .map((item) => {
      if (ids.has(item.id)) {
        throw new Error(`O item ${item.id} está duplicado na relação.`);
      }
      ids.add(item.id);
      const liquidoCentavos = decimalParaInteiro(item.totalLiquido, 2);
      if (liquidoCentavos < 0) {
        throw new Error(`O líquido de ${item.nome} não pode ser negativo.`);
      }
      totalLiquidoCentavos += liquidoCentavos;
      const pendencias: string[] = [];
      if (!item.conta) {
        pendencias.push("CONTA_NAO_CADASTRADA");
      } else {
        if (!texto(item.conta.agencia)) pendencias.push("AGENCIA_NAO_INFORMADA");
        if (!texto(item.conta.numero)) pendencias.push("CONTA_NAO_INFORMADA");
        if (!["CORRENTE", "POUPANCA"].includes(texto(item.conta.tipo))) {
          pendencias.push("TIPO_NAO_INFORMADO");
        }
      }
      return {
        ...item,
        liquidoCentavos,
        pendencias,
        apto: pendencias.length === 0,
      };
    });
  const aptos = linhas.filter((item) => item.apto).length;
  return {
    linhas,
    totalLiquidoCentavos,
    aptos,
    pendentes: linhas.length - aptos,
    pronta: aptos === linhas.length,
  };
}

export function gerarRelacaoPagamentosCsv({
  empresa,
  competencia,
  folhaNumero,
  revisao,
  folhaStatus,
  hashFolha,
  itens,
}: {
  empresa: string;
  competencia: string;
  folhaNumero: number;
  revisao: number;
  folhaStatus: string;
  hashFolha: string;
  itens: ItemRelacaoPagamento[];
}) {
  const relacao = montarRelacaoPagamentos(itens);
  const liberada = folhaStatus === "FECHADA" && relacao.pronta;
  const cabecalho = [
    "empresa",
    "competencia",
    "folha_numero",
    "revisao",
    "folha_status",
    "liberacao_financeira",
    "hash_folha",
    "status_conta",
    "pendencias",
    "nome",
    "documento",
    "matricula",
    "atividade",
    "agencia",
    "agencia_legacy_id",
    "conta",
    "digito",
    "variacao",
    "tipo_conta",
    "valor_liquido",
  ];
  const linhas = relacao.linhas.map((item) =>
    [
      empresa,
      competencia,
      String(folhaNumero),
      String(revisao),
      folhaStatus,
      liberada ? "LIBERADA" : "BLOQUEADA",
      hashFolha,
      item.apto ? "APTO" : "PENDENTE",
      item.pendencias.join("|"),
      item.nome,
      item.documento ?? "",
      item.matricula,
      item.atividade,
      item.conta?.agencia ?? "",
      item.conta?.agenciaLegacyId ?? "",
      item.conta?.numero ?? "",
      item.conta?.digito ?? "",
      item.conta?.variacao ?? "",
      item.conta?.tipo ?? "",
      moedaCsv(item.liquidoCentavos),
    ]
      .map(csvCelula)
      .join(";"),
  );
  const conteudo = `\uFEFF${cabecalho.join(";")}\r\n${linhas.join("\r\n")}\r\n`;
  return {
    conteudo,
    hashSha256: createHash("sha256").update(conteudo, "utf8").digest("hex"),
    resumo: relacao,
    liberada,
  };
}
