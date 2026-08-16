import Link from "next/link";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  ReceiptText,
  ShieldAlert,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BloqueioOrientado } from "@/components/bloqueio-orientado";
import { MetricCard, StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  diagnosticarCompetenciaObrigacao,
  listarObrigacoes,
} from "@/db/obrigacoes";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import { orientarBloqueio } from "@/lib/bloqueios-orientados";
import { nomeInstrumentoRecolhimento } from "@/lib/perfil-recolhimento";
import {
  apurarObrigacao,
  cancelarObrigacaoFiscal,
  registrarDocumento,
  solicitarRetificacaoFiscal,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  competencia?: string | string[];
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

function nomeStatus(status: string) {
  if (status === "RASCUNHO") return "Em preparação";
  if (status === "BLOQUEADA") return "Conciliação pendente";
  if (status === "APURADA") return "Totalizador conciliado";
  if (status === "EMITIDA") return "Documento registrado";
  if (status === "CANCELADA") return "Cancelada";
  return status.replaceAll("_", " ");
}

export default async function ObrigacoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);
  const competenciaSelecionada = await lerCompetenciaContexto(
    params.competencia,
  );
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let obrigacoes: Awaited<ReturnType<typeof listarObrigacoes>>;
  let diagnostico: Awaited<
    ReturnType<typeof diagnosticarCompetenciaObrigacao>
  >;
  try {
    empresa = await resolverEmpresaAtiva();
    [obrigacoes, diagnostico] = await Promise.all([
      listarObrigacoes(empresa.id, competenciaSelecionada),
      diagnosticarCompetenciaObrigacao(empresa.id, competenciaSelecionada),
    ]);
  } catch {
    return (
      <AppShell title="Obrigações e GPS" eyebrow="Apuração previdenciária" organization="Não configurada">
        <BloqueioOrientado bloqueio={{
          titulo: "Não foi possível carregar a apuração",
          causa: "As informações desta competência não ficaram disponíveis agora.",
          impacto: "Nenhuma guia será alterada até que a apuração possa ser carregada.",
          acao: { rotulo: "Tentar novamente", href: "/obrigacoes" },
        }} />
      </AppShell>
    );
  }
  const guiasGps = obrigacoes.filter(
    (item) => item.perfil_instrumento === "GPS_EXCECAO",
  );
  const obrigacaoAtual =
    guiasGps.find((item) => item.status !== "CANCELADA") ?? guiasGps[0];
  const documentoVerificado = (tipo: string) =>
    Boolean(
      obrigacaoAtual?.documentos.some(
        (documento) => documento.tipo === tipo && documento.verificado,
      ),
    );
  const gps = documentoVerificado("GPS");
  const documentoPagamento = gps;
  const proximaAcao = !diagnostico.apta_apuracao
    ? {
        titulo: "Aguarde o fechamento das folhas",
        detalhe: `${diagnostico.folhas_pendentes} folha(s) ainda precisam ser fechadas antes da apuração previdenciária.`,
        href: "/folhas",
        rotulo: "Abrir folhas mensais",
      }
    : !obrigacaoAtual
      ? {
          titulo: "Apure a competência",
          detalhe: "As folhas estão fechadas e os valores podem ser consolidados para as memórias GPS individuais.",
          href: "#apurar-obrigacao",
          rotulo: "Ir para apuração",
        }
      : !gps
        ? {
            titulo: "Registre as GPS oficiais",
            detalhe: "A apuração está disponível. Confira as memórias individuais e registre os documentos oficiais por prestador.",
            href: `/obrigacoes/${obrigacaoAtual.id}/gps/registro`,
            rotulo: "Registrar GPS oficiais",
          }
        : {
            titulo: "Documentação conferida",
            detalhe: "As GPS desta competência foram registradas e seguem disponíveis para consulta e auditoria.",
            href: "#detalhes-obrigacao",
            rotulo: "Ver detalhes da apuração",
          };

  return (
    <AppShell
      title="Obrigações e GPS"
      eyebrow="Previdência de prestadores"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: "Emissão controlada",
        text: "As memórias GPS são preparadas a partir dos processamentos fechados e do perfil de recolhimento congelado na competência.",
      }}
    >
      {erro && (
        <BloqueioOrientado bloqueio={orientarBloqueio({
          erro,
          competencia: competenciaSelecionada,
          retorno: `/obrigacoes?competencia=${competenciaSelecionada}`,
        })} />
      )}
      {sucesso && (
        <section className="feedback-banner success" role="status">
          <strong>Apuração concluída</strong><span>{sucesso}</span>
        </section>
      )}

      <section className="obrigacao-overview">
        <div>
          <span className="section-kicker">Competência {competencia(competenciaSelecionada)}</span>
          <h2>Previdência sem perder a trilha da Folha.</h2>
          <p>
            A apuração acompanha os processamentos fechados e preserva a memória GPS individual de cada prestador elegível.
          </p>
          <section className="metrics-grid obrigacao-metricas" aria-label="Resumo previdenciário">
            <MetricCard
              label="Folhas fechadas"
              value={`${diagnostico.folhas_fechadas}/${diagnostico.folhas_total}`}
              detail={
                diagnostico.folhas_pendentes
                  ? `${diagnostico.folhas_pendentes} pendente(s)`
                  : "nenhuma folha pendente"
              }
              icon={CheckCircle2}
              tone={diagnostico.folhas_pendentes ? "amber" : "teal"}
            />
            <MetricCard
              label="Prestadores apuráveis"
              value={String(diagnostico.itens_fechados)}
              detail={`competência ${competencia(competenciaSelecionada)}`}
              icon={Calculator}
              tone="blue"
            />
            <MetricCard
              label="INSS dos segurados"
              value={moeda(diagnostico.inss_segurado)}
              detail="conforme memórias das folhas fechadas"
              icon={ReceiptText}
            />
          </section>
        </div>
        <aside className="obrigacao-proxima-acao" aria-label="Próxima ação">
          <span>Próxima ação</span>
          <strong>{proximaAcao.titulo}</strong>
          <p>{proximaAcao.detalhe}</p>
          <Link className="button secondary" href={proximaAcao.href}>
            {proximaAcao.rotulo} <FileCheck2 size={16} />
          </Link>
        </aside>
      </section>

      <section className="panel process-panel" aria-label="Etapas da obrigação">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Fluxo previdenciário</span>
            <h2>Da folha fechada ao documento para pagamento</h2>
            <p>
              A competência reproduz o fluxo histórico: uma memória GPS para
              cada prestador PF elegível.
            </p>
          </div>
          <StatusBadge tone={documentoPagamento ? "success" : "warning"}>
            {documentoPagamento ? "Pronta para pagamento" : "Documentação pendente"}
          </StatusBadge>
        </div>
        <ol className="process-steps obligation-steps">
          {[
            ["1. Processamentos", diagnostico.apta_apuracao, `${diagnostico.folhas_fechadas} fechada(s)`],
            ["2. Apuração", Boolean(obrigacaoAtual), obrigacaoAtual ? moeda(obrigacaoAtual.total) : "Não executada"],
            ["3. GPS", gps, gps ? "Conferida" : "Pendente"],
          ].map(([titulo, concluida, detalhe], indice, etapas) => {
            const anteriorConcluida =
              indice === 0 || Boolean(etapas[indice - 1][1]);
            return (
              <li
                key={String(titulo)}
                className={
                  concluida ? "done" : anteriorConcluida ? "current" : "pending"
                }
              >
                <span>
                  {concluida ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <FileCheck2 size={17} />
                  )}
                </span>
                <div>
                  <strong>{titulo}</strong>
                  <small>{detalhe}</small>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="panel cadastro-section obrigacao-acao" id="apurar-obrigacao">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Folhas fechadas</span>
            <h2>Apurar retenções dos segurados</h2>
            <p>O processo exige todas as folhas fechadas e calcula os valores do segurado e da organização. Uma nova apuração exige nova conferência dos documentos.</p>
          </div>
          <StatusBadge tone={diagnostico.apta_apuracao ? "success" : "warning"}>
            {diagnostico.apta_apuracao ? (
              <CheckCircle2 size={14} />
            ) : (
              <ShieldAlert size={14} />
            )}
            {diagnostico.apta_apuracao
              ? "Pronta para apurar"
              : "Fechamento pendente"}
          </StatusBadge>
        </div>
        <form action={apurarObrigacao} className="crud-form">
          <label><span>Competência</span><input name="competencia" type="month" required defaultValue={competenciaSelecionada} /></label>
          <button
            className="button primary"
            type="submit"
            disabled={!diagnostico.apta_apuracao}
          >
            <FileCheck2 size={16} />{" "}
            {obrigacaoAtual ? "Reapurar competência" : "Apurar competência"}
          </button>
        </form>
      </section>

      {guiasGps.map((item) => (
        <section
          className="panel obrigacao-detalhe"
          id={item.id === obrigacaoAtual?.id ? "detalhes-obrigacao" : undefined}
          key={item.id}
        >
          <div className="panel-header">
            <div>
              <span className="section-kicker">{competencia(item.competencia)} · Guias GPS</span>
              <h2>{moeda(item.total)}</h2>
              <p>{item.folhas} processamento(s) · {item.itens} item(ns) rastreáveis · {item.perfil_instrumento ? nomeInstrumentoRecolhimento(item.perfil_instrumento) : "Perfil histórico sem instrumento"}</p>
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
              {item.perfil_instrumento === "GPS_EXCECAO" && (
                <Link
                  className="button secondary"
                  href={`/obrigacoes/${item.id}/gps`}
                >
                  <FileText size={16} /> Memórias GPS
                </Link>
              )}
              <StatusBadge tone={item.status === "BLOQUEADA" ? "danger" : item.status === "EMITIDA" ? "success" : item.status === "CANCELADA" ? "warning" : "info"}>
                {item.status === "BLOQUEADA" ? <AlertTriangle size={14} /> : <FileCheck2 size={14} />}
                {nomeStatus(item.status)}
              </StatusBadge>
            </div>
          </div>
          <dl className="large-reconciliation">
            <div><dt>Retenção dos segurados</dt><dd>{moeda(item.segurado)}<small>Alíquota conforme o regime congelado</small></dd></div>
            <div><dt>Contribuição patronal</dt><dd>{moeda(item.patronal)}<small>20% no regime geral ou zero na imunidade validada</small></dd></div>
            <div className={item.status === "EMITIDA" ? "" : "danger"}>
              <dt>{item.perfil_instrumento === "GPS_EXCECAO" ? "Conciliação GPS" : "Conciliação DCTFWeb"}</dt>
              <dd>
                {item.perfil_instrumento === "GPS_EXCECAO"
                  ? item.gps_individuais > 0
                    ? `GPS ${item.gps_registradas}/${item.gps_individuais} registrada(s)`
                    : "GPS pendente de preparo"
                  : item.status === "EMITIDA"
                  ? "DARF registrado"
                  : item.status === "CANCELADA"
                    ? "Obrigação cancelada"
                  : item.diferenca === "0.00"
                    ? "Totalizador conciliado"
                    : item.diferenca
                      ? `Diferença ${moeda(item.diferenca)}`
                      : "Pendente"}
                <small>{item.perfil_instrumento === "GPS_EXCECAO" ? `Total individual: ${moeda(item.gps_total)}. ${item.bloqueio_motivo ?? "A obrigação consolidada não representa quitação de outros componentes."}` : item.bloqueio_motivo ?? "Documento verificado e conciliado."}</small>
              </dd>
            </div>
          </dl>
          {item.status !== "CANCELADA" && (
            <>
              {item.perfil_instrumento === "GPS_EXCECAO" ? (
                <section className="alert-box">
                  <FileText size={22} />
                  <div>
                    <strong>GPS é individual por prestador</strong>
                    <p>
                      O legado gerava uma GPS para cada retenção. Não registre
                      uma guia agregada nesta obrigação; confira as memórias individuais.
                    </p>
                    <div className="row-actions">
                      <Link className="button secondary" href={`/obrigacoes/${item.id}/gps`}>
                        Abrir memórias GPS
                      </Link>
                      <Link className="button primary" href={`/obrigacoes/${item.id}/gps/registro`}>
                        Registrar GPS oficiais
                      </Link>
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  <div className="panel-header">
                    <div>
                      <span className="section-kicker">Evidência externa</span>
                      <h3>Registrar documento do recolhimento</h3>
                      <p>Marcar como verificado altera o estado somente se os valores satisfizerem as travas de conciliação.</p>
                    </div>
                  </div>
                  <form action={registrarDocumento} className="crud-form">
                    <input type="hidden" name="obrigacaoId" value={item.id} />
                    <label><span>Tipo</span><select name="tipo" required defaultValue=""><option value="" disabled>Selecione</option><option value="TOTALIZADOR_DCTFWEB">Totalizador DCTFWeb</option><option value="RECIBO_DCTFWEB">Recibo DCTFWeb</option><option value="DARF">DARF</option></select></label>
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

      {guiasGps.length === 0 && (
        <section className="alert-box">
          <ShieldAlert size={22} />
          <div><strong>Nenhuma GPS preparada</strong><p>Feche um processamento e execute a apuração acima.</p></div>
        </section>
      )}
    </AppShell>
  );
}
