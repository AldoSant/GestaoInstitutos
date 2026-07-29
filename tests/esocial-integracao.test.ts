import assert from "node:assert/strict";
import test from "node:test";
import {
  eventoAfetaFgts,
  sequenciaMinimaEsocialFgtsMensal,
  validarTransicaoEventoEsocial,
} from "../lib/integracoes/esocial";

test("máquina de estados não permite tratar transmissão como aceite", () => {
  assert.equal(validarTransicaoEventoEsocial("RASCUNHO", "VALIDADO"), "VALIDADO");
  assert.equal(
    validarTransicaoEventoEsocial("TRANSMITIDO", "PROCESSANDO"),
    "PROCESSANDO",
  );
  assert.equal(validarTransicaoEventoEsocial("PROCESSANDO", "ACEITO"), "ACEITO");
  assert.throws(
    () => validarTransicaoEventoEsocial("TRANSMITIDO", "VALIDADO"),
    /Transição eSocial inválida/,
  );
  assert.throws(
    () => validarTransicaoEventoEsocial("ACEITO", "RASCUNHO"),
    /Transição eSocial inválida/,
  );
});

test("identifica eventos de remuneração que sensibilizam o FGTS Digital", () => {
  assert.equal(eventoAfetaFgts("S-1200"), true);
  assert.equal(eventoAfetaFgts("S-2299"), true);
  assert.equal(eventoAfetaFgts("S-2399"), true);
  assert.equal(eventoAfetaFgts("S-1299"), false);
});

test("documenta a cadeia mínima até a GFD oficial", () => {
  const fluxo = sequenciaMinimaEsocialFgtsMensal();
  assert.deepEqual(
    fluxo.map((item) => item.fase),
    ["CADASTROS", "REMUNERACAO", "CONFERENCIA", "FECHAMENTO", "GUIA"],
  );
  assert.deepEqual(fluxo.at(-1)?.eventos, ["GFD"]);
});
