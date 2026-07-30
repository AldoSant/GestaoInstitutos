import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  CircleSlash2,
  Database,
  ExternalLink,
  FileInput,
  Landmark,
  Send,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard, StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { diagnosticarFgtsCompetencia } from "@/db/fgts";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import { sequenciaMinimaEsocialFgtsMensal } from "@/lib/integracoes/esocial";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ competencia?: string | string[] }>;

function moeda(valor: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function rotuloCompetencia(valor: string) {
  return valor.split("-").reverse().join("/");
}

export default async function FgtsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const competencia = await lerCompetenciaContexto(params.competencia);
  const fluxo = sequenciaMinimaEsocialFgtsMensal();
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let diagnostico: Awaited<ReturnType<typeof diagnosticarFgtsCompetencia>>;
  try {
    empresa = await resolverEmpresaAtiva();
    diagnostico = await diagnosticarFgtsCompetencia(empresa.id, competencia);
  } catch {
    return (
      <AppShell
        title="FGTS Digital"
        eyebrow="Diagnóstico da competência"
        organization="Não configurada"
      >
        <section className="alert-box danger">
          <Database size={22} />
          <div>
            <strong>Diagnóstico indisponível</strong>
            <p>Não foi possível analisar as categorias da folha fechada.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const possuiElegiveis = diagnostico.elegiveis > 0;

  return (
    <AppShell
      title="FGTS Digital"
      eyebrow={`Competência ${rotuloCompetencia(competencia)}`}
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: "Emissão externa",
        text:
          "A plataforma classifica os vínculos, mas não transmite ao eSocial nem emite a GFD. A guia oficial continua sendo obtida no FGTS Digital.",
      }}
    >
      <section className="hero-row">
        <div>
          <span className="section-kicker">Diagnóstico da folha fechada</span>
          <h2>
            {possuiElegiveis
              ? `${diagnostico.elegiveis} trabalhador(es) exigem validação de FGTS`
              : diagnostico.trabalhadores
                ? "FGTS mensal não aplicável aos vínculos desta competência"
                : "Nenhuma folha fechada para analisar"}
          </h2>
          <p>
            A classificação usa a categoria congelada na folha. Valores de FGTS
            não são calculados enquanto rubricas, incidências e transmissão ao
            eSocial não estiverem homologadas.
          </p>
        </div>
        <div className="hero-status">
          <StatusBadge tone={possuiElegiveis ? "warning" : "info"}>
            {possuiElegiveis ? (
              <AlertTriangle size={14} />
            ) : (
              <CircleSlash2 size={14} />
            )}
            {possuiElegiveis ? "Ação necessária" : "Sem emissão interna"}
          </StatusBadge>
          <span>{diagnostico.folhasFechadas} folha(s) fechada(s)</span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          label="Trabalhadores analisados"
          value={String(diagnostico.trabalhadores)}
          detail={`competência ${rotuloCompetencia(competencia)}`}
          icon={UsersRound}
          tone="blue"
        />
        <MetricCard
          label="Elegíveis no MVP"
          value={String(diagnostico.elegiveis)}
          detail="categorias 101, 103 e 721"
          icon={BadgeCheck}
          tone={possuiElegiveis ? "amber" : "teal"}
        />
        <MetricCard
          label="Não elegíveis"
          value={String(diagnostico.naoElegiveis)}
          detail="inclui contribuinte individual 701"
          icon={CircleSlash2}
          tone="slate"
        />
        <MetricCard
          label="Documento para pagar"
          value="GFD oficial"
          detail="emitida no portal FGTS Digital"
          icon={Landmark}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Classificação rastreável</span>
            <h2>Categorias encontradas na folha</h2>
            <p>
              Remuneração é exibida apenas para conferência; não representa base
              de FGTS calculada.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Trabalhadores</th>
                <th>Remuneração da folha</th>
                <th>Decisão</th>
                <th>Orientação</th>
              </tr>
            </thead>
            <tbody>
              {diagnostico.grupos.map((grupo) => (
                <tr key={grupo.categoria ?? "SEM_CATEGORIA"}>
                  <td>
                    <strong>{grupo.categoria ?? "Não informada"}</strong>
                    <small>
                      {grupo.decisao.elegivel
                        ? grupo.decisao.descricao
                        : grupo.decisao.motivo}
                    </small>
                  </td>
                  <td>{grupo.trabalhadores}</td>
                  <td>{moeda(grupo.remuneracao)}</td>
                  <td>
                    <StatusBadge
                      tone={grupo.decisao.elegivel ? "warning" : "neutral"}
                    >
                      {grupo.decisao.elegivel
                        ? "Validar para FGTS"
                        : "Não emitir"}
                    </StatusBadge>
                  </td>
                  <td>
                    {grupo.decisao.elegivel
                      ? "Confirmar rubricas e transmissão com RH/contabilidade."
                      : grupo.decisao.acao}
                  </td>
                </tr>
              ))}
              {diagnostico.grupos.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    Feche a folha da competência para analisar as categorias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Cadeia oficial</span>
              <h2>Controles antes do pagamento</h2>
            </div>
          </div>
          <ol className="check-list">
            {fluxo.map((etapa) => (
              <li key={etapa.fase}>
                <span className="status-badge pending">{etapa.fase}</span>
                <div>
                  <strong>{etapa.eventos.join(", ")}</strong>
                  <p>{etapa.observacao}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel critical-panel">
          <div className="critical-icon"><FileInput size={22} /></div>
          <div>
            <span className="section-kicker">Limite atual</span>
            <h2>Sem transmissão governamental</h2>
            <p>
              Quando houver vínculo elegível, confirme categoria, rubricas e
              incidências; transmita no ambiente oficial e concilie a GFD antes
              do pagamento.
            </p>
            <div className="guided-actions">
              <Send size={18} />
              <div>
                <strong>Não há geração fictícia de guia</strong>
                <p>Apenas a GFD retornada pelo FGTS Digital deve ser paga.</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="quick-grid">
        <Link
          className="quick-card"
          href="https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital"
          target="_blank"
          rel="noreferrer"
        >
          <Landmark size={22} />
          <span><strong>FGTS Digital oficial</strong><small>Acessar portal e manuais</small></span>
          <ExternalLink size={17} />
        </Link>
        <Link
          className="quick-card"
          href="https://www.gov.br/esocial/pt-br/documentacao-tecnica"
          target="_blank"
          rel="noreferrer"
        >
          <FileInput size={22} />
          <span><strong>Documentação eSocial</strong><small>Leiautes, XSD e Web Service</small></span>
          <ExternalLink size={17} />
        </Link>
      </section>
    </AppShell>
  );
}
