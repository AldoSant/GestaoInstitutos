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

export type GiwSnapshot =
  | GiwSnapshotPessoas
  | GiwSnapshotAtividades
  | GiwSnapshotLotacoes;

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
