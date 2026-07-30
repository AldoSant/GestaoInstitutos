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

export type FichaPessoaCadastro = PessoaCadastro & {
  nascimento: string | null;
  sexo: string | null;
  rg: string | null;
  rgOrgaoEmissor: string | null;
  rgUf: string | null;
  rgEmissao: string | null;
  estadoCivil: string | null;
  naturalidade: string | null;
  inscricaoInss: string | null;
  conselhoTipo: string | null;
  conselhoNumero: string | null;
  aposentado: boolean;
  cnh: string | null;
  cnhCategoria: string | null;
  cnhValidade: string | null;
  nomeFantasia: string | null;
  representanteLegal: string | null;
  inscricaoMunicipal: string | null;
  inscricaoEstadual: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  celularAlternativo: string | null;
  papelPrestador: boolean;
  papelParceiro: boolean;
  papelFornecedor: boolean;
};

export type EnderecoPessoaCadastro = {
  pessoaId: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  complemento: string | null;
  referencia: string | null;
};

export type ContaPessoaCadastro = {
  pessoaId: string;
  agencia: string;
  numero: string;
  digito: string | null;
  variacao: string | null;
  tipo: "CORRENTE" | "POUPANCA";
};

export type DependenteCadastro = {
  id: string | null;
  pessoaId: string;
  nome: string;
  cpf: string | null;
  nascimento: string | null;
  parentesco: string | null;
  estudante: boolean;
  baixaSalarioFamilia: string | null;
  baixaIrrf: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function idCadastroValido(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}

function texto(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function textoOpcional(
  value: unknown,
  limite: number,
  campo: string,
  erros: string[],
) {
  const normalizado = texto(value);
  if (normalizado.length > limite) {
    erros.push(`${campo} deve ter até ${limite} caracteres.`);
  }
  return normalizado || null;
}

function dataOpcional(value: unknown, campo: string, erros: string[]) {
  const normalizada = texto(value);
  if (!normalizada) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizada)) {
    erros.push(`${campo} deve ser uma data válida.`);
    return normalizada;
  }
  const [ano, mes, dia] = normalizada.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    erros.push(`${campo} deve ser uma data válida.`);
  }
  return normalizada;
}

function marcado(value: unknown) {
  return value === true || value === "on" || value === "true";
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

export function validarFichaPessoaCadastro(input: {
  id?: unknown;
  tipo?: unknown;
  nome?: unknown;
  documento?: unknown;
  nascimento?: unknown;
  sexo?: unknown;
  rg?: unknown;
  rgOrgaoEmissor?: unknown;
  rgUf?: unknown;
  rgEmissao?: unknown;
  estadoCivil?: unknown;
  naturalidade?: unknown;
  inscricaoInss?: unknown;
  conselhoTipo?: unknown;
  conselhoNumero?: unknown;
  aposentado?: unknown;
  cnh?: unknown;
  cnhCategoria?: unknown;
  cnhValidade?: unknown;
  nomeFantasia?: unknown;
  representanteLegal?: unknown;
  inscricaoMunicipal?: unknown;
  inscricaoEstadual?: unknown;
  email?: unknown;
  telefone?: unknown;
  celular?: unknown;
  celularAlternativo?: unknown;
  papelPrestador?: unknown;
  papelParceiro?: unknown;
  papelFornecedor?: unknown;
}): ResultadoValidacao<FichaPessoaCadastro> {
  const basica = validarPessoaCadastro(input);
  if (!basica.dados) return basica;
  const erros: string[] = [];
  const email = textoOpcional(input.email, 180, "E-mail", erros);
  const rgUf = textoOpcional(input.rgUf, 2, "UF do RG", erros)?.toUpperCase() ?? null;
  const sexo = textoOpcional(input.sexo, 10, "Sexo", erros)?.toUpperCase() ?? null;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    erros.push("Informe um e-mail válido.");
  }
  if (rgUf && !/^[A-Z]{2}$/.test(rgUf)) {
    erros.push("UF do RG deve conter duas letras.");
  }
  if (sexo && !["FEMININO", "MASCULINO", "OUTRO"].includes(sexo)) {
    erros.push("Selecione um sexo válido.");
  }

  const dados: FichaPessoaCadastro = {
    ...basica.dados,
    nascimento: dataOpcional(input.nascimento, "Nascimento", erros),
    sexo,
    rg: textoOpcional(input.rg, 40, "RG", erros),
    rgOrgaoEmissor: textoOpcional(
      input.rgOrgaoEmissor,
      10,
      "Órgão emissor",
      erros,
    ),
    rgUf,
    rgEmissao: dataOpcional(input.rgEmissao, "Emissão do RG", erros),
    estadoCivil: textoOpcional(input.estadoCivil, 40, "Estado civil", erros),
    naturalidade: textoOpcional(input.naturalidade, 120, "Naturalidade", erros),
    inscricaoInss: textoOpcional(
      input.inscricaoInss,
      30,
      "Inscrição INSS/NIT",
      erros,
    ),
    conselhoTipo: textoOpcional(input.conselhoTipo, 20, "Conselho profissional", erros),
    conselhoNumero: textoOpcional(input.conselhoNumero, 20, "Número do conselho", erros),
    aposentado: marcado(input.aposentado),
    cnh: textoOpcional(input.cnh, 20, "CNH", erros),
    cnhCategoria: textoOpcional(input.cnhCategoria, 2, "Categoria da CNH", erros)
      ?.toUpperCase() ?? null,
    cnhValidade: dataOpcional(input.cnhValidade, "Validade da CNH", erros),
    nomeFantasia: textoOpcional(input.nomeFantasia, 180, "Nome fantasia", erros),
    representanteLegal: textoOpcional(
      input.representanteLegal,
      180,
      "Representante legal",
      erros,
    ),
    inscricaoMunicipal: textoOpcional(
      input.inscricaoMunicipal,
      30,
      "Inscrição municipal",
      erros,
    ),
    inscricaoEstadual: textoOpcional(
      input.inscricaoEstadual,
      30,
      "Inscrição estadual",
      erros,
    ),
    email,
    telefone: textoOpcional(input.telefone, 20, "Telefone", erros),
    celular: textoOpcional(input.celular, 20, "Celular", erros),
    celularAlternativo: textoOpcional(
      input.celularAlternativo,
      20,
      "Celular alternativo",
      erros,
    ),
    papelPrestador: marcado(input.papelPrestador),
    papelParceiro: marcado(input.papelParceiro),
    papelFornecedor: marcado(input.papelFornecedor),
  };
  return erros.length ? { dados: null, erros } : { dados, erros: [] };
}

