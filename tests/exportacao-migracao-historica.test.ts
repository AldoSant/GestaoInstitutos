import assert from "node:assert/strict";
import test from "node:test";
import { gerarDossieMigracaoCsv } from "../lib/exportacao-migracao-historica";

test("exporta dossiê histórico e neutraliza fórmulas do legado", () => {
  const csv = gerarDossieMigracaoCsv("2026-06", "Instituto", {
    resumo: {
      folhas_legado: 1,
      pessoas_legado: 1,
      rubricas_legado: 1,
      guias_legado: 1,
      proventos_legado: "1000.00",
      descontos_legado: "110.00",
      liquido_legado: "890.00",
      base_inss_legado: "1000.00",
      inss_legado: "110.00",
      guias_total_legado: "110.00",
      pessoas_mapeadas: 1,
      vinculos_mapeados: 1,
      folhas_novas: 1,
      pessoas_novas: 1,
      proventos_novo: "1000.00",
      descontos_novo: "110.00",
      liquido_novo: "890.00",
      base_inss_novo: "1000.00",
      inss_novo: "110.00",
      obrigacoes_novas: 1,
      obrigacoes_total_novo: "110.00",
    },
    pessoas: [
      {
        pessoa_legacy_id: "P-1",
        nome_legado: "=HIPERLINK(\"https://exemplo.invalid\")",
        matricula_legado: "0001",
        pessoa_id: "00000000-0000-4000-8000-000000000001",
        proventos_legado: "1000.00",
        descontos_legado: "110.00",
        liquido_legado: "890.00",
        base_inss_legado: "1000.00",
        inss_legado: "110.00",
        proventos_novo: "1000.00",
        descontos_novo: "110.00",
        liquido_novo: "890.00",
        base_inss_novo: "1000.00",
        inss_novo: "110.00",
        diferenca_liquido: "0.00",
        diferenca_inss: "0.00",
      },
    ],
    folhas: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        legacy_id: "F-1",
        numero: "1",
        status: "FECHADA",
        data_pagamento: "2026-07-05",
        pessoas: 1,
        rubricas: 1,
        total_proventos: "1000.00",
        total_descontos: "110.00",
        base_inss: "1000.00",
        valor_inss: "110.00",
        total_liquido: "890.00",
        extraido_em: new Date("2026-07-01T12:00:00Z"),
      },
    ],
    guias: [
      {
        id: "00000000-0000-4000-8000-000000000003",
        legacy_id: "G-1",
        tipo: "GPS",
        status: "EMITIDA",
        identificador: "GUIA-1",
        codigo_receita: "2100",
        vencimento: "2026-07-20",
        pagamento: null,
        principal: "110.00",
        juros: "0.00",
        multa: "0.00",
        compensacoes: "0.00",
        total: "110.00",
        extraido_em: new Date("2026-07-01T12:00:00Z"),
      },
    ],
  });

  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /DOSSIÊ DE MIGRAÇÃO HISTÓRICA GIW/);
  assert.match(csv, /"'=HIPERLINK\(""https:\/\/exemplo\.invalid""\)"/);
  assert.match(csv, /"GUIAS GIW"/);
});
