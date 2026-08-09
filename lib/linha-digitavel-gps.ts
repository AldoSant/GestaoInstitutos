type DadosGps = {
  codigoReceita: string;
  competencia: string;
  identificador: string;
  totalCentavos: number;
  indicadorLayout?: number;
};

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function modulo11(digitos: string) {
  let soma = 0;
  let peso = 2;
  for (let indice = digitos.length - 1; indice >= 0; indice -= 1) {
    soma += Number(digitos[indice]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resultado = 11 - (soma % 11);
  return resultado >= 10 ? 0 : resultado;
}

/**
 * Reproduz a representação numérica de GPS com código de barras usada pelo
 * legado GIW. O campo livre usa o layout histórico: 02701 + os três últimos
 * dígitos do código + identificador com 14 posições + AAAAMM + indicador.
 */
export function gerarLinhaDigitavelGps(dados: DadosGps) {
  const identificador = somenteDigitos(dados.identificador);
  if (!/^\d{8,14}$/.test(identificador)) {
    throw new Error("GPS exige identificador NIT/PIS/PASEP com 8 a 14 dígitos.");
  }
  if (!/^\d{4}$/.test(dados.codigoReceita)) {
    throw new Error("GPS exige código de receita com quatro dígitos.");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dados.competencia)) {
    throw new Error("GPS exige competência no formato AAAA-MM.");
  }
  if (!Number.isSafeInteger(dados.totalCentavos) || dados.totalCentavos <= 0 || dados.totalCentavos > 99_999_999_999) {
    throw new Error("GPS exige total positivo compatível com a linha digitável.");
  }
  // As 169 GPS únicas fornecidas pelo GIW usam o indicador 3. Ele é parte do
  // layout legado, não uma inferência do número de competências processadas.
  const indicadorLayout = dados.indicadorLayout ?? 3;
  if (!Number.isInteger(indicadorLayout) || indicadorLayout < 0 || indicadorLayout > 9) {
    throw new Error("Indicador de layout inválido para GPS.");
  }

  const campoLivre = [
    "02701",
    dados.codigoReceita.slice(1),
    identificador.padStart(14, "0"),
    dados.competencia.replace("-", ""),
    String(indicadorLayout),
  ].join("");
  const semDacGeral = `858${String(dados.totalCentavos).padStart(11, "0")}${campoLivre}`;
  const codigoBarras = `${semDacGeral.slice(0, 3)}${modulo11(semDacGeral)}${semDacGeral.slice(3)}`;
  if (codigoBarras.length !== 44) {
    throw new Error("Não foi possível compor o código de barras da GPS.");
  }
  const blocos = codigoBarras.match(/.{11}/g);
  if (!blocos || blocos.length !== 4) {
    throw new Error("Não foi possível segmentar a linha digitável da GPS.");
  }
  return blocos.map((bloco) => `${bloco}-${modulo11(bloco)}`).join(" ");
}

export function vencimentoNominalGps(competencia: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 20)).toISOString().slice(0, 10);
}
