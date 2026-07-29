import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { promisify } from "node:util";
import {
  criarManifestPreflightPdf,
  converterTextoPdfHistorico,
  sha256Pdf,
} from "../../lib/conversao-historico-pdf";

const executarArquivo = promisify(execFile);

function emPrivate(caminho: string) {
  return caminho.split(/[\\/]/).some((parte) => parte.toLowerCase() === ".private");
}

async function executar() {
  const args = process.argv.slice(2);
  const arquivos = args.flatMap((arg, indice) =>
    arg === "--arquivo" && args[indice + 1] ? [resolve(args[indice + 1])] : []
  );
  const indiceSaida = args.indexOf("--saida");
  const indiceExtraido = args.indexOf("--extraido-em");
  const indiceEsperados = args.indexOf("--esperados");
  const indiceRecebidos = args.indexOf("--recebidos");
  const aplicar = args.includes("--aplicar");
  const producao = args.includes("--producao");
  const modo = producao ? "production" : aplicar ? "apply" : "dry-run";
  const arquivo = arquivos[0] ?? "";
  const nomeBase = basename(arquivo, extname(arquivo));
  const saida = resolve(
    args[indiceSaida + 1] ??
      `.private/importacoes/giw/${nomeBase}-folhas-historico.json`,
  );
  const extraidoEm = indiceExtraido >= 0 ? args[indiceExtraido + 1] : undefined;
  if (arquivos.length === 0) {
    throw new Error("Informe ao menos um --arquivo <documento.pdf>.");
  }
  if (modo !== "dry-run" && arquivos.length > 1 && indiceSaida >= 0) {
    throw new Error("--saida só pode ser usado com um único PDF.");
  }

  const entradas = await Promise.all(arquivos.map(async (caminho) => {
    const arquivoStat = await stat(caminho);
    if (!arquivoStat.isFile() || arquivoStat.size > 50 * 1024 * 1024) {
      throw new Error(`PDF inválido ou maior que 50 MB: ${basename(caminho)}.`);
    }
    const conteudo = await readFile(caminho);
    if (conteudo.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error(`Arquivo não é PDF: ${basename(caminho)}.`);
    }
    const { stdout: texto } = await executarArquivo(
      "pdftotext",
      ["-layout", "-nopgbrk", caminho, "-"],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    return { caminho, nomeArquivo: basename(caminho), conteudo, texto };
  }));

  const numero = (indice: number) =>
    indice >= 0 && args[indice + 1] ? Number(args[indice + 1]) : undefined;
  const manifest = criarManifestPreflightPdf(entradas, {
    modo,
    confirmedComplete: args.includes("--confirmed-complete"),
    expectedDocumentCount: numero(indiceEsperados),
    receivedDocumentCount: numero(indiceRecebidos),
  });
  console.log(JSON.stringify(manifest, null, 2));
  if (modo === "dry-run") return;

  for (const entrada of entradas) {
    const destino = arquivos.length === 1 && indiceSaida >= 0
      ? saida
      : resolve(`.private/importacoes/giw/${basename(entrada.caminho, extname(entrada.caminho))}-historico.json`);
    if (!emPrivate(destino)) throw new Error("A saída PDF deve ficar em uma pasta .private.");
    const resultado = converterTextoPdfHistorico(entrada.texto, {
      nomeArquivo: entrada.nomeArquivo,
      extraidoEm,
      arquivoSha256: sha256Pdf(entrada.conteudo),
    });
    if (!resultado.snapshot) {
      throw new Error(
        `PDF rejeitado com ${resultado.issues.length} problema(s): ` +
          resultado.issues.map((item) => `${item.campo}: ${item.mensagem}`).join("; "),
      );
    }
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, `${JSON.stringify(resultado.snapshot, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      `Snapshot privado válido: ${resultado.snapshot.records.length} registro(s) ` +
        `de ${resultado.snapshot.entity}.`,
    );
    console.log(`Gravado em ${destino}`);
  }
}

executar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
