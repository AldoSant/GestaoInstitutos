"use client";

import Link from "next/link";
import { Landmark } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ModalShell } from "@/components/modal-shell";
import type { InstrumentoRecolhimentoPrevidenciario } from "@/lib/perfil-recolhimento";
import { salvarPerfilRecolhimento } from "./actions";

export function PerfilRecolhimentoForm() {
  const searchParams = useSearchParams();
  const [instrumento, setInstrumento] =
    useState<InstrumentoRecolhimentoPrevidenciario>("DCTFWEB_DARF");
  const competencia = searchParams.get("competencia") ?? "";
  const inicioVigencia = /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)
    ? `${competencia}-01`
    : "";

  return (
    <ModalShell
      closeHref="/parametros"
      title="Publicar perfil de recolhimento"
      description="A escolha é congelada na apuração. GPS só deve ser usada quando houver fundamento formal e vigente para a competência."
    >
      <form action={salvarPerfilRecolhimento} className="crud-form parameter-form">
        <label className="field-wide">
          <span>Instrumento de recolhimento</span>
          <select
            name="instrumento"
            value={instrumento}
            onChange={(event) =>
              setInstrumento(event.target.value as InstrumentoRecolhimentoPrevidenciario)
            }
          >
            <option value="DCTFWEB_DARF">DCTFWeb / DARF (fluxo padrão)</option>
            <option value="GPS_EXCECAO">GPS excepcional</option>
          </select>
          <small className="field-help">
            {instrumento === "GPS_EXCECAO"
              ? "Não é uma cópia automática do legado: registre a base, o código e o responsável que confirmou a exceção."
              : "A conferência exigirá totalizador, recibo e DARF oficiais."}
          </small>
        </label>
        {instrumento === "GPS_EXCECAO" && (
          <label>
            <span>Código de receita GPS</span>
            <input
              name="codigoReceita"
              inputMode="numeric"
              pattern="[0-9]{4}"
              minLength={4}
              maxLength={4}
              required
              placeholder="Ex.: 1007"
            />
          </label>
        )}
        <label>
          <span>Início da vigência</span>
          <input name="inicioVigencia" type="date" required defaultValue={inicioVigencia} />
        </label>
        <label>
          <span>Fim da vigência</span>
          <input name="fimVigencia" type="date" required />
        </label>
        <label className="field-wide">
          <span>Fundamentação e evidência</span>
          <textarea
            name="evidencia"
            required
            minLength={20}
            maxLength={3000}
            rows={5}
            placeholder="Norma, decisão ou orientação aplicável, documento consultado, referência e data da conferência"
          />
        </label>
        <label className="field-wide">
          <span>Responsável pela conferência</span>
          <input name="responsavel" required minLength={3} maxLength={160} />
        </label>
        <div className="modal-actions field-wide">
          <button className="button primary" type="submit">
            <Landmark size={16} /> Publicar perfil
          </button>
          <Link className="button secondary" href="/parametros">Cancelar</Link>
        </div>
      </form>
    </ModalShell>
  );
}
