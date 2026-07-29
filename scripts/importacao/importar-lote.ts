import { spawn } from "node:child_process";
import { stat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { validarSnapshotGiw } from "../../lib/importacao-giw";
import { validarIntegridadeLoteGiw } from "../../lib/integridade-lote-giw";
import { ordenarPlanoImportacaoGiw } from "../../lib/plano-importacao-giw";

const LIMITE_ARQUIVOS = 100;
const LIMITE_ARQUIVO = 50 * 1024 * 1024;

function argumentos(args: string[], nome: string) {
  return args.flatMap((valor, indice) =>
    valor === nome && args[indice + 1] ? [args[indice + 1]] : [],
  );
}

function argumento(args: string[], nome: string) {
  return argumentos(args, nome)[0];
}

function executarImportador(args: string[]) {
  return new Promise<void>((resolvePromise, reject) => {
    const processo = spawn(
      process.execPath,
      ["--import", "tsx", resolve("scripts/importacao/importar.ts"), ...args],
      { stdio: "inherit", env: process.env },
    );
    processo.once("error", reject);
    processo.once("exit", (codigo, sinal) => {
      if (codigo === 0) resolvePromise();
      else {
        reject(
          new Error(
            `Importador terminou com ${sinal ? `sinal ${sinal}` : `código ${codigo}`}.`,
          ),
        );
      }
    });
  });
}

async function executar() {
  const args = process.argv.slice(2);
  const arquivosInformados = argumentos(args, "--arquivo").map((item) => resolve(item));
  const diretorios = argumentos(args, "--diretorio").map((item) => resolve(item));
  const aplicar = args.includes("--aplicar");
  const empresaId = argumento(args, "--empresa-id");

  for (const diretorio of diretorios) {
    const nomes = (await readdir(diretorio))
      .filter((nome) => nome.toLowerCase().endsWith(".json"))
      .sort();
    arquivosInformados.push(...nomes.map((nome) => resolve(diretorio, nome)));
  }
  if (arquivosInformados.length === 0 || arquivosInformados.length > LIMITE_ARQUIVOS) {
    throw new Error(`Informe entre 1 e ${LIMITE_ARQUIVOS} snapshots.`);
  }

  const entradas = [];
  const snapshots = [];
  for (const arquivo of arquivosInformados) {
    const informacao = await stat(arquivo);
    if (!informacao.isFile() || informacao.size <= 0 || informacao.size > LIMITE_ARQUIVO) {
      throw new Error(`Snapshot ausente, vazio ou maior que 50 MB: ${arquivo}`);
    }
    const bruto = JSON.parse(await readFile(arquivo, "utf8"));
    const validado = validarSnapshotGiw(bruto);
    if (!validado.snapshot) {
      throw new Error(
        `Snapshot inválido (${arquivo}): ${validado.issues.length} pendência(s).`,
      );
    }
    snapshots.push(validado.snapshot);
    entradas.push({ arquivo, entity: validado.snapshot.entity });
  }
  const problemasIntegridade = validarIntegridadeLoteGiw(snapshots);
  if (problemasIntegridade.length > 0) {
    const resumo = Object.fromEntries(
      [...new Set(problemasIntegridade.map((issue) => issue.field))].map((field) => [
        field,
        problemasIntegridade.filter((issue) => issue.field === field).length,
      ]),
    );
    console.error(JSON.stringify(resumo, null, 2));
    throw new Error(
      `O lote possui ${problemasIntegridade.length} chave(s) duplicada(s) ou dependência(s) ausente(s).`,
    );
  }
  const plano = ordenarPlanoImportacaoGiw(entradas);
  const porEntidade = Object.fromEntries(
    [...new Set(plano.map((entrada) => entrada.entity))].map((entity) => [
      entity,
      plano.filter((entrada) => entrada.entity === entity).length,
    ]),
  );
  console.log(`Plano válido: ${plano.length} snapshot(s).`);
  console.log(JSON.stringify(porEntidade, null, 2));

  if (aplicar && !args.includes("--confirmed-complete")) {
    throw new Error("--aplicar exige --confirmed-complete.");
  }
  if (aplicar && !process.env.DATABASE_URL) {
    throw new Error("--aplicar exige DATABASE_URL.");
  }
  if (!process.env.DATABASE_URL) {
    console.log("Dry-run estrutural do lote concluído; DATABASE_URL ausente.");
    return;
  }
  if (!aplicar) {
    console.warn(
      "Dry-run em banco processa cada snapshot isoladamente. As dependências " +
        "relacionais precisam já estar aplicadas; para banco vazio, use o " +
        "preflight estrutural sem DATABASE_URL e aplique primeiro em homologação descartável.",
    );
  }

  for (const [indice, entrada] of plano.entries()) {
    console.log(
      `Importando ${indice + 1}/${plano.length}: ${entrada.entity}.`,
    );
    const importarArgs = ["--arquivo", entrada.arquivo];
    if (empresaId) importarArgs.push("--empresa-id", empresaId);
    if (aplicar) importarArgs.push("--aplicar");
    await executarImportador(importarArgs);
  }
  console.log(
    `${plano.length} snapshot(s) processado(s) em ${aplicar ? "aplicação" : "dry-run"}.`,
  );
}

executar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
