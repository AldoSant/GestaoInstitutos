import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  RefreshCw,
  UnlockKeyhole,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BloqueioOrientado } from "@/components/bloqueio-orientado";
import { ProcessingAutoRefresh } from "@/components/processing-auto-refresh";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";
import { carregarHomologacoesFolha } from "@/db/homologacoes";
import { nomeRegimePrevidenciario } from "@/lib/enquadramento-previdenciario";
import { orientarBloqueio } from "@/lib/bloqueios-orientados";
import { descreverProcessamento } from "@/lib/processamento-operacional";
import {
  cancelar,
  fechar,
  importarHomologacao,
  reabrir,
  registrarConferencia,
  solicitarReprocessamento,
  tentarNovamenteProcessamento,
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

function consolidacaoMemoria(valor: unknown) {
  if (!valor || typeof valor !== "object") return null;
  const consolidacao = (valor as Record<string, unknown>).consolidacaoFiscal;
  if (!consolidacao || typeof consolidacao !== "object") return null;
  const dados = consolidacao as Record<string, unknown>;
  if (
    dados.modo !== "RATEIO_HOMOLOGADO" ||
    typeof dados.simulacaoId !== "string" ||
    typeof dados.hashResultado !== "string"
  ) {
    return null;
  }
  return {
    simulacaoId: dados.simulacaoId,
    hashResultado: dados.hashResultado,
  };
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
  let homologacoes: Awaited<ReturnType<typeof carregarHomologacoesFolha>>;
  try {
    empresa = await resolverEmpresaAtiva();
    [dados, homologacoes] = await Promise.all([
      carregarFolha(empresa.id, folhaId),
      carregarHomologacoesFolha(empresa.id, folhaId),
    ]);
  } catch {
    notFound();
  }
  const folha = dados.folha;
  const homologacaoAtual = homologacoes.lotes[0];
  const homologacaoDaRevisao =
    homologacaoAtual?.hash_folha === folha.hash_resultado;
  const conferenciaAtual = dados.conferencias.find(
    (item) => item.hash_resultado === folha.hash_resultado,
  );
  const aprovadaPeloRh = conferenciaAtual?.resultado === "APROVADA";
  const calculada = Boolean(folha.hash_resultado && dados.itens.length);
  const fechada = folha.status === "FECHADA";
  const pagamentosAptos = dados.itens.filter((item) => {
    const snapshots = item.snapshots as Record<string, unknown>;
    const conta = snapshots.contaBancaria;
    if (!conta || typeof conta !== "object") return false;
    const dadosConta = conta as Record<string, unknown>;
    return Boolean(
      String(dadosConta.agencia ?? "").trim() &&
        String(dadosConta.numero ?? "").trim() &&
        ["CORRENTE", "POUPANCA"].includes(String(dadosConta.tipo ?? "")),
    );
  }).length;
  const estadoProcessamento = dados.processamento
    ? descreverProcessamento(
        dados.processamento.status,
        dados.processamento.ultimo_erro,
      )
    : null;
  const processamentoFalhou = dados.processamento?.status === "FALHA";
  const rateiosHomologados = dados.itens
    .map((item) => consolidacaoMemoria(item.memoria))
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const simulacoesAplicadas = [
    ...new Set(rateiosHomologados.map((item) => item.simulacaoId)),
  ];
  const totais = dados.itens.reduce(
    (total, item) => ({
      proventos: total.proventos + Number(item.total_proventos),
      descontos: total.descontos + Number(item.total_descontos),
      baseInss: total.baseInss + Number(item.base_inss),
      inss: total.inss + Number(item.valor_inss),
      baseIrrf: total.baseIrrf + Number(item.base_irrf),
      irrf: total.irrf + Number(item.valor_irrf),
      liquido: total.liquido + Number(item.total_liquido),
    }),
    {
      proventos: 0,
      descontos: 0,
      baseInss: 0,
      inss: 0,
      baseIrrf: 0,
      irrf: 0,
      liquido: 0,
    },
  );
  const mapaRubricas = new Map<
    string,
    {
      codigo: string;
      descricao: string;
      natureza: string;
      incideInss: boolean;
      incideIrrf: boolean;
      ocorrencias: number;
      total: number;
    }
  >();
  for (const item of dados.itens) {
    for (const linha of item.eventos as Array<Record<string, unknown>>) {
      const codigo = String(linha.codigo ?? "");
      const natureza = String(linha.natureza ?? "");
      const incideInss = Boolean(linha.incide_inss);
      const incideIrrf = Boolean(linha.incide_irrf);
      const chave = `${natureza}:${codigo}:${incideInss}:${incideIrrf}`;
      const existente = mapaRubricas.get(chave);
      if (existente) {
        existente.ocorrencias += 1;
        existente.total += Number(linha.valor ?? 0);
      } else {
        mapaRubricas.set(chave, {
          codigo,
          descricao: String(linha.descricao ?? ""),
          natureza,
          incideInss,
          incideIrrf,
          ocorrencias: 1,
          total: Number(linha.valor ?? 0),
        });
      }
    }
  }
  const rubricas = [...mapaRubricas.values()].sort(
    (a, b) =>
      a.natureza.localeCompare(b.natureza, "pt-BR") ||
      a.codigo.localeCompare(b.codigo, "pt-BR"),
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
              <Link className="button secondary" href={`/folhas/${folha.id}/relatorio`}>
                <FileText size={16} /> Relatório imprimível
              </Link>
              <Link className="button secondary" href={`/folhas/${folha.id}/pagamentos`}>
                <CreditCard size={16} /> Relação de pagamentos
              </Link>
              <Link className="button secondary" href={`/conferencia-entre-folhas?competencia=${folha.competencia.slice(0, 7)}`}>
                Consolidar impostos por CPF
              </Link>
            </div>
          ) : undefined
        }
      >
        <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar para folhas</Link>
        {erro && (
          <BloqueioOrientado bloqueio={orientarBloqueio({
            erro,
            competencia: folha.competencia.slice(0, 7),
            retorno: `/folhas/${folha.id}`,
          })} />
        )}
        {sucesso && (
          <section className="feedback-banner success" role="status">
            <strong>Operação concluída</strong><span>{sucesso}</span>
          </section>
        )}
        <section className="detail-summary">
          <div><span>Status</span><StatusBadge>{nomeStatus(folha.status)}</StatusBadge></div>
          <div><span>Prestadores</span><strong>{dados.itens.length}</strong></div>
          <div><span>Proventos</span><strong>{moeda(String(totais.proventos))}</strong></div>
          <div><span>INSS retido</span><strong>{moeda(String(totais.inss))}</strong></div>
          <div><span>IRRF retido</span><strong>{moeda(String(totais.irrf))}</strong></div>
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
              {nomeRegimePrevidenciario(folha.regime_previdenciario)}
            </strong>
          </div>
        </section>

        <section className="panel process-panel" aria-label="Etapas da folha">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Fluxo desta folha</span>
              <h2>Próximo passo operacional</h2>
              <p>
                A revisão {folha.revisao} percorre cálculo, conferência, fechamento
                e preparação dos pagamentos.
              </p>
            </div>
            <StatusBadge tone={fechada ? "success" : "warning"}>
              {fechada ? "Folha fechada" : "Em andamento"}
            </StatusBadge>
          </div>
          <ol className="process-steps">
            <li className={calculada ? "done" : "current"}>
              <span><Calculator size={17} /></span>
              <div>
                <strong>1. Cálculo</strong>
                <small>{calculada ? "Memória gerada" : "Aguardando processamento"}</small>
              </div>
              {calculada && <CheckCircle2 size={17} />}
            </li>
            <li className={aprovadaPeloRh ? "done" : calculada ? "current" : "pending"}>
              <span><ClipboardCheck size={17} /></span>
              <div>
                <strong>2. Conferência do RH</strong>
                <small>
                  {aprovadaPeloRh
                    ? "Revisão aprovada"
                    : conferenciaAtual
                      ? "Correções solicitadas"
                      : "Checklist pendente"}
                </small>
              </div>
              {aprovadaPeloRh && <CheckCircle2 size={17} />}
            </li>
            <li className={fechada ? "done" : aprovadaPeloRh ? "current" : "pending"}>
              <span><LockKeyhole size={17} /></span>
              <div>
                <strong>3. Fechamento</strong>
                <small>{fechada ? "Memória congelada" : "Depende da aprovação"}</small>
              </div>
              {fechada && <CheckCircle2 size={17} />}
            </li>
            <li className={fechada ? "current" : "pending"}>
              <span><CreditCard size={17} /></span>
              <div>
                <strong>4. Pagamentos</strong>
                <small>
                  {pagamentosAptos}/{dados.itens.length} conta(s) apta(s)
                </small>
              </div>
            </li>
          </ol>
          <div className="guided-actions">
            {!calculada ? (
              <>
                <RefreshCw size={19} />
                <div>
                  <strong>Processamento em andamento</strong>
                  <p>Atualize a página em alguns instantes para acompanhar o resultado.</p>
                </div>
              </>
            ) : !aprovadaPeloRh ? (
              <>
                <ClipboardCheck size={19} />
                <div>
                  <strong>Faça a conferência formal</strong>
                  <p>Confira cadastros, valores e rubricas antes de registrar a decisão.</p>
                </div>
                <Link className="button primary" href="#conferencia">
                  Ir para conferência
                </Link>
              </>
            ) : !fechada ? (
              <>
                <LockKeyhole size={19} />
                <div>
                  <strong>A folha está pronta para fechar</strong>
                  <p>O fechamento congela a revisão aprovada e libera as etapas mensais seguintes.</p>
                </div>
                <Link className="button primary" href="#fechamento">
                  Ir para fechamento
                </Link>
              </>
            ) : (
              <>
                <CreditCard size={19} />
                <div>
                  <strong>Prepare pagamentos e obrigações</strong>
                  <p>
                    Resolva contas pendentes e gere a relação bancária antes do fechamento mensal.
                  </p>
                </div>
                <Link className="button primary" href={`/folhas/${folha.id}/pagamentos`}>
                  Abrir pagamentos
                </Link>
              </>
            )}
          </div>
        </section>

        {rateiosHomologados.length > 0 && (
          <section className="alert-box success">
            <LockKeyhole size={22} />
            <div>
              <strong>Rateio fiscal homologado aplicado</strong>
              <p>
                {rateiosHomologados.length} item(ns) desta Folha usam a simulação{" "}
                {simulacoesAplicadas
                  .map((simulacaoId) => simulacaoId.slice(0, 12))
                  .join(", ")}
                . O ID e o hash completos estão congelados na memória JSON.
              </p>
            </div>
          </section>
        )}

        {folha.status === "RASCUNHO" && (
          <section className={`alert-box ${processamentoFalhou ? "danger" : ""}`}>
            {processamentoFalhou ? (
              <AlertTriangle size={22} />
            ) : (
              <RefreshCw size={22} />
            )}
            <div>
              <strong>
                {estadoProcessamento?.titulo ?? "Aguardando processamento"}
              </strong>
              <p>
                {estadoProcessamento?.texto ??
                  "A folha está na fila e será calculada automaticamente."}
              </p>
              {dados.processamento && (
                <small className="technical-reference">
                  Tentativa {dados.processamento.tentativas} de{" "}
                  {dados.processamento.max_tentativas} · registro{" "}
                  {dados.processamento.id.slice(0, 8)}
                </small>
              )}
            </div>
            <div className="processing-status-actions">
              {processamentoFalhou ? (
                <>
                  {estadoProcessamento?.categoria === "CADASTRO" && (
                    <Link className="button secondary" href="/cadastros">
                      Revisar pessoas
                    </Link>
                  )}
                  {estadoProcessamento?.categoria === "MEDICAO" && (
                    <Link
                      className="button secondary"
                      href={`/medicoes?competencia=${folha.competencia.slice(0, 7)}`}
                    >
                      Revisar medições
                    </Link>
                  )}
                  {estadoProcessamento?.categoria === "CONSOLIDACAO" && (
                    <p className="field-help">
                      Este processamento depende de uma regra de rateio que
                      não está habilitada no operacional atual.
                    </p>
                  )}
                  <form action={tentarNovamenteProcessamento}>
                    <input type="hidden" name="folhaId" value={folha.id} />
                    <button className="button primary" type="submit">
                      <RefreshCw size={16} /> Tentar novamente
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <ProcessingAutoRefresh
                    active={["PENDENTE", "EXECUTANDO"].includes(
                      dados.processamento?.status ?? "",
                    )}
                  />
                  <Link className="button secondary" href={`/folhas/${folha.id}`}>
                    <RefreshCw size={16} /> Atualizar agora
                  </Link>
                </>
              )}
            </div>
          </section>
        )}

        {["RASCUNHO", "ABERTA"].includes(folha.status) && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Encerramento administrativo</span>
                <h2>Cancelar esta Folha</h2>
                <p>
                  O cancelamento preserva itens, histórico e evidências existentes
                  e interrompe tarefas ainda pendentes.
                </p>
              </div>
              <StatusBadge tone="danger">Ação terminal</StatusBadge>
            </div>
            <form action={cancelar} className="crud-form">
              <input type="hidden" name="folhaId" value={folha.id} />
              <label className="field-wide">
                <span>Motivo do cancelamento</span>
                <input
                  name="motivo"
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="Descreva a decisão administrativa e a referência que a autoriza"
                />
              </label>
              <button className="button secondary" type="submit">
                <XCircle size={16} /> Cancelar Folha
              </button>
            </form>
          </section>
        )}

        {folha.status === "ABERTA" && (
          <>
            <section className="panel" id="conferencia">
              <div className="panel-header">
                <div>
                  <span className="section-kicker">Validação operacional</span>
                  <h2>Conferência formal do RH</h2>
              <p>A decisão vale somente para esta versão da folha. Recalcular exige uma nova conferência.</p>
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

            <section className="panel" id="fechamento">
              <div className="panel-header">
          <div><span className="section-kicker">Fechamento</span><h2>Ações da versão {folha.revisao}</h2><p>O fechamento exige a aprovação vigente do RH e uma última verificação dos dados.</p></div>
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
            <div>
              <span className="section-kicker">Resumo fiscal e contábil</span>
              <h2>Bases e rubricas da revisão</h2>
              <p>
                Totais agregados exclusivamente dos itens e eventos congelados
                nesta Folha.
              </p>
            </div>
          </div>
          <div className="detail-summary">
            <div>
              <span>Base de INSS</span>
              <strong>{moeda(String(totais.baseInss))}</strong>
            </div>
            <div>
              <span>INSS do segurado</span>
              <strong>{moeda(String(totais.inss))}</strong>
            </div>
            <div>
              <span>Base de IRRF</span>
              <strong>{moeda(String(totais.baseIrrf))}</strong>
            </div>
            <div>
              <span>IRRF</span>
              <strong>{moeda(String(totais.irrf))}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rubrica</th>
                  <th>Natureza</th>
                  <th>Incidências</th>
                  <th>Ocorrências</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rubricas.map((rubrica) => (
                  <tr
                    key={`${rubrica.natureza}:${rubrica.codigo}:${rubrica.incideInss}:${rubrica.incideIrrf}`}
                  >
                    <td>
                      <strong>{rubrica.codigo}</strong>
                      <small>{rubrica.descricao}</small>
                    </td>
                    <td>{rubrica.natureza}</td>
                    <td>
                      INSS {rubrica.incideInss ? "✓" : "—"} · IRRF{" "}
                      {rubrica.incideIrrf ? "✓" : "—"}
                    </td>
                    <td>{rubrica.ocorrencias}</td>
                    <td>
                      <strong>{moeda(String(rubrica.total))}</strong>
                    </td>
                  </tr>
                ))}
                {rubricas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Aguardando eventos processados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

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
                  const consolidacao = consolidacaoMemoria(item.memoria);
                  return (
                    <tr key={item.id}>
                      <td><strong>{snapshot.pessoa?.nome ?? "Prestador"}</strong><small>Matrícula {snapshot.prestador?.matricula ?? "—"}</small></td>
                      <td>
                        {snapshot.vinculo?.atividade ?? "—"}
                        <small>{snapshot.pessoa?.tipo ?? "—"}</small>
                        {consolidacao && (
                          <small>
                            Rateio {consolidacao.simulacaoId.slice(0, 12)}…
                          </small>
                        )}
                      </td>
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
          <div className="panel-header">
            <div>
              <span className="section-kicker">Conferência por arquivo</span>
              <h2>Comparação com GIW ou planilha do RH</h2>
              <p>
                Importe os totais de referência. O sistema compara por matrícula,
                centavo a centavo, sem alterar o cálculo novo.
              </p>
            </div>
            {homologacaoAtual ? (
              <StatusBadge
                tone={
                  homologacaoDaRevisao &&
                  homologacaoAtual.status === "CONCILIADA"
                    ? "success"
                    : "danger"
                }
              >
                {!homologacaoDaRevisao
                  ? "Revisão atual pendente"
                  : homologacaoAtual.status === "CONCILIADA"
                    ? "Conciliada"
                    : `${homologacaoAtual.divergentes} divergência(s)`}
              </StatusBadge>
            ) : (
              <StatusBadge tone="info">Sem referência importada</StatusBadge>
            )}
          </div>

          {folha.hash_resultado ? (
            <form
              action={importarHomologacao}
              className="crud-form vinculo-form"
            >
              <input type="hidden" name="folhaId" value={folha.id} />
              <label>
                <span>Origem</span>
                <select name="origem" defaultValue="GIW" required>
                  <option value="GIW">Sistema GIW</option>
                  <option value="PLANILHA_RH">Planilha do RH</option>
                  <option value="OUTRO">Outra fonte controlada</option>
                </select>
              </label>
              <label>
                <span>Referência</span>
                <input
                  name="referencia"
                  required
                  minLength={3}
                  maxLength={200}
                  placeholder="Ex.: exportação GIW de 05/2026"
                />
              </label>
              <label>
                <span>Responsável</span>
                <input
                  name="responsavel"
                  required
                  minLength={3}
                  maxLength={160}
                  placeholder="Nome de quem importou e conferiu"
                />
              </label>
              <label>
                <span>Arquivo CSV (até 5 MB)</span>
                <input
                  type="file"
                  name="arquivo"
                  accept=".csv,text/csv"
                  required
                />
              </label>
              <div className="row-actions">
                <button className="button primary" type="submit">
                  <FileSpreadsheet size={16} /> Comparar referência
                </button>
                <Link
                  className="button secondary"
                  href={`/folhas/${folha.id}/conferencia/modelo`}
                >
                  <Download size={16} /> Baixar modelo CSV
                </Link>
              </div>
            </form>
          ) : (
            <p className="empty-state">
              Aguarde o processamento para importar uma referência.
            </p>
          )}

          {homologacaoAtual && (
            <>
              <div className="detail-summary">
                <div>
                  <span>Referência</span>
                  <strong>{homologacaoAtual.origem}</strong>
                  <small>{homologacaoAtual.referencia}</small>
                </div>
                <div>
                  <span>Revisão comparada</span>
                  <strong>{homologacaoAtual.revisao}</strong>
                  <small>Hash {homologacaoAtual.hash_folha.slice(0, 12)}…</small>
                </div>
                <div>
                  <span>Linhas</span>
                  <strong>{homologacaoAtual.total_linhas}</strong>
                </div>
                <div>
                  <span>Conciliadas</span>
                  <strong>{homologacaoAtual.conciliados}</strong>
                </div>
                <div>
                  <span>Divergências</span>
                  <strong>{homologacaoAtual.divergentes}</strong>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Prestador</th>
                      <th>Situação</th>
                      <th>Proventos</th>
                      <th>INSS</th>
                      <th>IRRF</th>
                      <th>Descontos</th>
                      <th>Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homologacoes.itens.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.nome || "Nome não informado"}</strong>
                          <small>Matrícula {item.matricula}</small>
                        </td>
                        <td>
                          <StatusBadge
                            tone={
                              item.situacao === "CONCILIADO"
                                ? "success"
                                : "danger"
                            }
                          >
                            {item.situacao.replaceAll("_", " ")}
                          </StatusBadge>
                        </td>
                        {(
                          [
                            "proventos",
                            "inss",
                            "irrf",
                            "descontos",
                            "liquido",
                          ] as const
                        ).map((campo) => (
                          <td key={campo}>
                            <strong>{moeda(item[`atual_${campo}`])}</strong>
                            <small>Ref. {moeda(item[`esperado_${campo}`])}</small>
                            <small>
                              Δ {moeda(item[`diferenca_${campo}`])}
                            </small>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {homologacoes.lotes.length > 0 && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Auditoria da conferência por arquivo</span>
                <h2>Referências já comparadas</h2>
                <p>
                  Cada lote é imutável e preserva os hashes da Folha e do
                  arquivo importado.
                </p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Revisão</th>
                    <th>Origem</th>
                    <th>Arquivo</th>
                    <th>Resultado</th>
                    <th>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {homologacoes.lotes.map((lote) => (
                    <tr key={lote.id}>
                      <td>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(lote.criado_em))}
                      </td>
                      <td>
                        {lote.revisao}
                        <small>Hash {lote.hash_folha.slice(0, 12)}…</small>
                      </td>
                      <td>
                        {lote.origem}
                        <small>{lote.referencia}</small>
                      </td>
                      <td>
                        {lote.nome_arquivo}
                        <small>SHA-256 {lote.hash_arquivo.slice(0, 12)}…</small>
                      </td>
                      <td>
                        <StatusBadge
                          tone={
                            lote.status === "CONCILIADA"
                              ? "success"
                              : "danger"
                          }
                        >
                          {lote.status === "CONCILIADA"
                            ? "Conciliada"
                            : `${lote.divergentes} divergência(s)`}
                        </StatusBadge>
                      </td>
                      <td>{lote.criado_por}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

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
