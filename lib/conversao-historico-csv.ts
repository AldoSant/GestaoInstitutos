import { createHash } from "node:crypto";
import { decimalParaInteiro } from "./dinheiro";
import {
  type GiwPessoa,
  type GiwSnapshotPessoas,
  validarSnapshotPessoas,
} from "./importacao-giw";
import {
  type GiwFolhaHistorica,
  type GiwFolhaItemHistorico,
  type GiwGuiaInssHistorica,
  type GiwRubricaHistorica,
  type GiwSnapshotFolhasHistoricas,
  type GiwSnapshotGuiasInssHistoricas,
  validarSnapshotFolhasHistoricas,
  validarSnapshotGuiasInssHistoricas,
} from "./migracao-historica";
import {
  type GiwEvento,
  type GiwSnapshotEventos,
  validarSnapshotEventos,
} from "./movimentos-giw";

type LinhaCsv = {
  numero: number;
  valores: Record<string, string>;
};

export type ProblemaConversaoCsv = {
  linha: number | null;
  campo: string;
  mensagem: string;
};

type OpcoesConversao = {
  nomeArquivo: string;
  extraidoEm?: string;
};

type ResultadoConversao<T> = {
  snapshot: T | null;
  issues: ProblemaConversaoCsv[];
  arquivoSha256: string;
};

const ALIASES_FOLHA = {
  folhaLegacyId: ["folha_legacy_id", "folha_id", "id_folha", "codigo_folha"],
  competencia: ["competencia", "competência", "mes_competencia"],
  numero: ["folha_numero", "numero_folha", "número_folha", "numero"],
  termoLegacyId: ["termo_legacy_id", "termo_id", "termo", "codigo_termo"],
  metaLegacyId: ["meta_legacy_id", "meta_id", "meta", "codigo_meta"],
  status: ["folha_status", "status_folha", "status", "situacao"],
  dataPagamento: ["data_pagamento", "pagamento", "data_de_pagamento"],
  itemLegacyId: ["item_legacy_id", "item_id", "folha_item_id"],
  pessoaLegacyId: ["pessoa_legacy_id", "pessoa_id", "codigo_pessoa"],
  vinculoLegacyId: ["vinculo_legacy_id", "vinculo_id", "codigo_vinculo"],
  matricula: ["matricula", "matrícula", "registro"],
  nome: ["nome", "prestador", "nome_prestador", "beneficiario"],
  cpf: ["cpf", "cpf_prestador", "documento"],
  cnpj: ["cnpj", "cnpj_prestador"],
  totalProventos: ["total_proventos", "proventos", "bruto", "total_bruto"],
  totalDescontos: ["total_descontos", "descontos"],
  baseInss: ["base_inss", "base_de_inss"],
  valorInss: ["valor_inss", "inss"],
  baseIrrf: ["base_irrf", "base_de_irrf"],
  valorIrrf: ["valor_irrf", "irrf"],
  totalLiquido: ["total_liquido", "total_líquido", "liquido", "líquido"],
  rubricaLegacyId: ["rubrica_legacy_id", "rubrica_id", "item_rubrica_id"],
  eventoLegacyId: ["evento_legacy_id", "evento_id", "codigo_evento_giw"],
  rubricaCodigo: ["rubrica_codigo", "codigo_rubrica", "evento_codigo"],
  rubricaDescricao: ["rubrica_descricao", "descricao_rubrica", "evento_descricao"],
  rubricaNatureza: ["rubrica_natureza", "natureza", "tipo_evento"],
  rubricaReferencia: ["rubrica_referencia", "referencia", "quantidade"],
  rubricaBaseCalculo: ["rubrica_base_calculo", "base_calculo_rubrica"],
  rubricaValor: ["rubrica_valor", "valor_rubrica", "valor_evento"],
  rubricaIncideInss: ["rubrica_incide_inss", "incide_inss"],
  rubricaIncideIrrf: ["rubrica_incide_irrf", "incide_irrf"],
} as const;

