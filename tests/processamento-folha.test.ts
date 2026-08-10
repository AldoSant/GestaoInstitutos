import assert from "node:assert/strict";
import test from "node:test";
import { processarVinculoFolha } from "../lib/processamento-folha";
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

test("processa retribuição, eventos, INSS e IRRF com memória em centavos", () => {
  const resultado = processarVinculoFolha(
    {
      vinculoId: "00000000-0000-4000-8000-000000000001",
      tipoPessoa: "FISICA",
      categoriaContribuinte: "701",
      valorRetribuicao: "6000.00",
      descontaInss: true,
      descontaIrrf: true,
      isentoInss: false,
      baseOutrasFontes: "0",
      outrasFontes: [],
      enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
      dependentesIrrf: 1,
      eventos: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          codigo: "BONUS",
          descricao: "Bônus de desempenho",
          natureza: "PROVENTO",
          tipoCalculo: "PERCENTUAL",
          valor: "10.0000",
          incideInss: true,
          incideIrrf: true,
        },
        {
          id: "00000000-0000-4000-8000-000000000003",
          codigo: "AJUSTE",
          descricao: "Desconto autorizado",
          natureza: "DESCONTO",
          tipoCalculo: "VALOR",
          valor: "100.00",
          incideInss: false,
          incideIrrf: false,
        },
      ],
    },
    REGRA_FISCAL_2026,
  );

  assert.equal(resultado.totalProventosCentavos, 660_000);
  assert.equal(resultado.baseInssCentavos, 660_000);
  assert.equal(resultado.valorInssCentavos, 72_600);
  assert.equal(resultado.baseIrrfCentavos, 568_441);
  assert.equal(resultado.irrfBrutoCentavos, 65_448);
  assert.equal(resultado.irrfReducaoCentavos, 9_986);
  assert.equal(resultado.valorIrrfCentavos, 55_462);
  assert.equal(resultado.totalDescontosCentavos, 138_062);
  assert.equal(resultado.totalLiquidoCentavos, 521_938);
  assert.deepEqual(
    resultado.linhas.map((linha) => linha.codigo),
    ["RETRIBUICAO", "AJUSTE", "BONUS", "INSS", "IRRF"],
  );
});

test("processa PJ no relatório mensal sem retenção PF ou GPS", () => {
  const resultado = processarVinculoFolha(
    {
      vinculoId: "00000000-0000-4000-8000-000000000004",
      tipoPessoa: "JURIDICA",
      categoriaContribuinte: null,
      valorRetribuicao: "2500.00",
      descontaInss: true,
      descontaIrrf: true,
      isentoInss: false,
      baseOutrasFontes: "0",
      outrasFontes: [],
      enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
      dependentesIrrf: 0,
      eventos: [],
    },
    REGRA_FISCAL_2026,
  );
  assert.equal(resultado.totalProventosCentavos, 250_000);
  assert.equal(resultado.totalDescontosCentavos, 0);
  assert.equal(resultado.valorInssCentavos, 0);
  assert.equal(resultado.valorIrrfCentavos, 0);
  assert.deepEqual(
    resultado.linhas.map((linha) => linha.codigo),
    ["RETRIBUICAO"],
  );
  assert.equal(resultado.memoria.enquadramento.cenario, "PJ_PAGAMENTO_SEM_PREVIDENCIA");
});

test("mantém a base de IRRF da pessoa física quando a retenção está dispensada", () => {
  const resultado = processarVinculoFolha(
    {
      vinculoId: "00000000-0000-4000-8000-000000000104",
      tipoPessoa: "FISICA",
      categoriaContribuinte: "701",
      valorRetribuicao: "6000.00",
      descontaInss: true,
      descontaIrrf: false,
      isentoInss: false,
      baseOutrasFontes: "0",
      outrasFontes: [],
      enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
      dependentesIrrf: 0,
      eventos: [],
    },
    REGRA_FISCAL_2026,
  );

  const esperado = calcularIrrf2026({ rendimentos: 6000, inssDedutivel: 660 });
  assert.equal(resultado.baseIrrfCentavos, Math.round(esperado.base * 100));
  assert.equal(resultado.irrfBrutoCentavos, Math.round(esperado.impostoBruto * 100));
  assert.equal(resultado.valorIrrfCentavos, 0);
  assert.equal(resultado.memoria.irrf.isento, true);
  assert.equal(
    resultado.linhas.find((linha) => linha.codigo === "IRRF")?.baseCalculoCentavos,
    Math.round(esperado.base * 100),
  );
});

