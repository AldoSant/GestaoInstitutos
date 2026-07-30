import assert from "node:assert/strict";
import test from "node:test";
import {
  derivarPagamentoFolhaPf,
  validarClassificacaoLegado,
  validarPagamentoDemonstrativo,
} from "../lib/demonstrativo-mensal";

test("deriva pagamento PF sem tratar desconto não tributário como retenção fiscal", () => {
  assert.deepEqual(
    derivarPagamentoFolhaPf({
      proventosCentavos: 100_000,
      descontosCentavos: 15_000,
      inssCentavos: 10_000,
      irrfCentavos: 2_000,
      liquidoCentavos: 85_000,
    }),
    {
      valorBrutoCentavos: 97_000,
      retencoesTributariasCentavos: 12_000,
      descontosNaoTributariosCentavos: 3_000,
      valorLiquidoCentavos: 85_000,
    },
  );
});

test("recusa Folha cuja composição monetária não fecha", () => {
  assert.throws(
    () =>
      derivarPagamentoFolhaPf({
        proventosCentavos: 100_000,
        descontosCentavos: 15_000,
        inssCentavos: 10_000,
        irrfCentavos: 2_000,
        liquidoCentavos: 86_000,
      }),
    /líquido da Folha diverge/,
  );
});

test("aceita pagamento PF calculado pela folha", () => {
  const resultado = validarPagamentoDemonstrativo({
    tipoPessoa: "FISICA",
    origem: "FOLHA_PF",
    valorBrutoCentavos: 100_000,
    valorLiquidoCentavos: 89_000,
    retencoes: [
      { tributo: "INSS", valorCentavos: 11_000, origem: "CALCULO_FOLHA_PF" },
    ],
  });
  assert.equal(resultado.totalRetencoesCentavos, 11_000);
});

test("aceita pagamento PJ legítimo sem inventar retenção", () => {
  const resultado = validarPagamentoDemonstrativo({
    tipoPessoa: "JURIDICA",
    origem: "NOTA_FISCAL_PJ",
    valorBrutoCentavos: 250_000,
    valorLiquidoCentavos: 250_000,
    retencoes: [],
  });
  assert.equal(resultado.valorLiquidoCentavos, 250_000);
});

test("rejeita retenção automática PJ sem matriz versionada e evidência", () => {
  assert.throws(
    () =>
      validarPagamentoDemonstrativo({
        tipoPessoa: "JURIDICA",
        origem: "NOTA_FISCAL_PJ",
        valorBrutoCentavos: 100_000,
        valorLiquidoCentavos: 89_000,
        retencoes: [
          {
            tributo: "INSS",
            valorCentavos: 11_000,
            origem: "MATRIZ_FISCAL",
          },
        ],
      }),
    /regra fiscal versionada e evidência/,
  );
});

test("rejeita líquido divergente", () => {
  assert.throws(
    () =>
      validarPagamentoDemonstrativo({
        tipoPessoa: "JURIDICA",
        origem: "NOTA_FISCAL_PJ",
        valorBrutoCentavos: 100_000,
        valorLiquidoCentavos: 95_000,
        retencoes: [
          {
            tributo: "ISS",
            valorCentavos: 4_000,
            origem: "DOCUMENTO_FISCAL",
            evidencia: "NF 123",
          },
        ],
      }),
    /diverge/,
  );
});

test("classificação de legado decidida exige responsável e evidência", () => {
  assert.throws(
    () =>
      validarClassificacaoLegado({
        natureza: "GUIA_RECOLHIMENTO",
        status: "CONFIRMADA",
      }),
    /responsável e evidência/,
  );
  assert.doesNotThrow(() =>
    validarClassificacaoLegado({
      natureza: "GUIA_RECOLHIMENTO",
      status: "CONFIRMADA",
      responsavel: "Gerente de RH",
      evidencia: "GPS da competência 2025-01",
    }),
  );
});
