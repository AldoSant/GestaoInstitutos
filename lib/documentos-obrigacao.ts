import { numeroDecimalBrasileiro } from "./importacao-giw";

export type TipoDocumentoObrigacao =
  | "TOTALIZADOR_DCTFWEB"
  | "RECIBO_DCTFWEB"
  | "DARF";

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function uuidValido(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor,
  );
}

function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.valueOf()) && data.toISOString().slice(0, 10) === valor;
}

export function validarDocumentoObrigacao(input: Record<string, unknown>) {
  const erros: string[] = [];
  const obrigacaoId = texto(input.obrigacaoId);
  const tipo = texto(input.tipo) as TipoDocumentoObrigacao;
  const referencia = texto(input.referencia);
  const emitidoEm = texto(input.emitidoEm);
  const localizador = texto(input.localizador);
  const hashSha256 = texto(input.hashSha256).toLowerCase() || null;
  const valorTotal =
    tipo === "RECIBO_DCTFWEB" && !texto(input.valorTotal)
      ? "0.00"
      : numeroDecimalBrasileiro(input.valorTotal);
  const verificado =
    input.verificado === true ||
    input.verificado === "on" ||
    input.verificado === "true";

  if (!uuidValido(obrigacaoId)) erros.push("Obrigação inválida.");
  if (!["TOTALIZADOR_DCTFWEB", "RECIBO_DCTFWEB", "DARF"].includes(tipo)) {
    erros.push("Tipo documental inválido.");
  }
  if (!referencia || referencia.length > 160) {
    erros.push("Referência é obrigatória e deve ter até 160 caracteres.");
  }
  if (!dataValida(emitidoEm)) erros.push("Data de emissão inválida.");
  if (!localizador || localizador.length > 2000) {
    erros.push("Localizador ou protocolo é obrigatório e deve ter até 2.000 caracteres.");
  }
  if (
    valorTotal === null ||
    Number(valorTotal) < 0 ||
    (!texto(input.valorTotal) && tipo !== "RECIBO_DCTFWEB")
  ) {
    erros.push("Valor total deve ser não negativo.");
  }
  if (hashSha256 && !/^[0-9a-f]{64}$/.test(hashSha256)) {
    erros.push("Hash SHA-256 deve possuir 64 caracteres hexadecimais.");
  }
  if (erros.length || valorTotal === null) return { dados: null, erros };
  return {
    dados: {
      obrigacaoId,
      tipo,
      referencia,
      valorTotal,
      emitidoEm,
      localizador,
      hashSha256,
      verificado,
    },
    erros,
  };
}