const ALIASES_GUIA = {
  legacyId: ["guia_legacy_id", "guia_id", "id_guia", "codigo_guia"],
  competencia: ["competencia", "competência", "mes_competencia"],
  tipo: ["tipo", "tipo_guia"],
  status: ["status", "situacao", "situação"],
  identificador: ["identificador", "numero", "número", "numero_documento"],
  pessoaLegacyId: ["pessoa_legacy_id", "pessoa_id", "codigo_pessoa"],
  beneficiarioNome: ["beneficiario_nome", "nome", "beneficiario"],
  lote: ["lote", "numero_lote"],
  codigoReceita: ["codigo_receita", "código_receita", "receita"],
  vencimento: ["vencimento", "data_vencimento"],
  pagamento: ["pagamento", "data_pagamento"],
  principal: ["principal", "valor_principal"],
  juros: ["juros", "valor_juros"],
  multa: ["multa", "valor_multa"],
  compensacoes: ["compensacoes", "compensações", "compensacao", "deducoes"],
  total: ["total", "valor_total"],
  folhaLegacyIds: ["folha_legacy_ids", "folhas", "folhas_ids"],
} as const;

function normalizarCabecalho(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
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
      if (linha.some((value) => value.trim())) linhas.push(linha);
      linha = [];
      celula = "";
    } else {
      celula += caractere;
    }
  }
  if (aspas) throw new Error("O CSV possui aspas não encerradas.");
  linha.push(celula);
  if (linha.some((value) => value.trim())) linhas.push(linha);
  return linhas;
}

function lerCsv(conteudoOriginal: string): LinhaCsv[] {
  const conteudo = conteudoOriginal.replace(/^\uFEFF/, "");
  if (!conteudo.trim()) throw new Error("O arquivo CSV está vazio.");
  const primeiraLinha = conteudo.split(/\r?\n/, 1)[0];
  const separador =
    [...primeiraLinha].filter((value) => value === ";").length >=
    [...primeiraLinha].filter((value) => value === ",").length
      ? ";"
      : ",";
  const matriz = separarCsv(conteudo, separador);
  if (matriz.length < 2) {
    throw new Error("O CSV deve possuir cabeçalho e pelo menos uma linha.");
  }
  if (matriz.length > 100_001) {
    throw new Error("O CSV excede o limite de 100.000 linhas.");
  }
  const cabecalhos = matriz[0].map(normalizarCabecalho);
  const duplicados = cabecalhos.filter(
    (cabecalho, index) => cabecalho && cabecalhos.indexOf(cabecalho) !== index,
  );
  if (duplicados.length > 0) {
    throw new Error(`Cabeçalho duplicado: ${[...new Set(duplicados)].join(", ")}.`);
  }
  return matriz.slice(1).map((colunas, index) => ({
    numero: index + 2,
    valores: Object.fromEntries(
      cabecalhos.map((cabecalho, coluna) => [cabecalho, (colunas[coluna] ?? "").trim()]),
    ),
  }));
}

function campo(
  linha: LinhaCsv,
  aliases: readonly string[],
) {
  for (const alias of aliases) {
    const value = linha.valores[normalizarCabecalho(alias)];
    if (value !== undefined) return value.trim();
  }
  return "";
}

function obrigatorio(
  linha: LinhaCsv,
  aliases: readonly string[],
  nome: string,
  issues: ProblemaConversaoCsv[],
) {
  const value = campo(linha, aliases);
  if (!value) {
    issues.push({ linha: linha.numero, campo: nome, mensagem: "obrigatório" });
  }
  return value;
}

function dinheiro(
  linha: LinhaCsv,
  aliases: readonly string[],
  nome: string,
  issues: ProblemaConversaoCsv[],
  padrao?: string,
) {
  let value = campo(linha, aliases).replace(/\u00a0/g, " ").replace(/R\$/gi, "");
  value = value.replace(/\s/g, "");
  if (!value && padrao !== undefined) value = padrao;
  if (!value) {
    issues.push({ linha: linha.numero, campo: nome, mensagem: "obrigatório" });
    return "0.00";
  }
  if (/^\(.+\)$/.test(value)) value = `-${value.slice(1, -1)}`;
  if (value.includes(",") && value.includes(".")) {
    value = value.replaceAll(".", "").replace(",", ".");
  } else if (value.includes(",")) {
    value = value.replace(",", ".");
  }
  try {
    const centavos = decimalParaInteiro(value, 2);
    if (centavos < 0) throw new Error();
    return (centavos / 100).toFixed(2);
  } catch {
    issues.push({
      linha: linha.numero,
      campo: nome,
      mensagem: "valor monetário inválido ou negativo",
    });
    return "0.00";
  }
}

