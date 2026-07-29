import { decimalParaInteiro } from "./dinheiro";

export type GpsLegadaExtraida = {
  nome: string;
  codigoPagamento: string;
  competencia: string;
  identificador: string;
  vencimento: string;
  valorInssCentavos: number;
  jurosMultaCentavos: number;
  totalCentavos: number;
  linhaDigitavel: string;
  valorLinhaDigitavelCentavos: number | null;
};

export type ItemFolhaParaConciliacaoGps = {
  nome: string;
  valorInss: string;
};

function dinheiroBrasileiro(valor: string, campo: string) {
  try {
    return decimalParaInteiro(
      valor.replaceAll(".", "").replace(",", "."),
      2,
    );
  } catch {
    throw new Error(`${campo} possui valor monetário inválido.`);
  }
}

function dinheiroDecimal(valor: string, campo: string) {
  try {
    return decimalParaInteiro(valor, 2);
  } catch {
    throw new Error(`${campo} possui valor monetário inválido.`);
  }
}

function capturar(texto: string, expressao: RegExp, campo: string) {
  const resultado = texto.match(expressao)?.[1]?.trim();
  if (!resultado) throw new Error(`Não foi possível localizar ${campo} na GPS.`);
  return resultado;
}

function nomeNormalizado(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toUpperCase();
}

export function valorDaLinhaDigitavelArrecadacao(linhaDigitavel: string) {
  const digitos = linhaDigitavel.replace(/\D/g, "");
  if (digitos.length !== 48) return null;
  const blocos = digitos.match(/.{12}/g);
  if (!blocos || blocos.length !== 4) return null;
  const codigoBarras = blocos.map((bloco) => bloco.slice(0, 11)).join("");
  if (codigoBarras.length !== 44 || codigoBarras[0] !== "8") return null;
  const valor = Number(codigoBarras.slice(4, 15));
  return Number.isSafeInteger(valor) ? valor : null;
}

export function extrairGpsLegadaGiw(textoPagina: string): GpsLegadaExtraida {
  const primeiraVia = textoPagina.split(/cortar nesta linha/i)[0];
  const nomeEValor = primeiraVia.match(
    /1\.?\s*NOME OU RAZÃO SOCIAL\/FONE\/ENDEREÇO:\s*\n6\.\s*VALOR DO INSS\s*\n(.+?)\s+R\$\s*([\d.]+,\d{2})/i,
  );
  if (!nomeEValor) {
    throw new Error("Não foi possível localizar nome e valor do INSS na GPS.");
  }
  const linhaDigitavel = capturar(
    primeiraVia,
    /(\d{11}-\d\s+\d{11}-\d\s+\d{11}-\d\s+\d{11}-\d)/,
    "a linha digitável",
  );
  const valorInssCentavos = dinheiroBrasileiro(nomeEValor[2], "Valor do INSS");
  const jurosMultaCentavos = dinheiroBrasileiro(
    capturar(
      primeiraVia,
      /10\.\s*ATM\/\s*MULTA E\s+R\$\s*([\d.]+,\d{2})/i,
      "juros e multa",
    ),
    "Juros e multa",
  );
  const totalCentavos = dinheiroBrasileiro(
    capturar(
      primeiraVia,
      /11\.\s*TOTAL\s*\n(?:[^\n]*\n)*?.*?R\$\s*([\d.]+,\d{2})/i,
      "o total",
    ),
    "Total",
  );

  return {
    nome: nomeEValor[1].trim(),
    codigoPagamento: capturar(
      primeiraVia,
      /MINISTÉRIO DA PREVIDÊNCIA SOCIAL\s*-\s*MPS\s+(\d{4})/i,
      "o código de pagamento",
    ),
    competencia: capturar(
      primeiraVia,
      /SECRETARIA DA RECEITA PREVIDENCIÁRIA\s*-\s*SRP\s*\n(\d{2}\/\d{4})/i,
      "a competência",
    ),
    identificador: capturar(
      primeiraVia,
      /5\.\s*IDENTIFICADOR\s*\n(\d{8,14})/i,
      "o identificador",
    ),
    vencimento: capturar(
      primeiraVia,
      /2\.\s*VENCIMENTO\s*\n9\.\s*VALOR DE OUTRAS\s*\n(\d{2}\/\d{2}\/\d{4})/i,
      "o vencimento",
    ),
    valorInssCentavos,
    jurosMultaCentavos,
    totalCentavos,
    linhaDigitavel,
    valorLinhaDigitavelCentavos:
      valorDaLinhaDigitavelArrecadacao(linhaDigitavel),
  };
}

function chaveGps(guia: GpsLegadaExtraida) {
  return [
    guia.competencia,
    guia.identificador,
    guia.codigoPagamento,
    guia.totalCentavos,
    guia.linhaDigitavel.replace(/\D/g, ""),
  ].join(":");
}

