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
import { carregarProntidaoFgtsCompetencia } from "@/db/fgts";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";

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
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let diagnostico: Awaited<ReturnType<typeof carregarProntidaoFgtsCompetencia>>;
  try {
    empresa = await resolverEmpresaAtiva();
    diagnostico = await carregarProntidaoFgtsCompetencia(empresa.id, competencia);
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
  const prontaParaPortal = diagnostico.prontidao.prontaParaEmitirNoPortal;

  return (
    <AppShell
      title="FGTS Digital"
      eyebrow={`Competência ${rotuloCompetencia(competencia)}`}
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: prontaParaPortal ? "Pronto para emissão externa" : "Emissão bloqueada com segurança",
        text:
          "A GFD oficial é emitida exclusivamente no FGTS Digital, após as remunerações aceitas pelo eSocial. Esta tela nunca gera uma guia interna pagável.",
      }}
    >
      <section className="hero-row">
        <div>
          <span className="section-kicker">Diagnóstico da folha fechada</span>
          <h2>
            {prontaParaPortal
              ? "Competência pronta para emitir a GFD no portal oficial"
              : possuiElegiveis
                ? `${diagnostico.elegiveis} trabalhador(es) exigem validação de FGTS`
              : diagnostico.trabalhadores
                ? "FGTS mensal não aplicável aos vínculos desta competência"
                : "Nenhuma folha fechada para analisar"}
          </h2>
          <p>
            A classificação usa a categoria congelada na folha. O sistema mantém
            a emissão bloqueada até comprovar rubricas, transmissão e totalizadores
            oficiais — sem inferir base de FGTS pela remuneração total.
          </p>
        </div>
        <div className="hero-status">
          <StatusBadge tone={prontaParaPortal ? "success" : possuiElegiveis ? "warning" : "info"}>
            {prontaParaPortal ? <BadgeCheck size={14} /> : possuiElegiveis ? <AlertTriangle size={14} /> : <CircleSlash2 size={14} />}
            {prontaParaPortal ? "Pronto para portal" : possuiElegiveis ? "Ação necessária" : "Sem emissão interna"}
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
          label="Emissão oficial"
          value={prontaParaPortal ? "Liberada" : "Bloqueada"}
          detail={prontaParaPortal ? "emitir GFD no portal FGTS Digital" : "não há guia interna pagável"}
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
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Categorias encontradas na folha"
        >
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
              <h2>Controles antes da emissão</h2>
            </div>
          </div>
          <ol className="check-list">
            {diagnostico.prontidao.etapas.map((etapa, indice) => (
              <li key={etapa.id}>
                <span className={`status-badge ${etapa.concluida ? "success" : "pending"}`}>0{indice + 1}</span>
                <div>
                  <strong>{etapa.titulo}</strong>
                  <p>{etapa.orientacao}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel critical-panel">
          <div className="critical-icon"><FileInput size={22} /></div>
          <div>
            <span className="section-kicker">Limite atual</span>
            <h2>{prontaParaPortal ? "Emita a GFD no portal" : "Ainda não é uma guia pagável"}</h2>
            <p>
              {prontaParaPortal
                ? "Acesse o FGTS Digital, gere a GFD e registre o documento oficial, seu valor e comprovante nesta competência."
                : "O motor atual é de prestadores 701 e não possui rubricas de incidência de FGTS. É preciso concluir o módulo trabalhista antes de calcular ou emitir uma GFD."}
            </p>
            <div className="guided-actions">
              <Send size={18} />
              <div>
                <strong>Não há geração fictícia de guia</strong>
                <p>Apenas a GFD retornada pelo FGTS Digital, com QR Code Pix, deve ser paga.</p>
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