export function validarEnderecoPessoaCadastro(input: {
  pessoaId?: unknown;
  cep?: unknown;
  logradouro?: unknown;
  numero?: unknown;
  bairro?: unknown;
  municipio?: unknown;
  complemento?: unknown;
  referencia?: unknown;
}): ResultadoValidacao<EnderecoPessoaCadastro> {
  const erros: string[] = [];
  const pessoaId = texto(input.pessoaId);
  if (!idCadastroValido(pessoaId)) erros.push("Pessoa inválida.");
  const cepInformado = somenteDigitos(input.cep);
  if (cepInformado && cepInformado.length !== 8) {
    erros.push("CEP deve ter 8 dígitos.");
  }
  const dados: EnderecoPessoaCadastro = {
    pessoaId,
    cep: cepInformado || null,
    logradouro: textoOpcional(input.logradouro, 120, "Logradouro", erros),
    numero: textoOpcional(input.numero, 20, "Número", erros),
    bairro: textoOpcional(input.bairro, 100, "Bairro", erros),
    municipio: textoOpcional(input.municipio, 120, "Município", erros),
    complemento: textoOpcional(input.complemento, 200, "Complemento", erros),
    referencia: textoOpcional(input.referencia, 200, "Referência", erros),
  };
  return erros.length ? { dados: null, erros } : { dados, erros: [] };
}

export function validarContaPessoaCadastro(input: {
  pessoaId?: unknown;
  agencia?: unknown;
  numero?: unknown;
  digito?: unknown;
  variacao?: unknown;
  tipo?: unknown;
}): ResultadoValidacao<ContaPessoaCadastro> {
  const erros: string[] = [];
  const pessoaId = texto(input.pessoaId);
  const agencia = texto(input.agencia);
  const numero = texto(input.numero);
  const tipo = input.tipo === "POUPANCA" ? "POUPANCA" : "CORRENTE";
  if (!idCadastroValido(pessoaId)) erros.push("Pessoa inválida.");
  if (!agencia) erros.push("Informe a agência.");
  if (agencia.length > 120) erros.push("Agência deve ter até 120 caracteres.");
  if (!numero) erros.push("Informe o número da conta.");
  if (numero.length > 20) erros.push("Conta deve ter até 20 caracteres.");
  if (input.tipo !== "CORRENTE" && input.tipo !== "POUPANCA") {
    erros.push("Selecione um tipo de conta válido.");
  }
  const dados: ContaPessoaCadastro = {
    pessoaId,
    agencia,
    numero,
    digito: textoOpcional(input.digito, 5, "Dígito", erros),
    variacao: textoOpcional(input.variacao, 5, "Variação", erros),
    tipo,
  };
  return erros.length ? { dados: null, erros } : { dados, erros: [] };
}

export function validarDependenteCadastro(input: {
  id?: unknown;
  pessoaId?: unknown;
  nome?: unknown;
  cpf?: unknown;
  nascimento?: unknown;
  parentesco?: unknown;
  estudante?: unknown;
  baixaSalarioFamilia?: unknown;
  baixaIrrf?: unknown;
}): ResultadoValidacao<DependenteCadastro> {
  const erros: string[] = [];
  const id = idOpcional(input.id, erros);
  const pessoaId = texto(input.pessoaId);
  const nome = texto(input.nome);
  const cpf = somenteDigitos(input.cpf);
  if (!idCadastroValido(pessoaId)) erros.push("Pessoa inválida.");
  if (!nome) erros.push("Informe o nome do dependente.");
  if (nome.length > 180) erros.push("Nome deve ter até 180 caracteres.");
  if (cpf && cpf.length !== 11) erros.push("CPF do dependente deve ter 11 dígitos.");
  const dados: DependenteCadastro = {
    id,
    pessoaId,
    nome,
    cpf: cpf || null,
    nascimento: dataOpcional(input.nascimento, "Nascimento", erros),
    parentesco: textoOpcional(input.parentesco, 80, "Parentesco", erros),
    estudante: marcado(input.estudante),
    baixaSalarioFamilia: dataOpcional(
      input.baixaSalarioFamilia,
      "Baixa do salário-família",
      erros,
    ),
    baixaIrrf: dataOpcional(input.baixaIrrf, "Baixa do IRRF", erros),
  };
  return erros.length ? { dados: null, erros } : { dados, erros: [] };
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