function booleanoOuNulo(value: string): boolean | null {
  const normalizado = normalizarCabecalho(value);
  if (!normalizado) return null;
  if (["sim", "s", "true", "1"].includes(normalizado)) return true;
  if (["nao", "n", "false", "0"].includes(normalizado)) return false;
  return null;
}

function somarDinheiro<T>(itens: T[], seletor: (item: T) => string) {
  const centavos = itens.reduce(
    (total, item) => total + decimalParaInteiro(seletor(item), 2),
    0,
  );
  return (centavos / 100).toFixed(2);
}

function sha256(conteudo: string) {
  return createHash("sha256").update(conteudo).digest("hex");
}

function extraidoEmValido(value?: string) {
  const resolved = value?.trim() || new Date().toISOString();
  if (Number.isNaN(Date.parse(resolved))) {
    throw new Error("A data de extração informada é inválida.");
  }
  return new Date(resolved).toISOString();
}

function converterIssuesHistoricos(
  issues: Array<{ record: number | null; field: string; message: string }>,
): ProblemaConversaoCsv[] {
  return issues.map((issue) => ({
    linha: issue.record,
    campo: issue.field,
    mensagem: issue.message,
  }));
}

export function converterCsvFolhasHistoricas(
  conteudo: string,
  opcoes: OpcoesConversao,
): ResultadoConversao<GiwSnapshotFolhasHistoricas> {
  const arquivoSha256 = sha256(conteudo);
  const issues: ProblemaConversaoCsv[] = [];
  let linhas: LinhaCsv[];
  try {
    linhas = lerCsv(conteudo);
  } catch (error) {
    return {
      snapshot: null,
      arquivoSha256,
      issues: [{
        linha: null,
        campo: "arquivo",
        mensagem: error instanceof Error ? error.message : "CSV inválido",
      }],
    };
  }

  const folhas = new Map<string, {
    legacyId: string;
    competencia: string;
    numero: string;
    termoLegacyId: string | null;
    metaLegacyId: string | null;
    status: string;
    dataPagamento: string | null;
    itens: Map<string, GiwFolhaItemHistorico>;
  }>();

  for (const linha of linhas) {
    const folhaLegacyId = obrigatorio(
      linha,
      ALIASES_FOLHA.folhaLegacyId,
      "folha_legacy_id",
      issues,
    );
    const competencia = obrigatorio(
      linha,
      ALIASES_FOLHA.competencia,
      "competencia",
      issues,
    );
    const numero = campo(linha, ALIASES_FOLHA.numero) || folhaLegacyId;
    const matricula = obrigatorio(linha, ALIASES_FOLHA.matricula, "matricula", issues);
    const nome = obrigatorio(linha, ALIASES_FOLHA.nome, "nome", issues);
    const cpf = campo(linha, ALIASES_FOLHA.cpf).replace(/\D/g, "") || null;
    const cnpj = campo(linha, ALIASES_FOLHA.cnpj).replace(/\D/g, "") || null;
    const pessoaLegacyId =
      campo(linha, ALIASES_FOLHA.pessoaLegacyId) ||
      (cpf
        ? `CPF:${cpf}`
        : cnpj
          ? `CNPJ:${cnpj}`
          : matricula
            ? `MATRICULA:${matricula}`
            : "");
    if (!pessoaLegacyId) {
      issues.push({
        linha: linha.numero,
        campo: "pessoa_legacy_id",
        mensagem: "informe pessoa_legacy_id, CPF ou matrícula",
      });
    }
    const itemLegacyId =
      campo(linha, ALIASES_FOLHA.itemLegacyId) ||
      (folhaLegacyId && pessoaLegacyId ? `${folhaLegacyId}:${pessoaLegacyId}` : "");
    const itemInput: GiwFolhaItemHistorico = {
      legacyId: itemLegacyId,
      pessoaLegacyId,
      vinculoLegacyId: campo(linha, ALIASES_FOLHA.vinculoLegacyId) || null,
      matricula,
      nome,
      cpf,
      cnpj,
      totalProventos: dinheiro(
        linha,
        ALIASES_FOLHA.totalProventos,
        "total_proventos",
        issues,
      ),
      totalDescontos: dinheiro(
        linha,
        ALIASES_FOLHA.totalDescontos,
        "total_descontos",
        issues,
      ),
      baseInss: dinheiro(linha, ALIASES_FOLHA.baseInss, "base_inss", issues),
      valorInss: dinheiro(linha, ALIASES_FOLHA.valorInss, "valor_inss", issues),
      baseIrrf: dinheiro(linha, ALIASES_FOLHA.baseIrrf, "base_irrf", issues),
      valorIrrf: dinheiro(linha, ALIASES_FOLHA.valorIrrf, "valor_irrf", issues),
      totalLiquido: dinheiro(
        linha,
        ALIASES_FOLHA.totalLiquido,
        "total_liquido",
        issues,
      ),
      rubricas: [],
    };

    let folha = folhas.get(folhaLegacyId);
    if (!folha) {
      folha = {
        legacyId: folhaLegacyId,
        competencia,
        numero,
        termoLegacyId: campo(linha, ALIASES_FOLHA.termoLegacyId) || null,
        metaLegacyId: campo(linha, ALIASES_FOLHA.metaLegacyId) || null,
        status: campo(linha, ALIASES_FOLHA.status) || "DESCONHECIDO",
        dataPagamento: campo(linha, ALIASES_FOLHA.dataPagamento) || null,
        itens: new Map(),
      };
      folhas.set(folhaLegacyId, folha);
    } else {
      const divergencias = [
        ["competencia", folha.competencia, competencia],
        ["numero", folha.numero, numero],
      ] as const;
      for (const [nomeCampo, anterior, atual] of divergencias) {
        if (anterior !== atual) {
          issues.push({
            linha: linha.numero,
            campo: nomeCampo,
            mensagem: `diverge de outra linha da folha ${folhaLegacyId}`,
          });
        }
      }
    }

    let item = folha.itens.get(itemLegacyId);
    if (!item) {
      item = itemInput;
      folha.itens.set(itemLegacyId, item);
    } else {
      const camposTotais = [
        "pessoaLegacyId",
        "matricula",
        "nome",
        "cpf",
        "totalProventos",
        "totalDescontos",
        "baseInss",
        "valorInss",
        "baseIrrf",
        "valorIrrf",
        "totalLiquido",
      ] as const;
      for (const nomeCampo of camposTotais) {
        if (item[nomeCampo] !== itemInput[nomeCampo]) {
          issues.push({
            linha: linha.numero,
            campo: nomeCampo,
            mensagem: `diverge de outra linha do item ${itemLegacyId}`,
          });
        }
      }
    }

    const rubricaLegacyId = campo(linha, ALIASES_FOLHA.rubricaLegacyId);
    const rubricaCodigo = campo(linha, ALIASES_FOLHA.rubricaCodigo);
    const rubricaValor = campo(linha, ALIASES_FOLHA.rubricaValor);
    const possuiRubrica = Boolean(rubricaLegacyId || rubricaCodigo || rubricaValor);
    if (possuiRubrica) {
      const codigo = obrigatorio(
        linha,
        ALIASES_FOLHA.rubricaCodigo,
        "rubrica_codigo",
        issues,
      );
      const legacyId = rubricaLegacyId || `${itemLegacyId}:${codigo}`;
      if (item.rubricas.some((rubrica) => rubrica.legacyId === legacyId)) {
        issues.push({
          linha: linha.numero,
          campo: "rubrica_legacy_id",
          mensagem: `rubrica duplicada no item ${itemLegacyId}`,
        });
      } else {
        item.rubricas.push({
          legacyId,
          eventoLegacyId: campo(linha, ALIASES_FOLHA.eventoLegacyId) || null,
          codigo,
          descricao: obrigatorio(
            linha,
            ALIASES_FOLHA.rubricaDescricao,
            "rubrica_descricao",
            issues,
          ),
          natureza: normalizarCabecalho(
            obrigatorio(
              linha,
              ALIASES_FOLHA.rubricaNatureza,
              "rubrica_natureza",
              issues,
            ),
          ).toUpperCase() as GiwRubricaHistorica["natureza"],
          referencia: campo(linha, ALIASES_FOLHA.rubricaReferencia) || null,
          baseCalculo: dinheiro(
            linha,
            ALIASES_FOLHA.rubricaBaseCalculo,
            "rubrica_base_calculo",
            issues,
            "0",
          ),
          valor: dinheiro(
            linha,
            ALIASES_FOLHA.rubricaValor,
            "rubrica_valor",
            issues,
          ),
          incideInss: booleanoOuNulo(campo(linha, ALIASES_FOLHA.rubricaIncideInss)),
          incideIrrf: booleanoOuNulo(campo(linha, ALIASES_FOLHA.rubricaIncideIrrf)),
        });
      }
    }
  }

  const records: GiwFolhaHistorica[] = [...folhas.values()].map((folha) => {
    const itens = [...folha.itens.values()];
    return {
      legacyId: folha.legacyId,
      competencia: folha.competencia,
      numero: folha.numero,
      termoLegacyId: folha.termoLegacyId,
      metaLegacyId: folha.metaLegacyId,
      status: folha.status,
      dataPagamento: folha.dataPagamento,
      totalProventos: somarDinheiro(itens, (item) => item.totalProventos),
      totalDescontos: somarDinheiro(itens, (item) => item.totalDescontos),
      baseInss: somarDinheiro(itens, (item) => item.baseInss),
      valorInss: somarDinheiro(itens, (item) => item.valorInss),
      baseIrrf: somarDinheiro(itens, (item) => item.baseIrrf),
      valorIrrf: somarDinheiro(itens, (item) => item.valorIrrf),
      totalLiquido: somarDinheiro(itens, (item) => item.totalLiquido),
      itens,
    };
  });
  const validacao = validarSnapshotFolhasHistoricas({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569390",
      extractedAt: extraidoEmValido(opcoes.extraidoEm),
      captureMethod: "CSV_FORNECIDO",
      sourceFileName: opcoes.nomeArquivo,
      sourceFileSha256: arquivoSha256,
    },
    entity: "folhas_historicas",
    records,
  });
  issues.push(...converterIssuesHistoricos(validacao.issues));
  return {
    snapshot: issues.length === 0 ? validacao.snapshot : null,
    issues,
    arquivoSha256,
  };
}

