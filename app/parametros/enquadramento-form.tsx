"use client";

import { useState } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { ModalShell } from "@/components/modal-shell";
import {
  CENARIOS_PREVIDENCIARIOS,
  type RegimePrevidenciario,
} from "@/lib/enquadramento-previdenciario";
import { salvarEnquadramento } from "./actions";

export function EnquadramentoForm({
  regimeInicial,
}: {
  regimeInicial?: string;
}) {
  const inicial =
    regimeInicial && regimeInicial in CENARIOS_PREVIDENCIARIOS
      ? (regimeInicial as RegimePrevidenciario)
      : "";
  const [regime, setRegime] = useState<RegimePrevidenciario | "">(inicial);
  const cenario = regime ? CENARIOS_PREVIDENCIARIOS[regime] : null;

  return (
    <ModalShell
      closeHref="/parametros"
      title="Publicar nova vigência"
      description="O enquadramento será congelado nas folhas processadas. Confira a documentação antes de publicar."
    >
      <form action={salvarEnquadramento} className="crud-form parameter-form">
        <label className="field-wide">
          <span>Enquadramento previdenciário</span>
          <select
            name="regime"
            required
            value={regime}
            onChange={(event) =>
              setRegime(event.target.value as RegimePrevidenciario | "")
            }
          >
            <option value="" disabled>Selecione o enquadramento comprovado</option>
            {Object.values(CENARIOS_PREVIDENCIARIOS).map((item) => (
              <option key={item.regime} value={item.regime}>
                {item.nome} · eSocial {item.codigoClassificacaoTributaria}
              </option>
            ))}
          </select>
          {cenario && <small className="field-help">{cenario.resumo}</small>}
        </label>
        <label>
          <span>Início da vigência</span>
          <input name="inicioVigencia" type="date" required />
        </label>
        <label>
          <span>Fim da vigência</span>
          <input name="fimVigencia" type="date" required />
        </label>

        {regime === "BENEFICENTE_IMUNE" && (
          <fieldset className="conditional-fields">
            <legend>Certificação CEBAS</legend>
            <label>
              <span>Número do certificado</span>
              <input name="cebasNumero" maxLength={100} required />
            </label>
            <label>
              <span>Início do CEBAS</span>
              <input name="cebasInicio" type="date" required />
            </label>
            <label>
              <span>Fim do CEBAS</span>
              <input name="cebasFim" type="date" required />
            </label>
          </fieldset>
        )}

        <label className="field-wide">
          <span>Evidência e responsável pela conferência</span>
          <textarea
            name="evidencia"
            rows={4}
            required
            maxLength={2000}
            placeholder="Documento consultado, protocolo ou certidão, data e responsável"
          />
        </label>
        <div className="modal-actions field-wide">
          <button className="button primary" type="submit">
            <Landmark size={16} /> Publicar vigência
          </button>
          <Link className="button secondary" href="/parametros">Cancelar</Link>
        </div>
      </form>
    </ModalShell>
  );
}
