import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  LockKeyhole,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard, StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  carregarDashboardOperacional,
  type CompetenciaDashboard,
} from "@/db/dashboard";
import { diagnosticarHomologacaoCompetencia } from "@/db/homologacoes-competencia";
import { ROTAS, rotaComCompetencia } from "@/lib/rotas";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";

export const dynamic = "force-dynamic";

function moeda(valor: string | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor ?? 0));
}

function competencia(valor: string) {
  const [ano, mes] = valor.slice(0, 7).split("-");
  return `${mes}/${ano}`;
}

function statusOperacional(item: CompetenciaDashboard) {
  if (item.folhas === 0 && item.demonstrativo_id) {
    if (item.demonstrativo_status === "FECHADO") return "Demonstrativo PJ fechado";
    if (item.demonstrativo_status === "EM_CONFERENCIA") return "Demonstrativo PJ em conferência";
    return "Demonstrativo PJ em preparação";
  }
  if (item.homologacao_status === "APROVADA") return "Fechamento aprovado";
  if (item.status_folhas !== "FECHADA") return "Folhas pendentes";
  if (item.pagamentos_conformes !== item.pagamentos_total) {
    return "Pagamentos bloqueados";
  }
  if (item.obrigacao_status !== "EMITIDA") return "Obrigação pendente";
  return "Aguardando fechamento";
}

