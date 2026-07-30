import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Download,
  FileLock2,
  History,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarCasosConsolidacao } from "@/db/consolidacoes";
import { listarSimulacoesConsolidacaoFiscal } from "@/db/simulacoes-consolidacao";
import {
  avaliarAtivacaoConsolidacaoProdutiva,
} from "@/lib/aplicacao-consolidacao";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import {
  rotuloStatusSimulacao,
  type StatusSimulacaoFiscal,
} from "@/lib/simulacao-consolidacao";
import { alterarStatusSimulacao, simularCaso } from "./actions";

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

function dataHora(valor: Date | string | null) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(valor));
}

function tom(status: StatusSimulacaoFiscal) {
  if (status === "HOMOLOGADA") return "success" as const;
  if (status === "REJEITADA" || status === "INVALIDADA") {
    return "danger" as const;
  }
  if (status === "EM_HOMOLOGACAO") return "warning" as const;
  return "info" as const;
}

function origem(snapshot: Record<string, unknown>) {
  const valor = snapshot.origem;
  return valor && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : {};
}

export default async function SimulacoesConsolidacaoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const competencia = await lerCompetenciaContexto(params.competencia);
  const sucesso = primeiro(params.sucesso);
  let erro = primeiro(params.erro);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let casos: Awaited<ReturnType<typeof listarCasosConsolidacao>> = [];
  let simulacoes: Awaited<
    ReturnType<typeof listarSimulacoesConsolidacaoFiscal>
  > = [];
  try {
    empresa = await resolverEmpresaAtiva();
    [casos, simulacoes] = await Promise.all([
      listarCasosConsolidacao(empresa.id, competencia),
      listarSimulacoesConsolidacaoFiscal(empresa.id, competencia),
    ]);
  } catch (error) {
    erro =
      erro ||
      (error instanceof Error
        ? error.message
        : "Não foi possível carregar as simulações.");
    try {
      empresa = await resolverEmpresaAtiva();
    } catch {
      return (
        <AppShell
          title="Simulações fiscais"
          eyebrow="Consolidação mensal"
          organization="Não configurada"
        >
          <section className="alert-box danger">
            <AlertTriangle size={22} />
            <div>
              <strong>Simulações indisponíveis</strong>
              <p>{erro}</p>
            </div>
          </section>
        </AppShell>
      );
    }
  }

  const elegiveis = casos.filter(
    (caso) =>
      caso.status === "RESOLVIDO" &&
      ["RATEIO_NECESSARIO", "UNIFICAR_VINCULOS"].includes(caso.decisao ?? ""),
  );
  const homologadas = simulacoes.filter(
    (simulacao) => simulacao.status === "HOMOLOGADA",
  ).length;
  let ativacao: ReturnType<typeof avaliarAtivacaoConsolidacaoProdutiva> = {
    ativa: false,
    motivo: "configuração inválida",
  };
  try {
    ativacao = avaliarAtivacaoConsolidacaoProdutiva({
      empresaId: empresa.id,
      competencia,
    });
  } catch (error) {
    erro =
      erro ||
      (error instanceof Error
        ? error.message
        : "A ativação produtiva está configurada incorretamente.");
  }

  return (
    <AppShell
      title="Simulações fiscais consolidadas"
      eyebrow="Pessoa · competência · múltiplos vínculos"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: ativacao.ativa ? "Modo produtivo controlado" : "Modo de simulação",
        text: ativacao.ativa
          ? `O rateio homologado pode alimentar Folhas desta empresa desde ${ativacao.inicio}.`
          : `O cálculo não alimenta Folhas nesta competência: ${ativacao.motivo}.`,
      }}
      actions={
        <div className="button-row">
          <Link
            className="button secondary"
            href={`/consolidacoes?competencia=${encodeURIComponent(competencia)}`}
          >
            <ArrowLeft size={16} /> Casos mensais
          </Link>
          {simulacoes.length > 0 && (
            <Link
              className="button secondary"
              href={`/consolidacoes/simulacoes/espelho?competencia=${encodeURIComponent(competencia)}`}
            >
              <Download size={16} /> Exportar memória
            </Link>
          )}
        </div>
      }
    >
      {sucesso && (
        <section className="alert-box success">
          <CheckCircle2 size={22} />
          <div>
            <strong>Operação concluída</strong>
            <p>{sucesso}</p>
          </div>
        </section>
      )}
      {erro && (
        <section className="alert-box danger">
          <AlertTriangle size={22} />
          <div>
            <strong>Operação não concluída</strong>
            <p>{erro}</p>
          </div>
        </section>
      )}

      <section className={`alert-box ${ativacao.ativa ? "success" : "warning"}`}>
        {ativacao.ativa ? (
          <CheckCircle2 size={22} />
        ) : (
          <FileLock2 size={22} />
        )}
        <div>
          <strong>
            {ativacao.ativa
              ? "Consumo produtivo habilitado nesta competência"
              : "Consumo produtivo bloqueado"}
          </strong>
          <p>
            {ativacao.ativa
              ? "Somente uma simulação homologada ainda atual pode alimentar a Folha. Mudança de fonte, regra, enquadramento ou Vínculo interrompe o processamento, e o fechamento exige todas as Folhas da Pessoa."
              : "“Homologada” registra a decisão do RH, mas não produz efeito financeiro enquanto empresa e competência não forem habilitadas na implantação."}
          </p>
        </div>
      </section>

      <section className="panel cadastro-section">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Competência</span>
            <h2>Casos aptos para simulação</h2>
            <p>
              Somente casos congelados e resolvidos entram no motor; medição,
              parâmetros ou fontes divergentes interrompem o cálculo.
            </p>
          </div>
          <StatusBadge tone="info">
            <Calculator size={14} /> {elegiveis.length} caso(s)
          </StatusBadge>
        </div>
        <form method="get" className="crud-form">
          <label>
            <span>Competência</span>
            <input
              type="month"
              name="competencia"
              required
              defaultValue={competencia}
            />
          </label>
          <button className="button primary" type="submit">
            Carregar
          </button>
        </form>
        {elegiveis.map((caso) => (
          <form action={simularCaso} className="crud-form" key={caso.id}>
            <input type="hidden" name="competencia" value={competencia} />
            <input type="hidden" name="casoId" value={caso.id} />
            <label>
              <span>Pessoa e decisão</span>
              <input
                value={`${caso.nome} · ${caso.decisao?.replaceAll("_", " ")}`}
                readOnly
              />
            </label>
            <label>
              <span>Operador responsável</span>
              <input
                name="responsavel"
                minLength={3}
                maxLength={160}
                required
                placeholder="Nome do operador"
              />
            </label>
            <button className="button secondary" type="submit">
              <Calculator size={16} /> Simular versão atual
            </button>
          </form>
        ))}
        {elegiveis.length === 0 && (
          <div className="empty-state">
            <History size={28} />
            <strong>Nenhum caso resolvido apto</strong>
            <p>
              Volte aos casos mensais, congele as fontes e registre a decisão
              do RH.
            </p>
          </div>
        )}
      </section>

      <section className="detail-summary">
        <div>
          <span>Versões calculadas</span>
          <strong>{simulacoes.length}</strong>
        </div>
        <div>
          <span>Em homologação</span>
          <strong>
            {
              simulacoes.filter(
                (simulacao) => simulacao.status === "EM_HOMOLOGACAO",
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Homologadas pelo RH</span>
          <strong>{homologadas}</strong>
        </div>
        <div>
          <span>Integração na Folha</span>
          <strong>{ativacao.ativa ? "Habilitada" : "Bloqueada"}</strong>
        </div>
      </section>

      {simulacoes.map((simulacao) => (
        <section className="panel" key={simulacao.id}>
          <div className="panel-header">
            <div>
              <span className="section-kicker">
                Versão {simulacao.versao} · {simulacao.hash_resultado.slice(0, 12)}
              </span>
              <h2>{simulacao.nome}</h2>
              <p>
                {simulacao.fontes.length} vínculos · criada por{" "}
                {simulacao.criado_por} em {dataHora(simulacao.criado_em)}
              </p>
            </div>
            <StatusBadge tone={tom(simulacao.status)}>
              {simulacao.status === "HOMOLOGADA" ? (
                <CheckCircle2 size={14} />
              ) : (
                <FileLock2 size={14} />
              )}
              {rotuloStatusSimulacao(simulacao.status)}
            </StatusBadge>
          </div>
          <div className="detail-summary">
            <div>
              <span>Proventos</span>
              <strong>{moeda(simulacao.total_proventos)}</strong>
            </div>
            <div>
              <span>INSS consolidado</span>
              <strong>{moeda(simulacao.valor_inss)}</strong>
            </div>
            <div>
              <span>IRRF consolidado</span>
              <strong>{moeda(simulacao.valor_irrf)}</strong>
            </div>
            <div>
              <span>Líquido</span>
              <strong>{moeda(simulacao.total_liquido)}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Proventos</th>
                  <th>Base INSS</th>
                  <th>INSS rateado</th>
                  <th>Base IRRF</th>
                  <th>IRRF rateado</th>
                  <th>Líquido</th>
                </tr>
              </thead>
              <tbody>
                {simulacao.fontes.map((fonte) => {
                  const dados = origem(fonte.snapshot);
                  return (
                    <tr key={fonte.id}>
                      <td>
                        <strong>Termo {String(dados.termoNumero ?? "—")}</strong>
                        <small>
                          Meta {String(dados.metaCodigo ?? "—")} ·{" "}
                          {String(dados.atividade ?? "—")}
                        </small>
                      </td>
                      <td>{moeda(fonte.totalProventos)}</td>
                      <td>{moeda(fonte.baseInssRateada)}</td>
                      <td>{moeda(fonte.valorInssRateado)}</td>
                      <td>{moeda(fonte.baseIrrfRateada)}</td>
                      <td>{moeda(fonte.valorIrrfRateado)}</td>
                      <td>
                        <strong>{moeda(fonte.totalLiquido)}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {simulacao.status === "SIMULADA" && (
            <form action={alterarStatusSimulacao} className="crud-form">
              <input type="hidden" name="competencia" value={competencia} />
              <input type="hidden" name="simulacaoId" value={simulacao.id} />
              <input type="hidden" name="status" value="EM_HOMOLOGACAO" />
              <label>
                <span>Responsável pelo envio ao RH</span>
                <input
                  name="responsavel"
                  minLength={3}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                <span>Observação inicial</span>
                <textarea name="justificativa" maxLength={3000} />
              </label>
              <button className="button primary" type="submit">
                Enviar para homologação
              </button>
            </form>
          )}
          {simulacao.status === "EM_HOMOLOGACAO" && (
            <form action={alterarStatusSimulacao} className="crud-form">
              <input type="hidden" name="competencia" value={competencia} />
              <input type="hidden" name="simulacaoId" value={simulacao.id} />
              <label>
                <span>Decisão do RH</span>
                <select name="status" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  <option value="HOMOLOGADA">Homologar memória</option>
                  <option value="REJEITADA">Rejeitar cálculo</option>
                  <option value="INVALIDADA">Invalidar versão</option>
                </select>
              </label>
              <label>
                <span>Responsável</span>
                <input
                  name="responsavel"
                  minLength={3}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                <span>Evidência e justificativa</span>
                <textarea
                  name="justificativa"
                  minLength={10}
                  maxLength={3000}
                  required
                />
              </label>
              <button className="button primary" type="submit">
                Registrar decisão
              </button>
            </form>
          )}
          {["HOMOLOGADA", "REJEITADA", "INVALIDADA"].includes(
            simulacao.status,
          ) && (
            <div className="alert-box neutral">
              <History size={20} />
              <div>
                <strong>Decisão terminal e imutável</strong>
                <p>
                  {simulacao.responsavel} · {dataHora(simulacao.decidido_em)} ·{" "}
                  {simulacao.justificativa}
                </p>
              </div>
            </div>
          )}
        </section>
      ))}
    </AppShell>
  );
}
