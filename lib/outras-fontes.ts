import { numeroDecimalBrasileiro, somenteDigitos } from "./importacao-giw";

export type OutraFonteCadastro = {
  prestadorId: string;
  competencia: string;
  fontePagadora: string;
  documentoFonte: string;
  remuneracao: string;
  inssDedutivelIrrf: string;
  irrfRetido: string;
  baseContribuicao: string;
  valorContribuicao: string;
  documentoReferencia: string;
  comprovanteVerificado: boolean;
  observacao: string | null;
};

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function uuidValido(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor,
  );
}

function moedaNaoNegativa(valor: unknown, campo: string, erros: string[]) {
  const normalizado = numeroDecimalBrasileiro(valor);
  if (normalizado === null || Number(normalizado) < 0) {
    erros.push(`${campo} deve ser um valor monetário não negativo.`);
    return null;
  }
  return Number(normalizado).toFixed(2);
}

export function validarOutraFonte(input: Record<string, unknown>) {
  const erros: string[] = [];
  const prestadorId = texto(input.prestadorId);
  const competencia = texto(input.competencia);
  const fontePagadora = texto(input.fontePagadora);
  const documentoFonte = somenteDigitos(input.documentoFonte) ?? "";
  const documentoReferencia = texto(input.documentoReferencia);
  const observacao = texto(input.observacao) || null;
  const remuneracao = moedaNaoNegativa(input.remuneracao, "Remuneração", erros);
  const inssDedutivelIrrf = moedaNaoNegativa(
    input.inssDedutivelIrrf || "0",
    "INSS dedutível no IRRF",
    erros,
  );
  const irrfRetido = moedaNaoNegativa(
    input.irrfRetido || "0",
    "IRRF já retido pela fonte",
    erros,
  );
  const baseContribuicao = moedaNaoNegativa(
    input.baseContribuicao,
    "Base de contribuição",
    erros,
  );
  const valorContribuicao = moedaNaoNegativa(
    input.valorContribuicao,
    "Contribuição retida",
    erros,
  );

  if (!uuidValido(prestadorId)) erros.push("Prestador inválido.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    erros.push("Competência deve usar o formato AAAA-MM.");
  }
  if (!fontePagadora || fontePagadora.length > 180) {
    erros.push("Fonte pagadora é obrigatória e deve ter até 180 caracteres.");
  }
  if (![11, 14].includes(documentoFonte.length)) {
    erros.push("CPF/CNPJ da fonte pagadora deve possuir 11 ou 14 dígitos.");
  }
  if (!documentoReferencia || documentoReferencia.length > 160) {
    erros.push("Referência do comprovante é obrigatória e deve ter até 160 caracteres.");
  }
  if (observacao && observacao.length > 2000) {
    erros.push("Observação deve ter até 2.000 caracteres.");
  }
  if (
    baseContribuicao !== null &&
    valorContribuicao !== null &&
    Number(valorContribuicao) > Number(baseContribuicao)
  ) {
    erros.push("A contribuição retida não pode superar sua base.");
  }

  if (
    erros.length ||
    remuneracao === null ||
    inssDedutivelIrrf === null ||
    irrfRetido === null ||
    baseContribuicao === null ||
    valorContribuicao === null
  ) {
    return { dados: null, erros };
  }
  return {
    dados: {
      prestadorId,
      competencia,
      fontePagadora,
      documentoFonte,
      remuneracao,
      inssDedutivelIrrf,
      irrfRetido,
      baseContribuicao,
      valorContribuicao,
      documentoReferencia,
      comprovanteVerificado:
        input.comprovanteVerificado === true ||
        input.comprovanteVerificado === "on" ||
        input.comprovanteVerificado === "true",
      observacao,
    } satisfies OutraFonteCadastro,
    erros,
  };
}
