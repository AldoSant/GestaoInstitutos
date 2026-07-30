import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Calculator,
  Database,
  FileCheck2,
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
  gerarRascunhoDemonstrativo,
  removerPagamentoPj,
  salvarPagamentoPj,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  competencia?: string | string[];
  novo?: string | string[];
  erro?: string | string[];
  sucesso?: string | string[];
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
  const pagamentosPf = dados.pagamentos.filter(
    (item) => item.tipo_pessoa === "FISICA",
  ).length;
  const pagamentosPj = dados.pagamentos.length - pagamentosPf;
  const fecharModal = `/demonstrativos?${new URLSearchParams({ competencia }).toString()}`;

  return (
    <AppShell
      title="Demonstrativo mensal"
      eyebrow="Pagamentos e recolhimentos"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: "Separação fiscal",
        text: "PF vem de Folhas fechadas; PJ é lançado por documento. Guias são obrigações da organização e nunca beneficiários.",
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

      {novoPj && !fechado && (
        <ModalShell
          title="Adicionar pagamento PJ"
          description="Transcreva os valores do documento fiscal. Nenhuma retenção será calculada automaticamente."
          closeHref={fecharModal}
        >
          <form action={salvarPagamentoPj} className="crud-form">
            <input type="hidden" name="competencia" value={competencia} />
            <label className="field-wide">
              <span>Prestador pessoa jurídica</span>
              <select name="prestadorId" required defaultValue="">
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
                placeholder="Ex.: NF 000123 de 30/06/2026"
              />
            </label>
            <label>
              <span>Valor bruto</span>
              <input name="valorBruto" required inputMode="decimal" placeholder="0,00" />
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
                  defaultValue="0,00"
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
              Registrar pagamento
            </button>
            <Link className="button secondary" href={fecharModal}>Cancelar</Link>
          </form>
        </ModalShell>
      )}

      <section className="cadastro-toolbar panel">
        <div>
          <span className="section-kicker">Competência financeira</span>
          <h2>Pagamentos, retenções e guias</h2>
          <p>Gere novamente o rascunho sempre que uma Folha PF fechada mudar.</p>
        </div>
        <form
          action={caminhoAplicacao("/demonstrativos")}
          method="get"
          className="search-field"
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
          <button type="submit">Abrir</button>
        </form>
      </section>

      <section className="metrics-grid" aria-label="Resumo do demonstrativo">
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

      <section className="panel cadastro-section">
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
                    {demonstrativo ? "Atualizar PF e guias" : "Gerar rascunho"}
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
                        <form action={removerPagamentoPj}>
                          <input type="hidden" name="competencia" value={competencia} />
                          <input type="hidden" name="pagamentoId" value={item.id} />
                          <button className="row-text-action danger" type="submit">
                            <Trash2 size={13} /> Remover
                          </button>
                        </form>
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

      <section className="panel cadastro-section">
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
