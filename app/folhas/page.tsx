import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  ClipboardCheck,
  Database,
  LockKeyhole,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard, StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarFolhas } from "@/db/folhas";

export const dynamic = "force-dynamic";

function moeda(valor: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function competencia(valor: string) {
  const [ano, mes] = valor.split("-");
  return `${mes}/${ano}`;
}

function nomeStatus(status: string) {
  if (status === "RASCUNHO") return "Aguardando cálculo";
  if (status === "PROCESSANDO") return "Processando";
  if (status === "ABERTA") return "Em conferência";
  if (status === "FECHADA") return "Fechada";
  return status;
}

function proximaAcao(status: string) {
  if (status === "RASCUNHO" || status === "PROCESSANDO") {
    return "Acompanhar cálculo";
  }
  if (status === "ABERTA") return "Conferir e fechar";
  if (status === "FECHADA") return "Ver pagamentos";
  return "Abrir folha";
}

export default async function FolhasPage() {
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let folhas: Awaited<ReturnType<typeof listarFolhas>>;
  try {
    empresa = await resolverEmpresaAtiva();
    folhas = await listarFolhas(empresa.id);
  } catch {
    return (
      <AppShell title="Folha mensal" eyebrow="Processamento e conferência" organization="Não configurada">
        <section className="alert-box danger">
          <Database size={22} />
          <div>
            <strong>Processamentos indisponíveis</strong>
            <p>Não foi possível carregar as competências. Tente novamente.</p>
          </div>
        </section>
      </AppShell>
    );
  }
  const processando = folhas.filter((item) =>
    ["RASCUNHO", "PROCESSANDO"].includes(item.status),
  ).length;
  const emConferencia = folhas.filter((item) => item.status === "ABERTA").length;
  const fechadas = folhas.filter((item) => item.status === "FECHADA").length;
  const filas = [
    {
      chave: "preparo",
      titulo: "Em preparação",
      descricao: "Lotes aguardando cálculo ou memória de processamento.",
      itens: folhas.filter((item) => ["RASCUNHO", "PROCESSANDO"].includes(item.status)),
    },
    {
      chave: "conferencia",
      titulo: "Decisão do RH",
      descricao: "Revisões calculadas que exigem conferência antes do fechamento.",
      itens: folhas.filter((item) => item.status === "ABERTA"),
    },
    {
      chave: "fechadas",
      titulo: "Encaminhadas",
      descricao: "Folhas com memória congelada, prontas para pagamentos e obrigações.",
      itens: folhas.filter((item) => item.status === "FECHADA"),
    },
  ];

  return (
      <AppShell
        title="Folha mensal"
        eyebrow="Processamento e conferência"
        organization={empresa.nomeFantasia ?? empresa.razaoSocial}
        actions={
          <Link href="/folhas/nova" className="button primary">
            <Plus size={16} /> Novo processamento
          </Link>
        }
      >
        <section className="metrics-grid" aria-label="Situação dos processamentos">
          <MetricCard
            label="Em cálculo"
            value={String(processando)}
            detail="lotes aguardando memória"
            icon={Calculator}
            tone="blue"
          />
          <MetricCard
            label="Em conferência"
            value={String(emConferencia)}
            detail="exigem decisão do RH"
            icon={ClipboardCheck}
            tone="amber"
          />
          <MetricCard
            label="Fechadas"
            value={String(fechadas)}
            detail="memória congelada"
            icon={LockKeyhole}
          />
        </section>
        <section className="processamento-board" aria-label="Quadro de processamentos">
          <header className="processamento-board-header">
            <div>
              <span className="section-kicker">Acompanhar a operação</span>
              <h2>Processamentos por próximo passo</h2>
              <p>Cada lote avança pela conferência, fechamento, pagamentos e obrigações sem perder sua consulta completa.</p>
            </div>
            <StatusBadge tone={folhas.length ? "success" : "neutral"}>
              {folhas.length} lote(s)
            </StatusBadge>
          </header>
          <div className="processing-lanes">
            {filas.map((fila) => (
              <section className={`processing-lane ${fila.chave}`} key={fila.chave}>
                <header>
                  <span>{fila.itens.length}</span>
                  <div>
                    <h3>{fila.titulo}</h3>
                    <p>{fila.descricao}</p>
                  </div>
                </header>
                <div className="processing-lane-items">
                  {fila.itens.map((item) => (
                    <article className="processing-ticket" key={item.id}>
                      <div className="processing-ticket-heading">
                        <div>
                          <span className="section-kicker">{competencia(item.competencia)}</span>
                          <h4>Termo {item.termo_numero} · Meta {item.meta_codigo}</h4>
                        </div>
                        <StatusBadge tone={item.status === "FECHADA" ? "success" : item.status === "ABERTA" ? "warning" : "info"}>
                          {nomeStatus(item.status)}
                        </StatusBadge>
                      </div>
                      <dl>
                        <div><dt>Prestadores</dt><dd>{item.prestadores}</dd></div>
                        <div><dt>Líquido</dt><dd>{moeda(item.liquido)}</dd></div>
                      </dl>
                      <small>Lote #{item.numero} · revisão {item.revisao}</small>
                      <div className="processing-ticket-actions">
                        <Link className="button primary" href={`/folhas/${item.id}`}>
                          {proximaAcao(item.status)} <ArrowRight size={15} />
                        </Link>
                        <Link className="text-link muted" href={`/folhas/${item.id}/consulta`}>
                          Consulta completa
                        </Link>
                      </div>
                    </article>
                  ))}
                  {fila.itens.length === 0 && (
                    <div className="processing-lane-empty">Nenhum processamento nesta etapa.</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>
      </AppShell>
  );
}
