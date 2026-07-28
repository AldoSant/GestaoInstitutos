import { decimalParaInteiro } from "./dinheiro";

type LinhaAtual = {
  id: string;
  total_proventos: string;
  total_descontos: string;
  valor_inss: string;
  valor_irrf: string;
  total_liquido: string;
  snapshots: unknown;
};

type Objeto = Record<string, unknown>;

export type LinhaLegado = {
  matricula: string;
  nome: string;
  proventosCentavos: number;
  inssCentavos: number;
  irrfCentavos: number;
  descontosCentavos: number;
  liquidoCentavos: number;
};

const ALIASES = {
  matricula: ["matricula", "matrícula", "registro"],
  nome: ["nome", "prestador", "nome_prestador"],
  proventos: ["total_proventos", "proventos", "bruto", "total_bruto"],
  inss: ["inss", "valor_inss"],
  irrf: ["irrf", "valor_irrf"],
  descontos: ["total_descontos", "descontos"],
  liquido: ["liquido", "líquido", "valor_liquido", "valor_líquido"],
} as const;

function objeto(valor: unknown): Objeto {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Objeto)
    : {};
}

function texto(valor: unknown) {
  return typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
}

function normalizarCabecalho(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function detectarSeparador(primeiraLinha: string) {
  const pontoVirgula = [...primeiraLinha].filter((c) => c === ";").length;
  const virgula = [...primeiraLinha].filter((c) => c === ",").length;
  return pontoVirgula >= virgula ? ";" : ",";
}

function separarCsv(conteudo: string, separador: string) {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (caractere === '"') {
      if (aspas && conteudo[indice + 1] === '"') {
        celula += '"';
        indice += 1;
      } else {
        aspas = !aspas;
      }
    } else if (caractere === separador && !aspas) {
      linha.push(celula);
      celula = "";
    } else if ((caractere === "\n" || caractere === "\r") && !aspas) {
      if (caractere === "\r" && conteudo[indice + 1] === "\n") indice += 1;
      linha.push(celula);
      if (linha.some((valor) => valor.trim())) linhas.push(linha);
      linha = [];
      celula = "";
    } else {
      celula += caractere;
    }
  }
  if (aspas) throw new Error("O CSV possui aspas não encerradas.");
  linha.push(celula);
  if (linha.some((valor) => valor.trim())) linhas.push(linha);
  return linhas;
}

function indiceColuna(cabecalhos: string[], aliases: readonly string[]) {
  const normalizados = aliases.map(normalizarCabecalho);
  return cabecalhos.findIndex((item) => normalizados.includes(item));
}

function valorMonetario(valor: string, campo: string, linha: number) {
  let normalizado = valor
    .replace(/\u00a0/g, " ")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .trim();
  if (!normalizado) {
    throw new Error(`Linha ${linha}: ${campo} não informado.`);
  }
  if (/^\(.+\)$/.test(normalizado)) {
    normalizado = `-${normalizado.slice(1, -1)}`;
  }
  if (normalizado.includes(",") && normalizado.includes(".")) {
    normalizado = normalizado.replaceAll(".", "").replace(",", ".");
  } else if (normalizado.includes(",")) {
    normalizado = normalizado.replace(",", ".");
  }
  const centavos = decimalParaInteiro(normalizado, 2);
  if (centavos < 0) {
    throw new Error(`Linha ${linha}: ${campo} não pode ser negativo.`);
  }
  return centavos;
}

export function lerCsvFolhaLegado(conteudoOriginal: string) {
  const conteudo = conteudoOriginal.replace(/^\uFEFF/, "");
  if (!conteudo.trim()) throw new Error("O arquivo de homologação está vazio.");
  const primeiraLinha = conteudo.split(/\r?\n/, 1)[0];
  const separador = detectarSeparador(primeiraLinha);
  const matriz = separarCsv(conteudo, separador);
  if (matriz.length < 2) {
    throw new Error("O CSV deve possuir cabeçalho e pelo menos uma linha.");
  }
  if (matriz.length > 10_001) {
    throw new Error("O CSV excede o limite de 10.000 prestadores.");
  }

  const cabecalhos = matriz[0].map(normalizarCabecalho);
  const indices = {
    matricula: indiceColuna(cabecalhos, ALIASES.matricula),
    nome: indiceColuna(cabecalhos, ALIASES.nome),
    proventos: indiceColuna(cabecalhos, ALIASES.proventos),
    inss: indiceColuna(cabecalhos, ALIASES.inss),
    irrf: indiceColuna(cabecalhos, ALIASES.irrf),
    descontos: indiceColuna(cabecalhos, ALIASES.descontos),
    liquido: indiceColuna(cabecalhos, ALIASES.liquido),
  };
  for (const [campo, indice] of Object.entries(indices)) {
    if (campo !== "nome" && indice < 0) {
      throw new Error(`Coluna obrigatória ausente: ${campo}.`);
    }
  }

  const matriculas = new Set<string>();
  return matriz.slice(1).map((colunas, indice) => {
    const numeroLinha = indice + 2;
    const matricula = texto(colunas[indices.matricula]);
    if (!matricula || matricula.length > 80) {
      throw new Error(`Linha ${numeroLinha}: matrícula inválida.`);
    }
    if (matriculas.has(matricula)) {
      throw new Error(`Matrícula duplicada no CSV: ${matricula}.`);
    }
    matriculas.add(matricula);
    const nome = indices.nome >= 0 ? texto(colunas[indices.nome]).slice(0, 180) : "";
    return {
      matricula,
      nome,
      proventosCentavos: valorMonetario(
        colunas[indices.proventos] ?? "",
        "proventos",
        numeroLinha,
      ),
      inssCentavos: valorMonetario(
        colunas[indices.inss] ?? "",
        "INSS",
        numeroLinha,
      ),
      irrfCentavos: valorMonetario(
        colunas[indices.irrf] ?? "",
        "IRRF",
        numeroLinha,
      ),
      descontosCentavos: valorMonetario(
        colunas[indices.descontos] ?? "",
        "descontos",
        numeroLinha,
      ),
      liquidoCentavos: valorMonetario(
        colunas[indices.liquido] ?? "",
        "líquido",
        numeroLinha,
      ),
    };
  });
}

