export type InstrumentoRecolhimentoPrevidenciario =
  | "DCTFWEB_DARF"
  | "GPS_EXCECAO";

export type PerfilRecolhimentoCadastro = {
  instrumento: InstrumentoRecolhimentoPrevidenciario;
  codigoReceita: string | null;
  inicioVigencia: string;
  fimVigencia: string;
  evidencia: string;
  responsavel: string;
};

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.valueOf()) && data.toISOString().slice(0, 10) === valor;
}

export function nomeInstrumentoRecolhimento(
  instrumento: InstrumentoRecolhimentoPrevidenciario,
) {
  return instrumento === "GPS_EXCECAO"
    ? "GPS excepcional"
    : "DCTFWeb / DARF";
}

export function validarPerfilRecolhimento(input: Record<string, unknown>) {
  const erros: string[] = [];
  const instrumento = texto(input.instrumento) as InstrumentoRecolhimentoPrevidenciario;
  const codigoReceita = texto(input.codigoReceita) || null;
  const inicioVigencia = texto(input.inicioVigencia);
  const fimVigencia = texto(input.fimVigencia);
  const evidencia = texto(input.evidencia);
  const responsavel = texto(input.responsavel);

  if (!["DCTFWEB_DARF", "GPS_EXCECAO"].includes(instrumento)) {
    erros.push("Selecione o instrumento de recolhimento.");
  }
  if (!dataValida(inicioVigencia) || !dataValida(fimVigencia)) {
    erros.push("Informe datas de vigência válidas.");
  } else if (fimVigencia < inicioVigencia) {
    erros.push("O fim da vigência não pode ser anterior ao início.");
  }
  if (evidencia.length < 20 || evidencia.length > 3000) {
    erros.push("A fundamentação deve ter entre 20 e 3.000 caracteres.");
  }
  if (responsavel.length < 3 || responsavel.length > 160) {
    erros.push("Informe o responsável pela conferência (3 a 160 caracteres).");
  }
  if (instrumento === "GPS_EXCECAO" && !/^\d{4}$/.test(codigoReceita ?? "")) {
    erros.push("GPS excepcional exige código de receita com quatro dígitos.");
  }
  if (instrumento === "DCTFWEB_DARF" && codigoReceita) {
    erros.push("Código de receita deve ficar vazio para DCTFWeb / DARF.");
  }
  if (erros.length) return { dados: null, erros };
  return {
    dados: {
      instrumento,
      codigoReceita,
      inicioVigencia,
      fimVigencia,
      evidencia,
      responsavel,
    },
    erros,
  };
}
