import assert from "node:assert/strict";
import test from "node:test";
import { gerarCsvConferenciaFolha } from "../lib/exportacao-folha";

const folha = {
  competencia: "2026-07-01",
  numero: 2,
  revisao: 3,
  status: "ABERTA",
  hash_resultado: "hash-folha-123",
  termo_numero: "TERMO-01",
  meta_codigo: "META-A",
  regra_codigo: "BR-2026",
  regra_versao: 1,
  regra_hash: "hash-regra-456",
};

const item = {
  total_proventos: "6600.00",
  total_descontos: "1380.62",
  base_inss: "6600.00",
  valor_inss: "726.00",
  base_irrf: "5684.41",
  valor_irrf: "554.62",
  total_liquido: "5219.38",
  snapshots: {
    pessoa: {
      nome: '=HIPERLINK("https://invalido")',
      cpf: "11144477735",
    },
    prestador: { matricula: "0007", categoriaContribuinte: "701" },
    vinculo: { atividade: 'Instrutor; "Nível II"' },
    medicaoMensal: {
      id: "medicao-1",
      tipo: "PERCENTUAL",
      evidenciaReferencia: "Relatório mensal",
    },
  },
  memoria: { outrasFontes: { baseContribuidaCentavos: 400_000 } },
  eventos: [
    {
      codigo: "RETRIBUICAO",
      natureza: "PROVENTO",
      valor: "6000.00",
    },
  ],
};

test("gera CSV de conferência compatível com Excel em pt-BR", () => {
  const csv = gerarCsvConferenciaFolha({ folha, itens: [item] });
  const linhas = csv.slice(1).trimEnd().split("\r\n");

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(linhas.length, 2);
  assert.match(linhas[0], /^competencia;lote;revisao;status;/);
  assert.match(linhas[1], /6600,00;4000,00;6600,00;726,00;/);
  assert.match(linhas[1], /"Instrutor; ""Nível II"""/);
  assert.match(linhas[1], /"'=HIPERLINK\(""https:\/\/invalido""\)"/);
  assert.match(linhas[1], /"hash-regra-456";"hash-folha-123"$/);
});

test("recusa exportar uma Folha sem memória processada", () => {
  assert.throws(
    () =>
      gerarCsvConferenciaFolha({
        folha: { ...folha, hash_resultado: "" },
        itens: [item],
      }),
    /ainda não possui memória processada/,
  );
});

test("recusa exportar uma Folha sem itens", () => {
  assert.throws(
    () => gerarCsvConferenciaFolha({ folha, itens: [] }),
    /não possui itens para conferência/,
  );
});
