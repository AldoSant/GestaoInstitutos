import { extname } from "node:path";

export const TIPOS_INSUMO = [
  "PDF",
  "CSV",
  "PLANILHA",
  "JSON",
  "DOCUMENTO",
  "ARQUIVO_COMPACTADO",
  "TEXTO",
  "DESCONHECIDO",
] as const;

export type TipoInsumo = (typeof TIPOS_INSUMO)[number];

export type EntradaManifestoInsumo = {
  caminhoRelativo: string;
  tamanhoBytes: number;
  sha256: string;
  modificadoEm: string;
};

export type DocumentoManifestoInsumo = EntradaManifestoInsumo & {
  extensao: string;
  tipo: TipoInsumo;
  suportadoNoPipeline: boolean;
};

export type StatusManifestoInsumo =
  | "PRONTA"
  | "PENDENTE_CONFIRMACAO"
  | "INCOMPLETA"
  | "DUPLICADA"
  | "REQUER_CLASSIFICACAO";

export type ManifestoRemessaInsumos = {
  schemaVersion: "1.0";
  expectedDocumentCount: number | null;
  receivedDocumentCount: number;
  confirmedComplete: boolean;
  status: StatusManifestoInsumo;
  totalBytes: number;
  supportedDocumentCount: number;
  unsupportedDocumentCount: number;
  countsByType: Array<{ tipo: TipoInsumo; quantidade: number }>;
  duplicateGroups: Array<{ sha256: string; caminhos: string[] }>;
  documents: DocumentoManifestoInsumo[];
};

const tipoPorExtensao: Record<string, TipoInsumo> = {
  ".pdf": "PDF",
  ".csv": "CSV",
  ".xlsx": "PLANILHA",
  ".xls": "PLANILHA",
  ".ods": "PLANILHA",
  ".json": "JSON",
  ".docx": "DOCUMENTO",
  ".doc": "DOCUMENTO",
  ".zip": "ARQUIVO_COMPACTADO",
  ".7z": "ARQUIVO_COMPACTADO",
  ".txt": "TEXTO",
};

const tiposProcessaveis = new Set<TipoInsumo>(["PDF", "CSV", "JSON"]);

export function classificarTipoInsumo(caminho: string) {
  return tipoPorExtensao[extname(caminho).toLowerCase()] ?? "DESCONHECIDO";
}

function caminhoRelativoSeguro(valor: string) {
  const normalizado = valor.trim().replaceAll("\\", "/");
  if (
    !normalizado ||
    normalizado.startsWith("/") ||
    /^[a-z]:\//i.test(normalizado)
  ) {
    throw new Error("O caminho do insumo deve ser relativo.");
  }
  const partes = normalizado.split("/").filter((parte) => parte && parte !== ".");
  if (partes.length === 0 || partes.some((parte) => parte === "..")) {
    throw new Error("O caminho do insumo não pode sair da remessa.");
  }
  return partes.join("/");
}

function validarEntrada(entrada: EntradaManifestoInsumo) {
  const caminhoRelativo = caminhoRelativoSeguro(entrada.caminhoRelativo);
  if (!Number.isSafeInteger(entrada.tamanhoBytes) || entrada.tamanhoBytes < 0) {
    throw new Error(`Tamanho inválido em ${caminhoRelativo}.`);
  }
  const sha256 = entrada.sha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error(`SHA-256 inválido em ${caminhoRelativo}.`);
  }
  const modificadoEm = new Date(entrada.modificadoEm);
  if (Number.isNaN(modificadoEm.getTime())) {
    throw new Error(`Data de modificação inválida em ${caminhoRelativo}.`);
  }
  const tipo = classificarTipoInsumo(caminhoRelativo);
  return {
    caminhoRelativo,
    tamanhoBytes: entrada.tamanhoBytes,
    sha256,
    modificadoEm: modificadoEm.toISOString(),
    extensao: extname(caminhoRelativo).toLowerCase(),
    tipo,
    suportadoNoPipeline: tiposProcessaveis.has(tipo),
  } satisfies DocumentoManifestoInsumo;
}

export function criarManifestoRemessaInsumos(
  entradas: EntradaManifestoInsumo[],
  opcoes: {
    expectedDocumentCount?: number;
    confirmedComplete?: boolean;
  } = {},
): ManifestoRemessaInsumos {
  if (entradas.length === 0) throw new Error("A remessa não contém arquivos.");
  if (entradas.length > 500) throw new Error("A remessa excede o limite de 500 arquivos.");
  if (
    opcoes.expectedDocumentCount !== undefined &&
    (!Number.isSafeInteger(opcoes.expectedDocumentCount) ||
      opcoes.expectedDocumentCount < 1)
  ) {
    throw new Error("A quantidade esperada deve ser um inteiro positivo.");
  }

  const documents = entradas
    .map(validarEntrada)
    .sort((a, b) =>
      a.caminhoRelativo.localeCompare(b.caminhoRelativo, "pt-BR") ||
      a.sha256.localeCompare(b.sha256)
    );
  const caminhos = new Set<string>();
  for (const document of documents) {
    const chave = document.caminhoRelativo.toLocaleLowerCase("pt-BR");
    if (caminhos.has(chave)) {
      throw new Error(`Caminho repetido na remessa: ${document.caminhoRelativo}.`);
    }
    caminhos.add(chave);
  }

  const porHash = new Map<string, string[]>();
  for (const document of documents) {
    const grupo = porHash.get(document.sha256) ?? [];
    grupo.push(document.caminhoRelativo);
    porHash.set(document.sha256, grupo);
  }
  const duplicateGroups = [...porHash.entries()]
    .filter(([, grupo]) => grupo.length > 1)
    .map(([sha256, grupo]) => ({ sha256, caminhos: grupo.sort() }))
    .sort((a, b) => a.sha256.localeCompare(b.sha256));

  const contagens = new Map<TipoInsumo, number>();
  for (const document of documents) {
    contagens.set(document.tipo, (contagens.get(document.tipo) ?? 0) + 1);
  }
  const countsByType = TIPOS_INSUMO
    .filter((tipo) => contagens.has(tipo))
    .map((tipo) => ({ tipo, quantidade: contagens.get(tipo)! }));
  const expectedDocumentCount = opcoes.expectedDocumentCount ?? null;
  const confirmedComplete = opcoes.confirmedComplete === true;
  const unsupportedDocumentCount = documents.filter(
    (document) => !document.suportadoNoPipeline,
  ).length;

  let status: StatusManifestoInsumo = "PRONTA";
  if (
    expectedDocumentCount !== null &&
    expectedDocumentCount !== documents.length
  ) {
    status = "INCOMPLETA";
  } else if (duplicateGroups.length > 0) {
    status = "DUPLICADA";
  } else if (unsupportedDocumentCount > 0) {
    status = "REQUER_CLASSIFICACAO";
  } else if (!confirmedComplete) {
    status = "PENDENTE_CONFIRMACAO";
  }

  return {
    schemaVersion: "1.0",
    expectedDocumentCount,
    receivedDocumentCount: documents.length,
    confirmedComplete,
    status,
    totalBytes: documents.reduce(
      (total, document) => total + document.tamanhoBytes,
      0,
    ),
    supportedDocumentCount: documents.length - unsupportedDocumentCount,
    unsupportedDocumentCount,
    countsByType,
    duplicateGroups,
    documents,
  };
}
