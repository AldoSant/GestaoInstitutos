import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
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
        <section className="empty-state quiet-empty-state" role="alert">
          <AlertTriangle size={22} />
          <div>
            <strong>Painel operacional indisponível</strong>
            <p>Não foi possível carregar os dados operacionais agora. Nenhum dado foi alterado; tente novamente em instantes.</p>
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
        <section className="empty-state quiet-empty-state">
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
      <div className="quiet-home">
        {params.aviso === "modulo-reservado" && (
          <section className="feedback-banner" role="status">
            <strong>Módulo fora da rotina atual</strong>
            <span>Esta função foi preservada no sistema, mas está desativada no operacional enxuto.</span>
          </section>
        )}
        <section className="quiet-home-focus">
          <div>
            <span className="section-kicker">Competência em foco · {competencia(atual.competencia)}</span>
            <h2>{concluida ? "O mês está em ordem." : "A operação pede uma decisão."}</h2>
            <p>{concluida ? "Os registros e documentos estão disponíveis para consulta." : bloqueio.texto}</p>
          </div>
          <div className="quiet-home-focus-status">
            {concluida ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
            <span>{statusOperacional(atual)}</span>
          </div>
        </section>

        <section className="quiet-home-totals" aria-label="Resumo da competência">
          <div><span>Prestadores</span><strong>{atual.prestadores}</strong><small>{dados.cadastros.vinculos} vínculos ativos</small></div>
          <div><span>Proventos</span><strong>{moeda(atual.proventos)}</strong><small>{atual.folhas_fechadas}/{atual.folhas} folhas fechadas</small></div>
          <div><span>Descontos</span><strong>{moeda(atual.descontos)}</strong><small>INSS + IRRF</small></div>
          <div><span>Líquido</span><strong>{moeda(atual.liquido)}</strong><small>{atual.pagamentos_conformes}/{atual.pagamentos_total} pagamentos aptos</small></div>
        </section>

        <section className="quiet-home-grid">
          <article className="quiet-home-action">
            <span className="section-kicker">Próxima ação</span>
            <h3>{bloqueio.titulo}</h3>
            <p>{bloqueio.texto}</p>
            <Link href={bloqueio.href} className="button primary">{bloqueio.acao} <ArrowRight size={16} /></Link>
          </article>
          <article className="quiet-home-timeline">
            <span className="section-kicker">Ritmo do mês</span>
            <ol>
              <li className={dados.cadastros.vinculos > 0 ? "done" : ""}><span>01</span><div><strong>Cadastros</strong><small>{dados.cadastros.vinculos} vínculos em operação</small></div></li>
              <li className={atual.status_folhas === "FECHADA" ? "done" : "current"}><span>02</span><div><strong>Folha</strong><small>{atual.folhas_fechadas}/{atual.folhas} processamento(s) fechado(s)</small></div></li>
              <li className={atual.pagamentos_total === atual.pagamentos_conformes ? "done" : ""}><span>03</span><div><strong>Pagamentos</strong><small>{atual.pagamentos_conformes}/{atual.pagamentos_total} conta(s) apta(s)</small></div></li>
              <li className={concluida ? "done" : ""}><span>04</span><div><strong>Obrigações</strong><small>{atual.obrigacao_status?.replaceAll("_", " ") ?? "Aguardando apuração"}</small></div></li>
            </ol>
          </article>
        </section>

        <section className="quiet-home-records">
          <div className="quiet-home-records-head"><div><span className="section-kicker">Arquivo vivo</span><h3>Últimas competências</h3></div><Link href="/folhas" className="text-link">Ver todas <ArrowRight size={15} /></Link></div>
          <div className="table-wrap"><table><thead><tr><th>Competência</th><th>Situação</th><th>Prestadores</th><th>Líquido</th><th></th></tr></thead><tbody>{dados.competencias.map((item) => <tr key={item.competencia}><td><strong>{competencia(item.competencia)}</strong></td><td>{statusOperacional(item)}</td><td>{item.prestadores}</td><td><strong>{moeda(item.liquido)}</strong></td><td><Link className="row-action" href={rotaComCompetencia(ROTAS.folhaMensal, item.competencia.slice(0, 7))} aria-label={`Abrir ${competencia(item.competencia)}`}><ArrowRight size={17} /></Link></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </AppShell>
  );
}