test("rejeita percentuais fora do contrato do Evento", () => {
  assert.throws(
    () =>
      processarVinculoFolha(
        {
          vinculoId: "00000000-0000-4000-8000-000000000005",
          tipoPessoa: "FISICA",
          categoriaContribuinte: "701",
          valorRetribuicao: "1000.00",
          descontaInss: true,
          descontaIrrf: true,
          isentoInss: false,
          baseOutrasFontes: "0",
          outrasFontes: [],
          enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
          dependentesIrrf: 0,
          eventos: [
            {
              id: "00000000-0000-4000-8000-000000000006",
              codigo: "INVALIDO",
              descricao: "Percentual inválido",
              natureza: "PROVENTO",
              tipoCalculo: "PERCENTUAL",
              valor: "100.0001",
              incideInss: true,
              incideIrrf: true,
            },
          ],
        },
        REGRA_FISCAL_2026,
      ),
    /entre 0% e 100%/,
  );
});

test("aplica categoria operacional sem exigir eSocial no cadastro", () => {
  const resultado = processarVinculoFolha(
        {
          vinculoId: "00000000-0000-4000-8000-000000000007",
          tipoPessoa: "FISICA",
          categoriaContribuinte: null,
          valorRetribuicao: "1000.00",
          descontaInss: true,
          descontaIrrf: true,
          isentoInss: false,
          baseOutrasFontes: "0",
          outrasFontes: [],
          enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
          dependentesIrrf: 0,
          eventos: [],
        },
        REGRA_FISCAL_2026,
      );
  assert.equal(resultado.memoria.enquadramento.categoriaAplicada, "701");
  assert.equal(resultado.valorInssCentavos, 11_000);
});

test("limita a retenção pela base comprovada em outras fontes", () => {
  const resultado = processarVinculoFolha(
    {
      vinculoId: "00000000-0000-4000-8000-000000000008",
      tipoPessoa: "FISICA",
      categoriaContribuinte: "701",
      valorRetribuicao: "6000.00",
      descontaInss: true,
      descontaIrrf: false,
      isentoInss: false,
      baseOutrasFontes: "4000.00",
      outrasFontes: [
        {
          fontePagadora: "Outra contratante",
          documentoFonte: "12345678000199",
          baseContribuicao: "4000.00",
          valorContribuicao: "440.00",
          documentoReferencia: "REC-2026-07",
        },
      ],
      enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
      dependentesIrrf: 0,
      eventos: [],
    },
    REGRA_FISCAL_2026,
  );

  assert.equal(resultado.baseInssCentavos, 447_555);
  assert.equal(resultado.valorInssCentavos, 49_231);
  assert.deepEqual(resultado.memoria.outrasFontes, {
    baseContribuidaCentavos: 400_000,
    rendimentosTributaveisCentavos: 0,
    inssDedutivelIrrfCentavos: 0,
    irrfRetidoCentavos: 0,
    comprovantes: [
      {
        fontePagadora: "Outra contratante",
        documentoFonte: "12345678000199",
        baseContribuicao: "4000.00",
        valorContribuicao: "440.00",
        documentoReferencia: "REC-2026-07",
      },
    ],
  });
});

test("considera rendimentos e IRRF já retido em comprovante de outra fonte", () => {
  const resultado = processarVinculoFolha(
    {
      vinculoId: "00000000-0000-4000-8000-000000000208",
      tipoPessoa: "FISICA",
      categoriaContribuinte: "701",
      valorRetribuicao: "3000.00",
      descontaInss: false,
      descontaIrrf: true,
      isentoInss: false,
      baseOutrasFontes: "0",
      outrasFontes: [{
        fontePagadora: "Outra contratante",
        documentoFonte: "12345678000199",
        remuneracao: "3000.00",
        baseContribuicao: "0.00",
        valorContribuicao: "0.00",
        inssDedutivelIrrf: "0.00",
        irrfRetido: "100.00",
        documentoReferencia: "INF-2026-08",
      }],
      enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
      dependentesIrrf: 0,
      eventos: [],
    },
    REGRA_FISCAL_2026,
  );
  const total = calcularIrrf2026({ rendimentos: 6000, inssDedutivel: 0 });

  assert.equal(resultado.baseIrrfCentavos, Math.round(total.base * 100));
  assert.equal(resultado.valorIrrfCentavos, Math.max(0, Math.round(total.valor * 100) - 10_000));
  assert.equal(resultado.memoria.outrasFontes.rendimentosTributaveisCentavos, 300_000);
  assert.equal(resultado.memoria.outrasFontes.irrfRetidoCentavos, 10_000);
});

