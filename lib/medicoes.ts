import { aplicarProporcao, decimalParaInteiro } from "./dinheiro";
import { numeroDecimalBrasileiro } from "./importacao-giw";

export type TipoMedicaoMensal = "PERCENTUAL" | "QUANTIDADE" | "VALOR";

function texto(valor: unknown) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function competencia(valor: unknown) {
  const textoValor = texto(valor);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(textoValor)) {
    throw new Error("Competência da medição deve usar o formato AAAA-MM.");
  }
  return `${textoValor}-01`;
}

function inteiroDecimal(valor: unknown, escala: number, campo: string) {
  const normalizado = numeroDecimalBrasileiro(valor);
  if (normalizado === null) throw new Error(`${campo} inválido.`);
  const inteiro = decimalParaInteiro(normalizado, escala);
  if (inteiro < 0) throw new Error(`${campo} não pode ser negativo.`);
  return inteiro;
}

function decimalCanonico(valor: number, escala: number) {
  if (!Number.isSafeInteger(valor)) throw new Error("Valor decimal inseguro.");
  const base = 10 ** escala;
  const inteira = Math.floor(valor / base);
  const fracao = String(valor % base).padStart(escala, "0");
  return `${inteira}.${fracao}`;
}

export function validarMedicaoMensal(entrada: {
  competencia: unknown;
  tipo: unknown;
  valorContratual: string;
  percentual?: unknown;
  quantidade?: unknown;
  valorUnitario?: unknown;
  valor?: unknown;
  evidenciaReferencia?: unknown;
  evidenciaHash?: unknown;
  conferente?: unknown;
  observacao?: unknown;
}) {
  const tipo = texto(entrada.tipo).toUpperCase();
  if (!["PERCENTUAL", "QUANTIDADE", "VALOR"].includes(tipo)) {
    throw new Error("Selecione um tipo de medição válido.");
  }
  const valorContratualCentavos = inteiroDecimal(
    entrada.valorContratual,
    2,
    "Valor contratual",
  );

  let percentual: string | null = null;
  let quantidade: string | null = null;
  let valorUnitario: string | null = null;
  let valorApuradoCentavos = 0;

  if (tipo === "PERCENTUAL") {
    const percentualEscalaQuatro = inteiroDecimal(
      entrada.percentual,
      4,
      "Percentual executado",
    );
    if (percentualEscalaQuatro > 1_000_000) {
      throw new Error("Percentual executado deve estar entre 0% e 100%.");
    }
    percentual = decimalCanonico(percentualEscalaQuatro, 4);
    valorApuradoCentavos = aplicarProporcao(
      valorContratualCentavos,
      percentualEscalaQuatro,
      1_000_000,
    );
  } else if (tipo === "QUANTIDADE") {
    const quantidadeEscalaQuatro = inteiroDecimal(
      entrada.quantidade,
      4,
      "Quantidade executada",
    );
    const valorUnitarioEscalaQuatro = inteiroDecimal(
      entrada.valorUnitario,
      4,
      "Valor unitário",
    );
    quantidade = decimalCanonico(quantidadeEscalaQuatro, 4);
    valorUnitario = decimalCanonico(valorUnitarioEscalaQuatro, 4);
    valorApuradoCentavos = aplicarProporcao(
      quantidadeEscalaQuatro,
      valorUnitarioEscalaQuatro,
      1_000_000,
    );
  } else {
    valorApuradoCentavos = inteiroDecimal(
      entrada.valor,
      2,
      "Valor apurado",
    );
  }

  const evidenciaReferencia = texto(entrada.evidenciaReferencia);
  if (
    evidenciaReferencia.length < 3 ||
    evidenciaReferencia.length > 200
  ) {
    throw new Error(
      "Informe a referência da evidência com 3 a 200 caracteres.",
    );
  }
  const evidenciaHash = texto(entrada.evidenciaHash).toLowerCase() || null;
  if (evidenciaHash && !/^[0-9a-f]{64}$/.test(evidenciaHash)) {
    throw new Error("Hash da evidência deve ser um SHA-256 hexadecimal.");
  }
  const conferente = texto(entrada.conferente);
  if (conferente.length < 3 || conferente.length > 160) {
    throw new Error("Informe o responsável pela conferência da medição.");
  }
  const observacao = texto(entrada.observacao);
  if (observacao.length > 2_000) {
    throw new Error("Observação deve ter no máximo 2.000 caracteres.");
  }

  return {
    competencia: competencia(entrada.competencia),
    tipo: tipo as TipoMedicaoMensal,
    valorContratual: decimalCanonico(valorContratualCentavos, 2),
    percentual,
    quantidade,
    valorUnitario,
    valorApurado: decimalCanonico(valorApuradoCentavos, 2),
    evidenciaReferencia,
    evidenciaHash,
    conferente,
    observacao,
  };
}
