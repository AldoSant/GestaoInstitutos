import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGO_REGIMES_PREVIDENCIARIOS,
  CENARIOS_PREVIDENCIARIOS,
  validarEnquadramentoPrevidenciario,
} from "../lib/enquadramento-previdenciario";

test("cenários fixam a combinação segurado e patronal", () => {
  assert.deepEqual(
    {
      segurado: CENARIOS_PREVIDENCIARIOS.EMPRESA_GERAL.aliquotaSeguradoNumerador,
      patronal: CENARIOS_PREVIDENCIARIOS.EMPRESA_GERAL.aliquotaPatronalNumerador,
    },
    { segurado: 11, patronal: 20 },
  );
  assert.deepEqual(
    {
      segurado:
        CENARIOS_PREVIDENCIARIOS.BENEFICENTE_IMUNE.aliquotaSeguradoNumerador,
      patronal:
        CENARIOS_PREVIDENCIARIOS.BENEFICENTE_IMUNE.aliquotaPatronalNumerador,
    },
    { segurado: 20, patronal: 0 },
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(CENARIOS_PREVIDENCIARIOS).map(([regime, cenario]) => [
        regime,
        [
          cenario.aliquotaSeguradoNumerador /
            cenario.aliquotaSeguradoDenominador,
          cenario.aliquotaPatronalNumerador /
            cenario.aliquotaPatronalDenominador,
        ],
      ]),
    ),
    {
      EMPRESA_GERAL: [0.11, 0.2],
      SIMPLES_SUBSTITUIDA: [0.11, 0],
      SIMPLES_ANEXO_IV: [0.11, 0.2],
      BENEFICENTE_IMUNE: [0.2, 0],
      ADMINISTRACAO_PUBLICA: [0.11, 0.2],
      INSTITUICAO_FINANCEIRA: [0.11, 0.225],
    },
  );
});

test("catálogo não permite publicar cenários que dependem de apuração variável", () => {
  const indisponiveis = CATALOGO_REGIMES_PREVIDENCIARIOS.filter(
    (item) => !item.publicavel,
  );
  assert.deepEqual(
    indisponiveis.map((item) => item.regime),
    ["SIMPLES_MISTO", "CPRB", "PRODUTOR_RURAL", "ASSOCIACAO_DESPORTIVA"],
  );
  assert.ok(indisponiveis.every((item) => item.motivoIndisponibilidade));
});

test("imunidade exige CEBAS cobrindo toda a vigência", () => {
  const invalido = validarEnquadramentoPrevidenciario({
    regime: "BENEFICENTE_IMUNE",
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-12-31",
    cebasNumero: "CEBAS-1",
    cebasInicio: "2026-02-01",
    cebasFim: "2026-12-31",
    evidencia: "Certidão conferida pelo responsável.",
  });
  assert.equal(invalido.dados, null);
  assert.match(invalido.erros.join(" "), /cobrir todo o enquadramento/);

  const valido = validarEnquadramentoPrevidenciario({
    regime: "BENEFICENTE_IMUNE",
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-12-31",
    cebasNumero: "CEBAS-1",
    cebasInicio: "2025-01-01",
    cebasFim: "2027-12-31",
    evidencia: "Certidão conferida pelo responsável.",
  });
  assert.ok(valido.dados);
});

test("campos CEBAS são descartados nos demais enquadramentos", () => {
  const validacao = validarEnquadramentoPrevidenciario({
    regime: "SIMPLES_ANEXO_IV",
    inicioVigencia: "2026-01-01",
    fimVigencia: "2026-12-31",
    cebasNumero: "não deve persistir",
    cebasInicio: "2025-01-01",
    cebasFim: "2027-12-31",
    evidencia: "Opção pelo Anexo IV conferida pelo responsável.",
  });
  assert.ok(validacao.dados);
  assert.equal(validacao.dados.cebasNumero, null);
  assert.equal(validacao.dados.cebasInicio, null);
  assert.equal(validacao.dados.cebasFim, null);
});