export function deduplicarGpsLegadas(guias: GpsLegadaExtraida[]) {
  const unicas = new Map<string, GpsLegadaExtraida>();
  let duplicadas = 0;
  for (const guia of guias) {
    const chave = chaveGps(guia);
    if (unicas.has(chave)) {
      duplicadas += 1;
    } else {
      unicas.set(chave, guia);
    }
  }
  return { guias: [...unicas.values()], duplicadas };
}

export function reconciliarGpsLegadasComFolha({
  itens,
  guias,
}: {
  itens: ItemFolhaParaConciliacaoGps[];
  guias: GpsLegadaExtraida[];
}) {
  const folhaComInss = itens
    .map((item) => ({
      ...item,
      nomeNormalizado: nomeNormalizado(item.nome),
      valorInssCentavos: dinheiroDecimal(item.valorInss, `INSS de ${item.nome}`),
    }))
    .filter((item) => item.valorInssCentavos > 0);
  const nomesFolha = new Set<string>();
  for (const item of folhaComInss) {
    if (nomesFolha.has(item.nomeNormalizado)) {
      throw new Error(`A Folha possui mais de um item de INSS para ${item.nome}.`);
    }
    nomesFolha.add(item.nomeNormalizado);
  }

  const deduplicacao = deduplicarGpsLegadas(guias);
  const guiasPorNome = new Map<string, GpsLegadaExtraida>();
  for (const guia of deduplicacao.guias) {
    const chave = nomeNormalizado(guia.nome);
    if (guiasPorNome.has(chave)) {
      throw new Error(`Há mais de uma GPS distinta para ${guia.nome}.`);
    }
    guiasPorNome.set(chave, guia);
  }

  const divergencias: Array<{
    tipo:
      | "ITEM_SEM_GUIA"
      | "GUIA_SEM_ITEM"
      | "VALOR_DIVERGENTE"
      | "TOTAL_INTERNO_DIVERGENTE"
      | "LINHA_DIGITAVEL_DIVERGENTE";
    nome: string;
    detalhe: string;
  }> = [];
  for (const item of folhaComInss) {
    const guia = guiasPorNome.get(item.nomeNormalizado);
    if (!guia) {
      divergencias.push({
        tipo: "ITEM_SEM_GUIA",
        nome: item.nome,
        detalhe: "A Folha possui retenção de INSS sem GPS histórica correspondente.",
      });
      continue;
    }
    if (item.valorInssCentavos !== guia.valorInssCentavos) {
      divergencias.push({
        tipo: "VALOR_DIVERGENTE",
        nome: item.nome,
        detalhe: `Folha ${item.valorInssCentavos} centavos; GPS ${guia.valorInssCentavos} centavos.`,
      });
    }
    if (
      guia.valorInssCentavos + guia.jurosMultaCentavos !==
      guia.totalCentavos
    ) {
      divergencias.push({
        tipo: "TOTAL_INTERNO_DIVERGENTE",
        nome: item.nome,
        detalhe: "O principal e os acréscimos da GPS não fecham com o total.",
      });
    }
    if (
      guia.valorLinhaDigitavelCentavos !== null &&
      guia.valorLinhaDigitavelCentavos !== guia.totalCentavos
    ) {
      divergencias.push({
        tipo: "LINHA_DIGITAVEL_DIVERGENTE",
        nome: item.nome,
        detalhe: "O valor codificado na linha digitável difere do total impresso.",
      });
    }
  }
  for (const [nome, guia] of guiasPorNome) {
    if (!nomesFolha.has(nome)) {
      divergencias.push({
        tipo: "GUIA_SEM_ITEM",
        nome: guia.nome,
        detalhe: "A GPS histórica não possui retenção correspondente na Folha.",
      });
    }
  }

  const totalFolhaCentavos = folhaComInss.reduce(
    (total, item) => total + item.valorInssCentavos,
    0,
  );
  const totalGuiasCentavos = deduplicacao.guias.reduce(
    (total, guia) => total + guia.valorInssCentavos,
    0,
  );
  return {
    itensComInss: folhaComInss.length,
    guiasRecebidas: guias.length,
    guiasUnicas: deduplicacao.guias.length,
    guiasDuplicadas: deduplicacao.duplicadas,
    totalFolhaCentavos,
    totalGuiasCentavos,
    conciliado:
      divergencias.length === 0 &&
      totalFolhaCentavos === totalGuiasCentavos &&
      folhaComInss.length === deduplicacao.guias.length,
    divergencias,
    alertasNormativos: deduplicacao.guias.some(
      (guia) => guia.codigoPagamento === "1007",
    )
      ? [
          "GPS 1007 é evidência legada de recolhimento individual; não deve ser tratada automaticamente como DARF empresarial emitido pela DCTFWeb.",
        ]
      : [],
  };
}