export function converterCsvGuiasHistoricas(
  conteudo: string,
  opcoes: OpcoesConversao,
): ResultadoConversao<GiwSnapshotGuiasInssHistoricas> {
  const arquivoSha256 = sha256(conteudo);
  const issues: ProblemaConversaoCsv[] = [];
  let linhas: LinhaCsv[];
  try {
    linhas = lerCsv(conteudo);
  } catch (error) {
    return {
      snapshot: null,
      arquivoSha256,
      issues: [{
        linha: null,
        campo: "arquivo",
        mensagem: error instanceof Error ? error.message : "CSV inválido",
      }],
    };
  }
  const records: GiwGuiaInssHistorica[] = linhas.map((linha) => {
    const competencia = obrigatorio(
      linha,
      ALIASES_GUIA.competencia,
      "competencia",
      issues,
    );
    const identificador = campo(linha, ALIASES_GUIA.identificador) || null;
    const legacyId =
      campo(linha, ALIASES_GUIA.legacyId) ||
      (identificador ? `GUIA:${identificador}` : `GUIA:${competencia}:${linha.numero}`);
    const folhaLegacyIds = campo(linha, ALIASES_GUIA.folhaLegacyIds)
      .split(/[|,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      legacyId,
      competencia,
      tipo: normalizarCabecalho(
        obrigatorio(linha, ALIASES_GUIA.tipo, "tipo", issues),
      ).toUpperCase() as GiwGuiaInssHistorica["tipo"],
      status: campo(linha, ALIASES_GUIA.status) || "DESCONHECIDO",
      identificador,
      pessoaLegacyId: campo(linha, ALIASES_GUIA.pessoaLegacyId) || null,
      beneficiarioNome: campo(linha, ALIASES_GUIA.beneficiarioNome) || null,
      lote: campo(linha, ALIASES_GUIA.lote) || null,
      codigoReceita: campo(linha, ALIASES_GUIA.codigoReceita) || null,
      vencimento: obrigatorio(linha, ALIASES_GUIA.vencimento, "vencimento", issues),
      pagamento: campo(linha, ALIASES_GUIA.pagamento) || null,
      principal: dinheiro(linha, ALIASES_GUIA.principal, "principal", issues),
      juros: dinheiro(linha, ALIASES_GUIA.juros, "juros", issues, "0"),
      multa: dinheiro(linha, ALIASES_GUIA.multa, "multa", issues, "0"),
      compensacoes: dinheiro(
        linha,
        ALIASES_GUIA.compensacoes,
        "compensacoes",
        issues,
        "0",
      ),
      total: dinheiro(linha, ALIASES_GUIA.total, "total", issues),
      folhaLegacyIds,
    };
  });
  const validacao = validarSnapshotGuiasInssHistoricas({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569421",
      extractedAt: extraidoEmValido(opcoes.extraidoEm),
      captureMethod: "CSV_FORNECIDO",
      sourceFileName: opcoes.nomeArquivo,
      sourceFileSha256: arquivoSha256,
    },
    entity: "guias_inss_historicas",
    records,
  });
  issues.push(...converterIssuesHistoricos(validacao.issues));
  return {
    snapshot: issues.length === 0 ? validacao.snapshot : null,
    issues,
    arquivoSha256,
  };
}

