export type GiwEvento = {
  legacyId: string;
  codigo: string;
  descricao: string;
  natureza: "PROVENTO" | "DESCONTO" | "INFORMATIVO";
  tipoCalculo: "VALOR" | "PERCENTUAL";
  incideInss: boolean;
  incideIrrf: boolean;
  ativo: boolean;
};

export type GiwLancamentoEvento = {
  legacyId: string;
  vinculoLegacyId: string;
  eventoLegacyId: string;
  valor: string;
  inicioCompetencia: string;
  fimCompetencia: string | null;
  ativo: boolean;
};

export type GiwProdutividade = {
  legacyId: string;
  vinculoLegacyId: string;
  competencia: string;
  tipo: "PERCENTUAL" | "QUANTIDADE" | "VALOR";
  valorContratual: string;
  percentual: string | null;
  quantidade: string | null;
  valorUnitario: string | null;
  valorApurado: string;
  evidenciaReferencia: string;
  evidenciaHash: string | null;
  conferente: string;
  observacao: string;
};

type GiwSource<FormId extends string> = {
  system: "GIW";
  formId: FormId;
  extractedAt: string;
  baseUrl?: string;
  captureMethod?: "WEBRUN" | "CSV_FORNECIDO";
  sourceFileName?: string;
  sourceFileSha256?: string;
};

export type GiwSnapshotEventos = {
  schemaVersion: "1.0";
  source: GiwSource<"8716">;
  entity: "eventos";
  records: GiwEvento[];
};

export type GiwSnapshotLancamentosEventos = {
  schemaVersion: "1.0";
  source: GiwSource<"464569425">;
  entity: "lancamentos_eventos";
  records: GiwLancamentoEvento[];
};

export type GiwSnapshotProdutividade = {
  schemaVersion: "1.0";
  source: GiwSource<"464569461">;
  entity: "produtividade";
  records: GiwProdutividade[];
};

export type GiwSnapshotMovimento =
  | GiwSnapshotEventos
  | GiwSnapshotLancamentosEventos
  | GiwSnapshotProdutividade;

export type ProblemaMovimentoGiw = {
  record: number | null;
  field: string;
  message: string;
};

type ResultadoValidacao<T extends GiwSnapshotMovimento> = {
  snapshot: T | null;
  issues: ProblemaMovimentoGiw[];
};

function objeto(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function texto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function booleano(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = texto(value).toLowerCase();
  if (["s", "sim", "true", "1", "ativo"].includes(normalized)) return true;
  if (["n", "não", "nao", "false", "0", "inativo"].includes(normalized)) return false;
  return fallback;
}

function decimal(value: unknown, scale: 2 | 4): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toFixed(scale);
  }
  const original = texto(value);
  if (!original) return null;
  const normalized = original.includes(",")
    ? original.replace(/\./g, "").replace(",", ".")
    : original;
  if (!/^-?\d+(?:\.\d{1,6})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number.toFixed(scale) : null;
}

