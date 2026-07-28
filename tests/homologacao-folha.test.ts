import assert from "node:assert/strict";
import test from "node:test";
import {
  compararFolhaComLegado,
  lerCsvFolhaLegado,
} from "../lib/homologacao-folha";

test("lê CSV brasileiro com BOM, moeda e campo entre aspas", () => {
  const linhas = lerCsvFolhaLegado(
    '\uFEFFmatricula;nome;proventos;inss;irrf;descontos;liquido\r\n' +
      'M-01;"Silva; Maria";R$ 4.080,00;448,80;120,10;568,90;3.511,10\r\n',
  );
  assert.deepEqual(linhas[0], {
    matricula: "M-01",
    nome: "Silva; Maria",
    proventosCentavos: 408_000,
    inssCentavos: 44_880,
    irrfCentavos: 12_010,
    descontosCentavos: 56_890,
    liquidoCentavos: 351_110,
  });
});

test("compara por matrícula e classifica diferenças e ausências", () => {
  const legado = lerCsvFolhaLegado(
    "matricula;nome;proventos;inss;irrf;descontos;liquido\n" +
      "M-01;Maria;1000,00;110,00;0,00;110,00;890,00\n" +
      "M-02;João;500,00;55,00;0,00;55,00;445,00\n",
  );
  const resultado = compararFolhaComLegado(legado, [
    {
      id: "item-1",
      total_proventos: "1000.00",
      valor_inss: "110.00",
      valor_irrf: "0.00",
      total_descontos: "110.00",
      total_liquido: "890.00",
      snapshots: {
        prestador: { matricula: "M-01" },
        pessoa: { nome: "Maria" },
      },
    },
    {
      id: "item-3",
      total_proventos: "700.00",
      valor_inss: "77.00",
      valor_irrf: "0.00",
      total_descontos: "77.00",
      total_liquido: "623.00",
      snapshots: {
        prestador: { matricula: "M-03" },
        pessoa: { nome: "Ana" },
      },
    },
  ]);

  assert.deepEqual(
    resultado.itens.map((item) => [item.matricula, item.situacao]),
    [
      ["M-01", "CONCILIADO"],
      ["M-02", "AUSENTE_NOVO"],
      ["M-03", "AUSENTE_LEGADO"],
    ],
  );
  assert.equal(resultado.conciliados, 1);
  assert.equal(resultado.divergentes, 2);
  assert.equal(resultado.diferencas.liquido, 17_800);
});

test("rejeita coluna ausente e matrícula duplicada", () => {
  assert.throws(
    () => lerCsvFolhaLegado("matricula;nome\n1;Teste\n"),
    /Coluna obrigatória ausente/,
  );
  assert.throws(
    () =>
      lerCsvFolhaLegado(
        "matricula;proventos;inss;irrf;descontos;liquido\n" +
          "1;0;0;0;0;0\n1;0;0;0;0;0\n",
      ),
    /Matrícula duplicada/,
  );
});
