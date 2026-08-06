import { idCadastroValido } from "./cadastros";

type ResultadoValidacao<T> =
  | { dados: T; erros: [] }
  | { dados: null; erros: string[] };

export type PrestadorCadastro = {
  id: string | null;
  pessoaId: string;
  matricula: string;
  isentoInss: boolean;
};

function texto(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function validarPrestadorCadastro(input: {
  id?: unknown;
  pessoaId?: unknown;
  matricula?: unknown;
  isentoInss?: unknown;
}): ResultadoValidacao<PrestadorCadastro> {
  const erros: string[] = [];
  const idTexto = texto(input.id);
  const id = idTexto || null;
  const pessoaId = texto(input.pessoaId);
  const matricula = texto(input.matricula);

  if (id !== null && !idCadastroValido(id)) erros.push("Identificador inválido.");
  if (!idCadastroValido(pessoaId)) erros.push("Selecione uma pessoa válida.");
  if (!matricula) erros.push("Informe a matrícula.");
  if (matricula.length > 40) erros.push("Matrícula deve ter até 40 caracteres.");
  if (erros.length > 0) return { dados: null, erros };
  return {
    dados: {
      id,
      pessoaId,
      matricula,
      isentoInss: input.isentoInss === true || input.isentoInss === "on",
    },
    erros: [],
  };
}
