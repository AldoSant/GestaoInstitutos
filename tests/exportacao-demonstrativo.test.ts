import assert from "node:assert/strict";
import test from "node:test";
import { exportarDemonstrativoCsv } from "../lib/exportacao-demonstrativo";

test("exporta pagamentos e guias sem misturar as naturezas", () => {
  const csv = exportarDemonstrativoCsv({
    competencia: "2026-06-01",
    numero: 1,
    revisao: 2,
    status: "FECHADO",
    hash: "a".repeat(64),
    pagamentos: [
      {
        tipo_pessoa: "JURIDICA",
        origem: "NOTA_FISCAL_PJ",
        beneficiario: "Prestador PJ",
        matricula: "123",
        documento_referencia: "NF 9",
        valor_bruto: "1000.00",
        total_retencoes: "50.00",
        valor_liquido: "950.00",
        retencoes: [{ tributo: "ISS", valor: "50.00" }],
      },
    ],
    guias: [
      {
        tipo: "INSS",
        status: "EMITIDA",
        total: "120.00",
        documentos: 2,
        verificados: 2,
      },
    ],
  });
  assert.match(csv, /PAGAMENTO_PRESTADOR/);
  assert.match(csv, /GUIA_RECOLHIMENTO/);
  assert.match(csv, /ISS=50,00/);
  assert.match(csv, /2\/2 documento\(s\) verificado\(s\)/);
});

test("neutraliza conteúdo capaz de virar fórmula em planilha", () => {
  const csv = exportarDemonstrativoCsv({
    competencia: "2026-06-01",
    numero: 1,
    revisao: 1,
    status: "RASCUNHO",
    hash: null,
    pagamentos: [
      {
        tipo_pessoa: "JURIDICA",
        origem: "NOTA_FISCAL_PJ",
        beneficiario: "=CMD()",
        matricula: null,
        documento_referencia: "+EXPLOIT",
        valor_bruto: "1.00",
        total_retencoes: "0.00",
        valor_liquido: "1.00",
        retencoes: [],
      },
    ],
    guias: [],
  });
  assert.match(csv, /"'=CMD\(\)"/);
  assert.match(csv, /"'\+EXPLOIT"/);
});
