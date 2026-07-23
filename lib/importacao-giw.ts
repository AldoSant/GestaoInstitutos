import { createHash } from "node:crypto";

export type GiwPessoa = {
  legacyId: string;
  nome: string;
  tipo: "FISICA" | "JURIDICA";
  cpf: string | null;
  cnpj: string | null;
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

export type ValidationIssue = {
  record: number | null;
  field: string;
  message: string;
};

export type ValidationResult = {
  snapshot: GiwSnapshotPessoas | null;
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
