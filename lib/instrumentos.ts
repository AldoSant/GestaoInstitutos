import { idCadastroValido } from "./cadastros";
import { numeroDecimalBrasileiro } from "./importacao-giw";

type ResultadoValidacao<T> =
  | { dados: T; erros: [] }
  | { dados: null; erros: string[] };

export type TermoCadastro = {
  id: string | null;
  numero: string;
  descricao: string;
  modalidade: string;
  inicio: string;
  fim: string | null;
  valorGlobal: string;
};

export type MetaCadastro = {
  id: string | null;
  termoId: string;
  codigo: string;
  descricao: string;
};

function texto(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function dataIso(value: unknown) {
  const data = texto(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const instante = new Date(`${data}T00:00:00Z`);
  return Number.isNaN(instante.getTime()) || instante.toISOString().slice(0, 10) !== data
    ? null
    : data;
}

function idOpcional(value: unknown, erros: string[]) {
  const id = texto(value);
  if (!id) return null;
  if (!idCadastroValido(id)) erros.push("Identificador inválido.");
  return id;
}

export function validarTermoCadastro(input: {
  id?: unknown;
  numero?: unknown;
  descricao?: unknown;
  modalidade?: unknown;
  inicio?: unknown;
  fim?: unknown;
  valorGlobal?: unknown;
}): ResultadoValidacao<TermoCadastro> {
  const erros: string[] = [];
  const id = idOpcional(input.id, erros);
  const numero = texto(input.numero);
  const descricao = texto(input.descricao);
  const modalidade = texto(input.modalidade);
  const inicio = dataIso(input.inicio);
  const fimTexto = texto(input.fim);
  const fim = fimTexto ? dataIso(fimTexto) : null;
  const valorGlobal = numeroDecimalBrasileiro(input.valorGlobal);

  if (!numero) erros.push("Informe o número do termo.");
  if (numero.length > 60) erros.push("Número do termo deve ter até 60 caracteres.");
  if (!descricao) erros.push("Informe a descrição do termo.");
  if (descricao.length > 255) erros.push("Descrição deve ter até 255 caracteres.");
  if (!modalidade) erros.push("Informe a modalidade.");
  if (modalidade.length > 80) erros.push("Modalidade deve ter até 80 caracteres.");
  if (inicio === null) erros.push("Informe uma data inicial válida.");
  if (fimTexto && fim === null) erros.push("Informe uma data final válida.");
  if (inicio !== null && fim !== null && fim < inicio) {
    erros.push("A data final não pode ser anterior à inicial.");
  }
  if (valorGlobal === null) erros.push("Informe um valor global válido.");
  if (valorGlobal !== null && Number(valorGlobal) < 0) {
    erros.push("Valor global não pode ser negativo.");
  }

  if (erros.length > 0 || inicio === null || valorGlobal === null) {
    return { dados: null, erros };
  }
  return {
    dados: { id, numero, descricao, modalidade, inicio, fim, valorGlobal },
    erros: [],
  };
}

export function validarMetaCadastro(input: {
  id?: unknown;
  termoId?: unknown;
  codigo?: unknown;
  descricao?: unknown;
}): ResultadoValidacao<MetaCadastro> {
  const erros: string[] = [];
  const id = idOpcional(input.id, erros);
  const termoId = texto(input.termoId);
  const codigo = texto(input.codigo);
  const descricao = texto(input.descricao);

  if (!idCadastroValido(termoId)) erros.push("Selecione um termo válido.");
  if (!codigo) erros.push("Informe o código da meta.");
  if (codigo.length > 40) erros.push("Código da meta deve ter até 40 caracteres.");
  if (!descricao) erros.push("Informe a descrição da meta.");
  if (descricao.length > 255) erros.push("Descrição deve ter até 255 caracteres.");

  if (erros.length > 0) return { dados: null, erros };
  return { dados: { id, termoId, codigo, descricao }, erros: [] };
}
