import { idCadastroValido } from "./cadastros";
import { dataIsoGiw, numeroDecimalBrasileiro } from "./importacao-giw";

export type VinculoCadastro = {
  id: string | null;
  prestadorId: string;
  termoId: string;
  metaId: string;
  atividadeId: string;
  lotacaoId: string;
  numeroContrato: string | null;
  inicio: string;
  fim: string | null;
  valorRetribuicao: string;
  cargaHoraria: string | null;
  descontaInss: boolean;
  descontaIrrf: boolean;
};

function texto(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function validarVinculoCadastro(input: {
  id?: unknown;
  prestadorId?: unknown;
  termoId?: unknown;
  metaId?: unknown;
  atividadeId?: unknown;
  lotacaoId?: unknown;
  numeroContrato?: unknown;
  inicio?: unknown;
  fim?: unknown;
  valorRetribuicao?: unknown;
  cargaHoraria?: unknown;
  descontaInss?: unknown;
  descontaIrrf?: unknown;
}): { dados: VinculoCadastro | null; erros: string[] } {
  const erros: string[] = [];
  const idText = texto(input.id);
  const id = idText || null;
  const prestadorId = texto(input.prestadorId);
  const termoId = texto(input.termoId);
  const metaId = texto(input.metaId);
  const atividadeId = texto(input.atividadeId);
  const lotacaoId = texto(input.lotacaoId);
  const numeroContrato = texto(input.numeroContrato) || null;
  const inicio = dataIsoGiw(input.inicio);
  const fimInformado = texto(input.fim);
  const fim = fimInformado ? dataIsoGiw(fimInformado) : null;
  const valorRetribuicao = numeroDecimalBrasileiro(input.valorRetribuicao);
  const cargaInformada = texto(input.cargaHoraria);
  const cargaHoraria = cargaInformada
    ? numeroDecimalBrasileiro(input.cargaHoraria)
    : null;

  if (id && !idCadastroValido(id)) erros.push("Identificador do vínculo inválido.");
  if (!idCadastroValido(prestadorId)) erros.push("Selecione um prestador válido.");
  if (!idCadastroValido(termoId)) erros.push("Selecione um termo válido.");
  if (!idCadastroValido(metaId)) erros.push("Selecione uma meta válida.");
  if (!idCadastroValido(atividadeId)) erros.push("Selecione uma atividade válida.");
  if (!idCadastroValido(lotacaoId)) erros.push("Selecione uma lotação válida.");
  if (numeroContrato && numeroContrato.length > 60) {
    erros.push("Número do contrato deve ter até 60 caracteres.");
  }
  if (!inicio) erros.push("Informe uma data inicial válida.");
  if (fimInformado && !fim) erros.push("Informe uma data final válida.");
  if (inicio && fim && fim < inicio) {
    erros.push("A data final não pode anteceder a data inicial.");
  }
  if (valorRetribuicao === null || Number(valorRetribuicao) < 0) {
    erros.push("Informe uma retribuição não negativa.");
  }
  if (cargaInformada && (cargaHoraria === null || Number(cargaHoraria) < 0)) {
    erros.push("Informe uma carga horária não negativa.");
  }

  if (erros.length > 0 || !inicio || valorRetribuicao === null) {
    return { dados: null, erros };
  }
  return {
    dados: {
      id,
      prestadorId,
      termoId,
      metaId,
      atividadeId,
      lotacaoId,
      numeroContrato,
      inicio,
      fim,
      valorRetribuicao,
      cargaHoraria,
      descontaInss: input.descontaInss === true,
      descontaIrrf: input.descontaIrrf === true,
    },
    erros,
  };
}
