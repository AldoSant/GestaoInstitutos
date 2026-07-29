import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import {
  converterCsvFolhasHistoricas,
  converterCsvGuiasHistoricas,
  converterEventosDoCsvFolhas,
  converterPessoasDoCsvFolhas,
} from "../../lib/conversao-historico-csv";

type TipoHistorico = "folhas" | "guias" | "pessoas" | "eventos";

type Opcoes = {
  tipo: TipoHistorico;
  arquivo: string;
  saida: string;
  extraidoEm?: string;
  permitirSaidaPublica: boolean;
};

function ajuda() {
  console.log(`Uso:
  npm run giw:converter:historico -- --tipo folhas --arquivo folha.csv
  npm run giw:converter:historico -- --tipo guias --arquivo guia.csv
  npm run giw:converter:historico -- --tipo pessoas --arquivo folha.csv
  npm run giw:converter:historico -- --tipo eventos --arquivo folha.csv

Opções:
  --saida CAMINHO              destino JSON; por padrão usa .private/importacoes/giw
  --extraido-em DATA_ISO       data/hora de obtenção do arquivo
  --permitir-saida-publica     permite gravar fora de uma pasta .private

O conversor não consulta nem altera o banco. Depois, valide o JSON com giw:importar.`);
}

function lerOpcoes(args: string[]): Opcoes {
  let tipo: TipoHistorico | null = null;
  let arquivo = "";
  let saida = "";
  let extraidoEm: string | undefined;
  let permitirSaidaPublica = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      ajuda();
      process.exit(0);
    }
    if (
      arg === "--tipo" &&
      (
        value === "folhas" ||
        value === "guias" ||
        value === "pessoas" ||
        value === "eventos"
      )
    ) {
      tipo = value;
      index += 1;
    } else if (arg === "--arquivo" && value) {
      arquivo = value;
      index += 1;
    } else if (arg === "--saida" && value) {
      saida = value;
      index += 1;
    } else if (arg === "--extraido-em" && value) {
      extraidoEm = value;
      index += 1;
    } else if (arg === "--permitir-saida-publica") {
      permitirSaidaPublica = true;
    } else {
      throw new Error(`Opção inválida ou incompleta: ${arg}`);
    }
  }
  if (!tipo) throw new Error("--tipo deve ser folhas, guias, pessoas ou eventos.");
  if (!arquivo) throw new Error("--arquivo é obrigatório.");
  const nomeBase = basename(arquivo, extname(arquivo));
  const resolvedOutput =
    saida ||
    resolve(
      ".private",
      "importacoes",
      "giw",
      `${nomeBase}-${tipo}-historico.json`,
    );
  return {
    tipo,
    arquivo: resolve(arquivo),
    saida: resolve(resolvedOutput),
    extraidoEm,
    permitirSaidaPublica,
  };
}

function estaEmPastaPrivate(caminho: string) {
  return caminho
    .split(/[\\/]/)
    .some((parte) => parte.toLowerCase() === ".private");
}

async function executar() {
  const opcoes = lerOpcoes(process.argv.slice(2));
  const arquivoStat = await stat(opcoes.arquivo);
  if (!arquivoStat.isFile()) throw new Error("O caminho de entrada não é um arquivo.");
  if (arquivoStat.size > 50 * 1024 * 1024) {
    throw new Error("O CSV excede o limite de 50 MB.");
  }
  if (!opcoes.permitirSaidaPublica && !estaEmPastaPrivate(opcoes.saida)) {
    throw new Error(
      "A saída contém dados pessoais e deve ficar em .private. " +
        "Use --permitir-saida-publica somente para dados fictícios.",
    );
  }
  const conteudo = await readFile(opcoes.arquivo, "utf8");
  const parametros = {
    nomeArquivo: basename(opcoes.arquivo),
    extraidoEm: opcoes.extraidoEm,
  };
  const conversao =
    opcoes.tipo === "folhas"
      ? converterCsvFolhasHistoricas(conteudo, parametros)
      : opcoes.tipo === "guias"
        ? converterCsvGuiasHistoricas(conteudo, parametros)
        : opcoes.tipo === "pessoas"
          ? converterPessoasDoCsvFolhas(conteudo, parametros)
          : converterEventosDoCsvFolhas(conteudo, parametros);
  if (!conversao.snapshot) {
    console.error(`CSV rejeitado com ${conversao.issues.length} problema(s):`);
    conversao.issues.slice(0, 100).forEach((issue) => {
      console.error(
        `- ${issue.linha ? `linha ${issue.linha}` : "arquivo"}, ` +
          `${issue.campo}: ${issue.mensagem}`,
      );
    });
    if (conversao.issues.length > 100) {
      console.error(`- ... mais ${conversao.issues.length - 100} problema(s).`);
    }
    process.exitCode = 1;
    return;
  }
  await mkdir(dirname(opcoes.saida), { recursive: true });
  await writeFile(
    opcoes.saida,
    `${JSON.stringify(conversao.snapshot, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  console.log(
    `${conversao.snapshot.records.length} registro(s) convertido(s). ` +
      `SHA-256 do CSV: ${conversao.arquivoSha256}.`,
  );
  console.log(`Snapshot privado gravado em ${opcoes.saida}`);
}

executar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
