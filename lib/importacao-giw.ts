import { createHash } from "node:crypto";

export type GiwPessoa = {
  legacyId: string;
  nome: string;
  tipo: "FISICA" | "JURIDICA";
  cpf: string | null;
  cnpj: string | null;
};

export type GiwAtividade = {
  legacyId: string;
  descricao: string;
  cargaHoraria: string | null;
  valor: string | null;
  ativo: boolean;
};

export type GiwLotacao = {
  legacyId: string;
  descricao: string;
  ativo: boolean;
};

export type GiwMeta = {
  legacyId: string;
  codigo: string;
  descricao: string;
  tipoCalculo: string | null;
  valorPrevisto: string | null;
  ativo: boolean;
};

export type GiwTermo = {
  legacyId: string;
  numero: string;
  descricao: string;
  modalidade: string;
  inicio: string;
  fim: string | null;
  valorGlobal: string;
  ativo: boolean;
  metas: GiwMeta[];
};

export type GiwVinculo = {
  legacyId: string;
  pessoaLegacyId: string;
  matricula: string;
  termoLegacyId: string;
  metaLegacyId: string;
  atividadeLegacyId: string;
  lotacaoLegacyId: string;
  numeroContrato: string | null;
  inicio: string;
  fim: string | null;
  valorRetribuicao: string;
  cargaHoraria: string | null;
  descontaInss: boolean;
  descontaIrrf: boolean;
  ativo: boolean;
};

export type GiwSnapshotPessoas = {
  schemaVersion: "1.0";
  source: {
    system: "GIW";
    formId: "464569402";
    extractedAt: string;
    baseUrl?: string;
  };
  entity: "pessoas";
  records: GiwPessoa[];
};

export type GiwSnapshotAtividades = {
  schemaVersion: "1.0";
  source: {
    system: "GIW";
    formId: "464569252";
    extractedAt: string;
    baseUrl?: string;
  };
  entity: "atividades";
  records: GiwAtividade[];
};

export type GiwSnapshotLotacoes = {
  schemaVersion: "1.0";
  source: {
    system: "GIW";
    formId: "464569449";
    extractedAt: string;
    baseUrl?: string;
  };
  entity: "lotacoes";
  records: GiwLotacao[];
};

export type GiwSnapshotTermos = {
  schemaVersion: "1.0";
  source: {
    system: "GIW";
    formId: "464569250";
    extractedAt: string;
    baseUrl?: string;
  };
  entity: "termos";
  records: GiwTermo[];
};

export type GiwSnapshotVinculos = {
  schemaVersion: "1.0";
  source: {
    system: "GIW";
    formId: "464569258";
    extractedAt: string;
    baseUrl?: string;
  };
  entity: "vinculos";
  records: GiwVinculo[];
};

export type GiwSnapshot =
  | GiwSnapshotPessoas
  | GiwSnapshotAtividades
  | GiwSnapshotLotacoes
  | GiwSnapshotTermos
  | GiwSnapshotVinculos;

export type ValidationIssue = {
  record: number | null;
  field: string;
  message: string;
};

export type ValidationResult<T extends GiwSnapshot = GiwSnapshotPessoas> = {
  snapshot: T | null;
  issues: ValidationIssue[];
};

function objectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function somenteDigitos(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/\D/g, "");
  return normalized || null;
}

export function numeroDecimalBrasileiro(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;

  const original = String(value).trim();
  if (!original) return null;
  const normalized = original.includes(",")
    ? original.replace(/\./g, "").replace(",", ".")
    : original;
  return /^-?\d+(\.\d+)?$/.test(normalized) ? normalized : null;
}

