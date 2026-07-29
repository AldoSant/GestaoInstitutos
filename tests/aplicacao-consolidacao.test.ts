import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarRateioConsolidadoNaFolha,
  avaliarAtivacaoConsolidacaoProdutiva,
  type RateioConsolidadoFonte,
} from "../lib/aplicacao-consolidacao";
import { processarVinculoFolha } from "../lib/processamento-folha";
import { REGRA_FISCAL_2026 } from "../lib/regras-fiscais";

const EMPRESA = "00000000-0000-4000-8000-000000000010";
const VINCULO = "00000000-0000-4000-8000-000000000011";

function resultadoIndividual() {
  return processarVinculoFolha(
    {
      vinculoId: VINCULO,
      tipoPessoa: "FISICA",
      categoriaContribuinte: "701",
      valorRetribuicao: "6000.00",
      descontaInss: true,
      descontaIrrf: true,
      isentoInss: false,
      baseOutrasFontes: "0",
      outrasFontes: [],
      enquadramentoPrevidenciario: {
        id: "00000000-0000-4000-8000-000000000012",
        regime: "EMPRESA_GERAL",
        aliquotaSeguradoNumerador: 11,
        aliquotaSeguradoDenominador: 100,
        aliquotaPatronalNumerador: 20,
        aliquotaPatronalDenominador: 100,
        fonteNormativa: "Fonte sintética",
      },
      dependentesIrrf: 0,
      eventos: [],
    },
    REGRA_FISCAL_2026,
  );
}

function rateio(overrides: Partial<RateioConsolidadoFonte> = {}): RateioConsolidadoFonte {
  return {
    simulacaoId: "00000000-0000-4000-8000-000000000013",
    hashResultado: "a".repeat(64),
    vinculoId: VINCULO,
    totalProventosCentavos: 600_000,
    descontosEventosCentavos: 0,
    totalDescontosCentavos: 90_000,
    totalLiquidoCentavos: 510_000,
    baseInssBrutaCentavos: 600_000,
    baseInssCentavos: 450_000,
    valorInssCentavos: 50_000,
    baseIrrfBrutaCentavos: 600_000,
    baseIrrfCentavos: 500_000,
    irrfBrutoCentavos: 50_000,
    irrfReducaoCentavos: 10_000,
    valorIrrfCentavos: 40_000,
    ...overrides,
  };
}

test("aplica rateio homologado e substitui somente as linhas fiscais", () => {
  const aplicado = aplicarRateioConsolidadoNaFolha(resultadoIndividual(), rateio());
  assert.equal(aplicado.valorInssCentavos, 50_000);
  assert.equal(aplicado.valorIrrfCentavos, 40_000);
  assert.equal(aplicado.totalLiquidoCentavos, 510_000);
  assert.deepEqual(
    aplicado.linhas
      .filter((linha) => linha.codigo === "INSS" || linha.codigo === "IRRF")
      .map((linha) => [linha.codigo, linha.baseCalculoCentavos, linha.valorCentavos]),
    [
      ["INSS", 450_000, 50_000],
      ["IRRF", 500_000, 40_000],
    ],
  );
  assert.deepEqual(aplicado.memoria.consolidacaoFiscal, {
    modo: "RATEIO_HOMOLOGADO",
    simulacaoId: "00000000-0000-4000-8000-000000000013",
    hashResultado: "a".repeat(64),
    vinculoId: VINCULO,
  });
});

test("recusa rateio obsoleto ou sem fechamento monetário", () => {
  assert.throws(
    () =>
      aplicarRateioConsolidadoNaFolha(
        resultadoIndividual(),
        rateio({ totalProventosCentavos: 599_999 }),
      ),
    /mudaram após a simulação/,
  );
  assert.throws(
    () =>
      aplicarRateioConsolidadoNaFolha(
        resultadoIndividual(),
        rateio({ totalLiquidoCentavos: 509_999 }),
      ),
    /fechamento monetário/,
  );
});

test("ativação produtiva exige empresa e competência explicitamente delimitadas", () => {
  const ambiente = {
    FOLHA_CONSOLIDADA_PRODUTIVA: "true",
    FOLHA_CONSOLIDADA_EMPRESA_ID: EMPRESA,
    FOLHA_CONSOLIDADA_INICIO: "2026-08",
  };
  assert.equal(
    avaliarAtivacaoConsolidacaoProdutiva({
      empresaId: EMPRESA,
      competencia: "2026-07-01",
      ambiente,
    }).ativa,
    false,
  );
  assert.equal(
    avaliarAtivacaoConsolidacaoProdutiva({
      empresaId: EMPRESA,
      competencia: "2026-08-01",
      ambiente,
    }).ativa,
    true,
  );
  assert.equal(
    avaliarAtivacaoConsolidacaoProdutiva({
      empresaId: "00000000-0000-4000-8000-000000000099",
      competencia: "2026-08-01",
      ambiente,
    }).ativa,
    false,
  );
  assert.throws(
    () =>
      avaliarAtivacaoConsolidacaoProdutiva({
        empresaId: EMPRESA,
        competencia: "2026-08-01",
        ambiente: {
          FOLHA_CONSOLIDADA_PRODUTIVA: "true",
          FOLHA_CONSOLIDADA_EMPRESA_ID: EMPRESA,
        },
      }),
    /FOLHA_CONSOLIDADA_INICIO/,
  );
});
