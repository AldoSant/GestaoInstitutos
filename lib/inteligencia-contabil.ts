export const FONTES_NORMATIVAS = Object.freeze({
  IRRF_2026: {
    codigo: "LEI_15270_2025_IRRF_2026",
    titulo: "Tributação mensal do IRPF em 2026",
    emissor: "Receita Federal do Brasil",
    vigenciaInicio: "2026-01-01",
    url: "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026",
    consultadaEm: "2026-07-27",
  },
  INSS_2026: {
    codigo: "PORTARIA_MPS_MF_13_2026",
    titulo: "Salário de contribuição e valores previdenciários de 2026",
    emissor: "MPS/MF e INSS",
    vigenciaInicio: "2026-01-01",
    url: "https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal",
    consultadaEm: "2026-07-27",
  },
  CONTRIBUINTE_INDIVIDUAL: {
    codigo: "IN_RFB_2110_2022",
    titulo: "Normas gerais de tributação previdenciária",
    emissor: "Receita Federal do Brasil",
    vigenciaInicio: "2022-10-19",
    url: "https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=126687",
    consultadaEm: "2026-07-27",
  },
  ESOCIAL_S_1_3: {
    codigo: "ESOCIAL_S_1_3_NT_06_2026",
    titulo: "Leiautes e tabelas do eSocial S-1.3",
    emissor: "eSocial",
    vigenciaInicio: "2026-04-27",
    url: "https://www.gov.br/esocial/pt-br/documentacao-tecnica/documentacao-tecnica/",
    consultadaEm: "2026-07-27",
  },
  ITG_2002_R1: {
    codigo: "ITG_2002_R1",
    titulo: "Entidade sem Finalidade de Lucros",
    emissor: "Conselho Federal de Contabilidade",
    vigenciaInicio: "2015-09-02",
    url: "https://portalrestore.cfc.org.br/tecnica/perguntas-frequentes/entidades-sem-finalidade-de-lucros/",
    consultadaEm: "2026-07-27",
  },
  MROSC: {
    codigo: "LEI_13019_2014_DECRETO_8726_2016",
    titulo: "Parcerias entre Administração Pública e OSC",
    emissor: "Presidência da República",
    vigenciaInicio: "2016-01-23",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l13019compilado.htm",
    consultadaEm: "2026-07-27",
  },
  CEBAS_IMUNIDADE: {
    codigo: "LC_187_2021_CEBAS",
    titulo: "Certificação beneficente e imunidade das contribuições à seguridade social",
    emissor: "Presidência da República",
    vigenciaInicio: "2021-12-17",
    url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp187.htm",
    consultadaEm: "2026-07-27",
  },
  EFD_REINF_DCTFWEB: {
    codigo: "EFD_REINF_DCTFWEB",
    titulo: "EFD-Reinf, eSocial e formação da DCTFWeb",
    emissor: "Receita Federal do Brasil",
    vigenciaInicio: "2025-01-01",
    url: "https://www.gov.br/pt-br/servicos/efd-reinf",
    consultadaEm: "2026-07-27",
  },
});

export type EnquadramentoPrestador = {
  tipoPessoa: "FISICA" | "JURIDICA";
  categoriaContribuinte: string | null;
};

export type DecisaoEnquadramento =
  | {
      suportado: true;
      cenario:
        | "PF_CONTRIBUINTE_INDIVIDUAL_701"
        | "PJ_PAGAMENTO_SEM_PREVIDENCIA";
      categoriaAplicada: string | null;
      fundamentos: string[];
    }

export function resolverEnquadramentoPrestador(
  entrada: EnquadramentoPrestador,
): DecisaoEnquadramento {
  if (entrada.tipoPessoa === "JURIDICA") {
    return {
      suportado: true,
      cenario: "PJ_PAGAMENTO_SEM_PREVIDENCIA",
      categoriaAplicada: null,
      fundamentos: [
        FONTES_NORMATIVAS.EFD_REINF_DCTFWEB.codigo,
      ],
    };
  }
  return {
    suportado: true,
    cenario: "PF_CONTRIBUINTE_INDIVIDUAL_701",
    // O operacional atual trata PF como contribuinte individual. "701" é
    // aplicado internamente; não é uma exigência de cadastro nem transmissão
    // ao eSocial, que permanece fora desta superfície.
    categoriaAplicada: "701",
    fundamentos: [
      FONTES_NORMATIVAS.CONTRIBUINTE_INDIVIDUAL.codigo,
      FONTES_NORMATIVAS.INSS_2026.codigo,
      FONTES_NORMATIVAS.IRRF_2026.codigo,
    ],
  };
}
