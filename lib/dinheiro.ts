const MAXIMO_SEGURO = BigInt(Number.MAX_SAFE_INTEGER);

function potenciaDeDez(expoente: number) {
  return 10n ** BigInt(expoente);
}

function dividirArredondando(
  numerador: bigint,
  denominador: bigint,
): bigint {
  if (denominador <= 0n) {
    throw new RangeError("O denominador deve ser positivo.");
  }
  const sinal = numerador < 0n ? -1n : 1n;
  const absoluto = numerador < 0n ? -numerador : numerador;
  const quociente = absoluto / denominador;
  const resto = absoluto % denominador;
  const arredondado =
    resto * 2n >= denominador ? quociente + 1n : quociente;
  return arredondado * sinal;
}

function inteiroSeguro(valor: bigint, campo: string) {
  const absoluto = valor < 0n ? -valor : valor;
  if (absoluto > MAXIMO_SEGURO) {
    throw new RangeError(`${campo} excede o limite numérico seguro.`);
  }
  return Number(valor);
}

export function paraCentavos(valor: number) {
  if (!Number.isFinite(valor)) {
    throw new RangeError("O valor monetário deve ser um número finito.");
  }

  const negativo = valor < 0;
  const texto = Math.abs(valor).toString().toLowerCase();
  const [coeficiente, expoenteTexto = "0"] = texto.split("e");
  const [inteira, fracionaria = ""] = coeficiente.split(".");
  const digitos = BigInt(`${inteira}${fracionaria}` || "0");
  const expoente = Number(expoenteTexto);
  const deslocamento = expoente - fracionaria.length + 2;
  const absoluto =
    deslocamento >= 0
      ? digitos * potenciaDeDez(deslocamento)
      : dividirArredondando(digitos, potenciaDeDez(-deslocamento));
  return inteiroSeguro(negativo ? -absoluto : absoluto, "valor monetário");
}

export function deCentavos(valor: number) {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError("Centavos devem ser representados por um inteiro seguro.");
  }
  return valor / 100;
}

export function aplicarProporcao(
  valor: number,
  numerador: number,
  denominador: number,
) {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError("O valor-base deve ser um inteiro seguro.");
  }
  if (!Number.isSafeInteger(numerador)) {
    throw new RangeError("O numerador deve ser um inteiro seguro.");
  }
  if (!Number.isSafeInteger(denominador) || denominador <= 0) {
    throw new RangeError("O denominador deve ser um inteiro positivo.");
  }
  return inteiroSeguro(
    dividirArredondando(
      BigInt(valor) * BigInt(numerador),
      BigInt(denominador),
    ),
    "resultado monetário",
  );
}

export function aplicarFormulaLinear({
  valor,
  numerador,
  denominador,
  parcela,
}: {
  valor: number;
  numerador: number;
  denominador: number;
  parcela: number;
}) {
  if (
    !Number.isSafeInteger(valor) ||
    !Number.isSafeInteger(numerador) ||
    !Number.isSafeInteger(denominador) ||
    denominador <= 0 ||
    !Number.isSafeInteger(parcela)
  ) {
    throw new RangeError("A fórmula monetária exige inteiros seguros.");
  }
  const resultado =
    BigInt(valor) * BigInt(numerador) -
    BigInt(parcela) * BigInt(denominador);
  return inteiroSeguro(
    dividirArredondando(resultado, BigInt(denominador)),
    "resultado monetário",
  );
}
