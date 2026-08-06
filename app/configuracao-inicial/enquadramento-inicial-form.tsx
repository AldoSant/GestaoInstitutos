"use client";

import { useState } from "react";
import { CheckCircle2, Landmark, ShieldCheck } from "lucide-react";
import {
  CENARIOS_PREVIDENCIARIOS,
  type RegimePrevidenciario,
} from "@/lib/enquadramento-previdenciario";
import { concluirConfiguracaoInicial } from "./actions";

const REGIMES = Object.values(CENARIOS_PREVIDENCIARIOS);

export function EnquadramentoInicialForm({
  competencia,
  inicioPadrao,
}: {
  competencia: string;
  inicioPadrao: string;
}) {
  const [regime, setRegime] = useState<RegimePrevidenciario | "">("");
  const cenario = regime ? CENARIOS_PREVIDENCIARIOS[regime] : null;

  return (
    <form action={concluirConfiguracaoInicial} className="crud-form parameter-form onboarding-form">
      <input name="competencia" type="hidden" value={competencia} />
      <label className="field-wide">
        <span>Como o IGP se enquadra perante a Previdência?</span>
        <select
          name="regime"
          required
          value={regime}
          onChange={(event) => setRegime(event.target.value as RegimePrevidenciario | "")}
        >
          <option value="">Confirme com RH/contabilidade e selecione</option>
          {REGIMES.map((item) => (
            <option key={item.regime} value={item.regime}>{item.nome}</option>
          ))}
        </select>
        <small className="field-help">
          Esta é a classificação da empresa contratante, não a categoria eSocial da pessoa prestadora.
        </small>
      </label>

      {cenario && (
        <aside className="onboarding-choice field-wide">
          <div className="onboarding-choice-icon"><Landmark size={20} /></div>
          <div>
            <small>Cenário selecionado</small>
            <strong>{cenario.nome}</strong>
            <p>{cenario.resumo}</p>
            <p className="onboarding-source">{cenario.fonteNormativa}</p>
          </div>
        </aside>
      )}

      <label>
        <span>Início da vigência</span>
        <input name="inicioVigencia" type="date" required defaultValue={inicioPadrao} />
      </label>
      <label>
        <span>Fim da vigência</span>
        <input name="fimVigencia" type="date" required defaultValue="2099-12-31" />
        <small className="field-help">Altere antes de qualquer mudança de regime ou término de certificado.</small>
      </label>

      {regime === "BENEFICENTE_IMUNE" && (
        <fieldset className="conditional-fields">
          <legend>CEBAS obrigatório</legend>
          <label><span>Número do certificado</span><input name="cebasNumero" maxLength={100} required /></label>
          <label><span>Início do CEBAS</span><input name="cebasInicio" type="date" required /></label>
          <label><span>Fim do CEBAS</span><input name="cebasFim" type="date" required /></label>
        </fieldset>
      )}

      <label className="field-wide">
        <span>Confirmação e evidência</span>
        <textarea
          name="evidencia"
          required
          maxLength={2000}
          placeholder="Ex.: Confirmado com RH e contabilidade em 06/08/2026; consulta de regime tributário e documento arquivados no dossiê do contrato."
        />
        <small className="field-help">Registre quem confirmou e o documento consultado. A decisão ficará preservada nas folhas futuras.</small>
      </label>
      <button className="button primary" type="submit" disabled={!regime}>
        <CheckCircle2 size={16} /> Concluir configuração e voltar à folha
      </button>
      <span className="onboarding-action-note"><ShieldCheck size={15} /> Nenhuma folha existente será alterada.</span>
    </form>
  );
}