export function converterPessoasDoCsvFolhas(
  conteudo: string,
  opcoes: OpcoesConversao,
): ResultadoConversao<GiwSnapshotPessoas> {
  const folhas = converterCsvFolhasHistoricas(conteudo, opcoes);
  if (!folhas.snapshot) {
    return {
      snapshot: null,
      issues: folhas.issues,
      arquivoSha256: folhas.arquivoSha256,
    };
  }
  const issues: ProblemaConversaoCsv[] = [];
  const pessoas = new Map<string, GiwPessoa>();
  for (const item of folhas.snapshot.records.flatMap((folha) => folha.itens)) {
    const existente = pessoas.get(item.pessoaLegacyId);
    if (existente) {
      if (
        existente.nome !== item.nome ||
        existente.cpf !== item.cpf ||
        existente.cnpj !== item.cnpj
      ) {
        issues.push({
          linha: null,
          campo: "pessoa",
          mensagem:
            `dados divergentes para ${item.pessoaLegacyId}: ` +
            `${existente.nome} / ${item.nome}`,
        });
      }
      continue;
    }
    pessoas.set(item.pessoaLegacyId, {
      legacyId: item.pessoaLegacyId,
      dadosCompletos: false,
      nome: item.nome,
      tipo: item.cnpj ? "JURIDICA" : "FISICA",
      cpf: item.cpf,
      cnpj: item.cnpj,
      sexo: null,
      nascimento: null,
      rg: null,
      rgOrgaoEmissor: null,
      rgUf: null,
      rgEmissao: null,
      estadoCivil: null,
      naturalidade: null,
      inscricaoInss: null,
      conselhoTipo: null,
      conselhoNumero: null,
      aposentado: false,
      cnh: null,
      cnhCategoria: null,
      cnhValidade: null,
      nomeFantasia: null,
      representanteLegal: null,
      inscricaoMunicipal: null,
      inscricaoEstadual: null,
      papelPrestador: true,
      papelParceiro: false,
      papelFornecedor: false,
      email: null,
      telefone: null,
      celular: null,
      celularAlternativo: null,
      endereco: null,
      contaBancaria: null,
      dependentes: [],
    });
  }
  const validacao = validarSnapshotPessoas({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569402",
      extractedAt: extraidoEmValido(opcoes.extraidoEm),
      captureMethod: "CSV_FORNECIDO",
      sourceFileName: opcoes.nomeArquivo,
      sourceFileSha256: folhas.arquivoSha256,
    },
    entity: "pessoas",
    records: [...pessoas.values()],
  });
  issues.push(
    ...validacao.issues.map((issue) => ({
      linha: issue.record,
      campo: issue.field,
      mensagem: issue.message,
    })),
  );
  return {
    snapshot: issues.length === 0 ? validacao.snapshot : null,
    issues,
    arquivoSha256: folhas.arquivoSha256,
  };
}

