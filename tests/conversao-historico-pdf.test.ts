import assert from "node:assert/strict";
import test from "node:test";
import {
  criarManifestPreflightPdf,
  converterTextoPdfFolhaHistorica,
  converterTextoPdfGuiasHistoricas,
} from "../lib/conversao-historico-pdf";

const pdf = (valor: string) => new TextEncoder().encode(`%PDF-${valor}`);

const texto = `
IGP - INSTITUTO FICTÍCIO
FOLHA DE PAGAMENTO
PARCERIA: FUNDO FICTÍCIO
META: META TESTE
LOTE: 7                     COMPETÊNCIA: Maio / 2026                     TIPO: Normal
0001 - PRESTADOR FICTÍCIO                                      DATA ADMISSÃO: 01/01/2026
CÓDIGO            EVENTO                         REF           PROVENTO            RETENÇÃO         VALOR LÍQUIDO
001               RETRIBUIÇÃO                    30 dias       1.000,00
101               INSS                           11 %                              110,00
BASES DE CÁLCULOS                                             1.000,00             110,00           890,00
Retribuição          INSS           IRRF       Dependente IRRF         Sal. Família   Aux. Tributos
DATA DE CRÉDITO: 31/05/2026
1.000,00             1.000,00       1.000,00   0x                     0,00           0,00
RESUMO
`;

test("converte texto de Folha PDF no snapshot histórico existente", () => {
  const resultado = converterTextoPdfFolhaHistorica(texto, {
    nomeArquivo: "folha-ficticia.pdf",
    extraidoEm: "2026-07-29T00:00:00.000Z",
    arquivoSha256: "a".repeat(64),
  });
  assert.deepEqual(resultado.issues, []);
  assert.equal(resultado.snapshot?.source.captureMethod, "PDF_FORNECIDO");
  assert.equal(resultado.snapshot?.records[0].competencia, "2026-05-01");
  assert.equal(resultado.snapshot?.records[0].itens.length, 1);
  assert.equal(resultado.snapshot?.records[0].totalLiquido, "890.00");
  assert.equal(resultado.snapshot?.records[0].baseInss, "1000.00");
  assert.equal(resultado.snapshot?.records[0].baseIrrf, "1000.00");
  assert.equal(resultado.snapshot?.records[0].itens[0].rubricas.length, 2);
});

test("rejeita texto que não seja Folha de Pagamento", () => {
  const resultado = converterTextoPdfFolhaHistorica("documento qualquer", {
    nomeArquivo: "outro.pdf",
    arquivoSha256: "b".repeat(64),
  });
  assert.equal(resultado.snapshot, null);
  assert.equal(resultado.issues[0].campo, "documento");
});

test("aceita variante de prestador com data de pagamento no cabeçalho", () => {
  const resultado = converterTextoPdfFolhaHistorica(
    texto.replace("DATA ADMISSÃO: 01/01/2026", "DATA PAGAMENTO: 31/05/2026"),
    {
      nomeArquivo: "folha-ficticia.pdf",
      extraidoEm: "2026-07-29T00:00:00.000Z",
      arquivoSha256: "d".repeat(64),
    },
  );
  assert.deepEqual(resultado.issues, []);
  assert.equal(resultado.snapshot?.records[0].dataPagamento, "2026-05-31");
});

test("rejeita resumo do PDF divergente dos itens", () => {
  const resultado = converterTextoPdfFolhaHistorica(
    `${texto}Provento: 999,99\nRetenção: 110,00\nLíquido: 889,99\n`,
    {
      nomeArquivo: "folha-divergente.pdf",
      extraidoEm: "2026-07-29T00:00:00.000Z",
      arquivoSha256: "c".repeat(64),
    },
  );
  assert.equal(resultado.snapshot, null);
  assert.equal(resultado.issues[0].campo, "resumo.totalProventos");
});

const gps = `
GPS - GUIA DA PREVIDÊNCIA SOCIAL                  3 - CÓDIGO DE PAGAMENTO
                                                   2100
                                                   4 - COMPETÊNCIA
                                                   05/2026
                                                   5 - IDENTIFICADOR
                                                   12.345.678/0001-90
                                                   6 - VALOR DO INSS
                                                   110,00
                                                   10 - ATM/MULTA E JUROS
                                                   0,00
VENCIMENTO                                        11 - TOTAL
20/06/2026                                        110,00
`;

