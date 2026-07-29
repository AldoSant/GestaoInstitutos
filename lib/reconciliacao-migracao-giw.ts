import type {
  GiwSnapshotFolhasHistoricas,
  GiwSnapshotGuiasInssHistoricas,
} from "./migracao-historica";

export type PessoaReferenciaGiw = {
  legacyId: string;
  nome: string;
  cpf: string | null;
  cnpj: string | null;
  inscricaoInss: string | null;
};

type MetodoVinculo = "CPF" | "CNPJ" | "NIT" | "NOME";

export type RelatorioReconciliacaoGiw = {
  schemaVersion: "1.0";
  status: "PRONTA" | "PENDENTE";
  summary: {
    pessoasDisponiveis: number;
    pessoasFolha: number;
    pessoasFolhaVinculadas: number;
    pessoasFolhaPendentes: number;
    beneficiariosGps: number;
    beneficiariosGpsVinculados: number;
    beneficiariosGpsPendentes: number;
    guiasVinculadasAFolha: number;
    metodos: Record<MetodoVinculo, number>;
  };
  issues: Array<{
    entity: "folha_item" | "guia_inss";
    legacyId: string;
    reason: "NAO_ENCONTRADA" | "AMBIGUA";
  }>;
};

type ResultadoReconciliacaoGiw = {
  folhas: GiwSnapshotFolhasHistoricas[];
  guias: GiwSnapshotGuiasInssHistoricas[];
  report: RelatorioReconciliacaoGiw;
};