test("não retém INSS quando outra fonte comprovada já alcançou o teto", () => {
  const resultado = processarVinculoFolha(
    {
      vinculoId: "00000000-0000-4000-8000-000000000108",
      tipoPessoa: "FISICA",
      categoriaContribuinte: null,
      valorRetribuicao: "12000.00",
      descontaInss: true,
      descontaIrrf: false,
      isentoInss: false,
      baseOutrasFontes: "8475.55",
      outrasFontes: [
        {
          fontePagadora: "Empregador principal",
          documentoFonte: "12345678000199",
          baseContribuicao: "8475.55",
          valorContribuicao: "988.09",
          documentoReferencia: "HOL-2026-08",
        },
      ],
      enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
      dependentesIrrf: 0,
      eventos: [],
    },
    REGRA_FISCAL_2026,
  );

  assert.equal(resultado.baseInssCentavos, 0);
  assert.equal(resultado.valorInssCentavos, 0);
  assert.equal(resultado.memoria.inss.tetoAtingido, true);
});

test("aplica 20% ao segurado quando a beneficente está imune da patronal", () => {
  const resultado = processarVinculoFolha(
    {
      vinculoId: "00000000-0000-4000-8000-000000000009",
      tipoPessoa: "FISICA",
      categoriaContribuinte: "701",
      valorRetribuicao: "3000.00",
      descontaInss: true,
      descontaIrrf: false,
      isentoInss: false,
      baseOutrasFontes: "0",
      outrasFontes: [],
      enquadramentoPrevidenciario: {
        ...ENQUADRAMENTO_GERAL,
        regime: "BENEFICENTE_IMUNE",
        aliquotaSeguradoNumerador: 20,
        aliquotaPatronalNumerador: 0,
      },
      dependentesIrrf: 0,
      eventos: [],
    },
    REGRA_FISCAL_2026,
  );

  assert.equal(resultado.baseInssCentavos, 300_000);
  assert.equal(resultado.valorInssCentavos, 60_000);
  assert.equal(resultado.memoria.inss.aliquotaNumerador, 20);
  assert.equal(resultado.memoria.previdencia.aliquotaPatronalNumerador, 0);
});

test("usa a medição mensal conferida como retribuição da competência", () => {
  const resultado = processarVinculoFolha(
    {
      vinculoId: "00000000-0000-4000-8000-000000000010",
      tipoPessoa: "FISICA",
      categoriaContribuinte: "701",
      valorRetribuicao: "2000.00",
      medicao: {
        id: "00000000-0000-4000-8000-000000000011",
        tipo: "PERCENTUAL",
        valorContratual: "4000.00",
        percentual: "50.0000",
        quantidade: null,
        valorUnitario: null,
        valorApurado: "2000.00",
        evidenciaReferencia: "Relatório mensal 07/2026",
        evidenciaHash: "a".repeat(64),
        conferente: "Gerente de RH",
        conferidaEm: "2026-07-27T12:00:00.000Z",
      },
      descontaInss: true,
      descontaIrrf: false,
      isentoInss: false,
      baseOutrasFontes: "0",
      outrasFontes: [],
      enquadramentoPrevidenciario: ENQUADRAMENTO_GERAL,
      dependentesIrrf: 0,
      eventos: [],
    },
    REGRA_FISCAL_2026,
  );

  assert.equal(resultado.totalProventosCentavos, 200_000);
  assert.equal(resultado.valorInssCentavos, 22_000);
  assert.equal(resultado.linhas[0].descricao, "Retribuição apurada pela medição mensal");
  assert.equal(resultado.memoria.retribuicao.origem, "MEDICAO_MENSAL");
});
