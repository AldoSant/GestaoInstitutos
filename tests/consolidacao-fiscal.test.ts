import assert from "node:assert/strict";
import test from "node:test";
import {
  processarPessoaConsolidada,
  ratearCentavos,
} from "../lib/consolidacao-fiscal";
import {
  processarVinculoFolha,
  type EntradaVinculoFolha,
} from "../lib/processamento-folha";
import { calcularIrrf2026 } from "../lib/calculos";
import { REGRA_FISCAL_2026 } from "../lib/regras-fiscais";

const ENQUADRAMENTO_GERAL = {
  id: "00000000-0000-4000-8000-000000000099",
  regime: "EMPRESA_GERAL",
  aliquotaSeguradoNumerador: 11,
  aliquotaSeguradoDenominador: 100,
  aliquotaPatronalNumerador: 20,
  aliquotaPatronalDenominador: 100,
  fonteNormativa: "Fonte normativa de teste",
} as const;

function fonte(
  vinculoId: string,
  valorRetribuicao: string,
  parcial: Partial<EntradaVinculoFolha> = {},
): EntradaVinculoFolha {
  return {
    vinculoId,
    tipoPessoa: "FISICA",
    categoriaContribuinte: "701",
    valorRetribuicao,
    descontaInss: true,
    descontaIrrf: true,
    isentoInss: false,
    baseOutrasFontes: "0",
    outrasFontes: [],
    enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
    dependentesIrrf: 0,
    eventos: [],
    ...parcial,
  };
}

test("rateia centavos pelo maior resto sem perder valor", () => {
  assert.deepEqual(
    Object.fromEntries(
      ratearCentavos(10, [
        { chave: "B", peso: 1 },
        { chave: "A", peso: 1 },
        { chave: "C", peso: 1 },
      ]),
    ),
    { B: 3, A: 4, C: 3 },
  );
  assert.deepEqual(
    ratearCentavos(10, [
      { chave: "C", peso: 1 },
      { chave: "B", peso: 1 },
      { chave: "A", peso: 1 },
    ]),
    ratearCentavos(10, [
      { chave: "A", peso: 1 },
      { chave: "B", peso: 1 },
      { chave: "C", peso: 1 },
    ]),
  );
});

test("rateio rejeita chaves, pesos e bases ambíguas", () => {
  assert.throws(
    () =>
      ratearCentavos(1, [
        { chave: "A", peso: 1 },
        { chave: "A", peso: 2 },
      ]),
    /únicas/,
  );
  assert.throws(
    () => ratearCentavos(1, [{ chave: "A", peso: 0 }]),
    /sem base/,
  );
  assert.throws(
    () => ratearCentavos(1, [{ chave: "A", peso: -1 }]),
    /não negativo/,
  );
  assert.throws(
    () =>
      ratearCentavos(1, [
        { chave: "A", peso: Number.MAX_SAFE_INTEGER },
        { chave: "B", peso: 1 },
      ]),
    /limite numérico seguro/,
  );
});

test("uma única fonte preserva exatamente o cálculo individual", () => {
  const entrada = fonte(
    "00000000-0000-4000-8000-000000000001",
    "6000.00",
    { dependentesIrrf: 1 },
  );
  const individual = processarVinculoFolha(entrada, REGRA_FISCAL_2026);
  const consolidado = processarPessoaConsolidada(
    [entrada],
    REGRA_FISCAL_2026,
  );

  assert.equal(consolidado.totalProventosCentavos, individual.totalProventosCentavos);
  assert.equal(consolidado.totalDescontosCentavos, individual.totalDescontosCentavos);
  assert.equal(consolidado.valorInssCentavos, individual.valorInssCentavos);
  assert.equal(consolidado.baseIrrfCentavos, individual.baseIrrfCentavos);
  assert.equal(consolidado.valorIrrfCentavos, individual.valorIrrfCentavos);
  assert.equal(consolidado.fontes[0].totalLiquidoCentavos, individual.totalLiquidoCentavos);
});

