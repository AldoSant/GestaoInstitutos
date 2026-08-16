import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Calculator,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  FileClock,
  FileText,
  LockKeyhole,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModalShell } from "@/components/modal-shell";
import { MetricCard, StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarDemonstrativo } from "@/db/demonstrativos";
import { caminhoAplicacao } from "@/lib/base-path";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import {
  abrirRevisaoDemonstrativo,
  atualizarPagamentoPj,
  gerarRascunhoDemonstrativo,
  conferirDemonstrativo,
  concluirDemonstrativo,
  removerPagamentoPj,
  salvarPagamentoPj,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  competencia?: string | string[];
  novo?: string | string[];
  erro?: string | string[];
  sucesso?: string | string[];
  conferir?: string | string[];
  fechar?: string | string[];
  revisar?: string | string[];
  editar?: string | string[];
}>;

type Retencao = {
  tributo: string;
  valor: string;
  origem: string;
  evidencia?: string;
};

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function moeda(valor: string | number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor ?? 0));
}

function nomeStatus(status: string) {
  if (status === "RASCUNHO") return "Em preparação";
  if (status === "EM_CONFERENCIA") return "Em conferência";
  if (status === "FECHADO") return "Fechado";
  return status;
}

export default async function DemonstrativosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const competencia = await lerCompetenciaContexto(params.competencia);
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);
  const novoPj = primeiro(params.novo) === "pj";
  const abrirConferencia = primeiro(params.conferir) === "1";
  const abrirFechamento = primeiro(params.fechar) === "1";
  const abrirRevisao = primeiro(params.revisar) === "1";
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarDemonstrativo>>;
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarDemonstrativo(empresa.id, competencia);
  } catch {
    return (
      <AppShell
        title="Demonstrativo mensal"
        eyebrow="Pagamentos e recolhimentos"
        organization="Não configurada"
      >
        <section className="alert-box danger">
          <Database size={22} />
          <div>
            <strong>Demonstrativo indisponível</strong>
            <p>Não foi possível carregar os pagamentos desta competência.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const demonstrativo = dados.demonstrativo;
  const fechado = demonstrativo?.status === "FECHADO";
  const pagamentoEmEdicao = dados.pagamentos.find(
    (item) =>
      item.id === primeiro(params.editar) &&
      item.origem === "NOTA_FISCAL_PJ",
  );
  const retencoesEmEdicao = (pagamentoEmEdicao?.retencoes ?? []) as Retencao[];
  const valorRetencaoEmEdicao = (tributo: string) =>
    retencoesEmEdicao.find((item) => item.tributo === tributo)?.valor ?? "0,00";
  const pagamentosPf = dados.pagamentos.filter(
    (item) => item.tipo_pessoa === "FISICA",
  ).length;
  const pagamentosPj = dados.pagamentos.length - pagamentosPf;
  const fecharModal = `/demonstrativos?${new URLSearchParams({ competencia }).toString()}`;
  const conferenciaAtual = dados.conferencias[0];
  const podeFechar =
    demonstrativo?.status === "EM_CONFERENCIA" &&
    conferenciaAtual?.resultado === "APROVADA" &&
    conferenciaAtual.hash_resultado === demonstrativo.hash_resultado &&
    conferenciaAtual.revisao === demonstrativo.revisao;
  const demonstrativoHref = (adicionais: Record<string, string> = {}) =>
    `/demonstrativos?${new URLSearchParams({ competencia, ...adicionais }).toString()}`;
  const proximaAcao = !demonstrativo
    ? {
        titulo: "Prepare a competência",
        detalhe: "Traga os pagamentos PF das Folhas fechadas e as guias da organização para iniciar a relação mensal.",
        tipo: "preparar" as const,
      }
    : fechado
      ? {
          titulo: "Demonstrativo fechado",
          detalhe: "A revisão atual está preservada. Consulte o dossiê ou abra uma nova revisão somente se houver evidência de correção.",
          tipo: "link" as const,
          href: `/demonstrativos/${demonstrativo.id}/relatorio`,
          rotulo: "Abrir dossiê",
        }
      : podeFechar
        ? {
            titulo: "Feche o demonstrativo",
            detalhe: "A conferência aprovada corresponde à revisão e ao hash atuais. O fechamento vai congelar esse conteúdo.",
            tipo: "link" as const,
            href: demonstrativoHref({ fechar: "1" }),
            rotulo: "Confirmar fechamento",
          }
        : conferenciaAtual?.resultado === "REJEITADA"
          ? {
              titulo: "Ajuste e confira novamente",
              detalhe: "A última conferência foi rejeitada. Revise pagamentos, retenções e guias antes de registrar uma nova decisão.",
              tipo: "link" as const,
              href: "#pagamentos-demonstrativo",
              rotulo: "Revisar pagamentos",
            }
          : {
              titulo: "Registre a conferência",
              detalhe: "Valide pagamentos, retenções e guias na revisão atual antes de solicitar o fechamento do demonstrativo.",
              tipo: "link" as const,
              href: demonstrativoHref({ conferir: "1" }),
              rotulo: "Iniciar conferência",
            };

  return (
    <AppShell
      title="Demonstrativo mensal"
      eyebrow="Pagamentos e recolhimentos"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: "Separação fiscal",
        text: "PF vem de Folhas fechadas; PJ é lançado por documento e pode iniciar uma competência sem folha PF. Guias são obrigações da organização e nunca beneficiários.",
      }}
    >
      {(erro || sucesso) && (
        <section
          className={`feedback-banner ${erro ? "error" : "success"}`}
          role="status"
        >
          <strong>{erro ? "Operação não concluída" : "Operação concluída"}</strong>
          <span>{erro || sucesso}</span>
        </section>
      )}

      {(novoPj || pagamentoEmEdicao) && !fechado && (
        <ModalShell
          title={pagamentoEmEdicao ? "Editar pagamento PJ" : "Adicionar pagamento PJ"}
          description="Transcreva os valores do documento fiscal. Nenhuma retenção será calculada automaticamente."
          closeHref={fecharModal}
        >
          <form action={pagamentoEmEdicao ? atualizarPagamentoPj : salvarPagamentoPj} className="crud-form">
            <input type="hidden" name="competencia" value={competencia} />
            {pagamentoEmEdicao && (
              <input type="hidden" name="pagamentoId" value={pagamentoEmEdicao.id} />
            )}
            <label className="field-wide">
              <span>Prestador pessoa jurídica</span>
              <select name="prestadorId" required defaultValue={pagamentoEmEdicao?.prestador_id ?? ""}>
                <option value="" disabled>Selecione o prestador</option>
                {dados.prestadoresPj.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome} · {item.cnpj ?? "CNPJ pendente"} · {item.matricula}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-wide">
              <span>Nota fiscal ou documento</span>
              <input
                name="documentoReferencia"
                required
                maxLength={160}
                defaultValue={pagamentoEmEdicao?.documento_referencia ?? ""}
                placeholder="Ex.: NF 000123 de 30/06/2026"
              />
            </label>
            <label>
              <span>Valor bruto</span>
              <input name="valorBruto" required inputMode="decimal" placeholder="0,00" defaultValue={pagamentoEmEdicao?.valor_bruto ?? ""} />
            </label>
            {[
              ["inss", "INSS"],
              ["irrf", "IRRF"],
              ["iss", "ISS"],
              ["pis", "PIS"],
              ["cofins", "COFINS"],
              ["csll", "CSLL"],
            ].map(([nome, rotulo]) => (
              <label key={nome}>
                <span>Retenção {rotulo}</span>
                <input
                  name={nome}
                  inputMode="decimal"
                  defaultValue={valorRetencaoEmEdicao(rotulo)}
                  aria-label={`Retenção ${rotulo}`}
                />
              </label>
            ))}
            <div className="alert-box warning field-wide">
              <AlertTriangle size={19} />
              <div>
                <strong>Valores informados, não calculados</strong>
                <p>Confirme as retenções com o documento e a contabilidade.</p>
              </div>
            </div>
            <button
              className="button primary"
              type="submit"
              disabled={dados.prestadoresPj.length === 0}
            >
              {pagamentoEmEdicao ? "Salvar pagamento" : "Registrar pagamento"}
            </button>
            <Link className="button secondary" href={fecharModal}>Cancelar</Link>
          </form>
        </ModalShell>
      )}

      {abrirConferencia && demonstrativo && !fechado && (
        <ModalShell
          title="Conferir demonstrativo"
          description="A decisão ficará vinculada à revisão e ao hash exato de pagamentos, retenções, guias e documentos."
          closeHref={fecharModal}
        >
          <form action={conferirDemonstrativo} className="crud-form">
            <input type="hidden" name="competencia" value={competencia} />
            <input type="hidden" name="demonstrativoId" value={demonstrativo.id} />
            <label>
              <span>Decisão</span>
              <select name="resultado" required defaultValue="APROVADA">
                <option value="APROVADA">Aprovar</option>
                <option value="REJEITADA">Rejeitar</option>
              </select>
            </label>
            <label>
              <span>Responsável pela conferência</span>
              <input name="conferente" required minLength={3} maxLength={160} />
            </label>
            <label className="checkbox-field field-wide">
              <input name="confirmouPagamentos" type="checkbox" />
              <span>Conferi beneficiários, documentos e valores dos pagamentos</span>
            </label>
            <label className="checkbox-field field-wide">
              <input name="confirmouRetencoes" type="checkbox" />
              <span>Conferi tributos e retenções com suas evidências</span>
            </label>
            <label className="checkbox-field field-wide">
              <input name="confirmouGuias" type="checkbox" />
              <span>Conferi obrigações, guias e documentos da competência</span>
            </label>
            <label className="field-wide">
              <span>Observação ou motivo da rejeição</span>
              <textarea name="observacao" maxLength={2000} rows={4} />
            </label>
            <button className="button primary" type="submit">
              <ClipboardCheck size={16} /> Registrar decisão
            </button>
            <Link className="button secondary" href={fecharModal}>Cancelar</Link>
          </form>
        </ModalShell>
      )}

      {abrirFechamento && demonstrativo && podeFechar && (
        <ModalShell
          title="Fechar demonstrativo"
          description="O conteúdo será bloqueado no hash aprovado. Correções posteriores exigirão uma nova revisão."
          closeHref={fecharModal}
        >
          <form action={concluirDemonstrativo} className="crud-form">
            <input type="hidden" name="competencia" value={competencia} />
            <input type="hidden" name="demonstrativoId" value={demonstrativo.id} />
            <label className="field-wide">
              <span>Responsável pelo fechamento</span>
              <input
                name="responsavel"
                required
                minLength={3}
                maxLength={160}
                defaultValue={conferenciaAtual.conferente}
              />
            </label>
            <div className="alert-box warning field-wide">
              <LockKeyhole size={19} />
              <div>
                <strong>Ação de fechamento</strong>
                <p>Pagamentos e retenções não poderão ser alterados silenciosamente.</p>
              </div>
            </div>
            <button className="button primary" type="submit">
              <LockKeyhole size={16} /> Confirmar fechamento
            </button>
            <Link className="button secondary" href={fecharModal}>Cancelar</Link>
          </form>
        </ModalShell>
      )}

      {abrirRevisao && demonstrativo && fechado && (
        <ModalShell
          title="Abrir nova revisão"
          description={`A revisão ${demonstrativo.revisao} permanecerá congelada. A nova revisão começará como rascunho e exigirá nova conferência.`}
          closeHref={fecharModal}
        >
          <form action={abrirRevisaoDemonstrativo} className="crud-form">
            <input type="hidden" name="competencia" value={competencia} />
            <input type="hidden" name="demonstrativoId" value={demonstrativo.id} />
            <label className="field-wide">
              <span>Responsável pela retificação</span>
              <input
                name="responsavel"
                required
                minLength={3}
                maxLength={160}
                defaultValue={demonstrativo.fechado_por ?? ""}
              />
            </label>
            <label className="field-wide">
              <span>Motivo da nova revisão</span>
              <textarea
                name="motivo"
                required
                minLength={20}
                maxLength={3000}
                rows={5}
                placeholder="Descreva o erro, a evidência recebida e o que precisa ser corrigido."
              />
            </label>
            <div className="alert-box warning field-wide">
              <FileClock size={19} />
              <div>
                <strong>Histórico preservado</strong>
                <p>
                  Pagamentos, retenções, guias, documentos, aprovação e hash do
                  fechamento atual serão armazenados em snapshot imutável.
                </p>
              </div>
            </div>
            <button className="button primary" type="submit">
              <FileClock size={16} /> Abrir revisão {demonstrativo.revisao + 1}
            </button>
            <Link className="button secondary" href={fecharModal}>Cancelar</Link>
          </form>
        </ModalShell>
      )}

      <section className="demonstrativo-overview">
        <div className="demonstrativo-overview-copy">
          <span className="section-kicker">Competência financeira</span>
          <h2>Conferência financeira, pronta para decisão.</h2>
          <p>Pagamentos PF nascem das Folhas fechadas; PJ é documentado; guias permanecem obrigações da organização.</p>
          <section className="metrics-grid demonstrativo-metricas" aria-label="Resumo do demonstrativo">
            <MetricCard
              label="Valor bruto"
              value={moeda(demonstrativo?.total_bruto)}
              detail={`${dados.pagamentos.length} pagamento(s)`}
              icon={Calculator}
            />
            <MetricCard
              label="Retenções"
              value={moeda(demonstrativo?.total_retencoes)}
              detail="vinculadas aos pagamentos"
              icon={ReceiptText}
              tone="amber"
            />
            <MetricCard
              label="Valor líquido"
              value={moeda(demonstrativo?.total_liquido)}
              detail="bruto menos retenções"
              icon={UsersRound}
              tone="blue"
            />
            <MetricCard
              label="Guias vinculadas"
              value={String(dados.guias.length)}
              detail={`${dados.pendencias} classificação(ões) pendente(s)`}
              icon={FileCheck2}
              tone="slate"
            />
          </section>
        </div>
        <aside className="demonstrativo-proxima-acao" aria-label="Próxima ação">
          <span>Próxima ação</span>
          <strong>{proximaAcao.titulo}</strong>
          <p>{proximaAcao.detalhe}</p>
          {proximaAcao.tipo === "preparar" ? (
            <form action={gerarRascunhoDemonstrativo}>
              <input type="hidden" name="competencia" value={competencia} />
              <button className="button secondary" type="submit">
                <RefreshCw size={16} /> Preparar competência
              </button>
            </form>
          ) : (
            <Link className="button secondary" href={proximaAcao.href}>
              {proximaAcao.rotulo} <FileCheck2 size={16} />
            </Link>
          )}
        </aside>
        <form
          action={caminhoAplicacao("/demonstrativos")}
          method="get"
          className="demonstrativo-competencia"
        >
          <label className="sr-only" htmlFor="competencia-demonstrativo">
            Competência
          </label>
          <input
            id="competencia-demonstrativo"
            name="competencia"
            type="month"
            defaultValue={competencia}
          />
          <button className="button secondary" type="submit">Abrir competência</button>
        </form>
      </section>

      <nav className="consulta-nav" aria-label="Seções do demonstrativo">
        <a href="#pagamentos-demonstrativo">Pagamentos</a>
        {demonstrativo && <a href="#conferencia-demonstrativo">Conferência</a>}
        <a href="#guias-demonstrativo">Guias</a>
      </nav>

      <section className="panel cadastro-section" id="pagamentos-demonstrativo">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Rascunho da competência</span>
            <h2>Relação de pagamentos</h2>
            <p>
              {pagamentosPf} PF da Folha e {pagamentosPj} PJ documentado(s).
            </p>
          </div>
          <div className="row-actions">
            <StatusBadge tone={fechado ? "success" : demonstrativo ? "info" : "warning"}>
              {demonstrativo ? nomeStatus(demonstrativo.status) : "Ainda não gerado"}
            </StatusBadge>
            {!fechado && (
              <>
                <form action={gerarRascunhoDemonstrativo}>
                  <input type="hidden" name="competencia" value={competencia} />
                  <button className="button secondary" type="submit">
                    <RefreshCw size={15} />
                    {demonstrativo ? "Atualizar PF e guias" : "Preparar competência"}
                  </button>
                </form>
                <Link
                  className="button primary"
                  href={`/demonstrativos?${new URLSearchParams({
                    competencia,
                    novo: "pj",
                  }).toString()}`}
                >
                  <Plus size={16} /> Adicionar PJ
                </Link>
              </>
            )}
            {demonstrativo && (
              <>
                <Link
                  className="button secondary"
                  href={`/demonstrativos/${demonstrativo.id}/relatorio`}
                >
                  <FileText size={15} /> Dossiê / PDF
                </Link>
                <Link
                  className="button secondary"
                  href={`/demonstrativos/exportar?competencia=${competencia}`}
                >
                  <Download size={15} /> Exportar CSV
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Beneficiário</th>
                <th>Origem</th>
                <th>Documento</th>
                <th>Bruto</th>
                <th>Retenções</th>
                <th>Líquido</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.pagamentos.map((item) => {
                const retencoes = item.retencoes as Retencao[];
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.beneficiario ?? "Beneficiário preservado no snapshot"}</strong>
                      <small>
                        {item.matricula ?? "Sem matrícula"} · {item.tipo_pessoa === "FISICA" ? "PF" : "PJ"}
                      </small>
                    </td>
                    <td>
                      <StatusBadge tone={item.tipo_pessoa === "FISICA" ? "info" : "neutral"}>
                        {item.origem === "FOLHA_PF" ? "Folha PF" : "Documento PJ"}
                      </StatusBadge>
                    </td>
                    <td>{item.documento_referencia ?? "—"}</td>
                    <td>{moeda(item.valor_bruto)}</td>
                    <td>
                      <strong>{moeda(item.total_retencoes)}</strong>
                      <small>
                        {retencoes.length
                          ? retencoes.map((r) => `${r.tributo} ${moeda(r.valor)}`).join(" · ")
                          : "Sem retenções"}
                      </small>
                    </td>
                    <td><strong>{moeda(item.valor_liquido)}</strong></td>
                    <td>
                      {item.origem !== "FOLHA_PF" && !fechado ? (
                        <div className="row-actions compact">
                          <Link
                            className="row-text-action"
                            href={`/demonstrativos?${new URLSearchParams({ competencia, editar: item.id }).toString()}`}
                          >
                            <Pencil size={13} /> Editar
                          </Link>
                          <form action={removerPagamentoPj}>
                            <input type="hidden" name="competencia" value={competencia} />
                            <input type="hidden" name="pagamentoId" value={item.id} />
                            <button className="row-text-action danger" type="submit">
                              <Trash2 size={13} /> Remover
                            </button>
                          </form>
                        </div>
                      ) : (
                        <small>Gerenciado pela Folha</small>
                      )}
                    </td>
                  </tr>
                );
              })}
              {dados.pagamentos.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    Gere o rascunho para trazer as Folhas PF fechadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {demonstrativo && (
        <section className="panel cadastro-section" id="conferencia-demonstrativo">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Decisão e integridade</span>
              <h2>Conferência do demonstrativo</h2>
              <p>
                Revisão {demonstrativo.revisao}
                {demonstrativo.hash_resultado
                  ? ` · hash ${demonstrativo.hash_resultado.slice(0, 12)}…`
                  : " · aguardando primeira conferência"}
              </p>
            </div>
            <div className="row-actions">
              {!fechado && (
                <Link
                  className="button secondary"
                  href={`/demonstrativos?${new URLSearchParams({
                    competencia,
                    conferir: "1",
                  }).toString()}`}
                >
                  <ClipboardCheck size={15} /> Registrar conferência
                </Link>
              )}
              {podeFechar && (
                <Link
                  className="button primary"
                  href={`/demonstrativos?${new URLSearchParams({
                    competencia,
                    fechar: "1",
                  }).toString()}`}
                >
                  <LockKeyhole size={15} /> Fechar demonstrativo
                </Link>
              )}
              {fechado && (
                <Link
                  className="button secondary"
                  href={`/demonstrativos?${new URLSearchParams({
                    competencia,
                    revisar: "1",
                  }).toString()}`}
                >
                  <FileClock size={15} /> Abrir nova revisão
                </Link>
              )}
            </div>
          </div>
          {conferenciaAtual ? (
            <div className="summary-strip">
              <span>
                <StatusBadge tone={conferenciaAtual.resultado === "APROVADA" ? "success" : "danger"}>
                  {conferenciaAtual.resultado === "APROVADA" ? "Aprovada" : "Rejeitada"}
                </StatusBadge>
                {" "}por {conferenciaAtual.conferente}
              </span>
              <span>
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(conferenciaAtual.criado_em))}
              </span>
            </div>
          ) : (
            <div className="alert-box warning">
              <AlertTriangle size={19} />
              <div><strong>Conferência pendente</strong><p>Revise os três blocos antes do fechamento.</p></div>
            </div>
          )}
          {dados.conferencias.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Revisão</th><th>Decisão</th><th>Responsável</th><th>Checklist</th><th>Observação</th></tr></thead>
                <tbody>
                  {dados.conferencias.map((item) => (
                    <tr key={item.id}>
                      <td>v{item.revisao}<small>{item.hash_resultado.slice(0, 12)}…</small></td>
                      <td><StatusBadge tone={item.resultado === "APROVADA" ? "success" : "danger"}>{item.resultado}</StatusBadge></td>
                      <td>{item.conferente}</td>
                      <td>{item.confirmou_pagamentos && item.confirmou_retencoes && item.confirmou_guias ? "3 de 3" : "Parcial"}</td>
                      <td>{item.observacao || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dados.revisoes.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Retificação</th>
                    <th>Responsável</th>
                    <th>Motivo</th>
                    <th>Fechamento preservado</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.revisoes.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/demonstrativos/${demonstrativo.id}/relatorio?revisao=${item.revisao_origem}`}
                        >
                          <strong>
                            v{item.revisao_origem} → v{item.revisao_destino}
                          </strong>
                        </Link>
                        <small>
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(item.criado_em))}
                        </small>
                      </td>
                      <td>{item.responsavel}</td>
                      <td>{item.motivo}</td>
                      <td><small>{item.hash_resultado}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel cadastro-section" id="guias-demonstrativo">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Recolhimentos</span>
            <h2>Obrigações e guias vinculadas</h2>
            <p>As guias pertencem à organização e não integram a lista de beneficiários.</p>
          </div>
          <Link className="button secondary" href={`/obrigacoes?competencia=${competencia}`}>
            <Building2 size={15} /> Abrir obrigações
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Status</th><th>Total</th><th>Documentos</th></tr></thead>
            <tbody>
              {dados.guias.map((guia) => (
                <tr key={guia.id}>
                  <td><strong>{guia.tipo}</strong></td>
                  <td><StatusBadge tone={guia.status === "EMITIDA" ? "success" : "warning"}>{guia.status}</StatusBadge></td>
                  <td>{moeda(guia.total)}</td>
                  <td>{guia.verificados} verificado(s) de {guia.documentos}</td>
                </tr>
              ))}
              {dados.guias.length === 0 && (
                <tr><td colSpan={4} className="empty-cell">Nenhuma obrigação vinculada ao rascunho.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
