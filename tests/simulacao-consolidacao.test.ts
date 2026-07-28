import assert from "node:assert/strict";
import test from "node:test";
import type { EntradaVinculoFolha } from "../lib/processamento-folha";
import {
  conteudoFontesSimulacao,
  normalizarTransicaoSimulacao,
  rotuloStatusSimulacao,
} from "../lib/simulacao-consolidacao";

const ENQUADRAMENTO = {
  id: "00000000-0000-4000-8000-000000000099",
  regime: "EMPRESA_GERAL",
  aliquotaSeguradoNumerador: 11,
  aliquotaSeguradoDenominador: 100,
  aliquotaPatronalNumerador: 20,
  aliquotaPatronalDenominador: 100,
  fonteNormativa: "Teste",
} as const;

function fonte(id: string, codigo: string): EntradaVinculoFolha {
  return {
    vinculoId: id,
    tipoPessoa: "FISICA",
    categoriaContribuinte: "701",
    valorRetribuicao: "1000.00",
    descontaInss: true,
    descontaIrrf: true,
    isentoInss: false,
    baseOutrasFontes: "0",
    outrasFontes: [],
    enquadramentoPrevidenciario: ENQUADRAMENTO,
    dependentesIrrf: 0,
    eventos: [
      {
        id: `${id.slice(0, -1)}9`,
        codigo,
        descricao: codigo,
        natureza: "PROVENTO",
        tipoCalculo: "VALOR",
        valor: "1.00",
        incideInss: true,
        incideIrrf: true,
      },
    ],
  };
}

test("conteúdo congelado independe da ordem recebida", () => {
  const a = fonte("00000000-0000-4000-8000-000000000001", "B");
  const b = fonte("00000000-0000-4000-8000-000000000002", "A");
  assert.deepEqual(
    conteudoFontesSimulacao({
      competencia: "2026-07",
      pessoaId: "00000000-0000-4000-8000-000000000010",
      fontes: [a, b],
    }),
    conteudoFontesSimulacao({
      competencia: "2026-07",
      pessoaId: "00000000-0000-4000-8000-000000000010",
      fontes: [b, a],
    }),
  );
});

test("máquina de estados exige fluxo de homologação", () => {
  const encaminhada = normalizarTransicaoSimulacao({
    statusAtual: "SIMULADA",
    statusDestino: "EM_HOMOLOGACAO",
    responsavel: " Gerente de RH ",
    justificativa: "",
  });
  assert.equal(encaminhada.status, "EM_HOMOLOGACAO");
  assert.equal(encaminhada.responsavel, "Gerente de RH");
  assert.equal(encaminhada.decididoEm, null);

  const aprovada = normalizarTransicaoSimulacao({
    statusAtual: "EM_HOMOLOGACAO",
    statusDestino: "HOMOLOGADA",
    responsavel: "Gerente de RH",
    justificativa: "Conferida contra os três meses do sistema legado.",
  });
  assert.equal(aprovada.status, "HOMOLOGADA");
  assert.ok(aprovada.decididoEm instanceof Date);
});

test("bloqueia salto, reabertura terminal e decisão sem evidência", () => {
  assert.throws(
    () =>
      normalizarTransicaoSimulacao({
        statusAtual: "SIMULADA",
        statusDestino: "HOMOLOGADA",
        responsavel: "Gerente de RH",
        justificativa: "Conferida integralmente.",
      }),
    /não pode avançar/,
  );
  assert.throws(
    () =>
      normalizarTransicaoSimulacao({
        statusAtual: "HOMOLOGADA",
        statusDestino: "EM_HOMOLOGACAO",
        responsavel: "Gerente de RH",
        justificativa: "",
      }),
    /não pode avançar/,
  );
  assert.throws(
    () =>
      normalizarTransicaoSimulacao({
        statusAtual: "EM_HOMOLOGACAO",
        statusDestino: "REJEITADA",
        responsavel: "Equipe RH",
        justificativa: "curta",
      }),
    /justificativa/,
  );
});

test("apresenta rótulos operacionais", () => {
  assert.equal(rotuloStatusSimulacao("SIMULADA"), "Simulada");
  assert.equal(rotuloStatusSimulacao("EM_HOMOLOGACAO"), "Em homologação");
  assert.equal(rotuloStatusSimulacao("HOMOLOGADA"), "Homologada");
});