test("converte GPS, valida fechamento e mantém vínculo de Folha pendente", () => {
  const resultado = converterTextoPdfGuiasHistoricas(`${gps}\n${gps}`, {
    nomeArquivo: "gps-ficticia.pdf",
    extraidoEm: "2026-07-29T00:00:00.000Z",
    arquivoSha256: "e".repeat(64),
  });
  assert.deepEqual(resultado.issues, []);
  assert.equal(resultado.snapshot?.records.length, 1);
  assert.equal(resultado.snapshot?.records[0].tipo, "GPS");
  assert.equal(resultado.snapshot?.records[0].competencia, "2026-05-01");
  assert.equal(resultado.snapshot?.records[0].principal, "110.00");
  assert.deepEqual(resultado.snapshot?.records[0].folhaLegacyIds, []);
  assert.equal(resultado.snapshot?.source.captureMethod, "PDF_FORNECIDO");
});

test("rejeita GPS com acréscimos combinados que não podem ser separados", () => {
  const resultado = converterTextoPdfGuiasHistoricas(
    gps
      .replace("                                                   0,00", "                                                   1,00")
      .replace("20/06/2026                                        110,00", "20/06/2026                                        111,00"),
    {
      nomeArquivo: "gps-acrescimos.pdf",
      extraidoEm: "2026-07-29T00:00:00.000Z",
      arquivoSha256: "f".repeat(64),
    },
  );
  assert.equal(resultado.snapshot, null);
  assert.ok(resultado.issues.some((issue) => issue.campo === "acrescimos"));
});

test("gera manifest determinístico ordenado com tipo, competência e SHA-256", () => {
  const entradas = [
    { nomeArquivo: "z-guia.pdf", conteudo: pdf("guia"), texto: gps },
    { nomeArquivo: "a-folha.pdf", conteudo: pdf("folha"), texto },
  ];
  const primeiro = criarManifestPreflightPdf(entradas);
  const segundo = criarManifestPreflightPdf([...entradas].reverse());
  assert.deepEqual(primeiro, segundo);
  assert.deepEqual(
    primeiro.documents.map(({ filename, documentType, competence }) => ({
      filename, documentType, competence,
    })),
    [
      { filename: "a-folha.pdf", documentType: "FOLHA_PAGAMENTO", competence: "2026-05-01" },
      { filename: "z-guia.pdf", documentType: "GUIA_PREVIDENCIA_SOCIAL", competence: "2026-05-01" },
    ],
  );
  assert.match(primeiro.documents[0].sha256, /^[a-f0-9]{64}$/);
});

test("rejeita PDFs com hash duplicado", () => {
  assert.throws(
    () => criarManifestPreflightPdf([
      { nomeArquivo: "a.pdf", conteudo: pdf("igual"), texto },
      { nomeArquivo: "b.pdf", conteudo: pdf("igual"), texto: gps },
    ]),
    /duplicado pelo SHA-256/,
  );
});

test("preflight usa dry-run por padrão", () => {
  const manifest = criarManifestPreflightPdf([
    { nomeArquivo: "folha.pdf", conteudo: pdf("folha"), texto },
  ]);
  assert.equal(manifest.mode, "dry-run");
});

test("rejeita apply com remessa incompleta ou não confirmada", () => {
  const entradas = [{ nomeArquivo: "folha.pdf", conteudo: pdf("folha"), texto }];
  assert.throws(
    () => criarManifestPreflightPdf(entradas, {
      modo: "apply", expectedDocumentCount: 1, receivedDocumentCount: 1,
    }),
    /confirmedComplete=true/,
  );
  assert.throws(
    () => criarManifestPreflightPdf(entradas, {
      modo: "apply", confirmedComplete: true,
      expectedDocumentCount: 2, receivedDocumentCount: 1,
    }),
    /contagens esperada e recebida iguais/,
  );
});
