import { CheckCircle2 } from "lucide-react";

const etapas = [
  ["Cálculo", "Prepara a memória"],
  ["Conferência RH", "Valida a revisão"],
  ["Fechamento", "Congela os valores"],
  ["Pagamentos", "Confere a relação"],
  ["Obrigações", "Trata a competência"],
  ["Concluído", "Disponível para consulta"],
] as const;

export function FolhaJornadaProgresso({
  etapaAtual,
  concluida = false,
}: {
  etapaAtual: number;
  concluida?: boolean;
}) {
  const etapaSegura = Math.min(Math.max(etapaAtual, 1), etapas.length);
  const percentual = concluida ? 100 : Math.round((etapaSegura / etapas.length) * 100);

  return (
    <section className="jornada-fluxo" aria-label="Etapas do processamento">
      <div className="jornada-fluxo-cabecalho">
        <span>{concluida ? "Jornada concluída" : `Etapa ${etapaSegura.toString().padStart(2, "0")} de ${etapas.length.toString().padStart(2, "0")}`}</span>
        <span>{percentual}%</span>
      </div>
      <div className="jornada-fluxo-trilho" aria-hidden="true">
        <span style={{ width: `${percentual}%` }} />
      </div>
      <ol className="jornada-etapas jornada-etapas-completa">
        {etapas.map(([titulo, detalhe], indice) => {
          const numero = indice + 1;
          const etapaConcluida = concluida || numero < etapaAtual;
          const atual = !concluida && numero === etapaAtual;
          return (
            <li
              key={titulo}
              className={etapaConcluida ? "concluida" : atual ? "atual" : "pendente"}
              aria-current={atual ? "step" : undefined}
            >
              <span>{etapaConcluida ? <CheckCircle2 size={16} /> : numero}</span>
              <div>
                <strong>{titulo}</strong>
                <small>{etapaConcluida ? "Concluído" : atual ? "Em andamento" : detalhe}</small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