export function converterEventosDoCsvFolhas(
  conteudo: string,
  opcoes: OpcoesConversao,
): ResultadoConversao<GiwSnapshotEventos> {
  const folhas = converterCsvFolhasHistoricas(conteudo, opcoes);
  if (!folhas.snapshot) {
    return {
      snapshot: null,
      issues: folhas.issues,
      arquivoSha256: folhas.arquivoSha256,
    };
  }
  const issues: ProblemaConversaoCsv[] = [];
  const eventos = new Map<string, GiwEvento>();
  const rubricas = folhas.snapshot.records.flatMap((folha) =>
    folha.itens.flatMap((item) => item.rubricas),
  );
  if (rubricas.length === 0) {
    issues.push({
      linha: null,
      campo: "rubricas",
      mensagem: "o CSV não contém rubricas para derivar Eventos",
    });
  }
  for (const rubrica of rubricas) {
    const legacyId = rubrica.eventoLegacyId || `EVENTO:${rubrica.codigo}`;
    if (rubrica.incideInss === null || rubrica.incideIrrf === null) {
      issues.push({
        linha: null,
        campo: "incidencias",
        mensagem:
          `a rubrica ${rubrica.codigo} precisa informar incidência de INSS e IRRF`,
      });
      continue;
    }
    const evento: GiwEvento = {
      legacyId,
      codigo: rubrica.codigo,
      descricao: rubrica.descricao,
      natureza: rubrica.natureza,
      tipoCalculo: "VALOR",
      incideInss: rubrica.incideInss,
      incideIrrf: rubrica.incideIrrf,
      ativo: true,
    };
    const existente = eventos.get(legacyId);
    if (!existente) {
      eventos.set(legacyId, evento);
      continue;
    }
    const campos = [
      "codigo",
      "descricao",
      "natureza",
      "incideInss",
      "incideIrrf",
    ] as const;
    for (const nomeCampo of campos) {
      if (existente[nomeCampo] !== evento[nomeCampo]) {
        issues.push({
          linha: null,
          campo: nomeCampo,
          mensagem: `diverge entre ocorrências do Evento ${legacyId}`,
        });
      }
    }
  }
  const validacao = validarSnapshotEventos({
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "8716",
      extractedAt: extraidoEmValido(opcoes.extraidoEm),
      captureMethod: "CSV_FORNECIDO",
      sourceFileName: opcoes.nomeArquivo,
      sourceFileSha256: folhas.arquivoSha256,
    },
    entity: "eventos",
    records: [...eventos.values()],
  });
  issues.push(
    ...validacao.issues.map((issue) => ({
      linha: issue.record,
      campo: issue.field,
      mensagem: issue.message,
    })),
  );
  return {
    snapshot: issues.length === 0 ? validacao.snapshot : null,
    issues,
    arquivoSha256: folhas.arquivoSha256,
  };
}

