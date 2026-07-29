import { hashJson } from "./json-canonico";

export type GiwRubricaHistorica = {
  legacyId: string;
  eventoLegacyId: string | null;
  codigo: string;
  descricao: string;
  natureza: "PROVENTO" | "DESCONTO" | "INFORMATIVO";
  referencia: string | null;
  baseCalculo: string;
  valor: string;
  incideInss: boolean | null;
  incideIrrf: boolean | null;
};

export type GiwFolhaItemHistorico = {
  legacyId: string;
  pessoaLegacyId: string;
  vinculoLegacyId: string | null;
  matricula: string;
  nome: string;
  cpf: string | null;
  cnpj: string | null;
  totalProventos: string;
  totalDescontos: string;
  baseInss: string;
  valorInss: string;
  baseIrrf: string;
  valorIrrf: string;
  totalLiquido: string;
  rubricas: GiwRubricaHistorica[];
};

export type GiwFolhaHistorica = {
  legacyId: string;
  competencia: string;
  numero: string;
  termoLegacyId: string | null;
  metaLegacyId: string | null;
  status: string;
  dataPagamento: string | null;
  totalProventos: string;
  totalDescontos: string;
  baseInss: string;
  valorInss: string;
  baseIrrf: string;
  valorIrrf: string;
  totalLiquido: string;
  itens: GiwFolhaItemHistorico[];
};

export type GiwGuiaInssHistorica = {
  legacyId: string;
  competencia: string;
  tipo: "GPS" | "DARF_PREVIDENCIARIO" | "DCTFWEB";
  status: string;
  identificador: string | null;
  pessoaLegacyId: string | null;
  beneficiarioNome: string | null;
  lote: string | null;
  codigoReceita: string | null;
  vencimento: string;
  pagamento: string | null;
  principal: string;
  juros: string;
  multa: string;
  compensacoes: string;
  total: string;
  folhaLegacyIds: string[];
};

type GiwSource<FormId extends string> = {
  system: "GIW";
  formId: FormId;
  extractedAt: string;
  baseUrl?: string;
  captureMethod?: "WEBRUN" | "CSV_FORNECIDO" | "PDF_FORNECIDO";
  sourceFileName?: string;
  sourceFileSha256?: string;
};

export type GiwSnapshotFolhasHistoricas = {
  schemaVersion: "1.0";
  source: GiwSource<"464569390">;
  entity: "folhas_historicas";
  records: GiwFolhaHistorica[];
};

export type GiwSnapshotGuiasInssHistoricas = {
  schemaVersion: "1.0";
  source: GiwSource<"464569421">;
  entity: "guias_inss_historicas";
  records: GiwGuiaInssHistorica[];
};

export type ProblemaSnapshotHistorico = {
  record: number | null;
  field: string;
  message: string;
};

type ResultadoValidacao<T> = {
  snapshot: T | null;
  issues: ProblemaSnapshotHistorico[];
};

