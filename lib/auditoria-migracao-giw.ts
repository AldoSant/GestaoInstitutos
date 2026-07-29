import { checksum, type GiwSnapshot } from "./importacao-giw";

export type ChaveMigracaoGiwEsperada = {
  entidade: string;
  legacyId: string;
  destinoTabela: string;
  checksum: string;
};

export type SnapshotMigracaoGiwEsperado = {
  entidade: string;
  checksumArquivo: string;
  registros: number;
};

export type ResumoFinanceiroGiwEsperado = {
  competencia: string;
  folhas: number;
  itensFolha: number;
  rubricas: number;
  guias: number;
  proventosCentavos: bigint;
  descontosCentavos: bigint;
  liquidoCentavos: bigint;
  baseInssCentavos: bigint;
  inssCentavos: bigint;
  guiasCentavos: bigint;
};

export type ExpectativaMigracaoGiw = {
  chaves: ChaveMigracaoGiwEsperada[];
  snapshots: SnapshotMigracaoGiwEsperado[];
  financeiro: ResumoFinanceiroGiwEsperado[];
};

const destinoPorEntidade: Record<string, string> = {
  pessoas: "pessoa",
  atividades: "atividade",
  lotacoes: "lotacao",
  termos: "termo",
  metas: "termo_meta",
  vinculos: "prestador_vinculo",
  eventos: "evento",
  lancamentos_eventos: "lancamento_evento_recorrente",
  produtividade: "medicao_mensal",
  folhas_historicas: "legado_folha",
  guias_inss_historicas: "legado_guia_inss",
};

function centavos(valor: string) {
  const sinal = valor.startsWith("-") ? -1n : 1n;
  const semSinal = valor.replace(/^[+-]/, "");
  const [inteiro = "0", fracao = ""] = semSinal.split(".");
  const duasCasas = `${fracao}00`.slice(0, 2);
  const terceiraCasa = Number(fracao[2] ?? "0");
  const absoluto =
    BigInt(inteiro || "0") * 100n +
    BigInt(duasCasas || "0") +
    (terceiraCasa >= 5 ? 1n : 0n);
  return absoluto * sinal;
}

function competenciaMes(valor: string) {
  return valor.slice(0, 7);
}

function resumoVazio(competencia: string): ResumoFinanceiroGiwEsperado {
  return {
    competencia,
    folhas: 0,
    itensFolha: 0,
    rubricas: 0,
    guias: 0,
    proventosCentavos: 0n,
    descontosCentavos: 0n,
    liquidoCentavos: 0n,
    baseInssCentavos: 0n,
    inssCentavos: 0n,
    guiasCentavos: 0n,
  };
}

function adicionarChave(
  chaves: ChaveMigracaoGiwEsperada[],
  entidade: string,
  registro: { legacyId: string },
) {
  chaves.push({
    entidade,
    legacyId: registro.legacyId,
    destinoTabela: destinoPorEntidade[entidade],
    checksum: checksum(registro),
  });
}

export function construirExpectativaMigracaoGiw(
  snapshots: GiwSnapshot[],
): ExpectativaMigracaoGiw {
  const chaves: ChaveMigracaoGiwEsperada[] = [];
  const arquivos: SnapshotMigracaoGiwEsperado[] = [];
  const financeiro = new Map<string, ResumoFinanceiroGiwEsperado>();

  for (const snapshot of snapshots) {
    arquivos.push({
      entidade: snapshot.entity,
      checksumArquivo: checksum(snapshot),
      registros: snapshot.records.length,
    });

    if (snapshot.entity === "termos") {
      for (const termo of snapshot.records) {
        adicionarChave(chaves, "termos", termo);
        termo.metas.forEach((meta) => adicionarChave(chaves, "metas", meta));
      }
      continue;
    }

    if (snapshot.entity === "folhas_historicas") {
      for (const registro of snapshot.records) {
        adicionarChave(chaves, snapshot.entity, registro);
        const competencia = competenciaMes(registro.competencia);
        const resumo =
          financeiro.get(competencia) ?? resumoVazio(competencia);
        resumo.folhas += 1;
        resumo.itensFolha += registro.itens.length;
        resumo.rubricas += registro.itens.reduce(
          (total, item) => total + item.rubricas.length,
          0,
        );
        resumo.proventosCentavos += centavos(registro.totalProventos);
        resumo.descontosCentavos += centavos(registro.totalDescontos);
        resumo.liquidoCentavos += centavos(registro.totalLiquido);
        resumo.baseInssCentavos += centavos(registro.baseInss);
        resumo.inssCentavos += centavos(registro.valorInss);
        financeiro.set(competencia, resumo);
      }
      continue;
    }

    if (snapshot.entity === "guias_inss_historicas") {
      for (const registro of snapshot.records) {
        adicionarChave(chaves, snapshot.entity, registro);
        const competencia = competenciaMes(registro.competencia);
        const resumo =
          financeiro.get(competencia) ?? resumoVazio(competencia);
        resumo.guias += 1;
        resumo.guiasCentavos += centavos(registro.total);
        financeiro.set(competencia, resumo);
      }
      continue;
    }

    for (const registro of snapshot.records) {
      adicionarChave(chaves, snapshot.entity, registro);
    }
  }

  return {
    chaves: chaves.sort((a, b) =>
      `${a.entidade}/${a.legacyId}`.localeCompare(
        `${b.entidade}/${b.legacyId}`,
      ),
    ),
    snapshots: arquivos,
    financeiro: [...financeiro.values()].sort((a, b) =>
      a.competencia.localeCompare(b.competencia),
    ),
  };
}

export function formatarCentavos(valor: bigint) {
  const sinal = valor < 0 ? "-" : "";
  const absoluto = valor < 0 ? -valor : valor;
  return `${sinal}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, "0")}`;
}
