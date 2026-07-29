import assert from "node:assert/strict";
import test from "node:test";
import {
  montarResumoRelatorioFolha,
  type ItemRelatorioFolha,
} from "../lib/relatorio-folha";

function item(
  parcial: Partial<ItemRelatorioFolha> = {},
): ItemRelatorioFolha {
  return {
    id: "item-1",
    nome: "Pessoa Teste",
    documento: "00000000000",
    matricula: "M-1",
    nitPisPasep: "00000000000",
    atividade: "Atividade sintética",
    totalProventos: "1000.00",
    totalDescontos: "110.00",
    baseInss: "1000.00",
    valorInss: "110.00",
    baseIrrf: "0.00",
    valorIrrf: "0.00",
    totalLiquido: "890.00",
    simulacaoId: null,
    hashSimulacao: null,
    linhas: [
      {
        codigo: "RETRIBUICAO",
        descricao: "Retribuição",
        natureza: "PROVENTO",
        origem: "CONTRATUAL",
        incideInss: true,
        incideIrrf: true,
        referencia: null,
        baseCalculo: "0.00",
        valor: "1000.00",
        ordem: 1,
      },
      {
        codigo: "INSS",
        descricao: "Retenção previdenciária",
        natureza: "DESCONTO",
        origem: "SISTEMA",
        incideInss: false,
        incideIrrf: false,
        referencia: "11",
        baseCalculo: "1000.00",
        valor: "110.00",
        ordem: 2,
      },
    ],
    ...parcial,
  };
}

test("resume e ordena uma Folha imprimível sem ponto flutuante", () => {
  const relatorio = montarResumoRelatorioFolha([
    item({ id: "b", nome: "Zilda", totalProventos: "0.10", totalDescontos: "0.03", totalLiquido: "0.07" }),
    item({ id: "a", nome: "Ana", totalProventos: "0.20", totalDescontos: "0.02", totalLiquido: "0.18" }),
  ]);
  assert.deepEqual(
    relatorio.itens.map((linha) => linha.nome),
    ["Ana", "Zilda"],
  );
  assert.equal(relatorio.totais.proventosCentavos, 30);
  assert.equal(relatorio.totais.descontosCentavos, 5);
  assert.equal(relatorio.totais.liquidoCentavos, 25);
});

test("consolida o resumo por rubrica e incidência como no relatório legado", () => {
  const relatorio = montarResumoRelatorioFolha([
    item({ id: "a" }),
    item({
      id: "b",
      nome: "Outra Pessoa",
      matricula: "M-2",
      totalProventos: "500.00",
      totalDescontos: "0.00",
      baseInss: "0.00",
      valorInss: "0.00",
      totalLiquido: "500.00",
      linhas: [
        {
          codigo: "RETRIBUICAO",
          descricao: "Retribuição",
          natureza: "PROVENTO",
          origem: "CONTRATUAL",
          incideInss: false,
          incideIrrf: true,
          referencia: null,
          baseCalculo: "0.00",
          valor: "500.00",
          ordem: 1,
        },
        {
          codigo: "INSS",
          descricao: "Retenção previdenciária",
          natureza: "DESCONTO",
          origem: "SISTEMA",
          incideInss: false,
          incideIrrf: false,
          referencia: "11",
          baseCalculo: "0.00",
          valor: "0.00",
          ordem: 2,
        },
      ],
    }),
  ]);

  assert.deepEqual(
    relatorio.rubricas.map((rubrica) => ({
      codigo: rubrica.codigo,
      incideInss: rubrica.incideInss,
      incideIrrf: rubrica.incideIrrf,
      quantidade: rubrica.quantidade,
      valorCentavos: rubrica.valorCentavos,
    })),
    [
      {
        codigo: "RETRIBUICAO",
        incideInss: true,
        incideIrrf: true,
        quantidade: 1,
        valorCentavos: 100000,
      },
      {
        codigo: "RETRIBUICAO",
        incideInss: false,
        incideIrrf: true,
        quantidade: 1,
        valorCentavos: 50000,
      },
      {
        codigo: "INSS",
        incideInss: false,
        incideIrrf: false,
        quantidade: 1,
        valorCentavos: 11000,
      },
    ],
  );
});

test("preserva uma única referência por simulação consolidada", () => {
  const hash = "a".repeat(64);
  const relatorio = montarResumoRelatorioFolha([
    item({ id: "a", simulacaoId: "sim-1", hashSimulacao: hash }),
    item({ id: "b", nome: "Outra Pessoa", matricula: "M-2", simulacaoId: "sim-1", hashSimulacao: hash }),
  ]);
  assert.deepEqual(relatorio.simulacoes, [
    { simulacaoId: "sim-1", hashResultado: hash },
  ]);
});

test("recusa fechamento monetário e evidência consolidada incompleta", () => {
  assert.throws(
    () => montarResumoRelatorioFolha([item({ totalLiquido: "891.00" })]),
    /fechamento/,
  );
  assert.throws(
    () =>
      montarResumoRelatorioFolha([
        item({ simulacaoId: "sim-1", hashSimulacao: null }),
      ]),
    /referência incompleta/,
  );
});
