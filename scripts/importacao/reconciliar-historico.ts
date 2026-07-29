import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { validarSnapshotPessoas } from "../../lib/importacao-giw";
import {
  validarSnapshotFolhasHistoricas,
  validarSnapshotGuiasInssHistoricas,
  type GiwSnapshotFolhasHistoricas,
  type GiwSnapshotGuiasInssHistoricas,
} from "../../lib/migracao-historica";
import { reconciliarSnapshotsHistoricosGiw } from "../../lib/reconciliacao-migracao-giw";

function argumento(args: string[], nome: string) {
  const indice = args.indexOf(nome);
  return indice >= 0 ? args[indice + 1] : undefined;
}

function emPrivate(caminho: string) {
  return caminho.split(/[\\/]/).some((parte) => parte.toLowerCase() === ".private");
}

async function gravarJsonPrivado(caminho: string, valor: unknown) {
  if (!emPrivate(caminho)) throw new Error("A saída deve ficar em uma pasta .private.");
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, `${JSON.stringify(valor, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

async function executar() {
  const args = process.argv.slice(2);
  const pessoasArg = argumento(args, "--pessoas");
  const diretorioArg = argumento(args, "--diretorio-snapshots");
  const saidaArg = argumento(args, "--pasta-saida");
  const relatorioArg = argumento(args, "--relatorio");
  const aplicar = args.includes("--aplicar");
  if (!pessoasArg || !diretorioArg) {
    throw new Error("Informe --pessoas e --diretorio-snapshots.");
  }

  const pessoasJson = JSON.parse(await readFile(resolve(pessoasArg), "utf8"));
  const pessoas = validarSnapshotPessoas(pessoasJson);
  if (!pessoas.snapshot) {
    throw new Error(`Snapshot de Pessoas inválido: ${pessoas.issues.length} pendência(s).`);
  }
  const diretorio = resolve(diretorioArg);
  const arquivos = (await readdir(diretorio))
    .filter((arquivo) => arquivo.toLowerCase().endsWith(".json"))
    .sort();
  if (arquivos.length === 0 || arquivos.length > 100) {
    throw new Error("A pasta deve conter entre 1 e 100 snapshots JSON.");
  }
  const folhas: Array<{ arquivo: string; snapshot: GiwSnapshotFolhasHistoricas }> = [];
  const guias: Array<{ arquivo: string; snapshot: GiwSnapshotGuiasInssHistoricas }> = [];
  for (const arquivo of arquivos) {
    const bruto = JSON.parse(await readFile(resolve(diretorio, arquivo), "utf8"));
    if (bruto.entity === "folhas_historicas") {
      const validado = validarSnapshotFolhasHistoricas(bruto);
      if (!validado.snapshot) {
        throw new Error(`Há snapshot de Folha inválido: ${validado.issues.length} pendência(s).`);
      }
      folhas.push({ arquivo, snapshot: validado.snapshot });
    } else if (bruto.entity === "guias_inss_historicas") {
      const validado = validarSnapshotGuiasInssHistoricas(bruto);
      if (!validado.snapshot) {
        throw new Error(`Há snapshot de GPS inválido: ${validado.issues.length} pendência(s).`);
      }
      guias.push({ arquivo, snapshot: validado.snapshot });
    } else {
      throw new Error("A pasta contém entidade histórica não suportada.");
    }
  }

  const resultado = reconciliarSnapshotsHistoricosGiw(
    pessoas.snapshot.records,
    folhas.map((item) => item.snapshot),
    guias.map((item) => item.snapshot),
  );
  for (const snapshot of resultado.folhas) {
    const validado = validarSnapshotFolhasHistoricas(snapshot);
    if (!validado.snapshot) {
      throw new Error(
        `A reconciliação produziu Folha inválida: ${validado.issues.length} pendência(s).`,
      );
    }
  }
  for (const snapshot of resultado.guias) {
    const validado = validarSnapshotGuiasInssHistoricas(snapshot);
    if (!validado.snapshot) {
      throw new Error(
        `A reconciliação produziu GPS inválida: ${validado.issues.length} pendência(s).`,
      );
    }
  }
  console.log(JSON.stringify(resultado.report.summary, null, 2));
  console.log(`Status da reconciliação: ${resultado.report.status}.`);
  if (relatorioArg) await gravarJsonPrivado(resolve(relatorioArg), resultado.report);
  if (!aplicar) return;
  if (!args.includes("--confirmed-complete")) {
    throw new Error("--aplicar exige --confirmed-complete.");
  }
  if (resultado.report.status !== "PRONTA") {
    throw new Error("A reconciliação ainda possui Pessoas ou GPS sem vínculo.");
  }
  if (!saidaArg) throw new Error("--aplicar exige --pasta-saida.");
  const pastaSaida = resolve(saidaArg);
  if (!emPrivate(pastaSaida)) throw new Error("A pasta de saída deve ficar em .private.");
  for (const [indice, item] of folhas.entries()) {
    await gravarJsonPrivado(
      resolve(pastaSaida, basename(item.arquivo)),
      resultado.folhas[indice],
    );
  }
  for (const [indice, item] of guias.entries()) {
    await gravarJsonPrivado(
      resolve(pastaSaida, basename(item.arquivo)),
      resultado.guias[indice],
    );
  }
  console.log(`${arquivos.length} snapshot(s) reconciliado(s) gravado(s).`);
}

executar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
