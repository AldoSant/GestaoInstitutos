import { decimalParaInteiro } from "./dinheiro";

export type ItemDossieObrigacao = {
  id: string;
  natureza: string;
  valor: string;
};

export type DocumentoDossieObrigacao = {
  tipo: string;
  valorTotal: string;
  verificado: boolean;
};

function centavos(valor: string, campo: string) {
  try {
    return decimalParaInteiro(valor, 2);
  } catch {
    throw new Error(`${campo} possui valor monetário inválido.`);
  }
}

export function montarResumoDossieObrigacao({
  status,
  principal,
  juros,
  multa,
  total,
  itens,
  documentos,
  instrumento = "DCTFWEB_DARF",
}: {
  status: string;
  principal: string;
  juros: string;
  multa: string;
  total: string;
  itens: ItemDossieObrigacao[];
  documentos: DocumentoDossieObrigacao[];
  instrumento?: "DCTFWEB_DARF" | "GPS_EXCECAO" | null;
}) {
  if (itens.length === 0) {
    throw new Error("A obrigação não possui itens para o dossiê.");
  }
  const valores = {
    principalCentavos: centavos(principal, "Principal"),
    jurosCentavos: centavos(juros, "Juros"),
    multaCentavos: centavos(multa, "Multa"),
    totalCentavos: centavos(total, "Total"),
  };
  if (
    valores.principalCentavos +
      valores.jurosCentavos +
      valores.multaCentavos !==
    valores.totalCentavos
  ) {
    throw new Error("O total da obrigação não fecha com principal, juros e multa.");
  }
  const naturezas = new Map<string, { itens: number; valorCentavos: number }>();
  const ids = new Set<string>();
  for (const item of itens) {
    if (ids.has(item.id)) {
      throw new Error(`O item ${item.id} está duplicado no dossiê.`);
    }
    ids.add(item.id);
    const atual = naturezas.get(item.natureza) ?? {
      itens: 0,
      valorCentavos: 0,
    };
    atual.itens += 1;
    atual.valorCentavos += centavos(item.valor, `Item ${item.id}`);
    naturezas.set(item.natureza, atual);
  }
  const somaItens = [...naturezas.values()].reduce(
    (totalItens, natureza) => totalItens + natureza.valorCentavos,
    0,
  );
  if (somaItens !== valores.principalCentavos) {
    throw new Error("Os itens previdenciários não fecham com o principal.");
  }
  const verificados = new Set(
    documentos
      .filter((documento) => documento.verificado)
      .map((documento) => documento.tipo),
  );
  const darfValido = documentos.some(
    (documento) =>
      documento.tipo === "DARF" &&
      documento.verificado &&
      centavos(documento.valorTotal, "DARF") === valores.totalCentavos,
  );
  const gpsValida = documentos.some(
    (documento) =>
      documento.tipo === "GPS" &&
      documento.verificado &&
      centavos(documento.valorTotal, "GPS") === valores.totalCentavos,
  );
  if (
    status === "EMITIDA" &&
    instrumento === "GPS_EXCECAO" &&
    !gpsValida
  ) {
    throw new Error("Obrigação emitida sem GPS excepcional verificada e conciliada.");
  }
  if (
    status === "EMITIDA" &&
    instrumento !== "GPS_EXCECAO" &&
    (!verificados.has("TOTALIZADOR_DCTFWEB") ||
      !verificados.has("RECIBO_DCTFWEB") ||
      !darfValido)
  ) {
    throw new Error("Obrigação emitida sem totalizador, recibo e DARF verificados.");
  }
  return {
    ...valores,
    itens: itens.length,
    naturezas: [...naturezas.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([natureza, resumo]) => ({ natureza, ...resumo })),
    documentos: {
      totalizadorVerificado: verificados.has("TOTALIZADOR_DCTFWEB"),
      reciboVerificado: verificados.has("RECIBO_DCTFWEB"),
      darfVerificado: darfValido,
      gpsVerificada: gpsValida,
    },
  };
}
