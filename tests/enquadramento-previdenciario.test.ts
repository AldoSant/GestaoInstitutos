import assert from "node:assert/strict";
import test from "node:test";
import {
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
