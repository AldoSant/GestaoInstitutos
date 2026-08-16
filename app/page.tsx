import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard, StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  carregarDashboardOperacional,
  type CompetenciaDashboard,
} from "@/db/dashboard";
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
  if (item.folhas === 0) return "Sem processamento";
  if (item.status_folhas !== "FECHADA") return "Processamento pendente";
  if (item.pagamentos_conformes !== item.pagamentos_total) {
    return "Pagamentos bloqueados";
  }
  if (item.obrigacao_status !== "EMITIDA") return "GPS pendente";
  return "Processamento concluído";
}

function bloqueioAtual(item: CompetenciaDashboard) {
  if (item.folhas === 0 || item.status_folhas !== "FECHADA") {
    return {
      titulo: "Processamento mensal pendente",
      texto: item.folhas
        ? `${item.folhas_fechadas} de ${item.folhas} processamento(s) estão fechados.`
        : "Crie o processamento para o termo e a meta da competência.",
      href: "/folhas",
      acao: "Abrir processamentos",
    };
  }
  if (item.pagamentos_total !== item.pagamentos_conformes) {
    return {
      titulo: "Relação de pagamentos bloqueada",
      texto: `${item.pagamentos_total - item.pagamentos_conformes} pagamento(s) possuem dados bancários incompletos ou precisam ser atualizados.`,
      href: "/folhas",
      acao: "Revisar processamentos",
    };
  }
  if (!item.obrigacao_id || item.obrigacao_status !== "EMITIDA") {
    return {
      titulo: "Guia GPS pendente",
      texto: item.obrigacao_id
        ? `Estado atual: ${item.obrigacao_status?.replaceAll("_", " ")}.`
        : "A competência ainda não possui apuração previdenciária.",
      href: "/obrigacoes",
      acao: "Abrir guias GPS",
    };
  }
  return {
    titulo: "Competência pronta para prestação de contas",
    texto: "Os processamentos e as guias GPS estão registrados para consulta.",
    href: "/obrigacoes",
    acao: "Consultar guias GPS",
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ competencia?: string | string[]; aviso?: string | string[] }>;
}) {
  const params = await searchParams;
  const competenciaSelecionada = await lerCompetenciaContexto(
    params.competencia,
  );
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarDashboardOperacional>>;
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarDashboardOperacional(
      empresa.id,
      competenciaSelecionada,
    );
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

  const atual: CompetenciaDashboard = competenciaEmFoco;
  const bloqueio = bloqueioAtual(atual);
  const competenciaAtual = atual.competencia.slice(0, 7);
  const concluida = atual.obrigacao_status === "EMITIDA";

  return (
    <AppShell
      title="Visão geral"
      eyebrow="Operação mensal"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      actions={
        <Link href={`/folhas/nova?competencia=${competenciaAtual}`} className="button primary">
          Novo processamento
        </Link>
      }
    >
      {params.aviso === "modulo-reservado" && (
        <section className="feedback-banner" role="status">
          <strong>Módulo fora da rotina atual</strong>
          <span>Esta função foi preservada no sistema, mas está desativada no operacional enxuto.</span>
        </section>
      )}
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
            {`${atual.folhas} processamento(s) · ${atual.prestadores} prestador(es)`}
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
          detail={`${atual.folhas_fechadas}/${atual.folhas} processamento(s) fechado(s)`}
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
                        {`${item.folhas} processamento(s)`}
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
                        href={rotaComCompetencia(ROTAS.folhaMensal, item.competencia.slice(0, 7))}
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

        <aside className={`panel next-action-card ${concluida ? "" : "critical-panel"}`}>
          <div className="critical-icon">
            {concluida ? (
              <CheckCircle2 size={22} />
            ) : (
              <AlertTriangle size={22} />
            )}
          </div>
          <span className="section-kicker">
            {concluida ? "Competência concluída" : "Sua próxima ação"}
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
              <dt>Guia GPS</dt>
              <dd>
                {atual.obrigacao_status?.replaceAll("_", " ") ?? "Pendente"}
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
              <strong>Cálculo e processamento</strong>
              <small>
                {`${atual.folhas_fechadas}/${atual.folhas} fechado(s)`}
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
              <strong>Guia GPS</strong>
              <small>
                {atual.obrigacao_status ?? "Ainda não preparada"}
              </small>
            </div>
          </li>
        </ol>
      </section>

      <section className="quick-grid" aria-label="Acessos operacionais">
        <Link href="/prestadores" className="quick-card">
          <UsersRound />
          <span>
            <strong>Conferir prestadores</strong>
            <small>Cadastros e incidências</small>
          </span>
          <ArrowRight />
        </Link>
        <Link
          href="/folhas"
          className="quick-card"
        >
          <BadgeDollarSign />
          <span>
            <strong>Conferir processamentos</strong>
            <small>Valores, pagamentos e relatórios</small>
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
      </section>
    </AppShell>
  );
}