export function normalizarPessoaGiw(
  value: unknown,
  index: number,
): { pessoa: GiwPessoa | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      pessoa: null,
      issues: [{ record: index, field: "registro", message: "deve ser um objeto" }],
    };
  }

  const legacyId = String(value.legacyId ?? "").trim();
  const nome = String(value.nome ?? "").replace(/\s+/g, " ").trim();
  const cpf = somenteDigitos(value.cpf);
  const cnpj = somenteDigitos(value.cnpj);

  if (!legacyId) {
    issues.push({ record: index, field: "legacyId", message: "é obrigatório" });
  }
  if (!nome) {
    issues.push({ record: index, field: "nome", message: "é obrigatório" });
  }
  if (cpf && cpf.length !== 11) {
    issues.push({ record: index, field: "cpf", message: "deve ter 11 dígitos" });
  }
  if (cnpj && cnpj.length !== 14) {
    issues.push({ record: index, field: "cnpj", message: "deve ter 14 dígitos" });
  }
  if (cpf && cnpj) {
    issues.push({
      record: index,
      field: "documento",
      message: "não pode conter CPF e CNPJ ao mesmo tempo",
    });
  }

  if (issues.length > 0) return { pessoa: null, issues };

  return {
    pessoa: {
      legacyId,
      nome,
      tipo: cnpj ? "JURIDICA" : "FISICA",
      cpf,
      cnpj,
    },
    issues,
  };
}

export function validarSnapshotPessoas(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }

  if (value.schemaVersion !== "1.0") {
    issues.push({
      record: null,
      field: "schemaVersion",
      message: "versão suportada: 1.0",
    });
  }
  if (value.entity !== "pessoas") {
    issues.push({
      record: null,
      field: "entity",
      message: "esta versão importa somente pessoas",
    });
  }
  if (!objectLike(value.source)) {
    issues.push({ record: null, field: "source", message: "é obrigatório" });
  }
  if (!Array.isArray(value.records)) {
    issues.push({ record: null, field: "records", message: "deve ser uma lista" });
  }
  if (issues.length > 0 || !objectLike(value.source) || !Array.isArray(value.records)) {
    return { snapshot: null, issues };
  }

  const records: GiwPessoa[] = [];
  const ids = new Set<string>();
  value.records.forEach((record, index) => {
    const normalized = normalizarPessoaGiw(record, index + 1);
    issues.push(...normalized.issues);
    if (!normalized.pessoa) return;
    if (ids.has(normalized.pessoa.legacyId)) {
      issues.push({
        record: index + 1,
        field: "legacyId",
        message: "duplicado no mesmo arquivo",
      });
      return;
    }
    ids.add(normalized.pessoa.legacyId);
    records.push(normalized.pessoa);
  });

  const extractedAt = String(value.source.extractedAt ?? "");
  if (!extractedAt || Number.isNaN(Date.parse(extractedAt))) {
    issues.push({
      record: null,
      field: "source.extractedAt",
      message: "deve ser uma data ISO válida",
    });
  }
  if (value.source.system !== "GIW") {
    issues.push({ record: null, field: "source.system", message: "deve ser GIW" });
  }
  if (String(value.source.formId ?? "") !== "464569402") {
    issues.push({
      record: null,
      field: "source.formId",
      message: "formulário de pessoas esperado: 464569402",
    });
  }

  if (issues.length > 0) return { snapshot: null, issues };

  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569402",
        extractedAt,
        baseUrl:
          typeof value.source.baseUrl === "string" ? value.source.baseUrl : undefined,
      },
      entity: "pessoas",
      records,
    },
    issues,
  };
}