function dataIso(value: unknown, competencia = false): string | null {
  const original = texto(value);
  if (!original) return null;
  let iso = original;
  const mes = /^(\d{2})\/(\d{4})$/.exec(original);
  if (mes) iso = `${mes[2]}-${mes[1]}-01`;
  const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(original);
  if (brasileira) iso = `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  return competencia && !iso.endsWith("-01") ? null : iso;
}

function problema(
  issues: ProblemaMovimentoGiw[],
  record: number | null,
  field: string,
  message: string,
) {
  issues.push({ record, field, message });
}

function cabecalho(
  value: Record<string, unknown>,
  entity: string,
  formId: string,
  issues: ProblemaMovimentoGiw[],
) {
  if (value.schemaVersion !== "1.0") {
    problema(issues, null, "schemaVersion", "deve ser 1.0");
  }
  if (value.entity !== entity) problema(issues, null, "entity", `deve ser ${entity}`);
  if (!objeto(value.source)) {
    problema(issues, null, "source", "origem ausente ou inválida");
    return null;
  }
  if (value.source.system !== "GIW") problema(issues, null, "source.system", "deve ser GIW");
  if (value.source.formId !== formId) {
    problema(issues, null, "source.formId", `deve ser ${formId}`);
  }
  const extractedAt = texto(value.source.extractedAt);
  if (!extractedAt || Number.isNaN(Date.parse(extractedAt))) {
    problema(issues, null, "source.extractedAt", "data/hora inválida");
  }
  const captureMethod = texto(value.source.captureMethod);
  if (captureMethod && !["WEBRUN", "CSV_FORNECIDO"].includes(captureMethod)) {
    problema(issues, null, "source.captureMethod", "método de captura inválido");
  }
  const sourceFileSha256 = texto(value.source.sourceFileSha256).toLowerCase();
  if (sourceFileSha256 && !/^[a-f0-9]{64}$/.test(sourceFileSha256)) {
    problema(issues, null, "source.sourceFileSha256", "SHA-256 inválido");
  }
  if (!Array.isArray(value.records)) {
    problema(issues, null, "records", "deve ser uma lista");
    return null;
  }
  return {
    extractedAt,
    baseUrl: typeof value.source.baseUrl === "string" ? value.source.baseUrl : undefined,
    captureMethod: captureMethod || undefined,
    sourceFileName: texto(value.source.sourceFileName) || undefined,
    sourceFileSha256: sourceFileSha256 || undefined,
    records: value.records,
  };
}

function validarIdsUnicos(
  records: Array<{ legacyId: string }>,
  issues: ProblemaMovimentoGiw[],
) {
  const ids = new Set<string>();
  records.forEach((record, index) => {
    if (ids.has(record.legacyId)) {
      problema(issues, index + 1, "legacyId", "duplicado no arquivo");
    }
    ids.add(record.legacyId);
  });
}

export function validarSnapshotEventos(value: unknown): ResultadoValidacao<GiwSnapshotEventos> {
  const issues: ProblemaMovimentoGiw[] = [];
  if (!objeto(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  const header = cabecalho(value, "eventos", "8716", issues);
  if (!header) return { snapshot: null, issues };
  const records: GiwEvento[] = [];
  header.records.forEach((raw, index) => {
    const record = index + 1;
    if (!objeto(raw)) {
      problema(issues, record, "registro", "Evento inválido");
      return;
    }
    const legacyId = texto(raw.legacyId);
    const codigo = texto(raw.codigo);
    const descricao = texto(raw.descricao);
    const natureza = texto(raw.natureza).toUpperCase();
    const tipoCalculo = texto(raw.tipoCalculo).toUpperCase() || "VALOR";
    const incideInss = booleano(raw.incideInss);
    const incideIrrf = booleano(raw.incideIrrf);
    if (!legacyId) problema(issues, record, "legacyId", "obrigatório");
    if (!codigo || codigo.length > 40) problema(issues, record, "codigo", "obrigatório, até 40 caracteres");
    if (!descricao || descricao.length > 180) {
      problema(issues, record, "descricao", "obrigatória, até 180 caracteres");
    }
    if (!["PROVENTO", "DESCONTO", "INFORMATIVO"].includes(natureza)) {
      problema(issues, record, "natureza", "valor inválido");
    }
    if (!["VALOR", "PERCENTUAL"].includes(tipoCalculo)) {
      problema(issues, record, "tipoCalculo", "valor inválido");
    }
    if (natureza === "INFORMATIVO" && (incideInss || incideIrrf)) {
      problema(issues, record, "incidencias", "Evento informativo não pode ter incidência");
    }
    if (
      legacyId &&
      codigo &&
      descricao &&
      ["PROVENTO", "DESCONTO", "INFORMATIVO"].includes(natureza) &&
      ["VALOR", "PERCENTUAL"].includes(tipoCalculo)
    ) {
      records.push({
        legacyId,
        codigo,
        descricao,
        natureza: natureza as GiwEvento["natureza"],
        tipoCalculo: tipoCalculo as GiwEvento["tipoCalculo"],
        incideInss,
        incideIrrf,
        ativo: booleano(raw.ativo, true),
      });
    }
  });
  validarIdsUnicos(records, issues);
  const codigos = new Set<string>();
  records.forEach((record, index) => {
    if (codigos.has(record.codigo)) {
      problema(issues, index + 1, "codigo", "duplicado no arquivo");
    }
    codigos.add(record.codigo);
  });
  if (issues.length > 0) return { snapshot: null, issues };
  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "8716",
        extractedAt: header.extractedAt,
        baseUrl: header.baseUrl,
        captureMethod: header.captureMethod as "WEBRUN" | "CSV_FORNECIDO" | undefined,
        sourceFileName: header.sourceFileName,
        sourceFileSha256: header.sourceFileSha256,
      },
      entity: "eventos",
      records,
    },
    issues,
  };
}

export function validarSnapshotLancamentosEventos(
  value: unknown,
): ResultadoValidacao<GiwSnapshotLancamentosEventos> {
  const issues: ProblemaMovimentoGiw[] = [];
  if (!objeto(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  const header = cabecalho(value, "lancamentos_eventos", "464569425", issues);
  if (!header) return { snapshot: null, issues };
  const records: GiwLancamentoEvento[] = [];
  header.records.forEach((raw, index) => {
    const record = index + 1;
    if (!objeto(raw)) {
      problema(issues, record, "registro", "Lançamento inválido");
      return;
    }
    const legacyId = texto(raw.legacyId);
    const vinculoLegacyId = texto(raw.vinculoLegacyId);
    const eventoLegacyId = texto(raw.eventoLegacyId);
    const valor = decimal(raw.valor, 4);
    const inicioCompetencia = dataIso(raw.inicioCompetencia, true);
    const fimCompetencia = raw.fimCompetencia ? dataIso(raw.fimCompetencia, true) : null;
    if (!legacyId) problema(issues, record, "legacyId", "obrigatório");
    if (!vinculoLegacyId) problema(issues, record, "vinculoLegacyId", "obrigatório");
    if (!eventoLegacyId) problema(issues, record, "eventoLegacyId", "obrigatório");
    if (valor === null || Number(valor) < 0) {
      problema(issues, record, "valor", "valor não negativo obrigatório");
    }
    if (!inicioCompetencia) {
      problema(issues, record, "inicioCompetencia", "competência inválida");
    }
    if (raw.fimCompetencia && !fimCompetencia) {
      problema(issues, record, "fimCompetencia", "competência inválida");
    } else if (inicioCompetencia && fimCompetencia && fimCompetencia < inicioCompetencia) {
      problema(issues, record, "fimCompetencia", "anterior ao início");
    }
    if (legacyId && vinculoLegacyId && eventoLegacyId && valor !== null && inicioCompetencia) {
      records.push({
        legacyId,
        vinculoLegacyId,
        eventoLegacyId,
        valor,
        inicioCompetencia,
        fimCompetencia,
        ativo: booleano(raw.ativo, true),
      });
    }
  });
  validarIdsUnicos(records, issues);
  const chavesNaturais = new Set<string>();
  records.forEach((record, index) => {
    const key = `${record.vinculoLegacyId}|${record.eventoLegacyId}|${record.inicioCompetencia}`;
    if (chavesNaturais.has(key)) {
      problema(
        issues,
        index + 1,
        "inicioCompetencia",
        "Vínculo, Evento e início duplicados no arquivo",
      );
    }
    chavesNaturais.add(key);
  });
  if (issues.length > 0) return { snapshot: null, issues };
  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569425",
        extractedAt: header.extractedAt,
        baseUrl: header.baseUrl,
        captureMethod: header.captureMethod as "WEBRUN" | "CSV_FORNECIDO" | undefined,
        sourceFileName: header.sourceFileName,
        sourceFileSha256: header.sourceFileSha256,
      },
      entity: "lancamentos_eventos",
      records,
    },
    issues,
  };
}

export function validarSnapshotProdutividade(
  value: unknown,
): ResultadoValidacao<GiwSnapshotProdutividade> {
  const issues: ProblemaMovimentoGiw[] = [];
  if (!objeto(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  const header = cabecalho(value, "produtividade", "464569461", issues);
  if (!header) return { snapshot: null, issues };
  const records: GiwProdutividade[] = [];
  header.records.forEach((raw, index) => {
    const record = index + 1;
    if (!objeto(raw)) {
      problema(issues, record, "registro", "Produtividade inválida");
      return;
    }
    const legacyId = texto(raw.legacyId);
    const vinculoLegacyId = texto(raw.vinculoLegacyId);
    const competencia = dataIso(raw.competencia, true);
    const tipo = texto(raw.tipo).toUpperCase();
    const valorContratual = decimal(raw.valorContratual, 2);
    const percentual = raw.percentual === null || raw.percentual === "" ? null : decimal(raw.percentual, 4);
    const quantidade = raw.quantidade === null || raw.quantidade === "" ? null : decimal(raw.quantidade, 4);
    const valorUnitario =
      raw.valorUnitario === null || raw.valorUnitario === ""
        ? null
        : decimal(raw.valorUnitario, 4);
    const valorApurado = decimal(raw.valorApurado, 2);
    const evidenciaReferencia =
      texto(raw.evidenciaReferencia) || `GIW produtividade ${legacyId}`;
    const evidenciaHash = texto(raw.evidenciaHash) || null;
    const conferente = texto(raw.conferente) || "Importação GIW";
    if (!legacyId) problema(issues, record, "legacyId", "obrigatório");
    if (!vinculoLegacyId) problema(issues, record, "vinculoLegacyId", "obrigatório");
    if (!competencia) problema(issues, record, "competencia", "competência inválida");
    if (!["PERCENTUAL", "QUANTIDADE", "VALOR"].includes(tipo)) {
      problema(issues, record, "tipo", "tipo inválido");
    }
    for (const [field, valueDecimal] of [
      ["valorContratual", valorContratual],
      ["valorApurado", valorApurado],
    ] as const) {
      if (valueDecimal === null || Number(valueDecimal) < 0) {
        problema(issues, record, field, "valor não negativo obrigatório");
      }
    }
    if (tipo === "PERCENTUAL") {
      if (
        percentual === null ||
        Number(percentual) < 0 ||
        Number(percentual) > 100 ||
        quantidade !== null ||
        valorUnitario !== null
      ) {
        problema(issues, record, "percentual", "campos incompatíveis com PERCENTUAL");
      } else if (
        valorContratual !== null &&
        valorApurado !== null &&
        Math.round(Number(valorContratual) * Number(percentual)) !==
          Math.round(Number(valorApurado) * 100)
      ) {
        problema(issues, record, "valorApurado", "não fecha com o percentual");
      }
    }
    if (tipo === "QUANTIDADE") {
      if (
        percentual !== null ||
        quantidade === null ||
        Number(quantidade) < 0 ||
        valorUnitario === null ||
        Number(valorUnitario) < 0
      ) {
        problema(issues, record, "quantidade", "campos incompatíveis com QUANTIDADE");
      } else if (
        valorApurado !== null &&
        Math.round(Number(quantidade) * Number(valorUnitario) * 100) !==
          Math.round(Number(valorApurado) * 100)
      ) {
        problema(issues, record, "valorApurado", "não fecha com quantidade × valor unitário");
      }
    }
    if (tipo === "VALOR" && (percentual !== null || quantidade !== null || valorUnitario !== null)) {
      problema(issues, record, "tipo", "VALOR não aceita percentual, quantidade ou valor unitário");
    }
    if (evidenciaReferencia.length < 3 || evidenciaReferencia.length > 200) {
      problema(issues, record, "evidenciaReferencia", "deve ter entre 3 e 200 caracteres");
    }
    if (evidenciaHash && !/^[0-9a-f]{64}$/.test(evidenciaHash)) {
      problema(issues, record, "evidenciaHash", "SHA-256 inválido");
    }
    if (conferente.length < 3 || conferente.length > 160) {
      problema(issues, record, "conferente", "deve ter entre 3 e 160 caracteres");
    }
    if (
      legacyId &&
      vinculoLegacyId &&
      competencia &&
      ["PERCENTUAL", "QUANTIDADE", "VALOR"].includes(tipo) &&
      valorContratual !== null &&
      valorApurado !== null
    ) {
      records.push({
        legacyId,
        vinculoLegacyId,
        competencia,
        tipo: tipo as GiwProdutividade["tipo"],
        valorContratual,
        percentual,
        quantidade,
        valorUnitario,
        valorApurado,
        evidenciaReferencia,
        evidenciaHash,
        conferente,
        observacao: texto(raw.observacao),
      });
    }
  });
  validarIdsUnicos(records, issues);
  const competenciasVinculo = new Set<string>();
  records.forEach((record, index) => {
    const key = `${record.vinculoLegacyId}|${record.competencia}`;
    if (competenciasVinculo.has(key)) {
      problema(
        issues,
        index + 1,
        "competencia",
        "Vínculo e competência duplicados no arquivo",
      );
    }
    competenciasVinculo.add(key);
  });
  if (issues.length > 0) return { snapshot: null, issues };
  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569461",
        extractedAt: header.extractedAt,
        baseUrl: header.baseUrl,
        captureMethod: header.captureMethod as "WEBRUN" | "CSV_FORNECIDO" | undefined,
        sourceFileName: header.sourceFileName,
        sourceFileSha256: header.sourceFileSha256,
      },
      entity: "produtividade",
      records,
    },
    issues,
  };
}
