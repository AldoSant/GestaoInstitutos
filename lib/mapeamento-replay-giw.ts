export type MapeamentoReplayGiw = {
  folhaLegacyId: string;
  itemLegacyId: string;
  vinculoId: string;
  confirmadoPor: string;
  justificativa: string;
};

export type ArquivoMapeamentoReplayGiw = {
  schemaVersion: "1.0";
  source: "MAPEAMENTO_HISTORICO_CONFIRMADO";
  empresaId: string;
  mappings: MapeamentoReplayGiw[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function texto(valor: unknown, campo: string, maximo: number) {
  if (typeof valor !== "string" || !valor.trim() || valor.trim().length > maximo) {
    throw new Error(`${campo} é obrigatório e deve ter até ${maximo} caracteres.`);
  }
  return valor.trim();
}

function id(valor: unknown, campo: string) {
  const resultado = texto(valor, campo, 100);
  if (!uuid.test(resultado)) throw new Error(`${campo} deve ser um UUID válido.`);
  return resultado;
}

/**
 * Valida o arquivo que associa um item imutável do espelho GIW a um Vínculo
 * existente. A associação é deliberadamente por item, nunca por aproximação de
 * nome: a evidência histórica não trazia o ID interno do Vínculo.
 */
export function validarArquivoMapeamentoReplayGiw(valor: unknown): ArquivoMapeamentoReplayGiw {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw new Error("O mapeamento deve ser um objeto JSON.");
  }
  const bruto = valor as Record<string, unknown>;
  if (bruto.schemaVersion !== "1.0") throw new Error("schemaVersion deve ser 1.0.");
  if (bruto.source !== "MAPEAMENTO_HISTORICO_CONFIRMADO") {
    throw new Error("source deve ser MAPEAMENTO_HISTORICO_CONFIRMADO.");
  }
  const empresaId = id(bruto.empresaId, "empresaId");
  if (!Array.isArray(bruto.mappings) || bruto.mappings.length === 0) {
    throw new Error("mappings deve conter ao menos um item.");
  }

  const chaves = new Set<string>();
  const mappings = bruto.mappings.map((item, indice) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`mappings[${indice}] é inválido.`);
    }
    const linha = item as Record<string, unknown>;
    const folhaLegacyId = texto(linha.folhaLegacyId, `mappings[${indice}].folhaLegacyId`, 100);
    const itemLegacyId = texto(linha.itemLegacyId, `mappings[${indice}].itemLegacyId`, 100);
    const chave = `${folhaLegacyId}/${itemLegacyId}`;
    if (chaves.has(chave)) throw new Error(`O item histórico ${chave} foi informado mais de uma vez.`);
    chaves.add(chave);
    return {
      folhaLegacyId,
      itemLegacyId,
      vinculoId: id(linha.vinculoId, `mappings[${indice}].vinculoId`),
      confirmadoPor: texto(linha.confirmadoPor, `mappings[${indice}].confirmadoPor`, 160),
      justificativa: texto(linha.justificativa, `mappings[${indice}].justificativa`, 1_000),
    };
  });
  return { schemaVersion: "1.0", source: "MAPEAMENTO_HISTORICO_CONFIRMADO", empresaId, mappings };
}

export function chaveMapeamentoReplayGiw(mapeamento: Pick<MapeamentoReplayGiw, "folhaLegacyId" | "itemLegacyId">) {
  return `${mapeamento.folhaLegacyId}/${mapeamento.itemLegacyId}`;
}