export function normalizarAtividadeGiw(
  value: unknown,
  index: number,
): { atividade: GiwAtividade | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      atividade: null,
      issues: [{ record: index, field: "registro", message: "deve ser um objeto" }],
    };
  }

  const legacyId = String(value.legacyId ?? "").trim();
  const descricao = String(value.descricao ?? "").replace(/\s+/g, " ").trim();
  const cargaHoraria = numeroDecimalBrasileiro(value.cargaHoraria);
  const valor = numeroDecimalBrasileiro(value.valor);
  const ativo = value.ativo === undefined ? true : value.ativo === true;

  if (!legacyId) {
    issues.push({ record: index, field: "legacyId", message: "é obrigatório" });
  }
  if (!descricao) {
    issues.push({ record: index, field: "descricao", message: "é obrigatória" });
  }
  if (value.cargaHoraria !== null && value.cargaHoraria !== undefined &&
      value.cargaHoraria !== "" && cargaHoraria === null) {
    issues.push({
      record: index,
      field: "cargaHoraria",
      message: "deve ser um número válido",
    });
  }
  if (value.valor !== null && value.valor !== undefined && value.valor !== "" &&
      valor === null) {
    issues.push({ record: index, field: "valor", message: "deve ser um número válido" });
  }
  if (value.ativo !== undefined && typeof value.ativo !== "boolean") {
    issues.push({ record: index, field: "ativo", message: "deve ser booleano" });
  }

  return issues.length > 0
    ? { atividade: null, issues }
    : { atividade: { legacyId, descricao, cargaHoraria, valor, ativo }, issues };
}

export function normalizarLotacaoGiw(
  value: unknown,
  index: number,
): { lotacao: GiwLotacao | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      lotacao: null,
      issues: [{ record: index, field: "registro", message: "deve ser um objeto" }],
    };
  }

  const legacyId = String(value.legacyId ?? "").trim();
  const descricao = String(value.descricao ?? "").replace(/\s+/g, " ").trim();
  const ativo = value.ativo === undefined ? true : value.ativo === true;
  if (!legacyId) {
    issues.push({ record: index, field: "legacyId", message: "é obrigatório" });
  }
  if (!descricao) {
    issues.push({ record: index, field: "descricao", message: "é obrigatória" });
  }
  if (value.ativo !== undefined && typeof value.ativo !== "boolean") {
    issues.push({ record: index, field: "ativo", message: "deve ser booleano" });
  }

  return issues.length > 0
    ? { lotacao: null, issues }
    : { lotacao: { legacyId, descricao, ativo }, issues };
}

function validarCabecalhoCadastro(
  value: unknown,
  entity: "atividades" | "lotacoes",
  formId: "464569252" | "464569449",
) {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      value: null,
      source: null,
      records: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  if (value.schemaVersion !== "1.0") {
    issues.push({ record: null, field: "schemaVersion", message: "versão suportada: 1.0" });
  }
  if (value.entity !== entity) {
    issues.push({ record: null, field: "entity", message: `deve ser ${entity}` });
  }
  const source = objectLike(value.source) ? value.source : null;
  if (!source) issues.push({ record: null, field: "source", message: "é obrigatório" });
  const records = Array.isArray(value.records) ? value.records : null;
  if (!records) issues.push({ record: null, field: "records", message: "deve ser uma lista" });
  if (source) {
    const extractedAt = String(source.extractedAt ?? "");
    if (!extractedAt || Number.isNaN(Date.parse(extractedAt))) {
      issues.push({
        record: null,
        field: "source.extractedAt",
        message: "deve ser uma data ISO válida",
      });
    }
    if (source.system !== "GIW") {
      issues.push({ record: null, field: "source.system", message: "deve ser GIW" });
    }
    if (String(source.formId ?? "") !== formId) {
      issues.push({
        record: null,
        field: "source.formId",
        message: `formulário esperado: ${formId}`,
      });
    }
  }
  return { value, source, records, issues };
}

export function validarSnapshotAtividades(
  value: unknown,
): ValidationResult<GiwSnapshotAtividades> {
  const header = validarCabecalhoCadastro(value, "atividades", "464569252");
  if (!header.value || !header.source || !header.records) {
    return { snapshot: null, issues: header.issues };
  }

  const issues = [...header.issues];
  const records: GiwAtividade[] = [];
  const ids = new Set<string>();
  header.records.forEach((record, index) => {
    const normalized = normalizarAtividadeGiw(record, index + 1);
    issues.push(...normalized.issues);
    if (!normalized.atividade) return;
    if (ids.has(normalized.atividade.legacyId)) {
      issues.push({ record: index + 1, field: "legacyId", message: "duplicado" });
      return;
    }
    ids.add(normalized.atividade.legacyId);
    records.push(normalized.atividade);
  });
  if (issues.length > 0) return { snapshot: null, issues };

  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569252",
        extractedAt: String(header.source.extractedAt),
        baseUrl:
          typeof header.source.baseUrl === "string" ? header.source.baseUrl : undefined,
      },
      entity: "atividades",
      records,
    },
    issues,
  };
}

