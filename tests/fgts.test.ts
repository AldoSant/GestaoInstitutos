import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularFgtsTruncado,
  calcularItemFgts,
  consolidarFgtsPorTrabalhador,
  avaliarProntidaoFgts,
  resolverCategoriaFgts,
  vencimentoNominalFgtsMensal,
} from "../lib/fgts";

test("só libera o portal após folha, eSocial e totalizadores conciliados", () => {
  const pendente = avaliarProntidaoFgts({
    folhasFechadas: 1,
    trabalhadoresElegiveis: 2,
    categoriasNaoHomologadas: 0,
    rubricasComIncidenciaFgts: 0,
    eventosEsocialAceitos: 0,
    s5003Conciliado: false,
    s5013Conciliado: false,
    gfdRegistrada: false,
  });
  assert.equal(pendente.prontaParaEmitirNoPortal, false);
  assert.equal(pendente.etapas[0].concluida, false);

  const pronta = avaliarProntidaoFgts({
    folhasFechadas: 1,
    trabalhadoresElegiveis: 2,
    categoriasNaoHomologadas: 0,
    rubricasComIncidenciaFgts: 1,
    eventosEsocialAceitos: 2,
    s5003Conciliado: true,
    s5013Conciliado: true,
    gfdRegistrada: false,
  });
  assert.equal(pronta.prontaParaEmitirNoPortal, true);
  assert.equal(pronta.etapas[3].concluida, false);
});

test("classifica apenas categorias de FGTS homologadas no MVP", () => {
  assert.deepEqual(resolverCategoriaFgts("101"), {
    elegivel: true,
    categoria: "101",
    descricao: "Empregado em geral",
    aliquotaNumerador: 8,
    aliquotaDenominador: 100,
  });
  assert.equal(resolverCategoriaFgts("103").elegivel, true);
  assert.equal(resolverCategoriaFgts("721").elegivel, true);
  const autonomo = resolverCategoriaFgts("701");
  assert.equal(autonomo.elegivel, false);
  if (autonomo.elegivel) assert.fail("A categoria 701 não pode gerar FGTS.");
  assert.match(autonomo.motivo, /não gera depósito mensal de FGTS/);
});

test("trunca o FGTS por trabalhador e tipo de valor", () => {
  assert.equal(calcularFgtsTruncado(10_099, 8, 100), 807);
  assert.deepEqual(
    calcularItemFgts({
      trabalhadorReferencia: "mat-1",
      categoria: "103",
      tipoValor: "MENSAL",
      baseCalculoCentavos: 10_099,
    }),
    {
      trabalhadorReferencia: "mat-1",
      categoria: "103",
      tipoValor: "MENSAL",
      baseCalculoCentavos: 10_099,
      aliquotaNumerador: 2,
      aliquotaDenominador: 100,
      valorFgtsCentavos: 201,
    },
  );
});

test("consolida a soma dos valores individualizados, sem recalcular sobre a base total", () => {
  const apuracao = consolidarFgtsPorTrabalhador([
    {
      trabalhadorReferencia: "mat-1",
      categoria: "101",
      tipoValor: "MENSAL",
      baseCalculoCentavos: 1_011,
    },
    {
      trabalhadorReferencia: "mat-2",
      categoria: "101",
      tipoValor: "MENSAL",
      baseCalculoCentavos: 1_011,
    },
  ]);

  assert.equal(apuracao.baseCalculoCentavos, 2_022);
  assert.equal(apuracao.valorFgtsCentavos, 160);
  assert.match(apuracao.hash, /^[0-9a-f]{64}$/);
});

test("recusa categoria 701, duplicidade e valores monetários inválidos", () => {
  assert.throws(
    () =>
      calcularItemFgts({
        trabalhadorReferencia: "prestador-1",
        categoria: "701",
        tipoValor: "MENSAL",
        baseCalculoCentavos: 100_000,
      }),
    /não gera depósito mensal de FGTS/,
  );
  assert.throws(
    () =>
      consolidarFgtsPorTrabalhador([
        {
          trabalhadorReferencia: "mat-1",
          categoria: "101",
          tipoValor: "MENSAL",
          baseCalculoCentavos: 100,
        },
        {
          trabalhadorReferencia: "mat-1",
          categoria: "101",
          tipoValor: "MENSAL",
          baseCalculoCentavos: 200,
        },
      ]),
    /duplicado/,
  );
  assert.throws(() => calcularFgtsTruncado(10.5, 8, 100), /inteiro/);
});

test("calcula somente o vencimento nominal, deixando o calendário bancário explícito", () => {
  assert.equal(vencimentoNominalFgtsMensal("2026-07"), "2026-08-20");
  assert.equal(vencimentoNominalFgtsMensal("2026-12"), "2027-01-20");
  assert.throws(() => vencimentoNominalFgtsMensal("07/2026"), /Competência/);
});
