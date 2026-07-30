export type RegimePrevidenciario =
  | "EMPRESA_GERAL"
  | "SIMPLES_SUBSTITUIDA"
  | "SIMPLES_ANEXO_IV"
  | "BENEFICENTE_IMUNE"
  | "ADMINISTRACAO_PUBLICA"
  | "INSTITUICAO_FINANCEIRA";

export type RegimePrevidenciarioCatalogo =
  | RegimePrevidenciario
  | "SIMPLES_MISTO"
  | "CPRB"
  | "PRODUTOR_RURAL"
  | "ASSOCIACAO_DESPORTIVA";

export type CenarioPrevidenciario = {
  regime: RegimePrevidenciario;
  nome: string;
  resumo: string;
  codigoClassificacaoTributaria: string;
  aliquotaSeguradoNumerador: number;
  aliquotaSeguradoDenominador: number;
  aliquotaPatronalNumerador: number;
  aliquotaPatronalDenominador: number;
  exigeCebas?: boolean;
  fonteNormativa: string;
};

export type ItemCatalogoPrevidenciario = {
  regime: RegimePrevidenciarioCatalogo;
  nome: string;
  resumo: string;
  codigoClassificacaoTributaria: string;
  publicavel: boolean;
  motivoIndisponibilidade?: string;
};

export const CENARIOS_PREVIDENCIARIOS: Record<
  RegimePrevidenciario,
  CenarioPrevidenciario
> = Object.freeze({
  EMPRESA_GERAL: {
    regime: "EMPRESA_GERAL",
    nome: "Regime geral — Lucro Real, Presumido ou Arbitrado",
    resumo: "Para esta apuração previdenciária, os três regimes usam retenção de 11% e contribuição patronal de 20%.",
    codigoClassificacaoTributaria: "99",
    aliquotaSeguradoNumerador: 11,
    aliquotaSeguradoDenominador: 100,
    aliquotaPatronalNumerador: 20,
    aliquotaPatronalDenominador: 100,
    fonteNormativa:
      "Lei 8.212/1991, arts. 22, III, e 30, § 4º; IN RFB 2.110/2022.",
  },
  SIMPLES_SUBSTITUIDA: {
    regime: "SIMPLES_SUBSTITUIDA",
    nome: "Simples Nacional — CPP substituída",
    resumo: "Retenção de 11%; contribuição patronal previdenciária incluída no DAS.",
    codigoClassificacaoTributaria: "01",
    aliquotaSeguradoNumerador: 11,
    aliquotaSeguradoDenominador: 100,
    aliquotaPatronalNumerador: 0,
    aliquotaPatronalDenominador: 100,
    fonteNormativa:
      "LC 123/2006, art. 13, VI; classificação tributária 01 da Tabela 08 do eSocial.",
  },
  SIMPLES_ANEXO_IV: {
    regime: "SIMPLES_ANEXO_IV",
    nome: "Simples Nacional — Anexo IV",
    resumo: "Retenção de 11% e contribuição patronal de 20% fora do DAS.",
    codigoClassificacaoTributaria: "02",
    aliquotaSeguradoNumerador: 11,
    aliquotaSeguradoDenominador: 100,
    aliquotaPatronalNumerador: 20,
    aliquotaPatronalDenominador: 100,
    fonteNormativa:
      "LC 123/2006, art. 13, VI; classificação tributária 02 da Tabela 08 do eSocial.",
  },
  BENEFICENTE_IMUNE: {
    regime: "BENEFICENTE_IMUNE",
    nome: "Entidade beneficente imune",
    resumo: "Retenção de 20%; imunidade da contribuição patronal condicionada ao CEBAS.",
    codigoClassificacaoTributaria: "80",
    aliquotaSeguradoNumerador: 20,
    aliquotaSeguradoDenominador: 100,
    aliquotaPatronalNumerador: 0,
    aliquotaPatronalDenominador: 100,
    exigeCebas: true,
    fonteNormativa:
      "CF, art. 195, § 7º; LC 187/2021; classificação tributária 80 da Tabela 08 do eSocial.",
  },
  ADMINISTRACAO_PUBLICA: {
    regime: "ADMINISTRACAO_PUBLICA",
    nome: "Administração pública",
    resumo: "Retenção de 11% e contribuição patronal de 20% sobre contribuinte individual.",
    codigoClassificacaoTributaria: "85",
    aliquotaSeguradoNumerador: 11,
    aliquotaSeguradoDenominador: 100,
    aliquotaPatronalNumerador: 20,
    aliquotaPatronalDenominador: 100,
    fonteNormativa:
      "Lei 8.212/1991, arts. 15, I, e 22, III; classificação tributária 85 da Tabela 08 do eSocial.",
  },
  INSTITUICAO_FINANCEIRA: {
    regime: "INSTITUICAO_FINANCEIRA",
    nome: "Instituição financeira",
    resumo: "Retenção de 11% e contribuição patronal de 22,5% (20% + adicional de 2,5%).",
    codigoClassificacaoTributaria: "13",
    aliquotaSeguradoNumerador: 11,
    aliquotaSeguradoDenominador: 100,
    aliquotaPatronalNumerador: 225,
    aliquotaPatronalDenominador: 1000,
    fonteNormativa:
      "Lei 8.212/1991, art. 22, III e § 1º; classificação tributária 13 da Tabela 08 do eSocial.",
  },
});

