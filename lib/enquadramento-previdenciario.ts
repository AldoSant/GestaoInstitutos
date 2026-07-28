export type RegimePrevidenciario =
  | "EMPRESA_GERAL"
  | "BENEFICENTE_IMUNE";

export type CenarioPrevidenciario = {
  regime: RegimePrevidenciario;
  aliquotaSeguradoNumerador: number;
  aliquotaSeguradoDenominador: number;
  aliquotaPatronalNumerador: number;
  aliquotaPatronalDenominador: number;
  fonteNormativa: string;
};

export const CENARIOS_PREVIDENCIARIOS: Record<
  RegimePrevidenciario,
  CenarioPrevidenciario
> = Object.freeze({
  EMPRESA_GERAL: {
    regime: "EMPRESA_GERAL",
    aliquotaSeguradoNumerador: 11,
    aliquotaSeguradoDenominador: 100,
    aliquotaPatronalNumerador: 20,
    aliquotaPatronalDenominador: 100,
    fonteNormativa:
      "Lei 8.212/1991, arts. 22 e 30, § 4º; IN RFB 2.110/2022, arts. 37 e 43.",
  },
  BENEFICENTE_IMUNE: {
    regime: "BENEFICENTE_IMUNE",
    aliquotaSeguradoNumerador: 20,
    aliquotaSeguradoDenominador: 100,
    aliquotaPatronalNumerador: 0,
    aliquotaPatronalDenominador: 100,
    fonteNormativa:
      "LC 187/2021; IN RFB 2.110/2022, art. 37, I, b; requisitos e certificação CEBAS aplicáveis.",
  },
});

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
