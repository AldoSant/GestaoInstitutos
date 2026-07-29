import { execFile } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  relative,
  resolve,
} from "node:path";
import { promisify } from "node:util";
import {
  analisarLotePdfHistorico,
  sha256Pdf,
  type EntradaPreflightPdf,
} from "../../lib/conversao-historico-pdf";

const executarArquivo = promisify(execFile);
const LIMITE_POR_PDF = 50 * 1024 * 1024;
const LIMITE_TOTAL = 500 * 1024 * 1024;
const LIMITE_DOCUMENTOS = 200;
const CONCORRENCIA_EXTRACAO = 3;
const DIRETORIOS_IGNORADOS = new Set([".git", ".next", "node_modules"]);

type ArquivoPdf = {
  caminho: string;
  nomeArquivo: string;
  tamanho: number;
};

function emPrivate(caminho: string) {
  return caminho.split(/[\\/]/).some((parte) => parte.toLowerCase() === ".private");
}

function valorDepois(args: string[], flag: string) {
  const indice = args.indexOf(flag);
  return indice >= 0 ? args[indice + 1] : undefined;
}

function numeroPositivoOuIndefinido(valor: string | undefined, nome: string) {
  if (valor === undefined) return undefined;
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0) {
    throw new Error(`${nome} deve ser um inteiro não negativo.`);
  }
  return numero;
}

async function mapearComLimite<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<R>,
) {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  async function worker() {
    while (proximo < itens.length) {
      const indice = proximo;
      proximo += 1;
      resultados[indice] = await tarefa(itens[indice]);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(limite, itens.length) },
      () => worker(),
    ),
  );
  return resultados;
}

async function listarPdfs(
  diretorio: string,
  raiz = diretorio,
  profundidade = 0,
): Promise<ArquivoPdf[]> {
  if (profundidade > 12) {
    throw new Error("A pasta de PDFs excede a profundidade máxima de 12 níveis.");
  }
  const itens = await readdir(diretorio, { withFileTypes: true });
  const encontrados: ArquivoPdf[] = [];
  for (const item of itens.sort((a, b) => a.name.localeCompare(b.name))) {
    if (item.isSymbolicLink()) continue;
    const caminho = resolve(diretorio, item.name);
    if (item.isDirectory()) {
      if (!DIRETORIOS_IGNORADOS.has(item.name)) {
        encontrados.push(...await listarPdfs(caminho, raiz, profundidade + 1));
      }
    } else if (item.isFile() && extname(item.name).toLowerCase() === ".pdf") {
      const dados = await stat(caminho);
      encontrados.push({
        caminho,
        nomeArquivo: relative(raiz, caminho).replace(/\\/g, "/"),
        tamanho: dados.size,
      });
    }
    if (encontrados.length > LIMITE_DOCUMENTOS) {
      throw new Error(`O lote excede o limite de ${LIMITE_DOCUMENTOS} PDFs.`);
    }
  }
  return encontrados;
}

async function descreverArquivo(caminho: string): Promise<ArquivoPdf> {
  const dados = await stat(caminho);
  return {
    caminho,
    nomeArquivo: basename(caminho),
    tamanho: dados.size,
  };
}

