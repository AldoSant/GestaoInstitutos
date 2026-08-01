import assert from "node:assert/strict";
import test from "node:test";
import { montarResumoDossieObrigacao } from "../lib/relatorio-obrigacao";

test("fecha o dossiê previdenciário por natureza e documentos", () => {
  const resumo = montarResumoDossieObrigacao({
    status: "EMITIDA",
    principal: "300.00",
    juros: "0.00",
    multa: "0.00",
    total: "300.00",
    itens: [
      { id: "1", natureza: "SEGURADO", valor: "100.00" },
      { id: "2", natureza: "PATRONAL", valor: "200.00" },
    ],
    documentos: [
      { tipo: "TOTALIZADOR_DCTFWEB", valorTotal: "300.00", verificado: true },
      { tipo: "RECIBO_DCTFWEB", valorTotal: "0.00", verificado: true },
      { tipo: "DARF", valorTotal: "300.00", verificado: true },
    ],
  });
  assert.equal(resumo.principalCentavos, 30_000);
  assert.equal(resumo.naturezas[0].natureza, "PATRONAL");
  assert.equal(resumo.naturezas[0].valorCentavos, 20_000);
  assert.deepEqual(resumo.documentos, {
    totalizadorVerificado: true,
    reciboVerificado: true,
    darfVerificado: true,
    gpsIndividuais: 0,
    gpsRegistradas: 0,
    gpsTotalCentavos: 0,
  });
});

test("GPS excepcional fica individual e não emite a obrigação agregada", () => {
  const comum = {
    status: "BLOQUEADA",
    principal: "110.00",
    juros: "0.00",
    multa: "0.00",
    total: "110.00",
    itens: [{ id: "1", natureza: "SEGURADO", valor: "110.00" }],
    instrumento: "GPS_EXCECAO" as const,
  };
  const resumo = montarResumoDossieObrigacao({
    ...comum,
    documentos: [],
    guiasGpsIndividuais: [
      { id: "gps-1", status: "REGISTRADA", total: "110.00", verificado: true },
    ],
  });
  assert.equal(resumo.documentos.gpsRegistradas, 1);
  assert.equal(resumo.documentos.gpsTotalCentavos, 11_000);
  assert.throws(
    () => montarResumoDossieObrigacao({ ...comum, status: "EMITIDA", documentos: [] }),
    /não pode ser emitida por GPS individual/,
  );
});

test("recusa totais ou itens previdenciários divergentes", () => {
  assert.throws(
    () =>
      montarResumoDossieObrigacao({
        status: "BLOQUEADA",
        principal: "100.00",
        juros: "1.00",
        multa: "0.00",
        total: "100.00",
        itens: [{ id: "1", natureza: "SEGURADO", valor: "100.00" }],
        documentos: [],
      }),
    /principal, juros e multa/,
  );
  assert.throws(
    () =>
      montarResumoDossieObrigacao({
        status: "BLOQUEADA",
        principal: "100.00",
        juros: "0.00",
        multa: "0.00",
        total: "100.00",
        itens: [{ id: "1", natureza: "SEGURADO", valor: "99.99" }],
        documentos: [],
      }),
    /não fecham com o principal/,
  );
});

test("obrigação emitida exige a cadeia documental completa", () => {
  assert.throws(
    () =>
      montarResumoDossieObrigacao({
        status: "EMITIDA",
        principal: "100.00",
        juros: "0.00",
        multa: "0.00",
        total: "100.00",
        itens: [{ id: "1", natureza: "SEGURADO", valor: "100.00" }],
        documentos: [
          { tipo: "TOTALIZADOR_DCTFWEB", valorTotal: "100.00", verificado: true },
          { tipo: "DARF", valorTotal: "100.00", verificado: true },
        ],
      }),
    /recibo e DARF/,
  );
});
