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
  if (item.homologacao_status === "APROVADA") return "Homologada";
  if (item.status_folhas !== "FECHADA") return "Folhas pendentes";
  if (item.pagamentos_conformes !== item.pagamentos_total) {
    return "Pagamentos bloqueados";
  }
  if (item.obrigacao_status !== "EMITIDA") return "Obrigação pendente";
  return "Aguardando homologação";
}

function bloqueioAtual(item: CompetenciaDashboard) {
  if (item.status_folhas !== "FECHADA") {
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
      texto: `${item.pagamentos_total - item.pagamentos_conformes} pagamento(s) possuem conta incompleta ou snapshot anterior ao controle bancário.`,
      href: `/homologacoes?competencia=${item.competencia.slice(0, 7)}`,
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
      texto: "Os controles operacionais precisam ser congelados e aprovados na mesma versão.",
      href: `/homologacoes?competencia=${item.competencia.slice(0, 7)}`,
      acao: "Abrir homologação",
    };
  }
  return {
    titulo: "Competência operacionalmente concluída",
    texto: "Folhas, pagamentos, obrigação e homologação estão conformes.",
    href: `/homologacoes?competencia=${item.competencia.slice(0, 7)}`,
    acao: "Abrir dossiê",
  };
}

export default async function Home() {
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarDashboardOperacional>>;
  let diagnosticoAtual: Awaited<
    ReturnType<typeof diagnosticarHomologacaoCompetencia>
  > | null = null;
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarDashboardOperacional(empresa.id);
    if (dados.competencias[0]) {
      diagnosticoAtual = await diagnosticarHomologacaoCompetencia(
        empresa.id,
        dados.competencias[0].competencia.slice(0, 7),
      );
    }
  } catch (error) {
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
            <p>
              {error instanceof Error
                ? error.message
                : "Não foi possível consultar o PostgreSQL."}
            </p>
          </div>
        </section>
      </AppShell>
    );
  }

  const competenciaMaisRecente = dados.competencias[0];
  if (!competenciaMaisRecente) {
    return (
      <AppShell
        title="Visão geral"
        eyebrow="Folha de prestadores"
        organization={empresa.nomeFantasia ?? empresa.razaoSocial}
        actions={
          <Link href="/folhas/nova" className="button primary">
            Nova Folha
          </Link>
        }
      >
        <section className="empty-state">
          <BadgeDollarSign size={30} />
          <strong>Nenhuma competência processada</strong>
          <p>
            Cadastre vínculos e crie a primeira Folha. Este painel não usa dados
            demonstrativos.
          </p>
        </section>
      </AppShell>
    );
  }

  const versaoMensalAtual =
    diagnosticoAtual?.hashFontes === competenciaMaisRecente.homologacao_hash &&
    diagnosticoAtual.resumo.pronta;
  const atual: CompetenciaDashboard = {
    ...competenciaMaisRecente,
    homologacao_status: versaoMensalAtual
      ? competenciaMaisRecente.homologacao_status
      : null,
  };
  const bloqueio = bloqueioAtual(atual);
  const competenciaAtual = atual.competencia.slice(0, 7);
  const concluida = atual.homologacao_status === "APROVADA";

  return (
    <AppShell
      title="Visão geral"
      eyebrow="Fechamento operacional"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      actions={
        <Link href="/folhas/nova" className="button primary">
          Nova Folha
        </Link>
      }
    >
      <section className="hero-row">
        <div>
          <p className="section-kicker">Competência mais recente</p>
          <h2>
            {competencia(atual.competencia)} · {statusOperacional(atual)}
          </h2>
          <p>
            Informações calculadas diretamente do PostgreSQL. A competência só é
            concluída quando os oito controles usam a mesma versão de fontes.
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
            {atual.folhas} Folha(s) · {atual.prestadores} prestador(es)
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
          label="Proventos"
          value={moeda(atual.proventos)}
          detail={`${atual.folhas_fechadas}/${atual.folhas} Folha(s) fechada(s)`}
          icon={BadgeDollarSign}
        />
        <MetricCard
          label="Descontos"
          value={moeda(atual.descontos)}
          detail={`INSS ${moeda(atual.inss)} · IRRF ${moeda(atual.irrf)}`}
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
              <span className="section-kicker">Histórico real</span>
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
                      <small>{item.folhas} Folha(s)</small>
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
                        href={`/homologacoes?competencia=${item.competencia.slice(0, 7)}`}
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
              <dt>Homologação</dt>
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
            <span className="section-kicker">Cadeia auditável</span>
            <h3>Da entrada ao fechamento</h3>
          </div>
          <StatusBadge tone="info">
            <LockKeyhole size={14} /> Fontes versionadas
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
          <li className={atual.status_folhas === "FECHADA" ? "done" : "attention"}>
            <span>2</span>
            <div>
              <strong>Cálculo e Folhas</strong>
              <small>
                {atual.folhas_fechadas}/{atual.folhas} fechada(s)
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
              <strong>Homologação mensal</strong>
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
        <Link href="/folhas" className="quick-card">
          <BadgeDollarSign />
          <span>
            <strong>Auditar Folhas</strong>
            <small>Memórias, pagamentos e relatórios</small>
          </span>
          <ArrowRight />
        </Link>
        <Link href="/obrigacoes" className="quick-card">
          <FileCheck2 />
          <span>
            <strong>Conciliar obrigação</strong>
            <small>Totalizador, recibo e DARF</small>
          </span>
          <ArrowRight />
        </Link>
        <Link
          href={`/homologacoes?competencia=${competenciaAtual}`}
          className="quick-card"
        >
          <ClipboardCheck />
          <span>
            <strong>Fechar competência</strong>
            <small>Oito controles e decisão final</small>
          </span>
          <ArrowRight />
        </Link>
      </section>
    </AppShell>
  );
}
