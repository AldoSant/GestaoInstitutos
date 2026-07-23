import assert from "node:assert/strict";
import test from "node:test";
import {
  checksum,
  dataIsoGiw,
  numeroDecimalBrasileiro,
  somenteDigitos,
  validarSnapshotAtividades,
  validarSnapshotGiw,
  validarSnapshotLotacoes,
  validarSnapshotPessoas,
  validarSnapshotTermos,
  validarSnapshotVinculos,
} from "../lib/importacao-giw";

function snapshot(records: unknown[]) {
  return {
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569402",
      extractedAt: "2026-07-22T12:00:00.000Z",
    },
    entity: "pessoas",
    records,
  };
}

test("normaliza documentos e classifica pessoa física", () => {
  const result = validarSnapshotPessoas(
    snapshot([{ legacyId: " 42 ", nome: " Maria   da Silva ", cpf: "123.456.789-01" }]),
  );

  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.snapshot?.records[0], {
    legacyId: "42",
    nome: "Maria da Silva",
    tipo: "FISICA",
    cpf: "12345678901",
    cnpj: null,
  });
});

test("classifica pessoa jurídica pelo CNPJ", () => {
  const result = validarSnapshotPessoas(
    snapshot([{ legacyId: "9", nome: "Clínica Exemplo", cnpj: "12.345.678/0001-90" }]),
  );

  assert.equal(result.issues.length, 0);
  assert.equal(result.snapshot?.records[0].tipo, "JURIDICA");
  assert.equal(result.snapshot?.records[0].cnpj, "12345678000190");
});

test("rejeita IDs repetidos e documentos inválidos", () => {
  const result = validarSnapshotPessoas(
    snapshot([
      { legacyId: "1", nome: "Primeira" },
      { legacyId: "1", nome: "Segunda" },
      { legacyId: "2", nome: "Terceira", cpf: "123" },
    ]),
  );

  assert.equal(result.snapshot, null);
  assert.ok(result.issues.some((issue) => issue.field === "cpf"));
  assert.ok(result.issues.some((issue) => issue.field === "legacyId"));
});

test("checksum é estável independentemente da ordem das chaves", () => {
  assert.equal(checksum({ b: 2, a: 1 }), checksum({ a: 1, b: 2 }));
  assert.notEqual(checksum({ a: 1 }), checksum({ a: 2 }));
});

test("somenteDigitos aceita valores vazios sem inventar documento", () => {
  assert.equal(somenteDigitos(""), null);
  assert.equal(somenteDigitos(null), null);
  assert.equal(somenteDigitos("12.3"), "123");
});

test("normaliza carga horária e valor monetário de Atividades", () => {
  const result = validarSnapshotAtividades({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569252",
      extractedAt: "2026-07-22T12:00:00.000Z",
    },
    entity: "atividades",
    records: [
      {
        legacyId: "174",
        descricao: " Enfermeira ",
        cargaHoraria: "200",
        valor: "2.922,48",
        ativo: true,
      },
    ],
  });

  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.snapshot?.records[0], {
    legacyId: "174",
    descricao: "Enfermeira",
    cargaHoraria: "200",
    valor: "2922.48",
    ativo: true,
  });
});

test("preserva lotação inativa e rejeita decimal inválido", () => {
  const lotacao = validarSnapshotLotacoes({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569449",
      extractedAt: "2026-07-22T12:00:00.000Z",
    },
    entity: "lotacoes",
    records: [{ legacyId: "10", descricao: "Hospital", ativo: false }],
  });
  assert.equal(lotacao.snapshot?.records[0].ativo, false);

  const atividade = validarSnapshotAtividades({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569252",
      extractedAt: "2026-07-22T12:00:00.000Z",
    },
    entity: "atividades",
    records: [{ legacyId: "1", descricao: "Teste", valor: "inválido" }],
  });
  assert.equal(atividade.snapshot, null);
  assert.ok(atividade.issues.some((issue) => issue.field === "valor"));
});

test("dispatcher reconhece as três entidades suportadas", () => {
  assert.equal(validarSnapshotGiw(snapshot([])).snapshot?.entity, "pessoas");
  assert.equal(
    validarSnapshotGiw({
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569449",
        extractedAt: "2026-07-22T12:00:00.000Z",
      },
      entity: "lotacoes",
      records: [],
    }).snapshot?.entity,
    "lotacoes",
  );
});

