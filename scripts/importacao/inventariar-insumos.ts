import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  lstat,
  mkdir,
  opendir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  criarManifestoRemessaInsumos,
  type EntradaManifestoInsumo,
} from "../../lib/remessa-insumos";

const LIMITE_ARQUIVOS = 500;
const LIMITE_ARQUIVO_BYTES = 100 * 1024 * 1024;
const LIMITE_REMESSA_BYTES = 2 * 1024 * 1024 * 1024;
const diretoriosIgnorados = new Set([".git", ".next", "node_modules"]);

function argumento(args: string[], nome: string) {
  const indice = args.indexOf(nome);
  return indice >= 0 ? args[indice + 1] : undefined;
}

function emPrivate(caminho: string) {
  return caminho
    .split(/[\\/]/)
    .some((parte) => parte.toLocaleLowerCase("pt-BR") === ".private");
}

async function listarArquivos(diretorio: string, atual = diretorio, nivel = 0) {
  if (nivel > 12) throw new Error("A remessa excede 12 níveis de diretórios.");
  const encontrados: string[] = [];
  const handle = await opendir(atual);
  for await (const entrada of handle) {
    const caminho = resolve(atual, entrada.name);
    if (entrada.isSymbolicLink()) continue;
    if (entrada.isDirectory()) {
      if (!diretoriosIgnorados.has(entrada.name)) {
        encontrados.push(...await listarArquivos(diretorio, caminho, nivel + 1));
      }
    } else if (entrada.isFile()) {
      encontrados.push(caminho);
    }
    if (encontrados.length > LIMITE_ARQUIVOS) {
      throw new Error(`A remessa excede ${LIMITE_ARQUIVOS} arquivos.`);
    }
  }
  return encontrados;
}

async function sha256Arquivo(caminho: string) {
  const hash = createHash("sha256");
  for await (const bloco of createReadStream(caminho)) hash.update(bloco);
  return hash.digest("hex");
}

async function mapearComLimite<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<R>,
) {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  async function executar() {
    while (proximo < itens.length) {
      const indice = proximo;
      proximo += 1;
      resultados[indice] = await tarefa(itens[indice]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, executar),
  );
  return resultados;
}

async function executar() {
  const args = process.argv.slice(2);
  const diretorioArg = argumento(args, "--diretorio");
  const saidaArg = argumento(args, "--saida");
  const esperadosArg = argumento(args, "--esperados");
  if (!diretorioArg) {
    throw new Error("Informe --diretorio <pasta-da-remessa>.");
  }
  const diretorio = await realpath(resolve(diretorioArg));
  if (!(await stat(diretorio)).isDirectory()) {
    throw new Error("O caminho informado não é um diretório.");
  }
  const saida = saidaArg ? resolve(saidaArg) : null;
  if (saida && !emPrivate(saida)) {
    throw new Error("O manifesto completo deve ser gravado em uma pasta .private.");
  }

  const arquivos = (await listarArquivos(diretorio))
    .filter((caminho) => !saida || resolve(caminho) !== saida)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  let totalBytes = 0;
  const entradas = await mapearComLimite(
    arquivos,
    4,
    async (caminho): Promise<EntradaManifestoInsumo> => {
      const arquivoStat = await lstat(caminho);
      if (!arquivoStat.isFile() || arquivoStat.size > LIMITE_ARQUIVO_BYTES) {
        throw new Error("A remessa contém arquivo inválido ou maior que 100 MB.");
      }
      totalBytes += arquivoStat.size;
      if (totalBytes > LIMITE_REMESSA_BYTES) {
        throw new Error("A remessa excede o limite total de 2 GB.");
      }
      return {
        caminhoRelativo: relative(diretorio, caminho),
        tamanhoBytes: arquivoStat.size,
        sha256: await sha256Arquivo(caminho),
        modificadoEm: arquivoStat.mtime.toISOString(),
      };
    },
  );
  const expectedDocumentCount = esperadosArg === undefined
    ? undefined
    : Number(esperadosArg);
  const manifesto = criarManifestoRemessaInsumos(entradas, {
    expectedDocumentCount,
    confirmedComplete: args.includes("--confirmed-complete"),
  });
  const resumo = {
    status: manifesto.status,
    expectedDocumentCount: manifesto.expectedDocumentCount,
    receivedDocumentCount: manifesto.receivedDocumentCount,
    totalBytes: manifesto.totalBytes,
    supportedDocumentCount: manifesto.supportedDocumentCount,
    unsupportedDocumentCount: manifesto.unsupportedDocumentCount,
    duplicateGroupCount: manifesto.duplicateGroups.length,
    countsByType: manifesto.countsByType,
  };
  console.log(JSON.stringify(resumo, null, 2));

  if (saida) {
    await mkdir(dirname(saida), { recursive: true });
    await writeFile(saida, `${JSON.stringify(manifesto, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    console.log(`Manifesto privado gravado em ${saida}.`);
  }
}

executar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
