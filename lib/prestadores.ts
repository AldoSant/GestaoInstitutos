import { idCadastroValido } from "./cadastros";
import { somenteDigitos } from "./importacao-giw";

type ResultadoValidacao<T> =
  | { dados: T; erros: [] }
  | { dados: null; erros: string[] };

export type PrestadorCadastro = {
  id: string | null;
  pessoaId: string;
  matricula: string;
  nitPisPasep: string | null;
  categoriaContribuinte: string | null;
  isentoInss: boolean;
};

function texto(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function validarPrestadorCadastro(input: {
  id?: unknown;
  pessoaId?: unknown;
  matricula?: unknown;
  nitPisPasep?: unknown;
  categoriaContribuinte?: unknown;
  isentoInss?: unknown;
}): ResultadoValidacao<PrestadorCadastro> {
  const erros: string[] = [];
  const idTexto = texto(input.id);
  const id = idTexto || null;
  const pessoaId = texto(input.pessoaId);
  const matricula = texto(input.matricula);
  const nitPisPasep = somenteDigitos(input.nitPisPasep) || null;
  const categoriaContribuinte = texto(input.categoriaContribuinte) || null;

  if (id !== null && !idCadastroValido(id)) erros.push("Identificador inválido.");
  if (!idCadastroValido(pessoaId)) erros.push("Selecione uma pessoa válida.");
  if (!matricula) erros.push("Informe a matrícula.");
  if (matricula.length > 40) erros.push("Matrícula deve ter até 40 caracteres.");
  if (nitPisPasep !== null && nitPisPasep.length !== 11) {
    erros.push("NIT, PIS ou PASEP deve ter 11 dígitos.");
  }
  if (categoriaContribuinte !== null && categoriaContribuinte.length > 30) {
    erros.push("Categoria do contribuinte deve ter até 30 caracteres.");
  }

  if (erros.length > 0) return { dados: null, erros };
  return {
    dados: {
      id,
      pessoaId,
      matricula,
      nitPisPasep,
      categoriaContribuinte,
      isentoInss: input.isentoInss === true || input.isentoInss === "on",
    },
    erros: [],
  };
}
