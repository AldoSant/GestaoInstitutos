import { createHash } from "node:crypto";
import {
  validarSnapshotFolhasHistoricas,
  validarSnapshotGuiasInssHistoricas,
  type GiwFolhaHistorica,
  type GiwFolhaItemHistorico,
  type GiwRubricaHistorica,
  type GiwSnapshotFolhasHistoricas,
  type GiwSnapshotGuiasInssHistoricas,
} from "./migracao-historica";

export type ProblemaConversaoPdf = {
  pagina: number | null;
  campo: string;
  mensagem: string;
};

type OpcoesConversaoPdf = {
  nomeArquivo: string;
  extraidoEm?: string;
  arquivoSha256: string;
};

type ResultadoConversaoPdf<T> = {
  snapshot: T | null;
  issues: ProblemaConversaoPdf[];
};

export type EntradaPreflightPdf = {
  nomeArquivo: string;
  conteudo: Uint8Array;
  texto: string;
};

export type OpcoesPreflightPdf = {
  modo?: "dry-run" | "apply" | "production";
  confirmedComplete?: boolean;
  expectedDocumentCount?: number;
  receivedDocumentCount?: number;
};

export type ItemManifestPdf = {
  filename: string;
  sha256: string;
  documentType: "FOLHA_PAGAMENTO" | "GUIA_PREVIDENCIA_SOCIAL" | "DESCONHECIDO";
  competence: string | null;
};

export type ManifestPreflightPdf = {
  mode: "dry-run" | "apply" | "production";
  expectedDocumentCount: number | null;
  receivedDocumentCount: number;
  documents: ItemManifestPdf[];
};

export type ItemRelatorioPreflightPdf = ItemManifestPdf & {
  status: "VALIDO" | "INVALIDO";
  entity: "folhas_historicas" | "guias_inss_historicas" | null;
  recordCount: number;
  issues: ProblemaConversaoPdf[];
};

export type RelatorioPreflightPdf = {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: ManifestPreflightPdf["mode"];
  expectedDocumentCount: number | null;
  receivedDocumentCount: number;
  summary: {
    validDocumentCount: number;
    invalidDocumentCount: number;
    issueCount: number;
    recordCount: number;
    byDocumentType: Record<ItemManifestPdf["documentType"], number>;
    competences: string[];
  };
  documents: ItemRelatorioPreflightPdf[];
};

export type ResultadoPreflightPdf = {
  manifest: ManifestPreflightPdf;
  report: RelatorioPreflightPdf;
  results: Array<{
    input: EntradaPreflightPdf;
    result: ResultadoConversaoPdf<
      GiwSnapshotFolhasHistoricas | GiwSnapshotGuiasInssHistoricas
    >;
  }>;
};

function dinheiro(texto: string) {
  const match = texto.match(/\d{1,3}(?:\.\d{3})*,\d{2}/);
  return match ? match[0].replace(/\./g, "").replace(",", ".") : "0.00";
}

function centavos(valor: string) {
  return Math.round(Number(valor) * 100);
}

function somar(valores: string[]) {
  return (valores.reduce((total, valor) => total + centavos(valor), 0) / 100).toFixed(2);
}