export function validarSnapshotLotacoes(
  value: unknown,
): ValidationResult<GiwSnapshotLotacoes> {
  const header = validarCabecalhoCadastro(value, "lotacoes", "464569449");
  if (!header.value || !header.source || !header.records) {
    return { snapshot: null, issues: header.issues };
  }

  const issues = [...header.issues];
  const records: GiwLotacao[] = [];
  const ids = new Set<string>();
  header.records.forEach((record, index) => {
    const normalized = normalizarLotacaoGiw(record, index + 1);
    issues.push(...normalized.issues);
    if (!normalized.lotacao) return;
    if (ids.has(normalized.lotacao.legacyId)) {
      issues.push({ record: index + 1, field: "legacyId", message: "duplicado" });
      return;
    }
    ids.add(normalized.lotacao.legacyId);
    records.push(normalized.lotacao);
  });
  if (issues.length > 0) return { snapshot: null, issues };

  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569449",
        extractedAt: String(header.source.extractedAt),
        baseUrl:
          typeof header.source.baseUrl === "string" ? header.source.baseUrl : undefined,
      },
      entity: "lotacoes",
      records,
    },
    issues,
  };
}

export function dataIsoGiw(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? iso
    : null;
}

export function normalizarMetaGiw(
  value: unknown,
  index: number,
): { meta: GiwMeta | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      meta: null,
      issues: [{ record: index, field: "metas", message: "deve conter objetos" }],
    };
  }
  const legacyId = String(value.legacyId ?? "").trim();
  const codigo = String(value.codigo ?? legacyId).replace(/\s+/g, " ").trim();
  const descricao = String(value.descricao ?? "").replace(/\s+/g, " ").trim();
  const tipoCalculo = String(value.tipoCalculo ?? "").replace(/\s+/g, " ").trim() || null;
  const valorPrevisto = numeroDecimalBrasileiro(value.valorPrevisto);
  const ativo = value.ativo === undefined ? true : value.ativo === true;

  if (!legacyId) issues.push({ record: index, field: "metas.legacyId", message: "é obrigatório" });
  if (!codigo) issues.push({ record: index, field: "metas.codigo", message: "é obrigatório" });
  if (!descricao) {
    issues.push({ record: index, field: "metas.descricao", message: "é obrigatória" });
  }
  if (
    value.valorPrevisto !== null &&
    value.valorPrevisto !== undefined &&
    value.valorPrevisto !== "" &&
    valorPrevisto === null
  ) {
    issues.push({
      record: index,
      field: "metas.valorPrevisto",
      message: "deve ser um número válido",
    });
  }
  if (valorPrevisto !== null && Number(valorPrevisto) < 0) {
    issues.push({
      record: index,
      field: "metas.valorPrevisto",
      message: "não pode ser negativo",
    });
  }
  if (value.ativo !== undefined && typeof value.ativo !== "boolean") {
    issues.push({ record: index, field: "metas.ativo", message: "deve ser booleano" });
  }

  return issues.length > 0
    ? { meta: null, issues }
    : {
        meta: { legacyId, codigo, descricao, tipoCalculo, valorPrevisto, ativo },
        issues,
      };
}

