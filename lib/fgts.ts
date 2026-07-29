import { createHash } from "node:crypto";

export const CATEGORIAS_FGTS_MVP = {
  "101": {
    descricao: "Empregado em geral",
    aliquotaNumerador: 8,
    aliquotaDenominador: 100,
  },
  "103": {
    descricao: "Empregado aprendiz",
    aliquotaNumerador: 2,
    aliquotaDenominador: 100,
  },
  "721": {
    descricao: "Diretor não empregado, com FGTS",
    aliquotaNumerador: 8,
    aliquotaDenominador: 100,
  },
} as const;

export type CategoriaFgtsMvp = keyof typeof CATEGORIAS_FGTS_MVP;

export type DecisaoFgts =
  | {
      elegivel: true;
      categoria: CategoriaFgtsMvp;
      descricao: string;
      aliquotaNumerador: number;
      aliquotaDenominador: number;
    }
  | {
      elegivel: false;
      categoria: string | null;
      motivo: string;
      acao: string;
    };

export type ItemApuracaoFgts = {
  trabalhadorReferencia: string;
  categoria: string;
  tipoValor: string;
  baseCalculoCentavos: number;
};

export type ItemFgtsCalculado = ItemApuracaoFgts & {
  aliquotaNumerador: number;
  aliquotaDenominador: number;
  valorFgtsCentavos: number;
};

function inteiroSeguro(valor: number, campo: string) {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new Error(`${campo} deve ser um inteiro não negativo em centavos.`);
  }
  return valor;
}

export function resolverCategoriaFgts(categoriaRecebida: string | null): DecisaoFgts {
  const categoria = categoriaRecebida?.trim() || null;
  if (!categoria) {
    return {
      elegivel: false,
      categoria,
      motivo: "Categoria eSocial ausente.",
      acao: "Classifique o vínculo antes de apurar FGTS.",
    };
  }

  if (categoria === "701") {
    return {
      elegivel: false,
      categoria,
      motivo:
        "Categoria 701 é contribuinte individual/autônomo em geral e não gera depósito mensal de FGTS.",
      acao:
        "Não emita GFD para esse vínculo. Confirme se existe outro vínculo empregatício ou se a obrigação pretendida era previdenciária.",
    };
  }

  if (categoria in CATEGORIAS_FGTS_MVP) {
    const regra = CATEGORIAS_FGTS_MVP[categoria as CategoriaFgtsMvp];
    return {
      elegivel: true,
      categoria: categoria as CategoriaFgtsMvp,
      ...regra,
    };
  }

  return {
    elegivel: false,
    categoria,
    motivo: `Categoria eSocial ${categoria} ainda não foi homologada no módulo FGTS.`,
    acao:
      "Validar a categoria, a incidência das rubricas e a alíquota com o RH/contabilidade antes de habilitar o cálculo.",
  };
}

export function calcularFgtsTruncado(
  baseCalculoCentavos: number,
  aliquotaNumerador: number,
  aliquotaDenominador: number,
) {
  inteiroSeguro(baseCalculoCentavos, "A base de cálculo");
  inteiroSeguro(aliquotaNumerador, "O numerador da alíquota");
  if (!Number.isSafeInteger(aliquotaDenominador) || aliquotaDenominador <= 0) {
    throw new Error("O denominador da alíquota deve ser um inteiro positivo.");
  }

  const resultado =
    (BigInt(baseCalculoCentavos) * BigInt(aliquotaNumerador)) /
    BigInt(aliquotaDenominador);
  if (resultado > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("O valor de FGTS ultrapassa o limite monetário suportado.");
  }
  return Number(resultado);
}

export function calcularItemFgts(item: ItemApuracaoFgts): ItemFgtsCalculado {
  const decisao = resolverCategoriaFgts(item.categoria);
  if (!decisao.elegivel) {
    throw new Error(`${decisao.motivo} ${decisao.acao}`);
  }
  inteiroSeguro(item.baseCalculoCentavos, "A base de cálculo");
  if (!item.trabalhadorReferencia.trim() || !item.tipoValor.trim()) {
    throw new Error("Trabalhador e tipo de valor são obrigatórios na apuração do FGTS.");
  }

  return {
    ...item,
    categoria: decisao.categoria,
    aliquotaNumerador: decisao.aliquotaNumerador,
    aliquotaDenominador: decisao.aliquotaDenominador,
    valorFgtsCentavos: calcularFgtsTruncado(
      item.baseCalculoCentavos,
      decisao.aliquotaNumerador,
      decisao.aliquotaDenominador,
    ),
  };
}

export function consolidarFgtsPorTrabalhador(itens: ItemApuracaoFgts[]) {
  const chaves = new Set<string>();
  const calculados = itens.map((item) => {
    const chave = [
      item.trabalhadorReferencia.trim(),
      item.categoria.trim(),
      item.tipoValor.trim(),
    ].join("|");
    if (chaves.has(chave)) {
      throw new Error(
        `Item de FGTS duplicado para trabalhador, categoria e tipo de valor: ${chave}.`,
      );
    }
    chaves.add(chave);
    return calcularItemFgts(item);
  });

  return {
    itens: calculados,
    baseCalculoCentavos: calculados.reduce(
      (total, item) => total + item.baseCalculoCentavos,
      0,
    ),
    valorFgtsCentavos: calculados.reduce(
      (total, item) => total + item.valorFgtsCentavos,
      0,
    ),
    hash: createHash("sha256")
      .update(
        JSON.stringify(
          [...calculados].sort((a, b) =>
            [
              a.trabalhadorReferencia,
              a.categoria,
              a.tipoValor,
            ].join("|").localeCompare(
              [b.trabalhadorReferencia, b.categoria, b.tipoValor].join("|"),
            ),
          ),
        ),
      )
      .digest("hex"),
  };
}

export function vencimentoNominalFgtsMensal(competencia: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    throw new Error("Competência inválida. Use AAAA-MM.");
  }
  const [ano, mes] = competencia.split("-").map(Number);
  const vencimento = new Date(Date.UTC(ano, mes, 20));
  return vencimento.toISOString().slice(0, 10);
}