function digitos(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function nomeNormalizado(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function indexar(
  pessoas: PessoaReferenciaGiw[],
  valor: (pessoa: PessoaReferenciaGiw) => string,
) {
  const indice = new Map<string, PessoaReferenciaGiw[]>();
  for (const pessoa of pessoas) {
    const chave = valor(pessoa);
    if (!chave) continue;
    indice.set(chave, [...(indice.get(chave) ?? []), pessoa]);
  }
  return indice;
}

function resolver(
  tentativas: Array<{
    metodo: MetodoVinculo;
    chave: string;
    indice: Map<string, PessoaReferenciaGiw[]>;
  }>,
) {
  for (const tentativa of tentativas) {
    if (!tentativa.chave) continue;
    const candidatas = tentativa.indice.get(tentativa.chave) ?? [];
    if (candidatas.length === 1) {
      return { pessoa: candidatas[0], metodo: tentativa.metodo, ambiguous: false };
    }
    if (candidatas.length > 1) {
      return { pessoa: null, metodo: tentativa.metodo, ambiguous: true };
    }
  }
  return { pessoa: null, metodo: null, ambiguous: false };
}

export function reconciliarSnapshotsHistoricosGiw(
  pessoas: PessoaReferenciaGiw[],
  folhasOriginais: GiwSnapshotFolhasHistoricas[],
  guiasOriginais: GiwSnapshotGuiasInssHistoricas[],
): ResultadoReconciliacaoGiw {
  const porCpf = indexar(pessoas, (pessoa) => digitos(pessoa.cpf));
  const porCnpj = indexar(pessoas, (pessoa) => digitos(pessoa.cnpj));
  const porNit = indexar(pessoas, (pessoa) => digitos(pessoa.inscricaoInss));
  const porNome = indexar(pessoas, (pessoa) => nomeNormalizado(pessoa.nome));
  const metodos: Record<MetodoVinculo, number> = { CPF: 0, CNPJ: 0, NIT: 0, NOME: 0 };
  const issues: RelatorioReconciliacaoGiw["issues"] = [];
  const pessoasFolha = new Set<string>();
  const pessoasFolhaVinculadas = new Set<string>();
  const referenciasFolhaVinculadas = new Set<string>();

  const folhas = folhasOriginais.map((snapshot) => ({
    ...snapshot,
    records: snapshot.records.map((folha) => ({
      ...folha,
      itens: folha.itens.map((item) => {
        pessoasFolha.add(item.pessoaLegacyId);
        const resultado = resolver([
          { metodo: "CPF", chave: digitos(item.cpf), indice: porCpf },
          { metodo: "CNPJ", chave: digitos(item.cnpj), indice: porCnpj },
          { metodo: "NOME", chave: nomeNormalizado(item.nome), indice: porNome },
        ]);
        if (!resultado.pessoa || !resultado.metodo) {
          issues.push({
            entity: "folha_item",
            legacyId: item.legacyId,
            reason: resultado.ambiguous ? "AMBIGUA" : "NAO_ENCONTRADA",
          });
          return item;
        }
        metodos[resultado.metodo] += 1;
        pessoasFolhaVinculadas.add(resultado.pessoa.legacyId);
        referenciasFolhaVinculadas.add(item.pessoaLegacyId);
        return { ...item, pessoaLegacyId: resultado.pessoa.legacyId };
      }),
    })),
  }));

  const folhasPorPessoaCompetencia = new Map<string, Set<string>>();
  for (const folha of folhas.flatMap((snapshot) => snapshot.records)) {
    for (const item of folha.itens) {
      const chave = `${folha.competencia}|${item.pessoaLegacyId}`;
      const ids = folhasPorPessoaCompetencia.get(chave) ?? new Set<string>();
      ids.add(folha.legacyId);
      folhasPorPessoaCompetencia.set(chave, ids);
    }
  }

  const beneficiariosGps = new Set<string>();
  const beneficiariosGpsVinculados = new Set<string>();
  const referenciasGpsVinculadas = new Set<string>();
  let guiasVinculadasAFolha = 0;
  const guias = guiasOriginais.map((snapshot) => ({
    ...snapshot,
    records: snapshot.records.map((guia) => {
      const chaveBeneficiario =
        digitos(guia.identificador) || nomeNormalizado(guia.beneficiarioNome);
      beneficiariosGps.add(chaveBeneficiario);
      const resultado = resolver([
        { metodo: "NIT", chave: digitos(guia.identificador), indice: porNit },
        {
          metodo: "NOME",
          chave: nomeNormalizado(guia.beneficiarioNome),
          indice: porNome,
        },
      ]);
      if (!resultado.pessoa || !resultado.metodo) {
        issues.push({
          entity: "guia_inss",
          legacyId: guia.legacyId,
          reason: resultado.ambiguous ? "AMBIGUA" : "NAO_ENCONTRADA",
        });
        return guia;
      }
      metodos[resultado.metodo] += 1;
      beneficiariosGpsVinculados.add(resultado.pessoa.legacyId);
      referenciasGpsVinculadas.add(chaveBeneficiario);
      const folhasRelacionadas = [
        ...(folhasPorPessoaCompetencia.get(
          `${guia.competencia}|${resultado.pessoa.legacyId}`,
        ) ?? []),
      ].sort();
      if (folhasRelacionadas.length > 0) guiasVinculadasAFolha += 1;
      return {
        ...guia,
        pessoaLegacyId: resultado.pessoa.legacyId,
        folhaLegacyIds: [
          ...new Set([...guia.folhaLegacyIds, ...folhasRelacionadas]),
        ].sort(),
      };
    }),
  }));

  const pessoasFolhaPendentes = [...pessoasFolha].filter(
    (referencia) => !referenciasFolhaVinculadas.has(referencia),
  ).length;
  const beneficiariosGpsPendentes = [...beneficiariosGps].filter(
    (referencia) => !referenciasGpsVinculadas.has(referencia),
  ).length;
  return {
    folhas,
    guias,
    report: {
      schemaVersion: "1.0",
      status: issues.length === 0 ? "PRONTA" : "PENDENTE",
      summary: {
        pessoasDisponiveis: pessoas.length,
        pessoasFolha: pessoasFolha.size,
        pessoasFolhaVinculadas: pessoasFolhaVinculadas.size,
        pessoasFolhaPendentes,
        beneficiariosGps: beneficiariosGps.size,
        beneficiariosGpsVinculados: beneficiariosGpsVinculados.size,
        beneficiariosGpsPendentes,
        guiasVinculadasAFolha,
        metodos,
      },
      issues,
    },
  };
}