function bloqueioAtual(item: CompetenciaDashboard) {
  if (
    item.folhas === 0 &&
    item.demonstrativo_id &&
    item.demonstrativo_status !== "FECHADO"
  ) {
    return {
      titulo: "Demonstrativo PJ pendente",
      texto: "Registre os documentos fiscais, confira as retenções informadas e feche o demonstrativo da competência.",
      href: rotaComCompetencia(ROTAS.demonstrativos, item.competencia.slice(0, 7)),
      acao: "Abrir demonstrativo",
    };
  }
  if (
    item.status_folhas !== "FECHADA" &&
    !(item.folhas === 0 && item.demonstrativo_id)
  ) {
    return {
      titulo: "Existem Folhas não fechadas",
      texto: `${item.folhas_fechadas} de ${item.folhas} Folha(s) estão fechadas.`,
      href: "/folhas",
      acao: "Abrir Folhas",
    };
  }
  if (item.pagamentos_total !== item.pagamentos_conformes) {
    return {
      titulo: "Relação de pagamentos bloqueada",
      texto: `${item.pagamentos_total - item.pagamentos_conformes} pagamento(s) possuem dados bancários incompletos ou precisam ser atualizados.`,
      href: rotaComCompetencia(ROTAS.fechamentoMensal, item.competencia.slice(0, 7)),
      acao: "Abrir fechamento",
    };
  }
  if (!item.obrigacao_id || item.obrigacao_status !== "EMITIDA") {
    return {
      titulo: "Obrigação previdenciária pendente",
      texto: item.obrigacao_id
        ? `Estado atual: ${item.obrigacao_status?.replaceAll("_", " ")}.`
        : "A competência ainda não possui apuração previdenciária.",
      href: "/obrigacoes",
      acao: "Abrir obrigações",
    };
  }
  if (item.homologacao_status !== "APROVADA") {
    return {
      titulo: "Decisão mensal pendente",
      texto: "A competência está pronta para a conferência e decisão final do RH.",
      href: rotaComCompetencia(ROTAS.fechamentoMensal, item.competencia.slice(0, 7)),
      acao: "Abrir fechamento",
    };
  }
  return {
    titulo: "Competência operacionalmente concluída",
    texto: "Folhas, pagamentos, obrigação e fechamento estão conformes.",
    href: rotaComCompetencia(ROTAS.fechamentoMensal, item.competencia.slice(0, 7)),
    acao: "Abrir dossiê",
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ competencia?: string | string[] }>;
}) {
  const params = await searchParams;
  const competenciaSelecionada = await lerCompetenciaContexto(
    params.competencia,
  );
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarDashboardOperacional>>;
  let diagnosticoAtual: Awaited<
    ReturnType<typeof diagnosticarHomologacaoCompetencia>
  > | null = null;
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarDashboardOperacional(
      empresa.id,
      competenciaSelecionada,
    );
    const competenciaEmFoco = dados.competencias.find(
      (item) => item.competencia.slice(0, 7) === competenciaSelecionada,
    );
    if (competenciaEmFoco) {
      diagnosticoAtual = await diagnosticarHomologacaoCompetencia(
        empresa.id,
        competenciaSelecionada,
      );
    }
  } catch {
    return (
      <AppShell
        title="Visão geral"
        eyebrow="Folha de prestadores"
        organization="Não configurada"
      >
        <section className="alert-box danger">
          <AlertTriangle size={22} />
          <div>
            <strong>Painel operacional indisponível</strong>
            <p>Não foi possível carregar os dados operacionais. Tente novamente.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const competenciaEmFoco = dados.competencias.find(
    (item) => item.competencia.slice(0, 7) === competenciaSelecionada,
  );
  if (!competenciaEmFoco) {
    return (
      <AppShell
        title="Visão geral"
        eyebrow="Folha de prestadores"
        organization={empresa.nomeFantasia ?? empresa.razaoSocial}
        actions={
          <Link
            href={`/folhas/nova?competencia=${competenciaSelecionada}`}
            className="button primary"
          >
            Nova Folha
          </Link>
        }
      >
        <section className="empty-state">
          <BadgeDollarSign size={30} />
          <strong>
            Nenhuma folha em {competencia(competenciaSelecionada)}
          </strong>
          <p>
            Selecione outro mês ou crie a primeira folha desta competência.
          </p>
        </section>
      </AppShell>
    );
  }

  const versaoMensalAtual =
    diagnosticoAtual?.hashFontes === competenciaEmFoco.homologacao_hash &&
    diagnosticoAtual.resumo.pronta;
  const atual: CompetenciaDashboard = {
    ...competenciaEmFoco,
    homologacao_status: versaoMensalAtual
      ? competenciaEmFoco.homologacao_status
      : null,
  };
  const bloqueio = bloqueioAtual(atual);
  const competenciaAtual = atual.competencia.slice(0, 7);
  const concluida = atual.homologacao_status === "APROVADA";
  const somentePj = atual.folhas === 0 && Boolean(atual.demonstrativo_id);

  return (
    <AppShell
      title="Visão geral"
      eyebrow="Fechamento operacional"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      actions={
        <Link
          href={somentePj
            ? rotaComCompetencia(ROTAS.demonstrativos, competenciaAtual)
            : `/folhas/nova?competencia=${competenciaAtual}`}
          className="button primary"
        >
          {somentePj ? "Abrir demonstrativo" : "Nova Folha"}
        </Link>
      }
    >
      <section className="hero-row">
        <div>
          <p className="section-kicker">Competência em foco</p>
          <h2>
            {competencia(atual.competencia)} · {statusOperacional(atual)}
          </h2>
          <p>
            Acompanhe valores, pendências e liberações até a conclusão do
            fechamento mensal.
          </p>
        </div>
        <div className="hero-status">
          <StatusBadge tone={concluida ? "success" : "warning"}>
            {concluida ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {concluida ? "Competência aprovada" : "Fechamento pendente"}
          </StatusBadge>
          <span>
            {somentePj
              ? `${atual.pagamentos_pj} pagamento(s) PJ · ${atual.prestadores} prestador(es)`
              : `${atual.folhas} Folha(s) · ${atual.prestadores} prestador(es)`}
          </span>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Resumo da competência">
        <MetricCard
          label="Prestadores"
          value={String(atual.prestadores)}
          detail={`${dados.cadastros.vinculos} vínculo(s) ativo(s) no cadastro`}
          icon={UsersRound}
          tone="blue"
        />
        <MetricCard
          label={somentePj ? "Pagamentos brutos" : "Proventos"}
          value={moeda(atual.proventos)}
          detail={somentePj
            ? "documentos fiscais da competência"
            : `${atual.folhas_fechadas}/${atual.folhas} Folha(s) fechada(s)`}
          icon={BadgeDollarSign}
        />
        <MetricCard
          label={somentePj ? "Retenções" : "Descontos"}
          value={moeda(atual.descontos)}
          detail={somentePj
            ? "informadas nos documentos fiscais"
            : `INSS ${moeda(atual.inss)} · IRRF ${moeda(atual.irrf)}`}
          icon={CircleDollarSign}
          tone="amber"
        />
        <MetricCard
          label="Líquido"
          value={moeda(atual.liquido)}
          detail={`${atual.pagamentos_conformes}/${atual.pagamentos_total} pagamento(s) apto(s)`}
          icon={Banknote}
          tone="slate"
        />
      </section>

      <section className="dashboard-grid">
        <article className="panel span-2">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Histórico</span>
              <h3>Últimas competências</h3>
            </div>
            <Link href="/folhas" className="text-link">
              Ver Folhas <ArrowRight size={15} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Situação</th>
                  <th>Prestadores</th>
                  <th>Proventos</th>
                  <th>Descontos</th>
                  <th>Líquido</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dados.competencias.map((item) => (
                  <tr key={item.competencia}>
                    <td>
                      <strong>{competencia(item.competencia)}</strong>
                      <small>
                        {item.folhas === 0 && item.demonstrativo_id
                          ? `${item.pagamentos_pj} pagamento(s) PJ`
                          : `${item.folhas} Folha(s)`}
                      </small>
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          item.homologacao_status === "APROVADA"
                            ? "success"
                            : "warning"
                        }
                      >
                        {statusOperacional(item)}
                      </StatusBadge>
                    </td>
                    <td>{item.prestadores}</td>
                    <td>{moeda(item.proventos)}</td>
                    <td>{moeda(item.descontos)}</td>
                    <td>
                      <strong>{moeda(item.liquido)}</strong>
                    </td>
                    <td>
                      <Link
                        className="row-action"
                        href={item.folhas === 0 && item.demonstrativo_id
                          ? rotaComCompetencia(ROTAS.demonstrativos, item.competencia.slice(0, 7))
                          : rotaComCompetencia(ROTAS.fechamentoMensal, item.competencia.slice(0, 7))}
                        aria-label={`Abrir ${competencia(item.competencia)}`}
                      >
                        <ArrowRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className={`panel ${concluida ? "" : "critical-panel"}`}>
          <div className="critical-icon">
            {concluida ? (
              <CheckCircle2 size={22} />
            ) : (
              <AlertTriangle size={22} />
            )}
          </div>
          <span className="section-kicker">
            {concluida ? "Fechamento concluído" : "Próximo bloqueio"}
          </span>
          <h3>{bloqueio.titulo}</h3>
          <p>{bloqueio.texto}</p>
          <dl className="reconciliation">
            <div>
              <dt>Obrigação</dt>
              <dd>{atual.obrigacao_status?.replaceAll("_", " ") ?? "Ausente"}</dd>
            </div>
            <div>
              <dt>Total previdenciário</dt>
              <dd>{moeda(atual.obrigacao_total)}</dd>
            </div>
            <div>
              <dt>Fechamento mensal</dt>
              <dd>
                {atual.homologacao_status?.replaceAll("_", " ") ?? "Pendente"}
              </dd>
            </div>
          </dl>
          <Link
            href={bloqueio.href}
            className={`button ${concluida ? "secondary" : "warning"}`}
          >
            {bloqueio.acao}
          </Link>
        </aside>
      </section>

      <section className="workflow-panel">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Etapas do mês</span>
            <h3>Da preparação ao fechamento</h3>
          </div>
          <StatusBadge tone="info">
            <LockKeyhole size={14} /> Controles atualizados
          </StatusBadge>
        </div>
        <ol className="workflow">
          <li className={dados.cadastros.vinculos > 0 ? "done" : "attention"}>
            <span>1</span>
            <div>
              <strong>Cadastros e vínculos</strong>
              <small>
                {dados.cadastros.prestadores} prestador(es) ·{" "}
                {dados.cadastros.vinculos} vínculo(s)
              </small>
            </div>
          </li>
          <li className={atual.status_folhas === "FECHADA" || somentePj ? "done" : "attention"}>
            <span>2</span>
            <div>
              <strong>{somentePj ? "Folha PF não aplicável" : "Cálculo e Folhas"}</strong>
              <small>
                {somentePj
                  ? "pagamentos PJ seguem no demonstrativo"
                  : `${atual.folhas_fechadas}/${atual.folhas} fechada(s)`}
              </small>
            </div>
          </li>
          <li
            className={
              atual.pagamentos_total === atual.pagamentos_conformes
                ? "done"
                : "attention"
            }
          >
            <span>3</span>
            <div>
              <strong>Relação de pagamentos</strong>
              <small>
                {atual.pagamentos_conformes}/{atual.pagamentos_total} conta(s)
                apta(s)
              </small>
            </div>
          </li>
          <li className={atual.obrigacao_status === "EMITIDA" ? "done" : "attention"}>
            <span>4</span>
            <div>
              <strong>Obrigação previdenciária</strong>
              <small>{atual.obrigacao_status ?? "Não apurada"}</small>
            </div>
          </li>
          <li className={concluida ? "done" : "attention"}>
            <span>5</span>
            <div>
              <strong>Fechamento mensal</strong>
              <small>
                {atual.homologacao_status ?? "Versão ainda não aprovada"}
              </small>
            </div>
          </li>
        </ol>
      </section>

      <section className="quick-grid">
        <Link href="/prestadores" className="quick-card">
          <UsersRound />
          <span>
            <strong>Conferir prestadores</strong>
            <small>Cadastros e incidências</small>
          </span>
          <ArrowRight />
        </Link>
        <Link
          href={somentePj
            ? rotaComCompetencia(ROTAS.demonstrativos, competenciaAtual)
            : "/folhas"}
          className="quick-card"
        >
          <BadgeDollarSign />
          <span>
            <strong>{somentePj ? "Conferir demonstrativo" : "Conferir folhas"}</strong>
            <small>{somentePj ? "Documentos, retenções e relação PJ" : "Valores, pagamentos e relatórios"}</small>
          </span>
          <ArrowRight />
        </Link>
        <Link href="/obrigacoes" className="quick-card">
          <FileCheck2 />
          <span>
            <strong>Conferir obrigações</strong>
            <small>Apuração, documentos e pagamento</small>
          </span>
          <ArrowRight />
        </Link>
        <Link
          href={rotaComCompetencia(ROTAS.fechamentoMensal, competenciaAtual)}
          className="quick-card"
        >
          <ClipboardCheck />
          <span>
            <strong>Fechar competência</strong>
            <small>Checklist e decisão final do RH</small>
          </span>
          <ArrowRight />
        </Link>
      </section>
    </AppShell>
  );
}
