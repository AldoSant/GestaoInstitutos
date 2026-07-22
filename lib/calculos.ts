export const PARAMETROS_2026 = {
  tetoBaseInss: 8_475.55,
  tetoContribuicaoInss: 932.31,
  aliquotaInssPrestador: 0.11,
  descontoSimplificadoIrrf: 607.2,
  deducaoDependenteIrrf: 189.59,
} as const;

export type ResultadoInss = {
  base: number;
  aliquota: number;
  valor: number;
  tetoAtingido: boolean;
};

export type ResultadoIrrf = {
  rendimentos: number;
  metodoDeducao: "LEGAL" | "SIMPLIFICADA";
  deducaoUtilizada: number;
  base: number;
  impostoBruto: number;
  reducao: number;
  valor: number;
};

export function arredondarMoeda(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularInssPrestador(
  baseTributavel: number,
  baseContribuidaEmOutrasFontes = 0,
): ResultadoInss {
  const baseResidual = Math.max(
    0,
    PARAMETROS_2026.tetoBaseInss - baseContribuidaEmOutrasFontes,
  );
  const base = arredondarMoeda(
    Math.min(Math.max(0, baseTributavel), baseResidual),
  );
  const valor = Math.min(
    arredondarMoeda(base * PARAMETROS_2026.aliquotaInssPrestador),
    PARAMETROS_2026.tetoContribuicaoInss,
  );

  return {
    base,
    aliquota: PARAMETROS_2026.aliquotaInssPrestador,
    valor,
    tetoAtingido: baseResidual === 0 || base === baseResidual,
  };
}

function calcularIrrfBruto(base: number) {
  if (base <= 2_428.8) return 0;
  if (base <= 2_826.65) return arredondarMoeda(base * 0.075 - 182.16);
  if (base <= 3_751.05) return arredondarMoeda(base * 0.15 - 394.16);
  if (base <= 4_664.68) return arredondarMoeda(base * 0.225 - 675.49);
  return arredondarMoeda(base * 0.275 - 908.73);
}

export function calcularIrrf2026({
  rendimentos,
  inssDedutivel,
  dependentes = 0,
  outrasDeducoes = 0,
}: {
  rendimentos: number;
  inssDedutivel: number;
  dependentes?: number;
  outrasDeducoes?: number;
}): ResultadoIrrf {
  const deducaoLegal = arredondarMoeda(
    Math.max(0, inssDedutivel) +
      Math.max(0, dependentes) * PARAMETROS_2026.deducaoDependenteIrrf +
      Math.max(0, outrasDeducoes),
  );
  const usarSimplificada =
    PARAMETROS_2026.descontoSimplificadoIrrf > deducaoLegal;
  const deducaoUtilizada = usarSimplificada
    ? PARAMETROS_2026.descontoSimplificadoIrrf
    : deducaoLegal;
  const base = arredondarMoeda(Math.max(0, rendimentos - deducaoUtilizada));
  const impostoBruto = calcularIrrfBruto(base);

  let reducao = 0;
  if (rendimentos <= 5_000) {
    reducao = Math.min(impostoBruto, 312.89);
  } else if (rendimentos <= 7_350) {
    reducao = Math.min(
      impostoBruto,
      Math.max(0, arredondarMoeda(978.62 - 0.133145 * rendimentos)),
    );
  }

  reducao = arredondarMoeda(reducao);

  return {
    rendimentos: arredondarMoeda(rendimentos),
    metodoDeducao: usarSimplificada ? "SIMPLIFICADA" : "LEGAL",
    deducaoUtilizada,
    base,
    impostoBruto,
    reducao,
    valor: arredondarMoeda(Math.max(0, impostoBruto - reducao)),
  };
}

export function analisarConciliacaoPrevidenciaria(
  inssFolha: number,
  totalObrigacao: number,
) {
  const diferenca = arredondarMoeda(totalObrigacao - inssFolha);
  const razao = inssFolha === 0 ? null : totalObrigacao / inssFolha;
  const duplicacaoExata =
    razao !== null && Math.abs(razao - 2) < 0.000_001;

  return {
    diferenca,
    razao: razao === null ? null : arredondarMoeda(razao),
    duplicacaoExata,
    conciliado: Math.abs(diferenca) < 0.01,
  };
}