function objeto(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function digitos(value: unknown): string | null {
  const valueText = texto(value);
  if (!valueText) return null;
  const normalized = valueText.replace(/\D/g, "");
  return normalized || null;
}

function dataIso(value: unknown, competencia = false): string | null {
  const valueText = texto(value);
  if (!valueText) return null;
  let iso = valueText;
  const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valueText);
  if (brasileira) iso = `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
  const mes = /^(\d{2})\/(\d{4})$/.exec(valueText);
  if (mes) iso = `${mes[2]}-${mes[1]}-01`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  if (competencia && !iso.endsWith("-01")) return null;
  return iso;
}

function decimal(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toFixed(2);
  }
  const valueText = texto(value);
  if (!valueText) return null;
  const normalized = valueText.includes(",")
    ? valueText.replace(/\./g, "").replace(",", ".")
    : valueText;
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number.toFixed(2) : null;
}

function centavos(value: string): number {
  return Math.round(Number(value) * 100);
}

function booleanoOuNulo(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = texto(value).toLowerCase();
  if (["s", "sim", "true", "1"].includes(normalized)) return true;
  if (["n", "não", "nao", "false", "0"].includes(normalized)) return false;
  return null;
}

function problema(
  issues: ProblemaSnapshotHistorico[],
  record: number | null,
  field: string,
  message: string,
) {
  issues.push({ record, field, message });
}

function validarCabecalho(
  value: Record<string, unknown>,
  entity: string,
  formId: string,
  issues: ProblemaSnapshotHistorico[],
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
  if (
    captureMethod &&
    !["WEBRUN", "CSV_FORNECIDO", "PDF_FORNECIDO"].includes(captureMethod)
  ) {
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

function normalizarRubrica(
  value: unknown,
  record: number,
  item: number,
  index: number,
  issues: ProblemaSnapshotHistorico[],
): GiwRubricaHistorica | null {
  const prefix = `itens[${item}].rubricas[${index}]`;
  if (!objeto(value)) {
    problema(issues, record, prefix, "rubrica inválida");
    return null;
  }
  const legacyId = texto(value.legacyId);
  const codigo = texto(value.codigo);
  const descricao = texto(value.descricao);
  const natureza = texto(value.natureza).toUpperCase();
  const baseCalculo = decimal(value.baseCalculo);
  const valor = decimal(value.valor);
  if (!legacyId) problema(issues, record, `${prefix}.legacyId`, "obrigatório");
  if (!codigo) problema(issues, record, `${prefix}.codigo`, "obrigatório");
  if (!descricao) problema(issues, record, `${prefix}.descricao`, "obrigatório");
  if (!["PROVENTO", "DESCONTO", "INFORMATIVO"].includes(natureza)) {
    problema(issues, record, `${prefix}.natureza`, "valor inválido");
  }
  if (baseCalculo === null || centavos(baseCalculo) < 0) {
    problema(issues, record, `${prefix}.baseCalculo`, "valor não negativo obrigatório");
  }
  if (valor === null || centavos(valor) < 0) {
    problema(issues, record, `${prefix}.valor`, "valor não negativo obrigatório");
  }
  if (
    !legacyId ||
    !codigo ||
    !descricao ||
    !["PROVENTO", "DESCONTO", "INFORMATIVO"].includes(natureza) ||
    baseCalculo === null ||
    valor === null
  ) {
    return null;
  }
  return {
    legacyId,
    eventoLegacyId: texto(value.eventoLegacyId) || null,
    codigo,
    descricao,
    natureza: natureza as GiwRubricaHistorica["natureza"],
    referencia: texto(value.referencia) || null,
    baseCalculo,
    valor,
    incideInss: booleanoOuNulo(value.incideInss),
    incideIrrf: booleanoOuNulo(value.incideIrrf),
  };
}

function normalizarItemFolha(
  value: unknown,
  record: number,
  index: number,
  issues: ProblemaSnapshotHistorico[],
): GiwFolhaItemHistorico | null {
  const prefix = `itens[${index}]`;
  if (!objeto(value)) {
    problema(issues, record, prefix, "item inválido");
    return null;
  }
  const legacyId = texto(value.legacyId);
  const pessoaLegacyId = texto(value.pessoaLegacyId);
  const matricula = texto(value.matricula);
  const nome = texto(value.nome);
  const cpf = digitos(value.cpf);
  const cnpj = digitos(value.cnpj);
  const campos = [
    "totalProventos",
    "totalDescontos",
    "baseInss",
    "valorInss",
    "baseIrrf",
    "valorIrrf",
    "totalLiquido",
  ] as const;
  const valores = Object.fromEntries(campos.map((field) => [field, decimal(value[field])])) as Record<
    (typeof campos)[number],
    string | null
  >;
  if (!legacyId) problema(issues, record, `${prefix}.legacyId`, "obrigatório");
  if (!pessoaLegacyId) problema(issues, record, `${prefix}.pessoaLegacyId`, "obrigatório");
  if (!matricula) problema(issues, record, `${prefix}.matricula`, "obrigatório");
  if (!nome) problema(issues, record, `${prefix}.nome`, "obrigatório");
  if (cpf && cpf.length !== 11) problema(issues, record, `${prefix}.cpf`, "deve ter 11 dígitos");
  if (cnpj && cnpj.length !== 14) {
    problema(issues, record, `${prefix}.cnpj`, "deve ter 14 dígitos");
  }
  if (cpf && cnpj) {
    problema(issues, record, `${prefix}.documento`, "CPF e CNPJ são mutuamente exclusivos");
  }
  for (const field of campos) {
    if (valores[field] === null || centavos(valores[field] ?? "0") < 0) {
      problema(issues, record, `${prefix}.${field}`, "valor não negativo obrigatório");
    }
  }
  if (
    valores.totalProventos !== null &&
    valores.totalDescontos !== null &&
    valores.totalLiquido !== null &&
    centavos(valores.totalLiquido) !==
      centavos(valores.totalProventos) - centavos(valores.totalDescontos)
  ) {
    problema(issues, record, `${prefix}.totalLiquido`, "não fecha com proventos menos descontos");
  }
  if (!Array.isArray(value.rubricas)) {
    problema(issues, record, `${prefix}.rubricas`, "deve ser uma lista");
  }
  const rubricas = Array.isArray(value.rubricas)
    ? value.rubricas
        .map((rubrica, rubricaIndex) =>
          normalizarRubrica(rubrica, record, index, rubricaIndex, issues),
        )
        .filter((rubrica): rubrica is GiwRubricaHistorica => Boolean(rubrica))
    : [];
  const rubricaIds = new Set<string>();
  rubricas.forEach((rubrica, rubricaIndex) => {
    if (rubricaIds.has(rubrica.legacyId)) {
      problema(
        issues,
        record,
        `${prefix}.rubricas[${rubricaIndex}].legacyId`,
        "duplicado no item",
      );
    }
    rubricaIds.add(rubrica.legacyId);
  });
  if (
    !legacyId ||
    !pessoaLegacyId ||
    !matricula ||
    !nome ||
    campos.some((field) => valores[field] === null)
  ) {
    return null;
  }
  return {
    legacyId,
    pessoaLegacyId,
    vinculoLegacyId: texto(value.vinculoLegacyId) || null,
    matricula,
    nome,
    cpf,
    cnpj,
    totalProventos: valores.totalProventos!,
    totalDescontos: valores.totalDescontos!,
    baseInss: valores.baseInss!,
    valorInss: valores.valorInss!,
    baseIrrf: valores.baseIrrf!,
    valorIrrf: valores.valorIrrf!,
    totalLiquido: valores.totalLiquido!,
    rubricas,
  };
}

function somar(itens: GiwFolhaItemHistorico[], field: keyof GiwFolhaItemHistorico) {
  return itens.reduce((total, item) => total + centavos(String(item[field])), 0);
}

export function validarSnapshotFolhasHistoricas(
  value: unknown,
): ResultadoValidacao<GiwSnapshotFolhasHistoricas> {
  const issues: ProblemaSnapshotHistorico[] = [];
  if (!objeto(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  const header = validarCabecalho(value, "folhas_historicas", "464569390", issues);
  if (!header) return { snapshot: null, issues };
  const ids = new Set<string>();
  const records: GiwFolhaHistorica[] = [];
  header.records.forEach((raw, index) => {
    const record = index + 1;
    if (!objeto(raw)) {
      problema(issues, record, "registro", "folha inválida");
      return;
    }
    const legacyId = texto(raw.legacyId);
    const competencia = dataIso(raw.competencia, true);
    const numero = texto(raw.numero);
    const status = texto(raw.status) || "DESCONHECIDO";
    const dataPagamento = dataIso(raw.dataPagamento);
    const campos = [
      "totalProventos",
      "totalDescontos",
      "baseInss",
      "valorInss",
      "baseIrrf",
      "valorIrrf",
      "totalLiquido",
    ] as const;
    const valores = Object.fromEntries(campos.map((field) => [field, decimal(raw[field])])) as Record<
      (typeof campos)[number],
      string | null
    >;
    if (!legacyId) problema(issues, record, "legacyId", "obrigatório");
    else if (ids.has(legacyId)) problema(issues, record, "legacyId", "duplicado no arquivo");
    else ids.add(legacyId);
    if (!competencia) problema(issues, record, "competencia", "competência mensal inválida");
    if (!numero) problema(issues, record, "numero", "obrigatório");
    for (const field of campos) {
      if (valores[field] === null || centavos(valores[field] ?? "0") < 0) {
        problema(issues, record, field, "valor não negativo obrigatório");
      }
    }
    if (!Array.isArray(raw.itens) || raw.itens.length === 0) {
      problema(issues, record, "itens", "deve conter ao menos um item");
    }
    const itens = Array.isArray(raw.itens)
      ? raw.itens
          .map((item, itemIndex) => normalizarItemFolha(item, record, itemIndex, issues))
          .filter((item): item is GiwFolhaItemHistorico => Boolean(item))
      : [];
    const itemIds = new Set<string>();
    itens.forEach((item, itemIndex) => {
      if (itemIds.has(item.legacyId)) {
        problema(
          issues,
          record,
          `itens[${itemIndex}].legacyId`,
          "duplicado na folha",
        );
      }
      itemIds.add(item.legacyId);
    });
    if (itens.length > 0) {
      for (const field of campos) {
        if (valores[field] !== null && somar(itens, field) !== centavos(valores[field]!)) {
          problema(issues, record, field, "não confere com a soma dos itens");
        }
      }
    }
    if (
      legacyId &&
      competencia &&
      numero &&
      itens.length > 0 &&
      campos.every((field) => valores[field] !== null)
    ) {
      records.push({
        legacyId,
        competencia,
        numero,
        termoLegacyId: texto(raw.termoLegacyId) || null,
        metaLegacyId: texto(raw.metaLegacyId) || null,
        status,
        dataPagamento,
        totalProventos: valores.totalProventos!,
        totalDescontos: valores.totalDescontos!,
        baseInss: valores.baseInss!,
        valorInss: valores.valorInss!,
        baseIrrf: valores.baseIrrf!,
        valorIrrf: valores.valorIrrf!,
        totalLiquido: valores.totalLiquido!,
        itens,
      });
    }
  });
  if (issues.length > 0) return { snapshot: null, issues };
  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569390",
        extractedAt: header.extractedAt,
        baseUrl: header.baseUrl,
        captureMethod: header.captureMethod as
          | "WEBRUN"
          | "CSV_FORNECIDO"
          | "PDF_FORNECIDO"
          | undefined,
        sourceFileName: header.sourceFileName,
        sourceFileSha256: header.sourceFileSha256,
      },
      entity: "folhas_historicas",
      records,
    },
    issues,
  };
}

export function validarSnapshotGuiasInssHistoricas(
  value: unknown,
): ResultadoValidacao<GiwSnapshotGuiasInssHistoricas> {
  const issues: ProblemaSnapshotHistorico[] = [];
  if (!objeto(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  const header = validarCabecalho(value, "guias_inss_historicas", "464569421", issues);
  if (!header) return { snapshot: null, issues };
  const ids = new Set<string>();
  const records: GiwGuiaInssHistorica[] = [];
  header.records.forEach((raw, index) => {
    const record = index + 1;
    if (!objeto(raw)) {
      problema(issues, record, "registro", "guia inválida");
      return;
    }
    const legacyId = texto(raw.legacyId);
    const competencia = dataIso(raw.competencia, true);
    const tipo = texto(raw.tipo).toUpperCase();
    const status = texto(raw.status) || "DESCONHECIDO";
    const vencimento = dataIso(raw.vencimento);
    const pagamento = dataIso(raw.pagamento);
    const campos = ["principal", "juros", "multa", "compensacoes", "total"] as const;
    const valores = Object.fromEntries(campos.map((field) => [field, decimal(raw[field])])) as Record<
      (typeof campos)[number],
      string | null
    >;
    if (!legacyId) problema(issues, record, "legacyId", "obrigatório");
    else if (ids.has(legacyId)) problema(issues, record, "legacyId", "duplicado no arquivo");
    else ids.add(legacyId);
    if (!competencia) problema(issues, record, "competencia", "competência mensal inválida");
    if (!["GPS", "DARF_PREVIDENCIARIO", "DCTFWEB"].includes(tipo)) {
      problema(issues, record, "tipo", "tipo de guia inválido");
    }
    if (!vencimento) problema(issues, record, "vencimento", "data inválida");
    for (const field of campos) {
      if (valores[field] === null || centavos(valores[field] ?? "0") < 0) {
        problema(issues, record, field, "valor não negativo obrigatório");
      }
    }
    if (
      campos.every((field) => valores[field] !== null) &&
      centavos(valores.total!) !==
        centavos(valores.principal!) +
          centavos(valores.juros!) +
          centavos(valores.multa!) -
          centavos(valores.compensacoes!)
    ) {
      problema(issues, record, "total", "não fecha com principal, acréscimos e compensações");
    }
    const folhaLegacyIds = Array.isArray(raw.folhaLegacyIds)
      ? [...new Set(raw.folhaLegacyIds.map(texto).filter(Boolean))]
      : [];
    if (
      legacyId &&
      competencia &&
      vencimento &&
      ["GPS", "DARF_PREVIDENCIARIO", "DCTFWEB"].includes(tipo) &&
      campos.every((field) => valores[field] !== null)
    ) {
      records.push({
        legacyId,
        competencia,
        tipo: tipo as GiwGuiaInssHistorica["tipo"],
        status,
        identificador: texto(raw.identificador) || null,
        pessoaLegacyId: texto(raw.pessoaLegacyId) || null,
        beneficiarioNome: texto(raw.beneficiarioNome) || null,
        lote: texto(raw.lote) || null,
        codigoReceita: texto(raw.codigoReceita) || null,
        vencimento,
        pagamento,
        principal: valores.principal!,
        juros: valores.juros!,
        multa: valores.multa!,
        compensacoes: valores.compensacoes!,
        total: valores.total!,
        folhaLegacyIds,
      });
    }
  });
  if (issues.length > 0) return { snapshot: null, issues };
  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569421",
        extractedAt: header.extractedAt,
        baseUrl: header.baseUrl,
        captureMethod: header.captureMethod as
          | "WEBRUN"
          | "CSV_FORNECIDO"
          | "PDF_FORNECIDO"
          | undefined,
        sourceFileName: header.sourceFileName,
        sourceFileSha256: header.sourceFileSha256,
      },
      entity: "guias_inss_historicas",
      records,
    },
    issues,
  };
}

export type TotaisCompetenciaHistorica = {
  folhas: number;
  pessoas: number;
  proventosCentavos: number;
  descontosCentavos: number;
  liquidoCentavos: number;
  baseInssCentavos: number;
  inssCentavos: number;
  guias: number;
  guiasCentavos: number;
};

export function resumirCompetenciaHistorica(
  folhas: GiwFolhaHistorica[],
  guias: GiwGuiaInssHistorica[],
): TotaisCompetenciaHistorica {
  return {
    folhas: folhas.length,
    pessoas: new Set(folhas.flatMap((folha) => folha.itens.map((item) => item.pessoaLegacyId)))
      .size,
    proventosCentavos: folhas.reduce(
      (total, folha) => total + centavos(folha.totalProventos),
      0,
    ),
    descontosCentavos: folhas.reduce(
      (total, folha) => total + centavos(folha.totalDescontos),
      0,
    ),
    liquidoCentavos: folhas.reduce(
      (total, folha) => total + centavos(folha.totalLiquido),
      0,
    ),
    baseInssCentavos: folhas.reduce((total, folha) => total + centavos(folha.baseInss), 0),
    inssCentavos: folhas.reduce((total, folha) => total + centavos(folha.valorInss), 0),
    guias: guias.length,
    guiasCentavos: guias.reduce((total, guia) => total + centavos(guia.total), 0),
  };
}

export function hashRegistroHistorico(value: GiwFolhaHistorica | GiwGuiaInssHistorica) {
  return hashJson(value);
}
