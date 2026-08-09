"use client";

import { useState } from "react";
import { CheckCircle2, Landmark, ShieldCheck } from "lucide-react";
import type { InstrumentoRecolhimentoPrevidenciario } from "@/lib/perfil-recolhimento";
import { concluirPerfilRecolhimento } from "./actions";

export function PerfilRecolhimentoInicialForm({
  competencia,
  retorno,
}: {
  competencia: string;
  retorno: string;
}) {
  const [instrumento, setInstrumento] = useState<InstrumentoRecolhimentoPrevidenciario | "">("");
  const inicioPadrao = `${competencia.slice(0, 4)}-01-01`;

  return (
    <form action={concluirPerfilRecolhimento} className="crud-form parameter-form onboarding-form">
      <input name="competencia" type="hidden" value={competencia} />
      <input name="retorno" type="hidden" value={retorno} />
      <label className="field-wide">
        <span>Como esta empresa recolhe a contribuição previdenciária?</span>
        <select
          name="instrumento"
          required
          value={instrumento}
          onChange={(event) => setInstrumento(event.target.value as InstrumentoRecolhimentoPrevidenciario | "")}
        >
          <option value="">Selecione conforme RH/contabilidade</option>
          <option value="DCTFWEB_DARF">DCTFWeb / DARF (fluxo padrão)</option>
          <option value="GPS_EXCECAO">GPS excepcional (quando houver fundamento vigente)</option>
        </select>
        <small className="field-help">
          Esta decisão é da empresa e vale por vigência. Ela não altera pessoas, vínculos ou folhas já fechadas.
        </small>
      </label>

      {instrumento === "GPS_EXCECAO" && (
        <aside className="onboarding-choice field-wide">
          <div className="onboarding-choice-icon"><Landmark size={20} /></div>
          <div>
            <small>GPS excepcional</small>
            <strong>Confirme a base e o código de receita antes de publicar</strong>
            <p>Use esta opção somente quando o RH/contabilidade confirmar que ela se aplica à competência. O sistema preservará essa confirmação na apuração.</p>
          </div>
        </aside>
      )}

      {instrumento === "GPS_EXCECAO" && (
        <label>
          <span>Código de receita GPS</span>
          <input name="codigoReceita" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} required placeholder="Ex.: 1007" />
        </label>
      )}
      <label>
        <span>Início da vigência</span>
        <input name="inicioVigencia" type="date" required defaultValue={inicioPadrao} />
      </label>
      <label>
        <span>Fim da vigência</span>
        <input name="fimVigencia" type="date" required defaultValue="2099-12-31" />
      </label>
      <label className="field-wide">
        <span>Fundamentação e evidência</span>
        <textarea name="evidencia" required minLength={20} maxLength={3000} placeholder="Ex.: confirmado com RH e contabilidade; documento consultado, referência e data da conferência." />
      </label>
      <label className="field-wide">
        <span>Responsável pela conferência</span>
        <input name="responsavel" required minLength={3} maxLength={160} placeholder="Nome de quem confirmou a regra" />
      </label>
      <button className="button primary" type="submit" disabled={!instrumento}>
        <CheckCircle2 size={16} /> Salvar configuração e continuar
      </button>
      <span className="onboarding-action-note"><ShieldCheck size={15} /> A configuração será registrada por vigência.</span>
    </form>
  );
}
