import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  RefreshCw,
  UnlockKeyhole,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";
import {
  fechar,
  reabrir,
  registrarConferencia,
  solicitarReprocessamento,
} from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  erro?: string | string[];
  sucesso?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

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

export default async function FolhaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ competencia: string }>;
  searchParams: SearchParams;
}) {
  const { competencia: folhaId } = await params;
  const mensagens = await searchParams;
  const erro = primeiro(mensagens.erro);
  const sucesso = primeiro(mensagens.sucesso);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarFolha>>;
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarFolha(empresa.id, folhaId);
  } catch {
    notFound();
  }
  const folha = dados.folha;
  const conferenciaAtual = dados.conferencias.find(
    (item) => item.hash_resultado === folha.hash_resultado,
  );
  const aprovadaPeloRh = conferenciaAtual?.resultado === "APROVADA";
  const totais = dados.itens.reduce(
    (total, item) => ({
      proventos: total.proventos + Number(item.total_proventos),
      descontos: total.descontos + Number(item.total_descontos),
      liquido: total.liquido + Number(item.total_liquido),
    }),
    { proventos: 0, descontos: 0, liquido: 0 },
  );
  return (
      <AppShell
        title={`Competência ${competencia(folha.competencia)}`}
        eyebrow={`Termo ${folha.termo_numero} · Meta ${folha.meta_codigo} · lote ${folha.numero}`}
        organization={empresa.nomeFantasia ?? empresa.razaoSocial}
        actions={
          folha.hash_resultado ? (
            <div className="row-actions">
              <Link className="button secondary" href={`/folhas/${folha.id}/conferencia`}>
                <FileSpreadsheet size={16} /> Conferência CSV
              </Link>
              <Link className="button secondary" href={`/folhas/${folha.id}/memoria`}>
                <Download size={16} /> Memória JSON
              </Link>
            </div>
          ) : undefined
        }
      >
        <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar para folhas</Link>
        {(erro || sucesso) && (
          <section className={`feedback-banner ${erro ? "error" : "success"}`} role="status">
            <strong>{erro ? "Operação não concluída" : "Operação concluída"}</strong>
            <span>{erro || sucesso}</span>
          </section>
        )}
        <section className="detail-summary">
          <div><span>Status</span><StatusBadge>{nomeStatus(folha.status)}</StatusBadge></div>
          <div><span>Prestadores</span><strong>{dados.itens.length}</strong></div>
          <div><span>Proventos</span><strong>{moeda(String(totais.proventos))}</strong></div>
          <div><span>Descontos</span><strong>{moeda(String(totais.descontos))}</strong></div>
          <div><span>Líquido</span><strong>{moeda(String(totais.liquido))}</strong></div>
          <div className="locked">
            <LockKeyhole size={17} />
            <span>Regra congelada</span>
            <strong>{folha.regra_codigo ? `v${folha.regra_versao}` : "Aguardando"}</strong>
          </div>
          <div className="locked">
            <LockKeyhole size={17} />
            <span>Previdência</span>
            <strong>
              {folha.regime_previdenciario === "BENEFICENTE_IMUNE"
                ? "Imune · segurado 20%"
                : folha.regime_previdenciario === "EMPRESA_GERAL"
                  ? "Geral · segurado 11%"
                  : "Aguardando"}
            </strong>
          </div>
        </section>

        {folha.status === "RASCUNHO" && (
          <section className="alert-box">
            <RefreshCw size={22} />
            <div><strong>Processamento enfileirado</strong><p>O worker materializará esta revisão. Atualize a página em alguns instantes.</p></div>
          </section>
        )}

        {folha.status === "ABERTA" && (
          <>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">Validação operacional</span>
                  <h2>Conferência formal do RH</h2>
                  <p>A decisão vale somente para o hash desta revisão. Reprocessar exige uma nova conferência.</p>
                </div>
                <StatusBadge tone={aprovadaPeloRh ? "success" : conferenciaAtual ? "danger" : "info"}>
                  {aprovadaPeloRh ? "Aprovada pelo RH" : conferenciaAtual ? "Rejeitada pelo RH" : "Pendente"}
                </StatusBadge>
              </div>
              <form action={registrarConferencia} className="crud-form vinculo-form">
                <input type="hidden" name="folhaId" value={folha.id} />
                <label>
                  <span>Resultado</span>
                  <select name="resultado" required defaultValue="APROVADA">
                    <option value="APROVADA">Aprovada</option>
                    <option value="REJEITADA">Rejeitada</option>
                  </select>
                </label>
                <label>
                  <span>Responsável pela conferência</span>
                  <input name="conferente" required minLength={3} maxLength={160} placeholder="Nome da responsável do RH" />
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" name="confirmouCadastros" />
                  <span>Cadastros conferidos</span>
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" name="confirmouValores" />
                  <span>Valores e líquido conferidos</span>
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" name="confirmouRubricas" />
                  <span>Rubricas e incidências conferidas</span>
                </label>
                <label className="field-wide">
                  <span>Observação — obrigatória na rejeição</span>
                  <input name="observacao" maxLength={2000} placeholder="Registre divergências ou ressalvas" />
                </label>
                <button className="button secondary" type="submit">
                  <ClipboardCheck size={16} /> Registrar decisão
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div><span className="section-kicker">Fechamento</span><h2>Ações da revisão {folha.revisao}</h2><p>O fechamento exige a aprovação vigente do RH e reconfere o hash.</p></div>
                <div className="row-actions">
                  <form action={solicitarReprocessamento}>
                    <input type="hidden" name="folhaId" value={folha.id} />
                    <button className="button secondary" type="submit"><RefreshCw size={16} /> Reprocessar</button>
                  </form>
                  <form action={fechar}>
                    <input type="hidden" name="folhaId" value={folha.id} />
                    <button className="button primary" type="submit" disabled={!aprovadaPeloRh}><LockKeyhole size={16} /> Fechar Folha</button>
                  </form>
                </div>
              </div>
            </section>
          </>
        )}

        {folha.status === "FECHADA" && (
          <section className="panel">
            <div className="panel-header">
              <div><span className="section-kicker">Exceção auditada</span><h2>Reabrir Folha</h2><p>A memória permanece congelada até uma justificativa válida ser registrada.</p></div>
            </div>
            <form action={reabrir} className="crud-form">
              <input type="hidden" name="folhaId" value={folha.id} />
              <label className="field-wide"><span>Motivo obrigatório</span><input name="motivo" required minLength={10} maxLength={2000} placeholder="Descreva por que a Folha precisa ser reaberta" /></label>
              <button className="button secondary" type="submit"><UnlockKeyhole size={16} /> Reabrir com auditoria</button>
            </form>
          </section>
        )}

        <section className="panel">
          <div className="panel-header">
            <div><span className="section-kicker">Memória individual</span><h2>Prestadores calculados</h2><p>Valores e rubricas congelados nesta revisão.</p></div>
            {folha.hash_resultado && <StatusBadge tone="info">Hash {folha.hash_resultado.slice(0, 12)}…</StatusBadge>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Prestador</th><th>Atividade</th><th>Proventos</th><th>INSS</th><th>IRRF</th><th>Descontos</th><th>Líquido</th><th>Memória</th></tr></thead>
              <tbody>
                {dados.itens.map((item) => {
                  const snapshot = item.snapshots as {
                    pessoa?: { nome?: string; tipo?: string };
                    prestador?: { matricula?: string };
                    vinculo?: { atividade?: string };
                  };
                  return (
                    <tr key={item.id}>
                      <td><strong>{snapshot.pessoa?.nome ?? "Prestador"}</strong><small>Matrícula {snapshot.prestador?.matricula ?? "—"}</small></td>
                      <td>{snapshot.vinculo?.atividade ?? "—"}<small>{snapshot.pessoa?.tipo ?? "—"}</small></td>
                      <td>{moeda(item.total_proventos)}</td>
                      <td>{moeda(item.valor_inss)}</td>
                      <td>{moeda(item.valor_irrf)}</td>
                      <td>{moeda(item.total_descontos)}</td>
                      <td><strong>{moeda(item.total_liquido)}</strong></td>
                      <td>
                        <details>
                          <summary className="icon-button" aria-label="Abrir memória"><FileText size={17} /></summary>
                          <div className="memory-detail">
                            {(item.eventos as Array<Record<string, unknown>>).map((linha) => (
                              <p key={String(linha.id)}>
                                <strong>{String(linha.codigo)}</strong> · {String(linha.descricao)}
                                <small>{String(linha.natureza)} · {moeda(String(linha.valor))}</small>
                              </p>
                            ))}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
                {dados.itens.length === 0 && <tr><td colSpan={8} className="empty-cell">Aguardando processamento.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div><span className="section-kicker">Conferência do RH</span><h2>Decisões registradas</h2><p>Registros imutáveis vinculados à revisão e ao hash processado.</p></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Revisão</th><th>Resultado</th><th>Responsável</th><th>Checklist</th><th>Observação</th></tr></thead>
              <tbody>
                {dados.conferencias.map((item) => (
                  <tr key={item.id}>
                    <td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.criado_em))}</td>
                    <td>{item.revisao}<small>Hash {item.hash_resultado.slice(0, 12)}…</small></td>
                    <td><StatusBadge tone={item.resultado === "APROVADA" ? "success" : "danger"}>{item.resultado === "APROVADA" ? "Aprovada" : "Rejeitada"}</StatusBadge></td>
                    <td>{item.conferente}</td>
                    <td>
                      Cadastros {item.confirmou_cadastros ? "✓" : "—"} · Valores {item.confirmou_valores ? "✓" : "—"} · Rubricas {item.confirmou_rubricas ? "✓" : "—"}
                    </td>
                    <td>{item.observacao || "Sem ressalvas"}</td>
                  </tr>
                ))}
                {dados.conferencias.length === 0 && <tr><td colSpan={6} className="empty-cell">Nenhuma decisão do RH registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div><span className="section-kicker">Auditoria</span><h2>Histórico de estados</h2></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Transição</th><th>Ator</th><th>Motivo</th></tr></thead>
              <tbody>{dados.historico.map((item, indice) => (
                <tr key={`${item.ocorrido_em}-${indice}`}>
                  <td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.ocorrido_em))}</td>
                  <td>{item.status_anterior ?? "—"} → {item.status_novo}</td>
                  <td>{item.ator}</td>
                  <td>{item.motivo ?? "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </AppShell>
  );
}
