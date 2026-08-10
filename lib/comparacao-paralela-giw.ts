import { decimalParaInteiro } from "./dinheiro";

export type LinhaFolhaParalelaGiw = {
  pessoaLegacyId: string;
  proventos: string;
  descontos: string;
  liquido: string;
  baseInss: string;
  inss: string;
  baseIrrf: string;
  irrf: string;
};

export type LinhaGpsParalelaGiw = {
  pessoaLegacyId: string | null;
  identificador: string | null;
  principal: string;
  total: string;
};

type ValoresFolha = Record<
  "proventos" | "descontos" | "liquido" | "baseInss" | "inss" | "baseIrrf" | "irrf",
  number
>;
type ValoresGps = Record<"principal" | "total", number>;

function valorCentavos(valor: string) {
  return decimalParaInteiro(valor, 2);
}

function somarFolhas(linhas: LinhaFolhaParalelaGiw[]) {
  const resultado = new Map<string, ValoresFolha>();
  for (const linha of linhas) {
    if (!linha.pessoaLegacyId) {
      throw new Error("Comparação de Folha exige a chave legada da Pessoa.");
    }
    const atual = resultado.get(linha.pessoaLegacyId) ?? {
      proventos: 0,
      descontos: 0,
      liquido: 0,
      baseInss: 0,
      inss: 0,
      baseIrrf: 0,
      irrf: 0,
    };
    for (const campo of Object.keys(atual) as Array<keyof ValoresFolha>) {
      atual[campo] += valorCentavos(linha[campo]);
    }
    resultado.set(linha.pessoaLegacyId, atual);
  }
  return resultado;
}

function chaveGps(linha: LinhaGpsParalelaGiw) {
  if (linha.pessoaLegacyId) return `pessoa:${linha.pessoaLegacyId}`;
  if (linha.identificador) return `identificador:${linha.identificador.replace(/\D/g, "")}`;
  throw new Error("Comparação de GPS exige Pessoa legada ou identificador.");
}

function somarGps(linhas: LinhaGpsParalelaGiw[]) {
  const resultado = new Map<string, ValoresGps & { quantidade: number }>();
  for (const linha of linhas) {
    const chave = chaveGps(linha);
    const atual = resultado.get(chave) ?? { principal: 0, total: 0, quantidade: 0 };
    atual.principal += valorCentavos(linha.principal);
    atual.total += valorCentavos(linha.total);
    atual.quantidade += 1;
    resultado.set(chave, atual);
  }
  return resultado;
}

function diferencas<T extends Record<string, number>>(esperado: T, atual: T) {
  return Object.fromEntries(
    Object.keys(esperado).map((campo) => [
      campo,
      (atual[campo] ?? 0) - esperado[campo],
    ]),
  ) as T;
}

export function compararFolhaParalelaGiw(
  esperado: LinhaFolhaParalelaGiw[],
  atual: LinhaFolhaParalelaGiw[],
) {
  const esperadoPorPessoa = somarFolhas(esperado);
  const atualPorPessoa = somarFolhas(atual);
  const chaves = [...new Set([...esperadoPorPessoa.keys(), ...atualPorPessoa.keys()])].sort();
  const itens = chaves.map((pessoaLegacyId) => {
    const valoresEsperados = esperadoPorPessoa.get(pessoaLegacyId) ?? null;
    const valoresAtuais = atualPorPessoa.get(pessoaLegacyId) ?? null;
    const situacao = !valoresEsperados
      ? "AUSENTE_GIW"
      : !valoresAtuais
        ? "AUSENTE_NOVO"
        : Object.values(diferencas(valoresEsperados, valoresAtuais)).every(
              (valor) => valor === 0,
            )
          ? "CONCILIADO"
          : "DIVERGENTE";
    return {
      pessoaLegacyId,
      situacao,
      esperado: valoresEsperados,
      atual: valoresAtuais,
      diferencas:
        valoresEsperados && valoresAtuais
          ? diferencas(valoresEsperados, valoresAtuais)
          : null,
    };
  });
  return {
    itens,
    conciliados: itens.filter((item) => item.situacao === "CONCILIADO").length,
    divergentes: itens.filter((item) => item.situacao !== "CONCILIADO").length,
    aprovado: itens.length > 0 && itens.every((item) => item.situacao === "CONCILIADO"),
  };
}

export function compararGpsParalelaGiw(
  esperado: LinhaGpsParalelaGiw[],
  atual: LinhaGpsParalelaGiw[],
) {
  const esperadoPorChave = somarGps(esperado);
  const atualPorChave = somarGps(atual);
  const chaves = [...new Set([...esperadoPorChave.keys(), ...atualPorChave.keys()])].sort();
  const itens = chaves.map((chave) => {
    const valoresEsperados = esperadoPorChave.get(chave) ?? null;
    const valoresAtuais = atualPorChave.get(chave) ?? null;
    const situacao = !valoresEsperados
      ? "AUSENTE_GIW"
      : !valoresAtuais
        ? "AUSENTE_NOVO"
        : valoresEsperados.quantidade === valoresAtuais.quantidade &&
            valoresEsperados.principal === valoresAtuais.principal &&
            valoresEsperados.total === valoresAtuais.total
          ? "CONCILIADO"
          : "DIVERGENTE";
    return {
      chave,
      situacao,
      esperado: valoresEsperados,
      atual: valoresAtuais,
      diferencas:
        valoresEsperados && valoresAtuais
          ? diferencas(valoresEsperados, valoresAtuais)
          : null,
    };
  });
  return {
    itens,
    conciliados: itens.filter((item) => item.situacao === "CONCILIADO").length,
    divergentes: itens.filter((item) => item.situacao !== "CONCILIADO").length,
    aprovado: itens.length > 0 && itens.every((item) => item.situacao === "CONCILIADO"),
  };
}