function competencia(texto: string) {
  const match = texto.match(
    /COMPET[ÊE]NCIA:\s*(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s*\/\s*(\d{4})/i,
  );
  if (!match) return null;
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const mes = meses.indexOf(match[1].toLocaleLowerCase("pt-BR")) + 1;
  return mes > 0 ? `${match[2]}-${String(mes).padStart(2, "0")}-01` : null;
}

function valorNaColuna(linha: string, inicio: number, fim?: number) {
  return dinheiro(linha.slice(inicio, fim));
}

function extrairData(texto: string) {
  const match = texto.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function paginaDaLinha(textoAteLinha: string) {
  return (textoAteLinha.match(/Página\s+\d+\s+de\s+\d+/gi) ?? []).length + 1;
}

export function converterTextoPdfFolhaHistorica(
  texto: string,
  opcoes: OpcoesConversaoPdf,
): {
  snapshot: GiwSnapshotFolhasHistoricas | null;
  issues: ProblemaConversaoPdf[];
} {
  const issues: ProblemaConversaoPdf[] = [];
  if (!/\bFOLHA DE PAGAMENTO\b/i.test(texto)) {
    return {
      snapshot: null,
      issues: [{ pagina: 1, campo: "documento", mensagem: "não é Folha de Pagamento" }],
    };
  }
  const competenciaIso = competencia(texto);
  const parceria = texto.match(/\bPARCERIA\s*:\s*([^\r\n]+)/i)?.[1].trim() ?? "";
  const meta = texto.match(/\bMETA\s*:\s*([^\r\n]+)/i)?.[1].trim() ?? "";
  const lote = texto.match(/\bLOTE:\s*(\d+)/i)?.[1] ?? "";
  const tipo = texto.match(/\bTIPO:\s*(.+)$/mi)?.[1].trim() ?? "";
  if (!competenciaIso) {
    issues.push({ pagina: 1, campo: "competencia", mensagem: "não identificada" });
  }
  if (!parceria) issues.push({ pagina: 1, campo: "parceria", mensagem: "não identificada" });
  if (!meta) issues.push({ pagina: 1, campo: "meta", mensagem: "não identificada" });
  if (!lote) issues.push({ pagina: 1, campo: "lote", mensagem: "não identificado" });

  const linhas = texto.split(/\r?\n/);
  const itens: GiwFolhaItemHistorico[] = [];
  let itemAtual: GiwFolhaItemHistorico | null = null;
  let dataPagamento: string | null = null;
  let colunas: { provento: number; retencao: number; liquido: number } | null = null;

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const linha = linhas[indice];
    if (/^\s*RESUMO\s*$/i.test(linha)) break;
    const cabecalho = linha.match(
      /^\s*(\d+)\s+-\s+(.+?)\s{2,}DATA (ADMISS[ÃA]O|PAGAMENTO):\s*(.*)$/i,
    );
    if (cabecalho) {
      const matricula = cabecalho[1];
      const folhaId = `PDF:${competenciaIso ?? "SEM-COMPETENCIA"}:${lote}:${meta}`;
      itemAtual = {
        legacyId: `${folhaId}:${matricula}`,
        pessoaLegacyId: `MATRICULA:${matricula}`,
        vinculoLegacyId: null,
        matricula,
        nome: cabecalho[2].trim(),
        cpf: null,
        totalProventos: "0.00",
        totalDescontos: "0.00",
        baseInss: "0.00",
        valorInss: "0.00",
        baseIrrf: "0.00",
        valorIrrf: "0.00",
        totalLiquido: "0.00",
        rubricas: [],
      };
      itens.push(itemAtual);
      if (/PAGAMENTO/i.test(cabecalho[3])) {
        dataPagamento = extrairData(cabecalho[4]) ?? dataPagamento;
      }
      colunas = null;
      continue;
    }
    if (!itemAtual) continue;
    const cpf = linha.match(/\bCPF:\s*([\d.-]+)/i)?.[1].replace(/\D/g, "");
    if (cpf?.length === 11) {
      itemAtual.cpf = cpf;
      itemAtual.pessoaLegacyId = `CPF:${cpf}`;
    }
    if (/C[ÓO]DIGO\s+EVENTO\s+REF\s+PROVENTO\s+RETEN[ÇC][ÃA]O/i.test(linha)) {
      colunas = {
        provento: linha.indexOf("PROVENTO"),
        retencao: linha.search(/RETEN[ÇC][ÃA]O/i),
        liquido: linha.search(/VALOR L[ÍI]QUIDO/i),
      };
      continue;
    }
    const credito = linha.match(/DATA DE CR[ÉE]DITO:\s*(.*)$/i);
    if (credito) dataPagamento = extrairData(credito[1]) ?? dataPagamento;
    if (colunas && /^\s*BASES DE C[ÁA]LCULOS/i.test(linha)) {
      const totais = linha.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) ?? [];
      if (totais.length >= 3) {
        itemAtual.totalProventos = dinheiro(totais.at(-3)!);
        itemAtual.totalDescontos = dinheiro(totais.at(-2)!);
        itemAtual.totalLiquido = dinheiro(totais.at(-1)!);
      }
      continue;
    }
    if (/^\s*Retribui[çc][ãa]o\s+INSS\s+IRRF\s+/i.test(linha)) {
      const valores =
        linhas
          .slice(indice + 1, indice + 4)
          .map((proxima) => proxima.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) ?? [])
          .find((candidatos) => candidatos.length >= 3) ?? [];
      if (valores.length >= 3) {
        itemAtual.baseInss = dinheiro(valores[1]);
        itemAtual.baseIrrf = dinheiro(valores[2]);
      }
      continue;
    }
    if (!colunas) continue;
    const evento = linha.slice(0, colunas.provento).match(/^\s*(\d+)\s+(.+?)\s{2,}/);
    if (!evento) continue;
    const provento = valorNaColuna(linha, colunas.provento, colunas.retencao);
    const retencao = valorNaColuna(linha, colunas.retencao, colunas.liquido);
    const natureza: GiwRubricaHistorica["natureza"] =
      centavos(retencao) > 0 ? "DESCONTO" : "PROVENTO";
    const valor = natureza === "DESCONTO" ? retencao : provento;
    if (centavos(valor) === 0) continue;
    const descricao = evento[2].trim();
    const rubrica: GiwRubricaHistorica = {
      legacyId: `${itemAtual.legacyId}:RUBRICA:${evento[1]}`,
      eventoLegacyId: `EVENTO:${evento[1]}`,
      codigo: evento[1],
      descricao,
      natureza,
      referencia: linha.slice(0, colunas.provento).match(/(\d+(?:,\d+)?)\s*(?:dias|%)/i)?.[1] ?? null,
      baseCalculo: "0.00",
      valor,
      incideInss: null,
      incideIrrf: null,
    };
    itemAtual.rubricas.push(rubrica);
    if (/^INSS$/i.test(descricao)) itemAtual.valorInss = valor;
    if (/^IRRF$/i.test(descricao)) itemAtual.valorIrrf = valor;
  }

  if (itens.length === 0) {
    issues.push({ pagina: 1, campo: "itens", mensagem: "nenhum prestador identificado" });
  }
  itens.forEach((item, indice) => {
    const pagina = paginaDaLinha(texto.slice(0, texto.indexOf(item.nome)));
    if (centavos(item.totalProventos) - centavos(item.totalDescontos) !== centavos(item.totalLiquido)) {
      issues.push({
        pagina,
        campo: `itens[${indice}].totalLiquido`,
        mensagem: "não confere com proventos menos retenções",
      });
    }
    if (item.rubricas.length === 0) {
      issues.push({ pagina, campo: `itens[${indice}].rubricas`, mensagem: "nenhuma verba identificada" });
    }
  });
  if (issues.length > 0 || !competenciaIso) return { snapshot: null, issues };

  const folhaId = `PDF:${competenciaIso}:${lote}:${meta}`;
  const record: GiwFolhaHistorica = {
    legacyId: folhaId,
    competencia: competenciaIso,
    numero: lote,
    termoLegacyId: parceria,
    metaLegacyId: meta,
    status: `RELATORIO_${tipo || "DESCONHECIDO"}`.toUpperCase().replace(/\s+/g, "_"),
    dataPagamento,
    totalProventos: somar(itens.map((item) => item.totalProventos)),
    totalDescontos: somar(itens.map((item) => item.totalDescontos)),
    baseInss: somar(itens.map((item) => item.baseInss)),
    valorInss: somar(itens.map((item) => item.valorInss)),
    baseIrrf: somar(itens.map((item) => item.baseIrrf)),
    valorIrrf: somar(itens.map((item) => item.valorIrrf)),
    totalLiquido: somar(itens.map((item) => item.totalLiquido)),
    itens,
  };
  const resumo = texto.slice(texto.search(/^\s*RESUMO\s*$/im));
  const prestadoresResumo = Number(
    resumo.match(/\bPrestadores:\s*(\d+)/i)?.[1] ?? "0",
  );
  if (prestadoresResumo && prestadoresResumo !== itens.length) {
    return {
      snapshot: null,
      issues: [{
        pagina: null,
        campo: "resumo.prestadores",
        mensagem: "diverge da quantidade de itens",
      }],
    };
  }
  const totaisResumo = {
    totalProventos: dinheiro(
      resumo.match(/\bProvento:\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)?.[1] ?? "",
    ),
    totalDescontos: dinheiro(
      resumo.match(/\bReten[çc][ãa]o:\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)?.[1] ?? "",
    ),
    totalLiquido: dinheiro(
      resumo.match(/\bL[íi]quido:\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)?.[1] ?? "",
    ),
  };
  for (const [campo, valorResumo] of Object.entries(totaisResumo)) {
    if (valorResumo !== "0.00" && record[campo as keyof typeof totaisResumo] !== valorResumo) {
      return {
        snapshot: null,
        issues: [{
          pagina: null,
          campo: `resumo.${campo}`,
          mensagem: "diverge da soma dos itens",
        }],
      };
    }
  }
  const extraidoEm = opcoes.extraidoEm?.trim() || new Date().toISOString();
  const validacao = validarSnapshotFolhasHistoricas({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569390",
      extractedAt: extraidoEm,
      captureMethod: "PDF_FORNECIDO",
      sourceFileName: opcoes.nomeArquivo,
      sourceFileSha256: opcoes.arquivoSha256,
    },
    entity: "folhas_historicas",
    records: [record],
  });
  return {
    snapshot: validacao.snapshot,
    issues: validacao.issues.map((issue) => ({
      pagina: issue.record,
      campo: issue.field,
      mensagem: issue.message,
    })),
  };
}

