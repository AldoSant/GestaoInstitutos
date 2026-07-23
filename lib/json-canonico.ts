import { createHash } from "node:crypto";

export function canonicalizarJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizarJson);
  if (value && typeof value === "object") {
    const objeto = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(objeto)
        .sort()
        .map((chave) => [chave, canonicalizarJson(objeto[chave])]),
    );
  }
  return value;
}

export function hashJson(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizarJson(value)))
    .digest("hex");
}
