import assert from "node:assert/strict";
import test from "node:test";
import type {
  GiwSnapshotFolhasHistoricas,
  GiwSnapshotGuiasInssHistoricas,
} from "../lib/migracao-historica";
import {
  reconciliarSnapshotsHistoricosGiw,
  type PessoaReferenciaGiw,
} from "../lib/reconciliacao-migracao-giw";

const pessoas: PessoaReferenciaGiw[] = [
  {
    legacyId: "PESSOA:10",
    nome: "Maria da Silva",
    cpf: "12345678901",
    cnpj: null,
    inscricaoInss: "11122233344",
  },
  {
    legacyId: "PESSOA:20",
    nome: "Clínica Exemplo Ltda.",
    cpf: null,
    cnpj: "12345678000190",
    inscricaoInss: "99988877766",
  },
];

function folha(
  pessoaLegacyId: string,
  nome: string,
  cpf: string | null,
  cnpj: string | null,
): GiwSnapshotFolhasHistoricas {
  return {
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569390",
      extractedAt: "2026-07-29T12:00:00.000Z",
      captureMethod: "PDF_FORNECIDO",
    },
    entity: "folhas_historicas",
    records: [
      {
        legacyId: "FOLHA:2026-05:1",
        competencia: "2026-05-01",
        numero: "1",
        termoLegacyId: null,
        metaLegacyId: null,
        status: "HISTORICA",
        dataPagamento: "2026-05-31",
        totalProventos: "1000.00",
        totalDescontos: "110.00",
        baseInss: "1000.00",
        valorInss: "110.00",
        baseIrrf: "1000.00",
        valorIrrf: "0.00",
        totalLiquido: "890.00",
        itens: [
          {
            legacyId: "ITEM:1",
            pessoaLegacyId,
            vinculoLegacyId: null,
            matricula: "1",
            nome,
            cpf,
            cnpj,
            totalProventos: "1000.00",
            totalDescontos: "110.00",
            baseInss: "1000.00",
            valorInss: "110.00",
            baseIrrf: "1000.00",
            valorIrrf: "0.00",
            totalLiquido: "890.00",
            rubricas: [],
          },
        ],
      },
    ],
  };
}

function guia(
  identificador: string | null,
  beneficiarioNome: string | null,
): GiwSnapshotGuiasInssHistoricas {
  return {
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569421",
      extractedAt: "2026-07-29T12:00:00.000Z",
      captureMethod: "PDF_FORNECIDO",
    },
    entity: "guias_inss_historicas",
    records: [
      {
        legacyId: "GPS:2026-05:1",
        competencia: "2026-05-01",
        tipo: "GPS",
        status: "HISTORICA",
        identificador,
        pessoaLegacyId: null,
        beneficiarioNome,
        lote: "1",
        codigoReceita: "1007",
        vencimento: "2026-06-20",
        pagamento: null,
        principal: "110.00",
        juros: "0.00",
        multa: "0.00",
        compensacoes: "0.00",
        total: "110.00",
        folhaLegacyIds: [],
      },
    ],
  };
}

test("reconcilia pessoa física por CPF e GPS por NIT com a mesma Folha", () => {
  const resultado = reconciliarSnapshotsHistoricosGiw(
    pessoas,
    [folha("CPF:12345678901", "Nome antigo", "123.456.789-01", null)],
    [guia("111.222.333-44", "Nome divergente")],
  );

  assert.equal(resultado.report.status, "PRONTA");
  assert.equal(resultado.report.summary.pessoasFolhaVinculadas, 1);
  assert.equal(resultado.report.summary.beneficiariosGpsVinculados, 1);
  assert.equal(resultado.report.summary.guiasVinculadasAFolha, 1);
  assert.deepEqual(resultado.report.summary.metodos, {
    CPF: 1,
    CNPJ: 0,
    NIT: 1,
    NOME: 0,
  });
  assert.equal(
    resultado.folhas[0].records[0].itens[0].pessoaLegacyId,
    "PESSOA:10",
  );
  assert.equal(resultado.guias[0].records[0].pessoaLegacyId, "PESSOA:10");
  assert.deepEqual(resultado.guias[0].records[0].folhaLegacyIds, [
    "FOLHA:2026-05:1",
  ]);
});

test("reconcilia pessoa jurídica pelo CNPJ e beneficiário GPS pelo nome", () => {
  const resultado = reconciliarSnapshotsHistoricosGiw(
    pessoas,
    [
      folha(
        "CNPJ:12345678000190",
        "Clínica Exemplo",
        null,
        "12.345.678/0001-90",
      ),
    ],
    [guia(null, "CLINICA EXEMPLO LTDA")],
  );

  assert.equal(resultado.report.status, "PRONTA");
  assert.equal(
    resultado.folhas[0].records[0].itens[0].pessoaLegacyId,
    "PESSOA:20",
  );
  assert.equal(resultado.guias[0].records[0].pessoaLegacyId, "PESSOA:20");
  assert.deepEqual(resultado.report.summary.metodos, {
    CPF: 0,
    CNPJ: 1,
    NIT: 0,
    NOME: 1,
  });
});

test("bloqueia nome ambíguo e conta referências pendentes sem duplicá-las", () => {
  const duplicadas: PessoaReferenciaGiw[] = [
    ...pessoas,
    {
      legacyId: "PESSOA:30",
      nome: "Maria da Silva",
      cpf: null,
      cnpj: null,
      inscricaoInss: null,
    },
  ];
  const primeira = folha("NOME:MARIA", "Maria da Silva", null, null);
  const segunda = structuredClone(primeira);
  segunda.records[0].legacyId = "FOLHA:2026-05:2";
  segunda.records[0].itens[0].legacyId = "ITEM:2";

  const resultado = reconciliarSnapshotsHistoricosGiw(
    duplicadas,
    [primeira, segunda],
    [guia(null, "Maria da Silva")],
  );

  assert.equal(resultado.report.status, "PENDENTE");
  assert.equal(resultado.report.summary.pessoasFolha, 1);
  assert.equal(resultado.report.summary.pessoasFolhaPendentes, 1);
  assert.equal(resultado.report.summary.beneficiariosGps, 1);
  assert.equal(resultado.report.summary.beneficiariosGpsPendentes, 1);
  assert.equal(resultado.report.issues.length, 3);
  assert.ok(resultado.report.issues.every((issue) => issue.reason === "AMBIGUA"));
});
