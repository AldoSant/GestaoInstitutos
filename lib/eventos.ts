import { idCadastroValido } from "./cadastros";
import { numeroDecimalBrasileiro } from "./importacao-giw";

export type NaturezaEvento = "PROVENTO" | "DESCONTO" | "INFORMATIVO";
export type TipoCalculoEvento = "VALOR" | "PERCENTUAL";

export type EventoCadastro = {
  id: string | null;
  codigo: string;
  descricao: string;
  natureza: NaturezaEvento;
  tipoCalculo: TipoCalculoEvento;
  incideInss: boolean;
  incideIrrf: boolean;
};

function texto(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function idOpcional(value: unknown, erros: string[]) {
  const id = texto(value);
  if (!id) return null;
  if (!idCadastroValido(id)) erros.push("Identificador inválido.");
  return id;
}

export function validarEventoCadastro(input: {
  id?: unknown;
  codigo?: unknown;
  descricao?: unknown;
  natureza?: unknown;
  tipoCalculo?: unknown;
  incideInss?: unknown;
  incideIrrf?: unknown;
}): { dados: EventoCadastro | null; erros: string[] } {
  const erros: string[] = [];
  const id = idOpcional(input.id, erros);
  const codigo = texto(input.codigo).toUpperCase();
  const descricao = texto(input.descricao);
  const natureza = texto(input.natureza).toUpperCase();
  const tipoCalculo = texto(input.tipoCalculo).toUpperCase();
  const incideInss = input.incideInss === true;
  const incideIrrf = input.incideIrrf === true;

  if (!codigo) erros.push("Informe o código do evento.");
  if (codigo.length > 40) erros.push("Código deve ter até 40 caracteres.");
  if (!descricao) erros.push("Informe a descrição do evento.");
  if (descricao.length > 180) erros.push("Descrição deve ter até 180 caracteres.");
  if (!["PROVENTO", "DESCONTO", "INFORMATIVO"].includes(natureza)) {
    erros.push("Selecione uma natureza válida.");
  }
  if (!["VALOR", "PERCENTUAL"].includes(tipoCalculo)) {
    erros.push("Selecione um tipo de cálculo válido.");
  }
  if (natureza === "INFORMATIVO" && (incideInss || incideIrrf)) {
    erros.push("Evento informativo não pode compor base de INSS ou IRRF.");
  }

  if (erros.length > 0) return { dados: null, erros };
  return {
    dados: {
      id,
      codigo,
      descricao,
      natureza: natureza as NaturezaEvento,
      tipoCalculo: tipoCalculo as TipoCalculoEvento,
      incideInss,
      incideIrrf,
    },
    erros,
  };
}

function competencia(value: unknown) {
  const text = texto(value);
  const iso = /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : text;
  if (!/^\d{4}-\d{2}-01$/.test(iso)) return null;
  const [year, month] = iso.split("-").map(Number);
  return year >= 2000 && month >= 1 && month <= 12 ? iso : null;
}

export function validarEventoRecorrente(input: {
  id?: unknown;
  vinculoId?: unknown;
  eventoId?: unknown;
  valor?: unknown;
  inicioCompetencia?: unknown;
  fimCompetencia?: unknown;
}): {
  dados: {
    id: string | null;
    vinculoId: string;
    eventoId: string;
    valor: string;
    inicioCompetencia: string;
    fimCompetencia: string | null;
  } | null;
  erros: string[];
} {
  const erros: string[] = [];
  const id = idOpcional(input.id, erros);
  const vinculoId = texto(input.vinculoId);
  const eventoId = texto(input.eventoId);
  const valor = numeroDecimalBrasileiro(input.valor);
  const inicioCompetencia = competencia(input.inicioCompetencia);
  const fimInformada = texto(input.fimCompetencia);
  const fimCompetencia = fimInformada ? competencia(fimInformada) : null;

  if (!idCadastroValido(vinculoId)) erros.push("Selecione um vínculo válido.");
  if (!idCadastroValido(eventoId)) erros.push("Selecione um evento válido.");
  if (valor === null || Number(valor) < 0) {
    erros.push("Informe um valor não negativo.");
  }
  if (!inicioCompetencia) erros.push("Informe uma competência inicial válida.");
  if (fimInformada && !fimCompetencia) {
    erros.push("Informe uma competência final válida.");
  }
  if (inicioCompetencia && fimCompetencia && fimCompetencia < inicioCompetencia) {
    erros.push("A competência final não pode anteceder a inicial.");
  }

  if (erros.length > 0 || valor === null || !inicioCompetencia) {
    return { dados: null, erros };
  }
  return {
    dados: { id, vinculoId, eventoId, valor, inicioCompetencia, fimCompetencia },
    erros,
  };
}