function normalizarBusca(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function trechoDepoisDoRotulo(secao: string, rotulo: string) {
  const linhas = secao.split(/\r?\n/);
  const rotuloNormalizado = normalizarBusca(rotulo);
  const indice = linhas.findIndex((linha) =>
    normalizarBusca(linha).includes(rotuloNormalizado)
  );
  if (indice < 0) return "";
  const coluna = normalizarBusca(linhas[indice]).indexOf(rotuloNormalizado);
  return linhas
    .slice(indice, indice + 4)
    .map((linha) => linha.slice(Math.max(0, coluna - 24)))
    .join(" ");
}

function dinheiroOuNulo(texto: string) {
  const match = texto.match(/\d{1,3}(?:\.\d{3})*,\d{2}/);
  return match ? match[0].replace(/\./g, "").replace(",", ".") : null;
}

function dataBrasileira(texto: string) {
  const match = texto.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function competenciaGps(texto: string) {
  const match = texto.match(/\b(\d{2})\/(\d{4})\b/);
  return match ? `${match[2]}-${match[1]}-01` : null;
}

function classificarDocumentoPdf(texto: string): Pick<ItemManifestPdf, "documentType" | "competence"> {
  if (/\bFOLHA DE PAGAMENTO\b/i.test(texto)) {
    return {
      documentType: "FOLHA_PAGAMENTO",
      competence: competencia(texto),
    };
  }
  if (/GUIA\s+DA\s+PREVID[ÊE]NCIA\s+SOCIAL/i.test(texto)) {
    return {
      documentType: "GUIA_PREVIDENCIA_SOCIAL",
      competence: competenciaGps(trechoDepoisDoRotulo(texto, "COMPETÊNCIA")),
    };
  }
  return { documentType: "DESCONHECIDO", competence: null };
}

export function criarManifestPreflightPdf(
  entradas: EntradaPreflightPdf[],
  opcoes: OpcoesPreflightPdf = {},
): ManifestPreflightPdf {
  const mode = opcoes.modo ?? "dry-run";
  const receivedDocumentCount = opcoes.receivedDocumentCount ?? entradas.length;
  if (receivedDocumentCount !== entradas.length) {
    throw new Error(
      `Contagem recebida (${receivedDocumentCount}) diverge da lista de PDFs (${entradas.length}).`,
    );
  }

  const documents = entradas
    .map((entrada) => ({
      filename: entrada.nomeArquivo,
      sha256: sha256Pdf(entrada.conteudo),
      ...classificarDocumentoPdf(entrada.texto),
    }))
    .sort((a, b) =>
      a.filename < b.filename ? -1 : a.filename > b.filename ? 1 :
        a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0
    );

  const hashes = new Set<string>();
  for (const document of documents) {
    if (hashes.has(document.sha256)) {
      throw new Error(`PDF duplicado pelo SHA-256: ${document.sha256}.`);
    }
    hashes.add(document.sha256);
  }

  if (mode !== "dry-run") {
    if (opcoes.confirmedComplete !== true) {
      throw new Error("Apply/production exige confirmedComplete=true.");
    }
    if (
      opcoes.expectedDocumentCount === undefined ||
      opcoes.expectedDocumentCount !== receivedDocumentCount
    ) {
      throw new Error("Apply/production exige contagens esperada e recebida iguais.");
    }
  }

  return {
    mode,
    expectedDocumentCount: opcoes.expectedDocumentCount ?? null,
    receivedDocumentCount,
    documents,
  };
}

function inteiroMonetario(valor: string) {
  return Math.round(Number(valor) * 100);
}

export function converterTextoPdfGuiasHistoricas(
  texto: string,
  opcoes: OpcoesConversaoPdf,
): ResultadoConversaoPdf<GiwSnapshotGuiasInssHistoricas> {
  const titulo = /GUIA\s+DA\s+PREVID[ÊE]NCIA\s+SOCIAL/gi;
  const inicios: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = titulo.exec(texto))) inicios.push(match.index);
  if (inicios.length === 0) {
    return {
      snapshot: null,
      issues: [{ pagina: 1, campo: "documento", mensagem: "não é uma GPS reconhecida" }],
    };
  }

  const issues: ProblemaConversaoPdf[] = [];
  const candidatos = inicios.map((inicio, indice) =>
    texto.slice(inicio, inicios[indice + 1] ?? texto.length)
  );
  const records = candidatos.flatMap((secao, indice) => {
    const competencia = competenciaGps(trechoDepoisDoRotulo(secao, "COMPETÊNCIA"));
    const identificador =
      trechoDepoisDoRotulo(secao, "IDENTIFICADOR")
        .match(/\b\d[\d.\/-]{5,}\d\b/)?.[0]
        .replace(/\D/g, "") ?? null;
    const codigoReceita =
      trechoDepoisDoRotulo(secao, "CÓDIGO DE PAGAMENTO").match(/\b\d{3,4}\b/)?.[0] ??
      null;
    const vencimento = dataBrasileira(trechoDepoisDoRotulo(secao, "VENCIMENTO"));
    const valorInss = dinheiroOuNulo(trechoDepoisDoRotulo(secao, "VALOR DO INSS"));
    const outrasEntidades =
      dinheiroOuNulo(trechoDepoisDoRotulo(secao, "OUTRAS ENTIDADES")) ?? "0.00";
    const acrescimos =
      dinheiroOuNulo(trechoDepoisDoRotulo(secao, "MULTA")) ?? null;
    const total = dinheiroOuNulo(trechoDepoisDoRotulo(secao, "TOTAL"));

    // Algumas vias repetem somente os campos cadastrais, sem qualquer valor.
    // Elas não são registros autônomos e a via monetária completa é preservada.
    if (valorInss === null && acrescimos === null && total === null) return [];
    const preenchidos = [
      competencia,
      identificador,
      codigoReceita,
      vencimento,
      valorInss,
      acrescimos,
      total,
    ].filter(Boolean).length;
    if (preenchidos < 7) {
      issues.push({
        pagina: Math.floor(indice / 2) + 1,
        campo: "gps",
        mensagem: "cópia preenchida parcialmente",
      });
      return [];
    }
    if (inteiroMonetario(acrescimos!) !== 0) {
      issues.push({
        pagina: Math.floor(indice / 2) + 1,
        campo: "acrescimos",
        mensagem: "GPS combina multa e juros; o modelo exige valores separados",
      });
      return [];
    }
    const principalCentavos =
      inteiroMonetario(valorInss!) + inteiroMonetario(outrasEntidades);
    if (principalCentavos !== inteiroMonetario(total!)) {
      issues.push({
        pagina: Math.floor(indice / 2) + 1,
        campo: "total",
        mensagem: "não fecha com os componentes da GPS",
      });
      return [];
    }
    return [{
      legacyId: `GPS:${competencia}:${identificador}`,
      competencia: competencia!,
      tipo: "GPS" as const,
      status: "EMITIDA",
      identificador,
      codigoReceita,
      vencimento: vencimento!,
      pagamento: null,
      principal: (principalCentavos / 100).toFixed(2),
      juros: "0.00",
      multa: "0.00",
      compensacoes: "0.00",
      total: total!,
      folhaLegacyIds: [],
    }];
  });

  const unicos = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    const existente = unicos.get(record.legacyId);
    if (existente && JSON.stringify(existente) !== JSON.stringify(record)) {
      issues.push({
        pagina: null,
        campo: "legacyId",
        mensagem: "cópias da mesma GPS têm conteúdo divergente",
      });
    } else {
      unicos.set(record.legacyId, record);
    }
  }
  if (unicos.size === 0) {
    issues.push({ pagina: null, campo: "records", mensagem: "nenhuma GPS completa" });
  }
  if (issues.length > 0) return { snapshot: null, issues };

  const validacao = validarSnapshotGuiasInssHistoricas({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569421",
      extractedAt: opcoes.extraidoEm?.trim() || new Date().toISOString(),
      captureMethod: "PDF_FORNECIDO",
      sourceFileName: opcoes.nomeArquivo,
      sourceFileSha256: opcoes.arquivoSha256,
    },
    entity: "guias_inss_historicas",
    records: [...unicos.values()],
  });
  return {
    snapshot: validacao.snapshot,
    issues: validacao.issues.map((issue) => ({
      pagina: issue.record,
      campo: issue.field,
      mensagem: issue.message,
    })),
  };
}

