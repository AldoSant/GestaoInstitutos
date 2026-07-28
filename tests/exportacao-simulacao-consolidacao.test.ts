import assert from "node:assert/strict";
import test from "node:test";
import type { SimulacaoConsolidacaoFiscal } from "../db/simulacoes-consolidacao";
import { gerarCsvSimulacoesConsolidacao } from "../lib/exportacao-simulacao-consolidacao";

const simulacao: SimulacaoConsolidacaoFiscal = {
  id: "00000000-0000-4000-8000-000000000001",
  caso_id: "00000000-0000-4000-8000-000000000002",
  pessoa_id: "00000000-0000-4000-8000-000000000003",
  nome: "=Pessoa de teste",
  documento: "12345678901",
  competencia: "2026-07-01",
  versao: 1,
  status: "SIMULADA",
  hipotese_rateio: "PROPORCIONAL_MAIOR_RESTO",
  hash_fontes: "a".repeat(64),
  hash_regra: "b".repeat(64),
  hash_enquadramento: "c".repeat(64),
  hash_resultado: "d".repeat(64),
  total_proventos: "1000.00",
  total_descontos: "110.00",
  total_liquido: "890.00",
  base_inss_bruta: "1000.00",
  base_inss: "1000.00",
  valor_inss: "110.00",
  rendimentos_irrf: "1000.00",
  base_irrf: "0.00",
  irrf_bruto: "0.00",
  irrf_reducao: "0.00",
  valor_irrf: "0.00",
  memoria: {},
  responsavel: null,
  justificativa: "",
  decidido_em: null,
  criado_por: "Operador",
  criado_em: new Date("2026-07-28T12:00:00Z"),
  atualizado_em: new Date("2026-07-28T12:00:00Z"),
  fontes: [
    {
      id: "00000000-0000-4000-8000-000000000004",
      vinculoId: "00000000-0000-4000-8000-000000000005",
      medicaoId: null,
      folhaId: null,
      ordem: 1,
      hashEntrada: "e".repeat(64),
      totalProventos: "1000.00",
      descontosEventos: "0.00",
      totalDescontos: "110.00",
      totalLiquido: "890.00",
      baseInssBruta: "1000.00",
      baseInssRateada: "1000.00",
      valorInssRateado: "110.00",
      baseIrrfBruta: "1000.00",
      baseIrrfRateada: "0.00",
      irrfBrutoRateado: "0.00",
      irrfReducaoRateada: "0.00",
      valorIrrfRateado: "0.00",
      snapshot: {
        origem: {
          termoNumero: "1/2026",
          metaCodigo: "M1",
          atividade: "Atendimento",
        },
      },
    },
  ],
};

test("exporta memória rateada com hashes e proteção contra fórmula", () => {
  const csv = gerarCsvSimulacoesConsolidacao([simulacao]);
  assert.ok(csv.startsWith("\uFEFFcompetencia;"));
  assert.match(csv, /hash_resultado/);
  assert.match(csv, /SIMULADA/);
  assert.match(csv, /00000000-0000-4000-8000-000000000001/);
  assert.match(csv, /"'=Pessoa de teste"/);
  assert.match(csv, /1000,00/);
  assert.match(csv, /1\/2026/);
  assert.ok(csv.endsWith("\r\n"));
});

test("exportação vazia preserva cabeçalho sem linha fantasma", () => {
  const csv = gerarCsvSimulacoesConsolidacao([]);
  assert.ok(csv.startsWith("\uFEFFcompetencia;"));
  assert.ok(csv.endsWith("\r\n"));
  assert.equal(csv.split("\r\n").length, 2);
});