test("calcula tributos uma vez por pessoa e rateia exatamente entre vínculos", () => {
  const a = fonte("00000000-0000-4000-8000-000000000011", "3000.00");
  const b = fonte("00000000-0000-4000-8000-000000000012", "2000.00");
  const consolidado = processarPessoaConsolidada(
    [b, a],
    REGRA_FISCAL_2026,
  );

  assert.deepEqual(
    consolidado.fontes.map((item) => item.vinculoId),
    [a.vinculoId, b.vinculoId],
  );
  assert.equal(consolidado.baseInssBrutaCentavos, 500_000);
  assert.equal(consolidado.baseInssCentavos, 500_000);
  assert.equal(consolidado.valorInssCentavos, 55_000);
  assert.equal(
    consolidado.fontes.reduce((soma, item) => soma + item.valorInssCentavos, 0),
    consolidado.valorInssCentavos,
  );
  assert.equal(
    consolidado.fontes.reduce((soma, item) => soma + item.valorIrrfCentavos, 0),
    consolidado.valorIrrfCentavos,
  );
  assert.equal(
    consolidado.fontes.reduce((soma, item) => soma + item.totalLiquidoCentavos, 0),
    consolidado.totalLiquidoCentavos,
  );
  assert.equal(consolidado.memoria.modo, "SIMULACAO_NAO_HOMOLOGADA");
});

test("resultado não depende da ordem recebida das fontes", () => {
  const a = fonte("00000000-0000-4000-8000-000000000021", "3333.33");
  const b = fonte("00000000-0000-4000-8000-000000000022", "1111.11");
  assert.deepEqual(
    processarPessoaConsolidada([a, b], REGRA_FISCAL_2026),
    processarPessoaConsolidada([b, a], REGRA_FISCAL_2026),
  );
});

test("aplica o teto de INSS ao agregado e não a cada vínculo", () => {
  const consolidado = processarPessoaConsolidada(
    [
      fonte("00000000-0000-4000-8000-000000000031", "6000.00"),
      fonte("00000000-0000-4000-8000-000000000032", "6000.00"),
    ],
    REGRA_FISCAL_2026,
  );
  assert.equal(consolidado.baseInssBrutaCentavos, 1_200_000);
  assert.equal(consolidado.baseInssCentavos, 847_555);
  assert.equal(consolidado.valorInssCentavos, 93_231);
  assert.equal(consolidado.memoria.inss.tetoAtingido, true);
});

test("considera a base comprovada em outras fontes somente uma vez", () => {
  const outrasFontes = [
    {
      fontePagadora: "Outra contratante",
      documentoFonte: "12345678000199",
      baseContribuicao: "4000.00",
      valorContribuicao: "440.00",
      documentoReferencia: "REC-2026-07",
    },
  ];
  const complemento = {
    baseOutrasFontes: "4000.00",
    outrasFontes,
    descontaIrrf: false,
  };
  const consolidado = processarPessoaConsolidada(
    [
      fonte("00000000-0000-4000-8000-000000000041", "3000.00", complemento),
      fonte("00000000-0000-4000-8000-000000000042", "3000.00", complemento),
    ],
    REGRA_FISCAL_2026,
  );

  assert.equal(consolidado.baseInssBrutaCentavos, 600_000);
  assert.equal(consolidado.baseInssCentavos, 447_555);
  assert.equal(consolidado.valorInssCentavos, 49_231);
  assert.equal(
    consolidado.memoria.outrasFontes.baseContribuidaCentavos,
    400_000,
  );
});

test("aplica dependentes e dedução previdenciária uma vez no IRRF mensal", () => {
  const fontes = [
    fonte("00000000-0000-4000-8000-000000000051", "3500.00", {
      dependentesIrrf: 2,
    }),
    fonte("00000000-0000-4000-8000-000000000052", "3500.00", {
      dependentesIrrf: 2,
    }),
  ];
  const consolidado = processarPessoaConsolidada(fontes, REGRA_FISCAL_2026);
  const somaIndividuais = fontes
    .map((item) => processarVinculoFolha(item, REGRA_FISCAL_2026))
    .reduce((soma, item) => soma + item.valorIrrfCentavos, 0);

  assert.equal(consolidado.memoria.dependentesIrrf, 2);
  assert.notEqual(consolidado.valorIrrfCentavos, somaIndividuais);
  assert.equal(
    consolidado.fontes.reduce((soma, item) => soma + item.valorIrrfCentavos, 0),
    consolidado.valorIrrfCentavos,
  );
});

