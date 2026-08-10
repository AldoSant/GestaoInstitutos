import { calcularIrrf2026 } from "../../lib/calculos";
import { REGRA_FISCAL_2026 } from "../../lib/regras-fiscais";
import { getPool } from "../../db";

function argumentos(nome: string) {
  return process.argv.slice(2).flatMap((valor, indice, itens) =>
    valor === nome && itens[indice + 1] ? [itens[indice + 1]] : [],
  );
}

function validarCompetencia(valor: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    throw new Error("Use --competencia AAAA-MM.");
  }
}

const empresaId = argumentos("--empresa-id")[0] ?? "";
const competencias = [...new Set(argumentos("--competencia"))].sort();
if (!empresaId) throw new Error("Informe --empresa-id.");
competencias.forEach(validarCompetencia);

const regraSemSimplificadoSemReducao = {
  ...REGRA_FISCAL_2026,
  irrf: {
    ...REGRA_FISCAL_2026.irrf,
    descontoSimplificadoCentavos: 0,
    reducao: {
      integralAteCentavos: 0,
      integralLimiteCentavos: 0,
      decrescenteAteCentavos: 0,
      constanteCentavos: 0,
      coeficienteNumerador: 0,
      coeficienteDenominador: 1,
    },
  },
};

try {
  const resultado = await getPool().query<{
    competencia: string;
    pessoa_legacy_id: string;
    proventos: string;
    inss: string;
    irrf: string;
    dependentes: number;
  }>(
    `with totais as (
       select to_char(f.competencia, 'YYYY-MM') competencia,
              i.pessoa_legacy_id,
              sum(i.total_proventos)::text proventos,
              sum(i.valor_inss)::text inss,
              sum(i.valor_irrf)::text irrf
         from legado_folha f
         join legado_folha_item i on i.folha_legado_id = f.id
        where f.empresa_id = $1 and f.origem = 'GIW'
          and (cardinality($2::text[]) = 0 or to_char(f.competencia, 'YYYY-MM') = any($2::text[]))
        group by f.competencia, i.pessoa_legacy_id
     )
     select totais.*,
            coalesce((
              select count(*)::int
                from legado_chave chave
                join dependente d
                  on d.empresa_id = chave.empresa_id and d.pessoa_id = chave.destino_id
               where chave.empresa_id = $1 and chave.origem = 'GIW'
                 and chave.entidade = 'pessoas' and chave.legacy_id = totais.pessoa_legacy_id
                 and d.ativo
                 and (d.baixa_irrf is null or d.baixa_irrf >= (totais.competencia || '-01')::date)
            ), 0) dependentes
       from totais
      order by competencia, pessoa_legacy_id`,
    [empresaId, competencias],
  );

  const porCompetencia = new Map<string, {
    pessoas: number;
    irrfLegadoPositivo: number;
    coincideVigente: number;
    coincideHistorica: number;
    coincideAmbas: number;
    naoExplicada: number;
  }>();
  for (const linha of resultado.rows) {
    const atual = porCompetencia.get(linha.competencia) ?? {
      pessoas: 0,
      irrfLegadoPositivo: 0,
      coincideVigente: 0,
      coincideHistorica: 0,
      coincideAmbas: 0,
      naoExplicada: 0,
    };
    atual.pessoas += 1;
    const esperadoCentavos = Math.round(Number(linha.irrf) * 100);
    if (esperadoCentavos > 0) atual.irrfLegadoPositivo += 1;
    const entrada = {
      rendimentos: Number(linha.proventos),
      inssDedutivel: Number(linha.inss),
      dependentes: linha.dependentes,
    };
    const vigente = Math.round(calcularIrrf2026(entrada).valor * 100);
    const historica = Math.round(
      calcularIrrf2026({ ...entrada, regra: regraSemSimplificadoSemReducao }).valor * 100,
    );
    const correspondeVigente = vigente === esperadoCentavos;
    const correspondeHistorica = historica === esperadoCentavos;
    if (correspondeVigente) atual.coincideVigente += 1;
    if (correspondeHistorica) atual.coincideHistorica += 1;
    if (correspondeVigente && correspondeHistorica) atual.coincideAmbas += 1;
    if (!correspondeVigente && !correspondeHistorica) atual.naoExplicada += 1;
    porCompetencia.set(linha.competencia, atual);
  }

  console.log(JSON.stringify({
    tipo: "DIAGNOSTICO_IRRF_LEGADO",
    competencias: [...porCompetencia.entries()].map(([competencia, resumo]) => ({
      competencia,
      ...resumo,
    })),
  }, null, 2));
} finally {
  await getPool().end();
}