function moedaAtual(valor: string) {
  return decimalParaInteiro(valor, 2);
}

export function compararFolhaComLegado(
  legado: LinhaLegado[],
  atuais: LinhaAtual[],
) {
  const mapaLegado = new Map(legado.map((linha) => [linha.matricula, linha]));
  const mapaAtual = new Map<
    string,
    LinhaAtual & { matricula: string; nome: string }
  >();
  for (const atual of atuais) {
    const snapshots = objeto(atual.snapshots);
    const prestador = objeto(snapshots.prestador);
    const pessoa = objeto(snapshots.pessoa);
    const matricula = texto(prestador.matricula);
    if (!matricula) throw new Error("Item da Folha atual sem matrícula congelada.");
    if (mapaAtual.has(matricula)) {
      throw new Error(`Matrícula duplicada na Folha atual: ${matricula}.`);
    }
    mapaAtual.set(matricula, {
      ...atual,
      matricula,
      nome: texto(pessoa.nome),
    });
  }

  const chaves = [...new Set([...mapaLegado.keys(), ...mapaAtual.keys()])].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  const itens = chaves.map((matricula) => {
    const esperado = mapaLegado.get(matricula);
    const atual = mapaAtual.get(matricula);
    const valoresEsperados = {
      proventos: esperado?.proventosCentavos ?? 0,
      inss: esperado?.inssCentavos ?? 0,
      irrf: esperado?.irrfCentavos ?? 0,
      descontos: esperado?.descontosCentavos ?? 0,
      liquido: esperado?.liquidoCentavos ?? 0,
    };
    const valoresAtuais = {
      proventos: atual ? moedaAtual(atual.total_proventos) : 0,
      inss: atual ? moedaAtual(atual.valor_inss) : 0,
      irrf: atual ? moedaAtual(atual.valor_irrf) : 0,
      descontos: atual ? moedaAtual(atual.total_descontos) : 0,
      liquido: atual ? moedaAtual(atual.total_liquido) : 0,
    };
    const diferencas = {
      proventos: valoresAtuais.proventos - valoresEsperados.proventos,
      inss: valoresAtuais.inss - valoresEsperados.inss,
      irrf: valoresAtuais.irrf - valoresEsperados.irrf,
      descontos: valoresAtuais.descontos - valoresEsperados.descontos,
      liquido: valoresAtuais.liquido - valoresEsperados.liquido,
    };
    const situacao = !esperado
      ? "AUSENTE_LEGADO"
      : !atual
        ? "AUSENTE_NOVO"
        : Object.values(diferencas).every((valor) => valor === 0)
          ? "CONCILIADO"
          : "DIVERGENTE";
    return {
      matricula,
      nome: esperado?.nome || atual?.nome || "",
      folhaItemId: atual?.id ?? null,
      situacao,
      esperado: valoresEsperados,
      atual: valoresAtuais,
      diferencas,
    };
  });

  const somar = (
    seletor: (item: (typeof itens)[number]) => Record<string, number>,
  ) =>
    itens.reduce(
      (total, item) => {
        const valor = seletor(item);
        for (const chave of Object.keys(total) as Array<keyof typeof total>) {
          total[chave] += valor[chave];
        }
        return total;
      },
      { proventos: 0, inss: 0, irrf: 0, descontos: 0, liquido: 0 },
    );

  return {
    itens,
    totaisEsperados: somar((item) => item.esperado),
    totaisAtuais: somar((item) => item.atual),
    diferencas: somar((item) => item.diferencas),
    conciliados: itens.filter((item) => item.situacao === "CONCILIADO").length,
    divergentes: itens.filter((item) => item.situacao !== "CONCILIADO").length,
  };
}

export const MODELO_CSV_HOMOLOGACAO =
  "\uFEFFmatricula;nome;total_proventos;inss;irrf;total_descontos;liquido\r\n" +
  'EXEMPLO-001;"Prestador de exemplo";0,00;0,00;0,00;0,00;0,00\r\n';
