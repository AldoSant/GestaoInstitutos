import assert from "node:assert/strict";
import test from "node:test";
import {
  converterCsvFolhasHistoricas,
  converterCsvGuiasHistoricas,
  converterEventosDoCsvFolhas,
  converterPessoasDoCsvFolhas,
  MODELO_CSV_FOLHAS_HISTORICAS,
  MODELO_CSV_GUIAS_HISTORICAS,
} from "../lib/conversao-historico-csv";

const opcoes = {
  nomeArquivo: "arquivo-ficticio.csv",
  extraidoEm: "2026-07-28T15:00:00.000Z",
};

test("converte modelo CSV de Folha em snapshot histórico rastreável", () => {
  const result = converterCsvFolhasHistoricas(MODELO_CSV_FOLHAS_HISTORICAS, opcoes);
  assert.deepEqual(result.issues, []);
  assert.match(result.arquivoSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.snapshot?.source.captureMethod, "CSV_FORNECIDO");
  assert.equal(result.snapshot?.source.sourceFileName, "arquivo-ficticio.csv");
  assert.equal(result.snapshot?.source.sourceFileSha256, result.arquivoSha256);
  assert.equal(result.snapshot?.records[0].competencia, "2026-06-01");
  assert.equal(result.snapshot?.records[0].itens[0].cpf, null);
  assert.equal(result.snapshot?.records[0].itens[0].rubricas[0].valor, "1000.00");
});

test("agrupa várias rubricas sem duplicar o total do item", () => {
  const linhas = MODELO_CSV_FOLHAS_HISTORICAS.trimEnd().split(/\r?\n/);
  const segunda = linhas[1]
    .replace("RUBRICA-1", "RUBRICA-2")
    .replace("EVENTO-1", "EVENTO-2")
    .replace(";001;", ";002;")
    .replace('"Retribuição fictícia";PROVENTO', '"INSS fictício";DESCONTO')
    .replace(";100;1000,00;1000,00;SIM;SIM", ";11;1000,00;110,00;NAO;NAO");
  const csv = `${linhas.join("\r\n")}\r\n${segunda}\r\n`;
  const result = converterCsvFolhasHistoricas(csv, opcoes);
  assert.deepEqual(result.issues, []);
  assert.equal(result.snapshot?.records[0].itens.length, 1);
  assert.equal(result.snapshot?.records[0].itens[0].rubricas.length, 2);
  assert.equal(result.snapshot?.records[0].totalProventos, "1000.00");
});

test("rejeita totais divergentes entre linhas do mesmo item", () => {
  const linhas = MODELO_CSV_FOLHAS_HISTORICAS.trimEnd().split(/\r?\n/);
  const segunda = linhas[1]
    .replace("RUBRICA-1", "RUBRICA-2")
    .replace(";1000,00;110,00;1000,00;", ";999,00;110,00;1000,00;");
  const result = converterCsvFolhasHistoricas(
    `${linhas.join("\r\n")}\r\n${segunda}\r\n`,
    opcoes,
  );
  assert.equal(result.snapshot, null);
  assert.ok(
    result.issues.some(
      (issue) =>
        issue.linha === 3 &&
        issue.campo === "totalProventos" &&
        issue.mensagem.includes("diverge"),
    ),
  );
});

test("gera chave estável da pessoa a partir de CPF quando o código não é fornecido", () => {
  const csv = MODELO_CSV_FOLHAS_HISTORICAS
    .replace(";PESSOA-1;VINCULO-1;0001;", ";;VINCULO-1;0001;")
    .replace(';"Prestador fictício";;', ';"Prestador fictício";123.456.789-01;');
  const result = converterCsvFolhasHistoricas(csv, opcoes);
  assert.deepEqual(result.issues, []);
  assert.equal(
    result.snapshot?.records[0].itens[0].pessoaLegacyId,
    "CPF:12345678901",
  );
});

