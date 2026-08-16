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
      <AppShell title="Processamentos mensais" eyebrow="PF, PJ e GPS" organization="Não configurada">
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

  return (
      <AppShell
        title="Processamentos mensais"
        eyebrow="PF, PJ e GPS"
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
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Histórico</span>
              <h2>Competências processadas</h2>
              <p>Cada lote reúne PF e PJ do instrumento. GPS é preparada somente para retenções PF.</p>
            </div>
            <StatusBadge tone={folhas.length ? "success" : "neutral"}>
              {folhas.length} lote(s)
            </StatusBadge>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Competência</th><th>Instrumento</th><th>Status</th>
                  <th>Prestadores</th><th>Proventos</th><th>INSS</th>
                  <th>IRRF</th><th>Líquido</th><th>Próximo passo</th>
                </tr>
              </thead>
              <tbody>
                {folhas.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{competencia(item.competencia)}</strong>
                      <small>Lote #{item.numero} · revisão {item.revisao}</small>
                    </td>
                    <td>
                      Termo {item.termo_numero}
                      <small>Meta {item.meta_codigo}</small>
                    </td>
                    <td>
                      <StatusBadge
                        tone={item.status === "FECHADA" ? "success" : item.status === "ABERTA" ? "warning" : "info"}
                      >
                        {nomeStatus(item.status)}
                      </StatusBadge>
                    </td>
                    <td>{item.prestadores}</td>
                    <td>{moeda(item.proventos)}</td>
                    <td>{moeda(item.inss)}</td>
                    <td>{moeda(item.irrf)}</td>
                    <td><strong>{moeda(item.liquido)}</strong></td>
                    <td>
                      <div className="table-actions">
                        <Link className="text-link" href={`/folhas/${item.id}`}>
                          {proximaAcao(item.status)} <ArrowRight size={15} />
                        </Link>
                        <Link className="text-link muted" href={`/folhas/${item.id}/consulta`}>
                          Consultar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {folhas.length === 0 && (
                  <tr><td colSpan={9} className="empty-cell">Nenhuma Folha criada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </AppShell>
  );
}
