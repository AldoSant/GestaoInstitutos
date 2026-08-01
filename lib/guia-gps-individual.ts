import { numeroDecimalBrasileiro } from "./importacao-giw";

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

/** Valida a evidência de uma GPS já emitida no canal oficial, sem criar guia. */
export function validarRegistroGuiaGpsIndividual(input: Record<string, unknown>) {
  const erros: string[] = [];
  const guiaId = texto(input.guiaId);
  const referencia = texto(input.referencia);
  const emitidoEm = texto(input.emitidoEm);
  const localizador = texto(input.localizador);
  const hashSha256 = texto(input.hashSha256).toLowerCase() || null;
  const juros = numeroDecimalBrasileiro(input.juros) ?? "0.00";
  const multa = numeroDecimalBrasileiro(input.multa) ?? "0.00";
  const verificado =
    input.verificado === true || input.verificado === "on" || input.verificado === "true";

  if (!uuidValido(guiaId)) erros.push("Guia GPS inválida.");
  if (!referencia || referencia.length > 160) {
    erros.push("Referência ou número da GPS é obrigatório e deve ter até 160 caracteres.");
  }
  if (!dataValida(emitidoEm)) erros.push("Data de emissão inválida.");
  if (!localizador || localizador.length > 2000) {
    erros.push("Localizador do documento é obrigatório e deve ter até 2.000 caracteres.");
  }
  if (Number(juros) < 0 || Number(multa) < 0) {
    erros.push("Juros e multa não podem ser negativos.");
  }
  if (hashSha256 && !/^[0-9a-f]{64}$/.test(hashSha256)) {
    erros.push("Hash SHA-256 deve possuir 64 caracteres hexadecimais.");
  }
  if (!verificado) {
    erros.push("Confirme que a GPS foi conferida no canal oficial antes de registrá-la.");
  }
  if (erros.length) return { dados: null, erros };
  return {
    dados: { guiaId, referencia, emitidoEm, localizador, hashSha256, juros, multa, verificado },
    erros,
  };
}