export function normalizarTermoGiw(
  value: unknown,
  index: number,
): { termo: GiwTermo | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      termo: null,
      issues: [{ record: index, field: "registro", message: "deve ser um objeto" }],
    };
  }
  const legacyId = String(value.legacyId ?? "").trim();
  const numero = String(value.numero ?? "").replace(/\s+/g, " ").trim();
  const descricao = String(value.descricao ?? "").replace(/\s+/g, " ").trim();
  const modalidade = String(value.modalidade ?? "").replace(/\s+/g, " ").trim();
  const inicio = dataIsoGiw(value.inicio);
  const fim = String(value.fim ?? "").trim() ? dataIsoGiw(value.fim) : null;
  const valorGlobal = numeroDecimalBrasileiro(value.valorGlobal);
  const ativo = value.ativo === undefined ? true : value.ativo === true;
  const metasOriginais = Array.isArray(value.metas) ? value.metas : null;

  if (!legacyId) issues.push({ record: index, field: "legacyId", message: "é obrigatório" });
  if (!numero) issues.push({ record: index, field: "numero", message: "é obrigatório" });
  if (!descricao) issues.push({ record: index, field: "descricao", message: "é obrigatória" });
  if (!modalidade) issues.push({ record: index, field: "modalidade", message: "é obrigatória" });
  if (!inicio) issues.push({ record: index, field: "inicio", message: "deve ser uma data válida" });
  if (String(value.fim ?? "").trim() && !fim) {
    issues.push({ record: index, field: "fim", message: "deve ser uma data válida" });
  }
  if (inicio && fim && fim < inicio) {
    issues.push({ record: index, field: "fim", message: "não pode anteceder o início" });
  }
  if (valorGlobal === null || Number(valorGlobal) < 0) {
    issues.push({
      record: index,
      field: "valorGlobal",
      message: "deve ser um número não negativo",
    });
  }
  if (!metasOriginais) {
    issues.push({ record: index, field: "metas", message: "deve ser uma lista" });
  }
  if (value.ativo !== undefined && typeof value.ativo !== "boolean") {
    issues.push({ record: index, field: "ativo", message: "deve ser booleano" });
  }

  const metas: GiwMeta[] = [];
  const ids = new Set<string>();
  metasOriginais?.forEach((item) => {
    const normalized = normalizarMetaGiw(item, index);
    issues.push(...normalized.issues);
    if (!normalized.meta) return;
    if (ids.has(normalized.meta.legacyId)) {
      issues.push({
        record: index,
        field: "metas.legacyId",
        message: "duplicado no mesmo termo",
      });
      return;
    }
    ids.add(normalized.meta.legacyId);
    metas.push(normalized.meta);
  });

  return issues.length > 0 || !inicio || valorGlobal === null
    ? { termo: null, issues }
    : {
        termo: {
          legacyId,
          numero,
          descricao,
          modalidade,
          inicio,
          fim,
          valorGlobal,
          ativo,
          metas,
        },
        issues,
      };
}

export function validarSnapshotTermos(
  value: unknown,
): ValidationResult<GiwSnapshotTermos> {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  if (value.schemaVersion !== "1.0") {
    issues.push({ record: null, field: "schemaVersion", message: "versão suportada: 1.0" });
  }
  if (value.entity !== "termos") {
    issues.push({ record: null, field: "entity", message: "deve ser termos" });
  }
  const source = objectLike(value.source) ? value.source : null;
  const recordsOriginais = Array.isArray(value.records) ? value.records : null;
  if (!source) issues.push({ record: null, field: "source", message: "é obrigatório" });
  if (!recordsOriginais) {
    issues.push({ record: null, field: "records", message: "deve ser uma lista" });
  }
  if (source) {
    if (source.system !== "GIW") {
      issues.push({ record: null, field: "source.system", message: "deve ser GIW" });
    }
    if (String(source.formId ?? "") !== "464569250") {
      issues.push({
        record: null,
        field: "source.formId",
        message: "formulário esperado: 464569250",
      });
    }
    if (Number.isNaN(Date.parse(String(source.extractedAt ?? "")))) {
      issues.push({
        record: null,
        field: "source.extractedAt",
        message: "deve ser uma data ISO válida",
      });
    }
  }
  if (!source || !recordsOriginais) return { snapshot: null, issues };

  const records: GiwTermo[] = [];
  const termoIds = new Set<string>();
  const metaIds = new Set<string>();
  recordsOriginais.forEach((record, recordIndex) => {
    const normalized = normalizarTermoGiw(record, recordIndex + 1);
    issues.push(...normalized.issues);
    if (!normalized.termo) return;
    if (termoIds.has(normalized.termo.legacyId)) {
      issues.push({
        record: recordIndex + 1,
        field: "legacyId",
        message: "duplicado no mesmo arquivo",
      });
      return;
    }
    termoIds.add(normalized.termo.legacyId);
    normalized.termo.metas.forEach((meta) => {
      if (metaIds.has(meta.legacyId)) {
        issues.push({
          record: recordIndex + 1,
          field: "metas.legacyId",
          message: "duplicado no arquivo",
        });
      }
      metaIds.add(meta.legacyId);
    });
    records.push(normalized.termo);
  });
  if (issues.length > 0) return { snapshot: null, issues };

  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569250",
        extractedAt: String(source.extractedAt),
        baseUrl: typeof source.baseUrl === "string" ? source.baseUrl : undefined,
      },
      entity: "termos",
      records,
    },
    issues,
  };
}