const CATALOGO_NAO_PUBLICAVEL: ItemCatalogoPrevidenciario[] = [
  {
    regime: "SIMPLES_MISTO",
    nome: "Simples Nacional — atividades concomitantes",
    resumo: "Parte das atividades tem CPP substituída e parte recolhe fora do DAS.",
    codigoClassificacaoTributaria: "03",
    publicavel: false,
    motivoIndisponibilidade: "Requer segregação por atividade e lotação tributária.",
  },
  {
    regime: "CPRB",
    nome: "Contribuição sobre a receita bruta (CPRB)",
    resumo: "A contribuição substitutiva depende de receita, período e atividade.",
    codigoClassificacaoTributaria: "variável",
    publicavel: false,
    motivoIndisponibilidade: "Requer módulo de receita e apuração da CPRB.",
  },
  {
    regime: "PRODUTOR_RURAL",
    nome: "Produtor rural e agroindústria",
    resumo: "O fato gerador pode ser comercialização da produção, folha ou combinação aplicável.",
    codigoClassificacaoTributaria: "06 / 07",
    publicavel: false,
    motivoIndisponibilidade: "Requer módulo rural e opção tributária por competência.",
  },
  {
    regime: "ASSOCIACAO_DESPORTIVA",
    nome: "Associação desportiva profissional",
    resumo: "Possui contribuição substitutiva vinculada à receita de eventos e patrocínios.",
    codigoClassificacaoTributaria: "11",
    publicavel: false,
    motivoIndisponibilidade: "Requer módulo de receitas desportivas.",
  },
];

export const CATALOGO_REGIMES_PREVIDENCIARIOS: readonly ItemCatalogoPrevidenciario[] =
  Object.freeze([
    ...Object.values(CENARIOS_PREVIDENCIARIOS).map((cenario) => ({
      regime: cenario.regime,
      nome: cenario.nome,
      resumo: cenario.resumo,
      codigoClassificacaoTributaria: cenario.codigoClassificacaoTributaria,
      publicavel: true,
    })),
    ...CATALOGO_NAO_PUBLICAVEL,
  ]);

export function nomeRegimePrevidenciario(regime: string | null | undefined) {
  if (!regime) return "Aguardando enquadramento";
  return (
    CATALOGO_REGIMES_PREVIDENCIARIOS.find((item) => item.regime === regime)?.nome ??
    regime
  );
}

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.valueOf()) && data.toISOString().slice(0, 10) === valor;
}

export type EnquadramentoCadastro = {
  regime: RegimePrevidenciario;
  inicioVigencia: string;
  fimVigencia: string;
  cebasNumero: string | null;
  cebasInicio: string | null;
  cebasFim: string | null;
  evidencia: string;
};

export function validarEnquadramentoPrevidenciario(
  input: Record<string, unknown>,
) {
  const erros: string[] = [];
  const regime = texto(input.regime) as RegimePrevidenciario;
  const inicioVigencia = texto(input.inicioVigencia);
  const fimVigencia = texto(input.fimVigencia);
  const cebasNumero = texto(input.cebasNumero) || null;
  const cebasInicio = texto(input.cebasInicio) || null;
  const cebasFim = texto(input.cebasFim) || null;
  const evidencia = texto(input.evidencia);

  if (!(regime in CENARIOS_PREVIDENCIARIOS)) {
    erros.push("Regime previdenciário não suportado.");
  }
  if (!dataValida(inicioVigencia) || !dataValida(fimVigencia)) {
    erros.push("Vigência deve possuir datas válidas.");
  } else if (fimVigencia < inicioVigencia) {
    erros.push("Fim da vigência não pode anteceder o início.");
  }
  if (!evidencia || evidencia.length > 2000) {
    erros.push("Evidência do enquadramento é obrigatória e deve ter até 2.000 caracteres.");
  }
  if (regime === "BENEFICENTE_IMUNE") {
    if (!cebasNumero || cebasNumero.length > 100) {
      erros.push("Número do CEBAS é obrigatório para entidade beneficente imune.");
    }
    if (!cebasInicio || !cebasFim || !dataValida(cebasInicio) || !dataValida(cebasFim)) {
      erros.push("Informe a vigência válida do CEBAS.");
    } else if (
      dataValida(inicioVigencia) &&
      dataValida(fimVigencia) &&
      (cebasInicio > inicioVigencia || cebasFim < fimVigencia)
    ) {
      erros.push("A vigência do CEBAS deve cobrir todo o enquadramento.");
    }
  }
  if (erros.length) return { dados: null, erros };
  return {
    dados: {
      regime,
      inicioVigencia,
      fimVigencia,
      cebasNumero: regime === "BENEFICENTE_IMUNE" ? cebasNumero : null,
      cebasInicio: regime === "BENEFICENTE_IMUNE" ? cebasInicio : null,
      cebasFim: regime === "BENEFICENTE_IMUNE" ? cebasFim : null,
      evidencia,
    } satisfies EnquadramentoCadastro,
    erros,
  };
}