test("deriva cadastro operacional de Pessoas sem marcar a ficha como completa", () => {
  const linhas = MODELO_CSV_FOLHAS_HISTORICAS.trimEnd().split(/\r?\n/);
  const segundaRubrica = linhas[1]
    .replace("RUBRICA-1", "RUBRICA-2")
    .replace("EVENTO-1", "EVENTO-2")
    .replace(";001;", ";002;");
  const result = converterPessoasDoCsvFolhas(
    `${linhas.join("\r\n")}\r\n${segundaRubrica}\r\n`,
    opcoes,
  );
  assert.deepEqual(result.issues, []);
  assert.equal(result.snapshot?.records.length, 1);
  assert.equal(result.snapshot?.records[0].legacyId, "PESSOA-1");
  assert.equal(result.snapshot?.records[0].papelPrestador, true);
  assert.equal(result.snapshot?.records[0].dadosCompletos, false);
  assert.equal(result.snapshot?.source.captureMethod, "CSV_FORNECIDO");
});

test("rejeita dados pessoais divergentes entre Folhas", () => {
  const linhas = MODELO_CSV_FOLHAS_HISTORICAS.trimEnd().split(/\r?\n/);
  const outraFolha = linhas[1]
    .replaceAll("FOLHA-EXEMPLO-1", "FOLHA-EXEMPLO-2")
    .replace("ITEM-1", "ITEM-2")
    .replace("RUBRICA-1", "RUBRICA-2")
    .replace('"Prestador fictício"', '"Outro nome"');
  const result = converterPessoasDoCsvFolhas(
    `${linhas.join("\r\n")}\r\n${outraFolha}\r\n`,
    opcoes,
  );
  assert.equal(result.snapshot, null);
  assert.ok(
    result.issues.some(
      (issue) => issue.campo === "pessoa" && issue.mensagem.includes("divergentes"),
    ),
  );
});

test("deriva Eventos deduplicados com incidências explícitas", () => {
  const linhas = MODELO_CSV_FOLHAS_HISTORICAS.trimEnd().split(/\r?\n/);
  const outraFolha = linhas[1]
    .replaceAll("FOLHA-EXEMPLO-1", "FOLHA-EXEMPLO-2")
    .replace("ITEM-1", "ITEM-2")
    .replace("RUBRICA-1", "RUBRICA-2");
  const result = converterEventosDoCsvFolhas(
    `${linhas.join("\r\n")}\r\n${outraFolha}\r\n`,
    opcoes,
  );
  assert.deepEqual(result.issues, []);
  assert.equal(result.snapshot?.records.length, 1);
  assert.deepEqual(result.snapshot?.records[0], {
    legacyId: "EVENTO-1",
    codigo: "001",
    descricao: "Retribuição fictícia",
    natureza: "PROVENTO",
    tipoCalculo: "VALOR",
    incideInss: true,
    incideIrrf: true,
    ativo: true,
  });
});

test("não presume incidências ausentes ao derivar Eventos", () => {
  const result = converterEventosDoCsvFolhas(
    MODELO_CSV_FOLHAS_HISTORICAS.replace(";SIM;SIM\r\n", ";;\r\n"),
    opcoes,
  );
  assert.equal(result.snapshot, null);
  assert.ok(
    result.issues.some(
      (issue) => issue.campo === "incidencias" && issue.mensagem.includes("precisa"),
    ),
  );
});

test("converte modelo CSV de guia e mantém vínculo com a Folha", () => {
  const result = converterCsvGuiasHistoricas(MODELO_CSV_GUIAS_HISTORICAS, opcoes);
  assert.deepEqual(result.issues, []);
  assert.equal(result.snapshot?.records[0].tipo, "GPS");
  assert.equal(result.snapshot?.records[0].total, "110.00");
  assert.deepEqual(result.snapshot?.records[0].folhaLegacyIds, ["FOLHA-EXEMPLO-1"]);
});

test("rejeita guia cujo total não fecha", () => {
  const result = converterCsvGuiasHistoricas(
    MODELO_CSV_GUIAS_HISTORICAS.replace(";110,00;FOLHA-", ";109,99;FOLHA-"),
    opcoes,
  );
  assert.equal(result.snapshot, null);
  assert.ok(
    result.issues.some(
      (issue) => issue.campo === "total" && issue.mensagem.includes("não fecha"),
    ),
  );
});