export function normalizarVinculoGiw(
  value: unknown,
  index: number,
): { vinculo: GiwVinculo | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      vinculo: null,
      issues: [{ record: index, field: "registro", message: "deve ser um objeto" }],
    };
  }
  const texto = (field: string) => String(value[field] ?? "").replace(/\s+/g, " ").trim();
  const legacyId = texto("legacyId");
  const pessoaLegacyId = texto("pessoaLegacyId");
  const matricula = texto("matricula");
  const termoLegacyId = texto("termoLegacyId");
  const metaLegacyId = texto("metaLegacyId");
  const atividadeLegacyId = texto("atividadeLegacyId");
  const lotacaoLegacyId = texto("lotacaoLegacyId");
  const numeroContrato = texto("numeroContrato") || null;
  const inicio = dataIsoGiw(value.inicio);
  const fim = texto("fim") ? dataIsoGiw(value.fim) : null;
  const valorRetribuicao = numeroDecimalBrasileiro(value.valorRetribuicao);
  const cargaHoraria = texto("cargaHoraria")
    ? numeroDecimalBrasileiro(value.cargaHoraria)
    : null;
  const descontaInss = value.descontaInss === true;
  const descontaIrrf = value.descontaIrrf === true;
  const ativo = value.ativo === undefined ? true : value.ativo === true;

  for (const [field, fieldValue] of [
    ["legacyId", legacyId],
    ["pessoaLegacyId", pessoaLegacyId],
    ["matricula", matricula],
    ["termoLegacyId", termoLegacyId],
    ["metaLegacyId", metaLegacyId],
    ["atividadeLegacyId", atividadeLegacyId],
    ["lotacaoLegacyId", lotacaoLegacyId],
  ]) {
    if (!fieldValue) issues.push({ record: index, field, message: "é obrigatório" });
  }
  if (matricula.length > 40) {
    issues.push({ record: index, field: "matricula", message: "deve ter até 40 caracteres" });
  }
  if (numeroContrato && numeroContrato.length > 60) {
    issues.push({
      record: index,
      field: "numeroContrato",
      message: "deve ter até 60 caracteres",
    });
  }
  if (!inicio) issues.push({ record: index, field: "inicio", message: "deve ser uma data válida" });
  if (texto("fim") && !fim) {
    issues.push({ record: index, field: "fim", message: "deve ser uma data válida" });
  }
  if (inicio && fim && fim < inicio) {
    issues.push({ record: index, field: "fim", message: "não pode anteceder o início" });
  }
  if (valorRetribuicao === null || Number(valorRetribuicao) < 0) {
    issues.push({
      record: index,
      field: "valorRetribuicao",
      message: "deve ser um número não negativo",
    });
  }
  if (texto("cargaHoraria") && (cargaHoraria === null || Number(cargaHoraria) < 0)) {
    issues.push({
      record: index,
      field: "cargaHoraria",
      message: "deve ser um número não negativo",
    });
  }
  for (const field of ["descontaInss", "descontaIrrf", "ativo"]) {
    if (value[field] !== undefined && typeof value[field] !== "boolean") {
      issues.push({ record: index, field, message: "deve ser booleano" });
    }
  }

  if (issues.length > 0 || !inicio || valorRetribuicao === null) {
    return { vinculo: null, issues };
  }
  return {
    vinculo: {
      legacyId,
      pessoaLegacyId,
      matricula,
      termoLegacyId,
      metaLegacyId,
      atividadeLegacyId,
      lotacaoLegacyId,
      numeroContrato,
      inicio,
      fim,
      valorRetribuicao,
      cargaHoraria,
      descontaInss,
      descontaIrrf,
      ativo,
    },
    issues,
  };
}

