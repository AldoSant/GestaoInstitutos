import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileText,
  ShieldAlert,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarObrigacoes } from "@/db/obrigacoes";
import {
  apurarObrigacao,
  cancelarObrigacaoFiscal,
  registrarDocumento,
  solicitarRetificacaoFiscal,
} from "./actions";

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
  return valor.slice(0, 7).split("-").reverse().join("/");
}

export default async function ObrigacoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let obrigacoes: Awaited<ReturnType<typeof listarObrigacoes>>;
  try {
    empresa = await resolverEmpresaAtiva();
    obrigacoes = await listarObrigacoes(empresa.id);
  } catch (error) {
    return (
      <AppShell title="Obrigações" eyebrow="PostgreSQL" organization="Não configurada">
        <section className="alert-box danger">
          <Database size={22} />
          <div><strong>Apuração indisponível</strong><p>{error instanceof Error ? error.message : "Falha ao consultar o banco."}</p></div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Obrigações"
      eyebrow="Apuração previdenciária"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: "Emissão controlada",
        text: "Segurado e patronal são apurados da Folha fechada conforme o enquadramento; nenhuma guia é liberada sem conciliação com a DCTFWeb.",
      }}
    >
      {(erro || sucesso) && (
        <section className={`feedback-banner ${erro ? "error" : "success"}`} role="status">
          <strong>{erro ? "Apuração não concluída" : "Apuração concluída"}</strong>
          <span>{erro || sucesso}</span>
        </section>
      )}

      <section className="panel cadastro-section">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Folhas fechadas</span>
            <h2>Apurar retenções dos segurados</h2>
            <p>O processo exige todas as Folhas fechadas e recompõe segurado e patronal com origem, enquadramento e snapshot. Reapurar invalida conferências documentais anteriores.</p>
          </div>
          <StatusBadge tone="warning"><ShieldAlert size={14} /> Guia ainda bloqueada</StatusBadge>
        </div>
        <form action={apurarObrigacao} className="crud-form">
          <label><span>Competência</span><input name="competencia" type="month" required /></label>
          <button className="button primary" type="submit"><FileCheck2 size={16} /> Apurar competência</button>
        </form>
      </section>

      {obrigacoes.map((item) => (
        <section className="panel" key={item.id}>
          <div className="panel-header">
            <div>
              <span className="section-kicker">{competencia(item.competencia)} · {item.tipo}</span>
              <h2>{moeda(item.total)}</h2>
              <p>{item.folhas} Folha(s) · {item.itens} item(ns) rastreáveis</p>
            </div>
            <div className="row-actions">
              <Link
                className="button secondary"
                href={`/obrigacoes/${item.id}/espelho`}
              >
                <Download size={16} /> Espelho CSV
              </Link>
              <Link
                className="button secondary"
                href={`/obrigacoes/${item.id}/relatorio`}
              >
                <FileText size={16} /> Dossiê imprimível
              </Link>
              <StatusBadge tone={item.status === "BLOQUEADA" ? "danger" : item.status === "EMITIDA" ? "success" : item.status === "CANCELADA" ? "warning" : "info"}>
                {item.status === "BLOQUEADA" ? <AlertTriangle size={14} /> : <FileCheck2 size={14} />}
                {item.status}
              </StatusBadge>
            </div>
          </div>
          <dl className="large-reconciliation">
            <div><dt>Retenção dos segurados</dt><dd>{moeda(item.segurado)}</dd><small>Alíquota conforme o regime congelado</small></div>
            <div><dt>Contribuição patronal</dt><dd>{moeda(item.patronal)}</dd><small>20% no regime geral ou zero na imunidade validada</small></div>
            <div className={item.status === "EMITIDA" ? "" : "danger"}>
              <dt>Conciliação DCTFWeb</dt>
              <dd>
                {item.status === "EMITIDA"
                  ? "DARF registrado"
                  : item.status === "CANCELADA"
                    ? "Obrigação cancelada"
                  : item.diferenca === "0.00"
                    ? "Totalizador conciliado"
                    : item.diferenca
                      ? `Diferença ${moeda(item.diferenca)}`
                      : "Pendente"}
              </dd>
              <small>{item.bloqueio_motivo ?? "Documento verificado e conciliado."}</small>
            </div>
          </dl>
          {item.status !== "CANCELADA" && (
            <>
              <div className="panel-header">
                <div>
                  <span className="section-kicker">Evidência externa</span>
                  <h3>Registrar documento da DCTFWeb</h3>
                  <p>
                    Marcar como verificado altera o estado somente se os valores
                    satisfizerem as travas de conciliação.
                  </p>
                </div>
              </div>
              <form action={registrarDocumento} className="crud-form">
                <input type="hidden" name="obrigacaoId" value={item.id} />
                <label>
                  <span>Tipo</span>
                  <select name="tipo" required defaultValue="">
                    <option value="" disabled>Selecione</option>
                    <option value="TOTALIZADOR_DCTFWEB">Totalizador DCTFWeb</option>
                    <option value="RECIBO_DCTFWEB">Recibo DCTFWeb</option>
                    <option value="DARF">DARF</option>
                  </select>
                </label>
                <label><span>Referência/protocolo</span><input name="referencia" required maxLength={160} /></label>
                <label><span>Valor total (recibo pode ficar vazio)</span><input name="valorTotal" inputMode="decimal" placeholder="0,00" /></label>
                <label><span>Data de emissão</span><input name="emitidoEm" type="date" required /></label>
                <label className="field-wide"><span>Localizador do documento</span><input name="localizador" required maxLength={2000} placeholder="Caminho interno, ID do arquivo ou protocolo" /></label>
                <label className="field-wide"><span>Hash SHA-256, se disponível</span><input name="hashSha256" maxLength={64} /></label>
                <label className="checkbox-field"><input name="verificado" type="checkbox" /><span>Documento conferido contra o portal oficial</span></label>
                <button className="button secondary" type="submit"><FileCheck2 size={16} /> Registrar documento</button>
              </form>
            </>
          )}
          {item.documentos.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>Referência</th><th>Emissão</th><th>Valor</th><th>Conferência</th><th>Localizador</th></tr></thead>
                <tbody>
                  {item.documentos.map((documento) => (
                    <tr key={documento.id}>
                      <td>{documento.tipo}</td>
                      <td><strong>{documento.referencia}</strong><small>{documento.hashSha256 ? `SHA-256 ${documento.hashSha256.slice(0, 12)}…` : "Sem hash informado"}</small></td>
                      <td>{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${documento.emitidoEm}T00:00:00Z`))}</td>
                      <td>{moeda(documento.valorTotal)}</td>
                      <td><StatusBadge tone={documento.verificado ? "success" : "warning"}>{documento.verificado ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{documento.verificado ? "Verificado" : "Pendente"}</StatusBadge></td>
                      <td>{documento.localizador}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {item.status === "EMITIDA" &&
            !item.retificacoes.some((retificacao) =>
              ["SOLICITADA", "EM_ANDAMENTO"].includes(retificacao.status),
            ) && (
              <details>
                <summary className="button secondary">
                  <RotateCcw size={16} /> Iniciar retificação formal
                </summary>
                <form action={solicitarRetificacaoFiscal} className="crud-form">
                  <input type="hidden" name="obrigacaoId" value={item.id} />
                  <label>
                    <span>Responsável</span>
                    <input
                      name="responsavel"
                      required
                      minLength={3}
                      maxLength={160}
                    />
                  </label>
                  <label className="field-wide">
                    <span>Motivo e referência administrativa</span>
                    <textarea
                      name="motivo"
                      required
                      minLength={20}
                      maxLength={3000}
                      placeholder="Descreva o erro, a origem, o documento que autorizou a correção e o resultado esperado"
                    />
                  </label>
                  <button className="button secondary" type="submit">
                    <RotateCcw size={16} /> Congelar original e abrir retificação
                  </button>
                </form>
              </details>
            )}
          {item.retificacoes.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Retificação</th>
                    <th>Estado</th>
                    <th>Responsável</th>
                    <th>Motivo</th>
                    <th>Snapshot anterior</th>
                    <th>Protocolo</th>
                  </tr>
                </thead>
                <tbody>
                  {item.retificacoes.map((retificacao) => (
                    <tr key={retificacao.id}>
                      <td>
                        <strong>v{retificacao.versao}</strong>
                        <small>
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "America/Bahia",
                          }).format(new Date(retificacao.solicitadaEm))}
                        </small>
                      </td>
                      <td>
                        <StatusBadge
                          tone={
                            retificacao.status === "CONCLUIDA"
                              ? "success"
                              : retificacao.status === "CANCELADA"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {retificacao.status.replaceAll("_", " ")}
                        </StatusBadge>
                      </td>
                      <td>{retificacao.responsavel}</td>
                      <td>{retificacao.motivo}</td>
                      <td>
                        SHA-256
                        <small>{retificacao.hashSnapshotAnterior}</small>
                      </td>
                      <td>{retificacao.protocolo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {["RASCUNHO", "BLOQUEADA", "APURADA"].includes(item.status) && (
            <details>
              <summary className="button secondary">
                <XCircle size={16} /> Cancelar obrigação
              </summary>
              <form action={cancelarObrigacaoFiscal} className="crud-form">
                <input type="hidden" name="obrigacaoId" value={item.id} />
                <label className="field-wide">
                  <span>Motivo do cancelamento</span>
                  <input
                    name="motivo"
                    required
                    minLength={10}
                    maxLength={2000}
                    placeholder="Informe a decisão, o responsável e a referência administrativa"
                  />
                </label>
                <button className="button secondary" type="submit">
                  <XCircle size={16} /> Confirmar cancelamento
                </button>
              </form>
            </details>
          )}
          <details>
            <summary className="button secondary"><FileText size={16} /> Conferir itens</summary>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Prestador</th><th>Natureza</th><th>Base</th><th>Alíquota</th><th>Valor</th><th>Folha</th></tr></thead>
                <tbody>
                  {item.itens_detalhe.map((linha) => {
                    const snapshot = linha.snapshot as {
                      pessoa?: { nome?: string };
                      prestador?: { matricula?: string };
                      folhaNumero?: number;
                      folhaRevisao?: number;
                    };
                    return (
                      <tr key={linha.id}>
                        <td><strong>{snapshot.pessoa?.nome ?? "Prestador"}</strong><small>Matrícula {snapshot.prestador?.matricula ?? "—"}</small></td>
                        <td>{linha.natureza}<small>{linha.descricao}</small></td>
                        <td>{moeda(linha.baseCalculo)}</td>
                        <td>{linha.aliquota ? `${Number(linha.aliquota).toLocaleString("pt-BR")}%` : "—"}</td>
                        <td><strong>{moeda(linha.valor)}</strong></td>
                        <td>Lote {snapshot.folhaNumero ?? "—"}<small>Revisão {snapshot.folhaRevisao ?? "—"}</small></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      ))}

      {obrigacoes.length === 0 && (
        <section className="alert-box">
          <ShieldAlert size={22} />
          <div><strong>Nenhuma competência apurada</strong><p>Feche uma Folha e execute a apuração acima.</p></div>
        </section>
      )}
    </AppShell>
  );
}
