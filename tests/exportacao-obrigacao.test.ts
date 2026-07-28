import assert from "node:assert/strict";
import test from "node:test";
import { gerarCsvEspelhoObrigacao } from "../lib/exportacao-obrigacao";

function dados() {
  return {
    obrigacao: {
      id: "00000000-0000-4000-8000-000000000001",
      competencia: "2026-07-01",
      tipo: "PREVIDENCIARIA_DCTFWEB",
      status: "BLOQUEADA",
      principal: "300.00",
      juros: "0.00",
      multa: "0.00",
      total: "300.00",
      valor_declarado: null,
      diferenca: null,
      criado_em: new Date("2026-08-01T00:00:00Z"),
    },
    itens: [
      {
        id: "item-1",
        natureza: "SEGURADO",
        origem: "FOLHA",
        descricao: "Retenção previdenciária",
        base_calculo: "1000.00",
        aliquota: "20.000000",
        valor: "200.00",
        snapshot: {
          pessoa: {
            nome: "=Prestadora de teste",
            cpf: "12345678900",
          },
          prestador: { matricula: "0007" },
        },
        folha_numero: 1,
        folha_revisao: 2,
        folha_hash: "a".repeat(64),
        termo_numero: "45/2026",
        meta_codigo: "META-01",
      },
    ],
    documentos: [],
  };
}

test("gera espelho previdenciário com fontes e valores exatos", () => {
  const csv = gerarCsvEspelhoObrigacao(dados());
  assert.match(csv, /^\uFEFFobrigacao_id;/);
  assert.match(csv, /0007/);
  assert.match(csv, /20,000000/);
  assert.match(csv, /1000,00/);
  assert.match(csv, new RegExp("a{64}"));
});

test("protege conteúdo cadastral contra fórmula de planilha", () => {
  const csv = gerarCsvEspelhoObrigacao(dados());
  assert.match(csv, /"'=Prestadora de teste"/);
});