export function validarSnapshotVinculos(
  value: unknown,
): ValidationResult<GiwSnapshotVinculos> {
  const issues: ValidationIssue[] = [];
  if (!objectLike(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  const source = objectLike(value.source) ? value.source : null;
  const recordsOriginais = Array.isArray(value.records) ? value.records : null;
  if (value.schemaVersion !== "1.0") {
    issues.push({ record: null, field: "schemaVersion", message: "versão suportada: 1.0" });
  }
  if (value.entity !== "vinculos") {
    issues.push({ record: null, field: "entity", message: "deve ser vinculos" });
  }
  if (!source) issues.push({ record: null, field: "source", message: "é obrigatório" });
  if (!recordsOriginais) {
    issues.push({ record: null, field: "records", message: "deve ser uma lista" });
  }
  if (source) {
    if (source.system !== "GIW") {
      issues.push({ record: null, field: "source.system", message: "deve ser GIW" });
    }
    if (String(source.formId ?? "") !== "464569258") {
      issues.push({
        record: null,
        field: "source.formId",
        message: "formulário esperado: 464569258",
      });
    }
    if (Number.isNaN(Date.parse(String(source.extractedAt ?? "")))) {
      issues.push({
        record: null,
        field: "source.extractedAt",
        message: "deve ser uma data ISO válida",
      });
    }
  }
  if (!source || !recordsOriginais) return { snapshot: null, issues };

  const records: GiwVinculo[] = [];
  const ids = new Set<string>();
  recordsOriginais.forEach((record, index) => {
    const normalized = normalizarVinculoGiw(record, index + 1);
    issues.push(...normalized.issues);
    if (!normalized.vinculo) return;
    if (ids.has(normalized.vinculo.legacyId)) {
      issues.push({
        record: index + 1,
        field: "legacyId",
        message: "duplicado no mesmo arquivo",
      });
      return;
    }
    ids.add(normalized.vinculo.legacyId);
    records.push(normalized.vinculo);
  });
  if (issues.length > 0) return { snapshot: null, issues };

  return {
    snapshot: {
      schemaVersion: "1.0",
      source: {
        system: "GIW",
        formId: "464569258",
        extractedAt: String(source.extractedAt),
        baseUrl: typeof source.baseUrl === "string" ? source.baseUrl : undefined,
      },
      entity: "vinculos",
      records,
    },
    issues,
  };
}

export function validarSnapshotGiw(value: unknown): ValidationResult<GiwSnapshot> {
  if (!objectLike(value)) {
    return {
      snapshot: null,
      issues: [{ record: null, field: "arquivo", message: "JSON inválido" }],
    };
  }
  if (value.entity === "pessoas") return validarSnapshotPessoas(value);
  if (value.entity === "atividades") return validarSnapshotAtividades(value);
  if (value.entity === "lotacoes") return validarSnapshotLotacoes(value);
  if (value.entity === "termos") return validarSnapshotTermos(value);
  if (value.entity === "vinculos") return validarSnapshotVinculos(value);
  return {
    snapshot: null,
    issues: [{ record: null, field: "entity", message: "entidade não suportada" }],
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!objectLike(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  );
}

export function checksum(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
