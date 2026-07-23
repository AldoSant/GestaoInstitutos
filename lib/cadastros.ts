import { numeroDecimalBrasileiro, somenteDigitos } from "./importacao-giw";

type ResultadoValidacao<T> =
  | { dados: T; erros: [] }
  | { dados: null; erros: string[] };

export type PessoaCadastro = {
  id: string | null;
  tipo: "FISICA" | "JURIDICA";
  nome: string;
  cpf: string | null;
  cnpj: string | null;
};

export type AtividadeCadastro = {
  id: string | null;
  codigo: string;
  descricao: string;
  cargaHoraria: string | null;
  valor: string | null;
};

export type LotacaoCadastro = {
  id: string | null;
  codigo: string;
  descricao: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function idCadastroValido(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}

function texto(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function idOpcional(value: unknown, erros: string[]) {
  const id = texto(value);
  if (!id) return null;
  if (!idCadastroValido(id)) erros.push("Identificador inválido.");
  return id;
}

export function validarPessoaCadastro(input: {
  id?: unknown;
  tipo?: unknown;
  nome?: unknown;
  documento?: unknown;
}): ResultadoValidacao<PessoaCadastro> {
  const erros: string[] = [];
  const id = idOpcional(input.id, erros);
  const tipo = input.tipo === "JURIDICA" ? "JURIDICA" : "FISICA";
  const nome = texto(input.nome);
  const documento = somenteDigitos(input.documento);

  if (input.tipo !== "FISICA" && input.tipo !== "JURIDICA") {
    erros.push("Selecione uma natureza válida.");
  }
  if (!nome) erros.push("Informe o nome ou razão social.");
  if (nome.length > 180) erros.push("Nome ou razão social deve ter até 180 caracteres.");
  if (documento && tipo === "FISICA" && documento.length !== 11) {
    erros.push("CPF deve ter 11 dígitos.");
  }
  if (documento && tipo === "JURIDICA" && documento.length !== 14) {
    erros.push("CNPJ deve ter 14 dígitos.");
  }

  if (erros.length > 0) return { dados: null, erros };
  return {
    dados: {
      id,
      tipo,
      nome,
      cpf: tipo === "FISICA" ? documento : null,
      cnpj: tipo === "JURIDICA" ? documento : null,
    },
    erros: [],
  };
}

export function validarAtividadeCadastro(input: {
  id?: unknown;
  codigo?: unknown;
  descricao?: unknown;
  cargaHoraria?: unknown;
  valor?: unknown;
}): ResultadoValidacao<AtividadeCadastro> {
  const erros: string[] = [];
  const id = idOpcional(input.id, erros);
  const codigo = texto(input.codigo);
  const descricao = texto(input.descricao);
  const cargaHoraria = numeroDecimalBrasileiro(input.cargaHoraria);
  const valor = numeroDecimalBrasileiro(input.valor);

  if (!codigo) erros.push("Informe o código da atividade.");
  if (codigo.length > 40) erros.push("Código da atividade deve ter até 40 caracteres.");
  if (!descricao) erros.push("Informe a descrição da atividade.");
  if (descricao.length > 180) erros.push("Descrição deve ter até 180 caracteres.");
  if (texto(input.cargaHoraria) && cargaHoraria === null) {
    erros.push("Carga horária deve ser numérica.");
  }
  if (texto(input.valor) && valor === null) erros.push("Valor deve ser numérico.");
  if (cargaHoraria !== null && Number(cargaHoraria) < 0) {
    erros.push("Carga horária não pode ser negativa.");
  }
  if (valor !== null && Number(valor) < 0) erros.push("Valor não pode ser negativo.");

  if (erros.length > 0) return { dados: null, erros };
  return { dados: { id, codigo, descricao, cargaHoraria, valor }, erros: [] };
}

export function validarLotacaoCadastro(input: {
  id?: unknown;
  codigo?: unknown;
  descricao?: unknown;
}): ResultadoValidacao<LotacaoCadastro> {
  const erros: string[] = [];
  const id = idOpcional(input.id, erros);
  const codigo = texto(input.codigo);
  const descricao = texto(input.descricao);

  if (!codigo) erros.push("Informe o código da lotação.");
  if (codigo.length > 40) erros.push("Código da lotação deve ter até 40 caracteres.");
  if (!descricao) erros.push("Informe a descrição da lotação.");
  if (descricao.length > 160) erros.push("Descrição deve ter até 160 caracteres.");

  if (erros.length > 0) return { dados: null, erros };
  return { dados: { id, codigo, descricao }, erros: [] };
}