test("numeroDecimalBrasileiro não aceita texto ou infinito", () => {
  assert.equal(numeroDecimalBrasileiro("1.320,00"), "1320.00");
  assert.equal(numeroDecimalBrasileiro("abc"), null);
  assert.equal(numeroDecimalBrasileiro(Number.POSITIVE_INFINITY), null);
});

test("normaliza Termos e Metas extraídos do GIW", () => {
  const result = validarSnapshotTermos({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569250",
      extractedAt: "2026-07-23T12:00:00.000Z",
    },
    entity: "termos",
    records: [
      {
        legacyId: "54",
        numero: "22",
        descricao: " IX - ADITIVO ",
        modalidade: "1 - TERMO DE COLABORAÇÃO",
        inicio: "01/04/2026",
        fim: "31/08/2026",
        valorGlobal: "2.861.539,60",
        metas: [
          {
            legacyId: "254",
            descricao: " HOSPITAL ",
            tipoCalculo: "Mensal",
            valorPrevisto: "890.429,48",
          },
        ],
      },
    ],
  });

  assert.equal(result.issues.length, 0);
  assert.equal(result.snapshot?.records[0].inicio, "2026-04-01");
  assert.equal(result.snapshot?.records[0].valorGlobal, "2861539.60");
  assert.deepEqual(result.snapshot?.records[0].metas[0], {
    legacyId: "254",
    codigo: "254",
    descricao: "HOSPITAL",
    tipoCalculo: "Mensal",
    valorPrevisto: "890429.48",
    ativo: true,
  });
});

test("rejeita datas impossíveis e meta duplicada em Termos", () => {
  assert.equal(dataIsoGiw("30/02/2026"), null);
  const result = validarSnapshotTermos({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569250",
      extractedAt: "2026-07-23T12:00:00.000Z",
    },
    entity: "termos",
    records: [
      {
        legacyId: "1",
        numero: "1",
        descricao: "Teste",
        modalidade: "Colaboração",
        inicio: "2026-02-30",
        valorGlobal: "1",
        metas: [
          { legacyId: "9", descricao: "A" },
          { legacyId: "9", descricao: "B" },
        ],
      },
    ],
  });

  assert.equal(result.snapshot, null);
  assert.ok(result.issues.some((issue) => issue.field === "inicio"));
  assert.ok(result.issues.some((issue) => issue.field === "metas.legacyId"));
});

test("normaliza Vínculo do GIW com incidências e dependências legadas", () => {
  const result = validarSnapshotVinculos({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569258",
      extractedAt: "2026-07-23T12:00:00.000Z",
    },
    entity: "vinculos",
    records: [
      {
        legacyId: "5430",
        pessoaLegacyId: "1076",
        matricula: "1073",
        termoLegacyId: "54",
        metaLegacyId: "254",
        atividadeLegacyId: "75",
        lotacaoLegacyId: "10",
        numeroContrato: "222/2026",
        inicio: "01/04/2026",
        fim: "31/08/2026",
        valorRetribuicao: "4.080,00",
        cargaHoraria: "200",
        descontaInss: false,
        descontaIrrf: true,
        ativo: true,
      },
    ],
  });

  assert.equal(result.issues.length, 0);
  assert.equal(result.snapshot?.records[0].inicio, "2026-04-01");
  assert.equal(result.snapshot?.records[0].valorRetribuicao, "4080.00");
  assert.equal(result.snapshot?.records[0].descontaInss, false);
  assert.equal(result.snapshot?.records[0].descontaIrrf, true);
});

test("rejeita Vínculo sem dependência e com valor negativo", () => {
  const result = validarSnapshotVinculos({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569258",
      extractedAt: "2026-07-23T12:00:00.000Z",
    },
    entity: "vinculos",
    records: [
      {
        legacyId: "1",
        matricula: "1",
        termoLegacyId: "2",
        metaLegacyId: "3",
        atividadeLegacyId: "4",
        lotacaoLegacyId: "5",
        inicio: "2026-01-01",
        valorRetribuicao: "-1",
      },
    ],
  });

  assert.equal(result.snapshot, null);
  assert.ok(result.issues.some((issue) => issue.field === "pessoaLegacyId"));
  assert.ok(result.issues.some((issue) => issue.field === "valorRetribuicao"));
});