async function extrairPdf(arquivo: ArquivoPdf): Promise<EntradaPreflightPdf> {
  if (arquivo.tamanho <= 0 || arquivo.tamanho > LIMITE_POR_PDF) {
    throw new Error("Há PDF vazio ou maior que 50 MB no lote.");
  }
  const conteudo = await readFile(arquivo.caminho);
  if (conteudo.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("Há arquivo com extensão .pdf, mas sem assinatura PDF válida.");
  }
  const { stdout: texto } = await executarArquivo(
    "pdftotext",
    ["-layout", "-nopgbrk", arquivo.caminho, "-"],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  return {
    nomeArquivo: arquivo.nomeArquivo,
    conteudo,
    texto,
  };
}

async function gravarJsonPrivado(caminho: string, conteudo: unknown) {
  if (!emPrivate(caminho)) {
    throw new Error("Relatórios e snapshots devem ficar em uma pasta .private.");
  }
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, `${JSON.stringify(conteudo, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

async function executar() {
  const args = process.argv.slice(2);
  const caminhosExplicitos = args.flatMap((arg, indice) =>
    arg === "--arquivo" && args[indice + 1] ? [resolve(args[indice + 1])] : []
  );
  const diretorios = args.flatMap((arg, indice) =>
    arg === "--diretorio" && args[indice + 1] ? [resolve(args[indice + 1])] : []
  );
  const aplicar = args.includes("--aplicar");
  const producao = args.includes("--producao");
  const modo = producao ? "production" : aplicar ? "apply" : "dry-run";
  const extraidoEm = valorDepois(args, "--extraido-em");
  const expectedDocumentCount = numeroPositivoOuIndefinido(
    valorDepois(args, "--esperados"),
    "--esperados",
  );
  const receivedDocumentCount = numeroPositivoOuIndefinido(
    valorDepois(args, "--recebidos"),
    "--recebidos",
  );
  const saidaInformada = valorDepois(args, "--saida");
  const relatorioInformado = valorDepois(args, "--relatorio");

  if (caminhosExplicitos.length === 0 && diretorios.length === 0) {
    throw new Error(
      "Informe --arquivo <documento.pdf> ou --diretorio <pasta-de-pdfs>.",
    );
  }

  const descritos = [
    ...await mapearComLimite(caminhosExplicitos, 8, descreverArquivo),
    ...(await mapearComLimite(diretorios, 4, (diretorio) => listarPdfs(diretorio)))
      .flat(),
  ];
  const arquivos = [
    ...new Map(
      descritos.map((arquivo) => [arquivo.caminho.toLowerCase(), arquivo]),
    ).values(),
  ];
  if (arquivos.length === 0) throw new Error("Nenhum PDF foi encontrado.");
  if (arquivos.length > LIMITE_DOCUMENTOS) {
    throw new Error(`O lote excede o limite de ${LIMITE_DOCUMENTOS} PDFs.`);
  }
  const totalBytes = arquivos.reduce((total, arquivo) => total + arquivo.tamanho, 0);
  if (totalBytes > LIMITE_TOTAL) {
    throw new Error("O lote de PDFs excede o limite total de 500 MB.");
  }
  if (modo !== "dry-run" && arquivos.length > 1 && saidaInformada) {
    throw new Error("--saida só pode ser usado com um único PDF.");
  }

  const entradas = await mapearComLimite(
    arquivos,
    CONCORRENCIA_EXTRACAO,
    extrairPdf,
  );
  const preflight = analisarLotePdfHistorico(entradas, {
    modo,
    confirmedComplete: args.includes("--confirmed-complete"),
    expectedDocumentCount,
    receivedDocumentCount,
    extraidoEm,
  });

  console.log(JSON.stringify({
    mode: preflight.report.mode,
    receivedDocumentCount: preflight.report.receivedDocumentCount,
    expectedDocumentCount: preflight.report.expectedDocumentCount,
    totalBytes,
    ...preflight.report.summary,
  }, null, 2));

  if (relatorioInformado) {
    await gravarJsonPrivado(resolve(relatorioInformado), preflight.report);
    console.log("Relatório privado de preflight gravado.");
  }
  if (preflight.report.summary.invalidDocumentCount > 0) {
    throw new Error(
      `Lote rejeitado: ${preflight.report.summary.invalidDocumentCount} PDF(s) ` +
        `inválido(s) e ${preflight.report.summary.issueCount} pendência(s).`,
    );
  }
  if (modo === "dry-run") return;

  for (const { input, result } of preflight.results) {
    if (!result.snapshot) {
      throw new Error("Resultado PDF inválido após a validação do lote.");
    }
    const hash = sha256Pdf(input.conteudo);
    const destino = arquivos.length === 1 && saidaInformada
      ? resolve(saidaInformada)
      : resolve(
        `.private/importacoes/giw/pdf-historico/documento-${hash.slice(0, 16)}-historico.json`,
      );
    await gravarJsonPrivado(destino, result.snapshot);
  }
  console.log(`${preflight.results.length} snapshot(s) privado(s) gravado(s).`);
}

executar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