export function converterTextoPdfHistorico(
  texto: string,
  opcoes: OpcoesConversaoPdf,
): ResultadoConversaoPdf<GiwSnapshotFolhasHistoricas | GiwSnapshotGuiasInssHistoricas> {
  if (/\bFOLHA DE PAGAMENTO\b/i.test(texto)) {
    return converterTextoPdfFolhaHistorica(texto, opcoes);
  }
  return converterTextoPdfGuiasHistoricas(texto, opcoes);
}

export function analisarLotePdfHistorico(
  entradas: EntradaPreflightPdf[],
  opcoes: OpcoesPreflightPdf & { extraidoEm?: string } = {},
): ResultadoPreflightPdf {
  const generatedAt = opcoes.extraidoEm?.trim() || new Date().toISOString();
  const manifest = criarManifestPreflightPdf(entradas, opcoes);
  const results = entradas.map((input) => ({
    input,
    result: converterTextoPdfHistorico(input.texto, {
      nomeArquivo: input.nomeArquivo,
      extraidoEm: generatedAt,
      arquivoSha256: sha256Pdf(input.conteudo),
    }),
  }));
  const resultByHash = new Map(
    results.map((item) => [sha256Pdf(item.input.conteudo), item.result]),
  );
  const documents = manifest.documents.map((document): ItemRelatorioPreflightPdf => {
    const result = resultByHash.get(document.sha256);
    if (!result) {
      throw new Error(`Resultado ausente para o SHA-256 ${document.sha256}.`);
    }
    return {
      ...document,
      status: result.snapshot ? "VALIDO" : "INVALIDO",
      entity: result.snapshot?.entity ?? null,
      recordCount: result.snapshot?.records.length ?? 0,
      issues: result.issues,
    };
  });
  const validDocuments = documents.filter((document) => document.status === "VALIDO");
  const byDocumentType: RelatorioPreflightPdf["summary"]["byDocumentType"] = {
    FOLHA_PAGAMENTO: 0,
    GUIA_PREVIDENCIA_SOCIAL: 0,
    DESCONHECIDO: 0,
  };
  for (const document of documents) byDocumentType[document.documentType] += 1;

  return {
    manifest,
    report: {
      schemaVersion: "1.0",
      generatedAt,
      mode: manifest.mode,
      expectedDocumentCount: manifest.expectedDocumentCount,
      receivedDocumentCount: manifest.receivedDocumentCount,
      summary: {
        validDocumentCount: validDocuments.length,
        invalidDocumentCount: documents.length - validDocuments.length,
        issueCount: documents.reduce(
          (total, document) => total + document.issues.length,
          0,
        ),
        recordCount: documents.reduce(
          (total, document) => total + document.recordCount,
          0,
        ),
        byDocumentType,
        competences: [
          ...new Set(
            documents.flatMap((document) =>
              document.competence ? [document.competence] : []
            ),
          ),
        ].sort(),
      },
      documents,
    },
    results,
  };
}

export function sha256Pdf(conteudo: Uint8Array) {
  return createHash("sha256").update(conteudo).digest("hex");
}