test("abate IRRF já recolhido em outra fonte antes de ratear entre as Folhas", () => {
  const outrasFontes = [{
    fontePagadora: "Outra contratante",
    documentoFonte: "12345678000199",
    remuneracao: "3000.00",
    baseContribuicao: "0.00",
    valorContribuicao: "0.00",
    inssDedutivelIrrf: "0.00",
    irrfRetido: "100.00",
    documentoReferencia: "INF-2026-08",
  }];
  const fontes = [
    fonte("00000000-0000-4000-8000-000000000151", "2000.00", { outrasFontes }),
    fonte("00000000-0000-4000-8000-000000000152", "1000.00", { outrasFontes }),
  ];
  const consolidado = processarPessoaConsolidada(fontes, REGRA_FISCAL_2026);
  const total = calcularIrrf2026({ rendimentos: 6000, inssDedutivel: 330 });

  assert.equal(consolidado.rendimentosIrrfCentavos, 600_000);
  assert.equal(
    consolidado.valorIrrfCentavos,
    Math.max(0, Math.round(total.valor * 100) - 10_000),
  );
  assert.equal(
    consolidado.fontes.reduce((soma, item) => soma + item.valorIrrfCentavos, 0),
    consolidado.valorIrrfCentavos,
  );
  assert.equal(consolidado.memoria.outrasFontes.irrfRetidoCentavos, 10_000);
});

test("rejeita fontes com contextos fiscais incompatíveis", () => {
  const base = fonte("00000000-0000-4000-8000-000000000061", "1000.00");
  const id = "00000000-0000-4000-8000-000000000062";
  assert.throws(
    () =>
      processarPessoaConsolidada(
        [base, fonte(id, "1000.00", { dependentesIrrf: 1 })],
        REGRA_FISCAL_2026,
      ),
    /dependentes/,
  );
  assert.throws(
    () =>
      processarPessoaConsolidada(
        [base, fonte(id, "1000.00", { categoriaContribuinte: "741" })],
        REGRA_FISCAL_2026,
      ),
    /categorias previdenciárias/,
  );
  assert.throws(
    () =>
      processarPessoaConsolidada(
        [
          base,
          fonte(id, "1000.00", {
            enquadramentoPrevidenciario: {
              ...ENQUADRAMENTO_GERAL,
              id: "00000000-0000-4000-8000-000000000098",
            },
          }),
        ],
        REGRA_FISCAL_2026,
      ),
    /mesmo enquadramento/,
  );
  assert.throws(
    () =>
      processarPessoaConsolidada(
        [base, fonte(id, "1000.00", { baseOutrasFontes: "1.00" })],
        REGRA_FISCAL_2026,
      ),
    /outras fontes/,
  );
});

test("rejeita comprovantes divergentes mesmo quando a base é igual", () => {
  const comprovante = {
    fontePagadora: "Fonte A",
    documentoFonte: "12345678000199",
    baseContribuicao: "1000.00",
    valorContribuicao: "110.00",
    documentoReferencia: "A",
  };
  assert.throws(
    () =>
      processarPessoaConsolidada(
        [
          fonte("00000000-0000-4000-8000-000000000071", "1000.00", {
            baseOutrasFontes: "1000.00",
            outrasFontes: [comprovante],
          }),
          fonte("00000000-0000-4000-8000-000000000072", "1000.00", {
            baseOutrasFontes: "1000.00",
            outrasFontes: [
              { ...comprovante, documentoReferencia: "B" },
            ],
          }),
        ],
        REGRA_FISCAL_2026,
      ),
    /comprovantes/,
  );
});

test("rejeita conjunto vazio e vínculos duplicados", () => {
  assert.throws(
    () => processarPessoaConsolidada([], REGRA_FISCAL_2026),
    /ao menos uma fonte/,
  );
  const repetida = fonte(
    "00000000-0000-4000-8000-000000000081",
    "1000.00",
  );
  assert.throws(
    () =>
      processarPessoaConsolidada(
        [repetida, structuredClone(repetida)],
        REGRA_FISCAL_2026,
      ),
    /Vínculo único/,
  );
});
