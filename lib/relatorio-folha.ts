import { decimalParaInteiro } from "./dinheiro";

export type LinhaRelatorioFolha = {
  codigo: string;
  descricao: string;
  natureza: string;
  origem: string;
  incideInss: boolean;
  incideIrrf: boolean;
  referencia: string | null;
  baseCalculo: string;
  valor: string;
  ordem: number;
};

export type ItemRelatorioFolha = {
  id: string;
  nome: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  documento: string | null;
  matricula: string;
  nitPisPasep: string | null;
  atividade: string;
  totalProventos: string;
  totalDescontos: string;
  baseInss: string;
  valorInss: string;
  baseIrrf: string;
  valorIrrf: string;
  totalLiquido: string;
  simulacaoId: string | null;
  hashSimulacao: string | null;
  linhas: LinhaRelatorioFolha[];
};

function paraCentavos(valor: string, campo: string) {
  try {
    return decimalParaInteiro(valor, 2);
  } catch {
    throw new Error(`${campo} possui valor monetário inválido.`);
  }
}

export function montarResumoRelatorioFolha(itens: ItemRelatorioFolha[]) {
  if (itens.length === 0) {
    throw new Error("A Folha não possui itens processados para o relatório.");
  }
  const identificadores = new Set<string>();
  const totais = {
    proventosCentavos: 0,
    descontosCentavos: 0,
    baseInssCentavos: 0,
    inssCentavos: 0,
    baseIrrfCentavos: 0,
    irrfCentavos: 0,
    liquidoCentavos: 0,
  };
  const consolidadas = new Map<string, string>();
  const rubricas = new Map<
    string,
    {
      codigo: string;
      descricao: string;
      natureza: string;
      origem: string;
      incideInss: boolean;
      incideIrrf: boolean;
      quantidade: number;
      baseCalculoCentavos: number;
      valorCentavos: number;
      ordem: number;
    }
  >();
  const ordenados = [...itens]
    .sort(
      (a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR") ||
        a.matricula.localeCompare(b.matricula, "pt-BR") ||
        a.id.localeCompare(b.id),
    )
    .map((item) => {
      if (identificadores.has(item.id)) {
        throw new Error(`O item ${item.id} está duplicado no relatório.`);
      }
      identificadores.add(item.id);
      const valores = {
        proventosCentavos: paraCentavos(
          item.totalProventos,
          `Proventos de ${item.nome}`,
        ),
        descontosCentavos: paraCentavos(
          item.totalDescontos,
          `Descontos de ${item.nome}`,
        ),
        baseInssCentavos: paraCentavos(
          item.baseInss,
          `Base de INSS de ${item.nome}`,
        ),
        inssCentavos: paraCentavos(item.valorInss, `INSS de ${item.nome}`),
        baseIrrfCentavos: paraCentavos(
          item.baseIrrf,
          `Base de IRRF de ${item.nome}`,
        ),
        irrfCentavos: paraCentavos(item.valorIrrf, `IRRF de ${item.nome}`),
        liquidoCentavos: paraCentavos(
          item.totalLiquido,
          `Líquido de ${item.nome}`,
        ),
      };
      if (
        valores.proventosCentavos - valores.descontosCentavos !==
        valores.liquidoCentavos
      ) {
        throw new Error(`O fechamento do item de ${item.nome} é inconsistente.`);
      }
      for (const chave of Object.keys(totais) as Array<keyof typeof totais>) {
        totais[chave] += valores[chave];
      }
      if (item.simulacaoId && item.hashSimulacao) {
        const hashAnterior = consolidadas.get(item.simulacaoId);
        if (hashAnterior && hashAnterior !== item.hashSimulacao) {
          throw new Error(
            `A simulação ${item.simulacaoId} aparece com hashes divergentes.`,
          );
        }
        consolidadas.set(item.simulacaoId, item.hashSimulacao);
      } else if (item.simulacaoId || item.hashSimulacao) {
        throw new Error(
          `O item de ${item.nome} possui referência incompleta de consolidação.`,
        );
      }
      for (const linha of item.linhas) {
        const valorCentavos = paraCentavos(
          linha.valor,
          `Rubrica ${linha.codigo} de ${item.nome}`,
        );
        if (valorCentavos === 0) continue;
        const baseCalculoCentavos = paraCentavos(
          linha.baseCalculo,
          `Base da rubrica ${linha.codigo} de ${item.nome}`,
        );
        const chave = [
          linha.codigo,
          linha.descricao,
          linha.natureza,
          linha.origem,
          linha.incideInss ? "INSS" : "SEM_INSS",
          linha.incideIrrf ? "IRRF" : "SEM_IRRF",
        ].join("\u0000");
        const atual = rubricas.get(chave) ?? {
          codigo: linha.codigo,
          descricao: linha.descricao,
          natureza: linha.natureza,
          origem: linha.origem,
          incideInss: linha.incideInss,
          incideIrrf: linha.incideIrrf,
          quantidade: 0,
          baseCalculoCentavos: 0,
          valorCentavos: 0,
          ordem: linha.ordem,
        };
        atual.quantidade += 1;
        atual.baseCalculoCentavos += baseCalculoCentavos;
        atual.valorCentavos += valorCentavos;
        atual.ordem = Math.min(atual.ordem, linha.ordem);
        rubricas.set(chave, atual);
      }
      return {
        ...item,
        ...valores,
        linhas: [...item.linhas].sort(
          (a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo),
        ),
      };
    });
  if (
    totais.proventosCentavos - totais.descontosCentavos !==
    totais.liquidoCentavos
  ) {
    throw new Error("Os totais da Folha não possuem fechamento monetário.");
  }
  return {
    itens: ordenados,
    totais,
    simulacoes: [...consolidadas.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([simulacaoId, hashResultado]) => ({
        simulacaoId,
        hashResultado,
      })),
    rubricas: [...rubricas.values()].sort(
      (a, b) =>
        a.ordem - b.ordem ||
        a.codigo.localeCompare(b.codigo, "pt-BR") ||
        a.descricao.localeCompare(b.descricao, "pt-BR") ||
        Number(b.incideInss) - Number(a.incideInss) ||
        Number(b.incideIrrf) - Number(a.incideIrrf),
    ),
  };
}
