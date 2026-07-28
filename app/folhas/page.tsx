import Link from "next/link";
import { ArrowRight, Database, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
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
  if (status === "RASCUNHO") return "Na fila";
  if (status === "PROCESSANDO") return "Processando";
  if (status === "ABERTA") return "Em conferência";
  if (status === "FECHADA") return "Fechada";
  return status;
}

export default async function FolhasPage() {
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let folhas: Awaited<ReturnType<typeof listarFolhas>>;
  try {
    empresa = await resolverEmpresaAtiva();
    folhas = await listarFolhas(empresa.id);
  } catch (error) {
    return (
      <AppShell title="Folhas" eyebrow="PostgreSQL" organization="Não configurada">
        <section className="alert-box danger">
          <Database size={22} />
          <div>
            <strong>Folhas indisponíveis</strong>
            <p>{error instanceof Error ? error.message : "Não foi possível consultar o banco."}</p>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
      <AppShell
        title="Folhas"
        eyebrow="Processamento mensal"
        organization={empresa.nomeFantasia ?? empresa.razaoSocial}
        actions={
          <Link href="/folhas/nova" className="button primary">
            <Plus size={16} /> Nova folha
          </Link>
        }
        notice={{
          label: "Persistência operacional",
          text: "Cada lote é calculado pelo worker, recebe memória e só fecha após conferência do hash.",
        }}
      >
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Histórico</span>
              <h2>Competências processadas</h2>
              <p>Folhas reais do PostgreSQL, separadas por Termo, Meta e lote.</p>
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
                  <th>IRRF</th><th>Líquido</th><th></th>
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
                      <Link className="row-action" href={`/folhas/${item.id}`} aria-label="Abrir Folha">
                        <ArrowRight size={17} />
                      </Link>
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