export const MODELO_CSV_FOLHAS_HISTORICAS =
  "\uFEFFfolha_legacy_id;competencia;folha_numero;termo_legacy_id;meta_legacy_id;folha_status;data_pagamento;item_legacy_id;pessoa_legacy_id;vinculo_legacy_id;matricula;nome;cpf;cnpj;total_proventos;total_descontos;base_inss;valor_inss;base_irrf;valor_irrf;total_liquido;rubrica_legacy_id;evento_legacy_id;rubrica_codigo;rubrica_descricao;rubrica_natureza;rubrica_referencia;rubrica_base_calculo;rubrica_valor;rubrica_incide_inss;rubrica_incide_irrf\r\n" +
  'FOLHA-EXEMPLO-1;06/2026;1;TERMO-1;META-1;FECHADA;05/07/2026;ITEM-1;PESSOA-1;VINCULO-1;0001;"Prestador fictício";;;1000,00;110,00;1000,00;110,00;890,00;0,00;890,00;RUBRICA-1;EVENTO-1;001;"Retribuição fictícia";PROVENTO;100;1000,00;1000,00;SIM;SIM\r\n';

export const MODELO_CSV_GUIAS_HISTORICAS =
  "\uFEFFguia_legacy_id;competencia;tipo;status;identificador;pessoa_legacy_id;beneficiario_nome;lote;codigo_receita;vencimento;pagamento;principal;juros;multa;compensacoes;total;folha_legacy_ids\r\n" +
  'GUIA-EXEMPLO-1;06/2026;GPS;EMITIDA;GPS-001;PESSOA-1;"Prestador fictício";1;2100;20/07/2026;;110,00;0,00;0,00;0,00;110,00;FOLHA-EXEMPLO-1\r\n';
