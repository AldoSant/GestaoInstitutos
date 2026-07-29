import assert from "node:assert/strict";
import test from "node:test";
import { ordenarPlanoImportacaoGiw } from "../lib/plano-importacao-giw";

test("ordena snapshots pela cadeia relacional e preserva ordem na mesma entidade", () => {
  const resultado = ordenarPlanoImportacaoGiw([
    { arquivo: "guias.json", entity: "guias_inss_historicas" },
    { arquivo: "atividades-atuais.json", entity: "atividades" },
    { arquivo: "pessoas.json", entity: "pessoas" },
    { arquivo: "atividades-historicas.json", entity: "atividades" },
    { arquivo: "folhas.json", entity: "folhas_historicas" },
    { arquivo: "vinculos.json", entity: "vinculos" },
    { arquivo: "termos.json", entity: "termos" },
    { arquivo: "lotacoes.json", entity: "lotacoes" },
  ]);

  assert.deepEqual(
    resultado.map((entrada) => entrada.arquivo),
    [
      "pessoas.json",
      "atividades-atuais.json",
      "atividades-historicas.json",
      "lotacoes.json",
      "termos.json",
      "vinculos.json",
      "folhas.json",
      "guias.json",
    ],
  );
});

test("rejeita arquivo repetido e entidade desconhecida", () => {
  assert.throws(
    () =>
      ordenarPlanoImportacaoGiw([
        { arquivo: "pessoas.json", entity: "pessoas" },
        { arquivo: "pessoas.json", entity: "pessoas" },
      ]),
    /Arquivo repetido/,
  );
  assert.throws(
    () => ordenarPlanoImportacaoGiw([{ arquivo: "x.json", entity: "desconhecida" }]),
    /Entidade não suportada/,
  );
});
