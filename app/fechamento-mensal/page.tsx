import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileLock2,
  History,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  diagnosticarCampanhaHomologacao,
  diagnosticarHomologacaoCompetencia,
} from "@/db/homologacoes-competencia";
import {
  destinoItemCompetencia,
  rotuloItemCompetencia,
  type StatusChecklistCompetencia,
} from "@/lib/homologacao-competencia";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import { congelarCompetencia, decidirCompetencia } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  competencia?: string | string[];
  erro?: string | string[];
  sucesso?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function tomItem(status: StatusChecklistCompetencia) {
  if (status === "OK") return "success" as const;
  if (status === "NAO_APLICAVEL") return "neutral" as const;
  if (status === "BLOQUEIO") return "danger" as const;
  return "warning" as const;
}

function tomVersao(status: string) {
  if (status === "APROVADA") return "success" as const;
  if (status === "REJEITADA" || status === "INVALIDADA") {
    return "danger" as const;
  }
  if (status === "EM_ANALISE") return "warning" as const;
  return "info" as const;
}

function dataHora(valor: Date | string | null) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(valor));
}

function rotuloCompetencia(valor: string) {
  const [ano, mes] = valor.split("-");
  return ano && mes ? `${mes}/${ano}` : valor;
}

export default async function HomologacoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const competencia = await lerCompetenciaContexto(params.competencia);
  const sucesso = primeiro(params.sucesso);
  let erro = primeiro(params.erro);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let diagnostico: Awaited<
    ReturnType<typeof diagnosticarHomologacaoCompetencia>
  > | null = null;
  let campanha: Awaited<ReturnType<typeof diagnosticarCampanhaHomologacao>> =
    [];
  let versoes: Awaited<
    ReturnType<typeof diagnosticarCampanhaHomologacao>
  >[number]["versoes"] = [];

  try {
    empresa = await resolverEmpresaAtiva();
    campanha = await diagnosticarCampanhaHomologacao(
      empresa.id,
      competencia,
    );
    const selecionada = campanha.find(
      (item) => item.competencia === competencia,
    );
    diagnostico = selecionada?.diagnostico ?? null;
    versoes = selecionada?.versoes ?? [];
  } catch (error) {
    erro =
      erro ||
      (error instanceof Error
        ? error.message
        : "Não foi possível diagnosticar a competência.");
    try {
      empresa = await resolverEmpresaAtiva();
    } catch {
      return (
        <AppShell
          title="Fechamento mensal"
          eyebrow="Execução paralela"
          organization="Não configurada"
        >
          <section className="alert-box danger">
            <AlertTriangle size={22} />
            <div>
              <strong>Fechamento indisponível</strong>
              <p>{erro}</p>
            </div>
          </section>
        </AppShell>
      );
    }
  }

  const versaoAtual = diagnostico
    ? versoes.find(
        (versao) =>
          versao.hash_fontes === diagnostico?.hashFontes &&
          versao.status !== "INVALIDADA",
      )
    : undefined;
  const aprovada =
    versaoAtual?.status === "APROVADA" && diagnostico?.resumo.pronta;
  const bloqueios = diagnostico?.resumo.bloqueios.length ?? 0;
  const proximaAcao = !diagnostico
    ? {
        titulo: "Atualize o diagnóstico",
        detalhe: "Carregue os controles da competência para iniciar a conferência.",
        destino: "#preparo-fechamento",
      }
    : bloqueios > 0
      ? {
          titulo: `Resolva ${bloqueios} bloqueio${bloqueios === 1 ? "" : "s"}`,
          detalhe: "A aprovação só fica disponível quando todos os controles obrigatórios estiverem conformes.",
          destino: "#checklist-fechamento",
        }
      : !versaoAtual
        ? {
            titulo: "Congele a evidência",
            detalhe: "Registre o responsável para preservar esta versão dos controles antes da decisão final.",
            destino: "#congelar-fechamento",
          }
        : aprovada
          ? {
              titulo: "Competência aprovada",
              detalhe: "A decisão está associada às fontes atuais e permanece disponível no histórico auditável.",
              destino: "#historico-fechamento",
            }
          : {
              titulo: "Registre a decisão final",
              detalhe: "A versão congelada está pronta para análise, aprovação ou rejeição formal.",
              destino: "#decisao-fechamento",
            };

  return (
    <AppShell
      title="Fechamento mensal"
      eyebrow="Execução paralela e corte"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: aprovada ? "Competência aprovada" : "Fechamento controlado",
        text: aprovada
          ? `A versão ${versaoAtual.versao} corresponde às fontes atuais e possui decisão final.`
          : "Aprovação exige os oito controles obrigatórios na mesma versão de fontes.",
      }}
      actions={
        versaoAtual ? (
          <Link
            className="button secondary"
            href={`/fechamento-mensal/espelho?competencia=${encodeURIComponent(competencia)}`}
          >
            <Download size={16} /> Exportar dossiê
          </Link>
        ) : undefined
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

      <section className="fechamento-hero" id="preparo-fechamento">
        <div className="fechamento-hero-copy">
          <span className="section-kicker">Dossiê da competência</span>
          <h2>Decida com os controles certos à vista.</h2>
          <p>
            O diagnóstico é recalculado a partir do PostgreSQL. O congelamento
            preserva hashes e contagens para revisão e assinatura do RH.
          </p>
          <div className="fechamento-resumo" aria-label="Resumo do fechamento">
            <div><span>Controles</span><strong>{diagnostico?.resumo.total ?? "—"}</strong></div>
            <div><span>Conformes</span><strong>{diagnostico?.resumo.conformes ?? "—"}</strong></div>
            <div><span>Bloqueios</span><strong>{bloqueios}</strong></div>
          </div>
        </div>
        <aside className="fechamento-proxima-acao" aria-label="Próxima ação">
          <span>Próxima ação</span>
          <strong>{proximaAcao.titulo}</strong>
          <p>{proximaAcao.detalhe}</p>
          <a href={proximaAcao.destino} className="button secondary">
            Ver o que precisa ser feito <ArrowRight size={16} />
          </a>
        </aside>
        <div className="fechamento-controles">
          <form method="get" className="crud-form fechamento-form">
          <label>
            <span>Competência</span>
            <input
              type="month"
              name="competencia"
              defaultValue={competencia}
              required
            />
          </label>
          <button className="button primary" type="submit">
            Recalcular diagnóstico
          </button>
        </form>
        {diagnostico && (
          <form id="congelar-fechamento" action={congelarCompetencia} className="crud-form fechamento-form">
            <input type="hidden" name="competencia" value={competencia} />
            <label>
              <span>Responsável pelo congelamento</span>
              <input
                name="responsavel"
                minLength={3}
                maxLength={160}
                placeholder="Nome do operador"
                required
              />
            </label>
            <button className="button secondary" type="submit">
              <FileLock2 size={16} /> Congelar os oito controles
            </button>
          </form>
        )}
        </div>
      </section>

      <section className="panel campanha-fechamento">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Campanha obrigatória</span>
            <h2>Três competências em execução paralela</h2>
            <p>
              A visão acompanha o trimestre encerrado na competência escolhida
              e distingue prontidão viva de aprovação formal.
            </p>
          </div>
          <StatusBadge
            tone={
              campanha.every(
                (item) =>
                  item.diagnostico.resumo.pronta &&
                  item.versaoAtual?.status === "APROVADA",
              )
                ? "success"
                : "warning"
            }
          >
            <ShieldCheck size={14} />
            {
              campanha.filter(
                (item) =>
                  item.diagnostico.resumo.pronta &&
                  item.versaoAtual?.status === "APROVADA",
              ).length
            }
            /3 aprovadas
          </StatusBadge>
        </div>
        <div className="campanha-cards">
          {campanha.map((item) => {
            const itemAprovada =
              item.diagnostico.resumo.pronta &&
              item.versaoAtual?.status === "APROVADA";
            const itemSelecionada = item.competencia === competencia;
            return (
              <Link
                key={item.competencia}
                className={`campanha-card${itemSelecionada ? " selecionada" : ""}`}
                href={`/fechamento-mensal?competencia=${item.competencia}`}
                aria-current={itemSelecionada ? "page" : undefined}
              >
                <span className="campanha-card-periodo">{rotuloCompetencia(item.competencia)}</span>
                <strong>{item.diagnostico.resumo.conformes}/{item.diagnostico.resumo.total} controles</strong>
                <small>{item.diagnostico.resumo.bloqueios.length} bloqueio(s) em aberto</small>
                <StatusBadge tone={itemAprovada ? "success" : item.versaoAtual ? tomVersao(item.versaoAtual.status) : "neutral"}>
                  {itemAprovada ? "Aprovada" : item.versaoAtual?.status.replaceAll("_", " ") ?? "Sem versão"}
                </StatusBadge>
                <span className="campanha-card-acao">Abrir competência <ArrowRight size={15} /></span>
              </Link>
            );
          })}
        </div>
      </section>

      {diagnostico && (
        <>
          <section className="panel" id="checklist-fechamento">
            <div className="panel-header">
              <div>
                <span className="section-kicker">
                  Hash {diagnostico.hashFontes.slice(0, 16)}
                </span>
                <h2>Checklist vivo</h2>
                <p>
                  Cada controle possui hash próprio e será congelado como
                  evidência na versão mensal.
                </p>
              </div>
              <StatusBadge tone="info">
                <ListChecks size={14} /> {diagnostico.itens.length} verificações
              </StatusBadge>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Controle</th>
                    <th>Estado</th>
                    <th>Conformes</th>
                    <th>Pendentes</th>
                    <th>Evidência</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostico.itens.map((item) => (
                    <tr key={item.tipo}>
                      <td>
                        <strong>{rotuloItemCompetencia(item.tipo)}</strong>
                        <small>{item.obrigatorio ? "Obrigatório" : "Opcional"}</small>
                      </td>
                      <td>
                        <StatusBadge tone={tomItem(item.status)}>
                          {item.status.replaceAll("_", " ")}
                        </StatusBadge>
                      </td>
                      <td>
                        {item.conformes}/{item.total}
                      </td>
                      <td>{item.pendentes}</td>
                      <td>
                        <details>
                          <summary>{item.hashEvidencia.slice(0, 12)}</summary>
                          <pre>{JSON.stringify(item.detalhes, null, 2)}</pre>
                        </details>
                      </td>
                      <td>
                        <Link
                          className="row-action"
                          href={destinoItemCompetencia(item.tipo, competencia)}
                          aria-label={`Resolver ${rotuloItemCompetencia(item.tipo)}`}
                        >
                          <ArrowRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {versaoAtual && (
        <section className="panel cadastro-section" id="decisao-fechamento">
          <div className="panel-header">
            <div>
              <span className="section-kicker">
                Versão {versaoAtual.versao} · {versaoAtual.hash_fontes.slice(0, 12)}
              </span>
              <h2>Decisão final da competência</h2>
              <p>
                Aprovação somente é aceita se o servidor repetir o diagnóstico
                e encontrar o mesmo hash sem bloqueios.
              </p>
            </div>
            <StatusBadge tone={tomVersao(versaoAtual.status)}>
              <ShieldCheck size={14} /> {versaoAtual.status.replaceAll("_", " ")}
            </StatusBadge>
          </div>
          <form action={decidirCompetencia} className="crud-form">
            <input type="hidden" name="competencia" value={competencia} />
            <input
              type="hidden"
              name="homologacaoId"
              value={versaoAtual.id}
            />
            <label>
              <span>Decisão</span>
              <select
                name="status"
                defaultValue={
                  versaoAtual.status === "PENDENTE"
                    ? "EM_ANALISE"
                    : versaoAtual.status
                }
                required
              >
                <option value="EM_ANALISE">Em análise</option>
                <option value="APROVADA">Aprovada</option>
                <option value="REJEITADA">Rejeitada</option>
              </select>
            </label>
            <label>
              <span>Responsável</span>
              <input
                name="responsavel"
                minLength={3}
                maxLength={160}
                defaultValue={versaoAtual.responsavel ?? ""}
                required
              />
            </label>
            <label>
              <span>Justificativa e referência da evidência</span>
              <textarea
                name="justificativa"
                minLength={10}
                maxLength={3000}
                defaultValue={versaoAtual.justificativa}
                required
              />
            </label>
            <button className="button primary" type="submit">
              Registrar decisão mensal
            </button>
          </form>
        </section>
      )}

      <section className="panel" id="historico-fechamento">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Histórico preservado</span>
            <h2>Versões da competência</h2>
            <p>
              Mudanças em qualquer um dos oito controles tornam a versão
              anterior inválida para aprovação, sem apagar a decisão.
            </p>
          </div>
          <StatusBadge tone="info">
            <History size={14} /> {versoes.length} versão(ões)
          </StatusBadge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Versão</th>
                <th>Estado</th>
                <th>Prontidão</th>
                <th>Responsável</th>
                <th>Decisão</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {versoes.map((versao) => (
                <tr key={versao.id}>
                  <td>
                    <strong>v{versao.versao}</strong>
                    <small>{dataHora(versao.criado_em)}</small>
                  </td>
                  <td>
                    <StatusBadge tone={tomVersao(versao.status)}>
                      {versao.status.replaceAll("_", " ")}
                    </StatusBadge>
                  </td>
                  <td>
                    {versao.resumo.conformes}/{versao.resumo.total}
                    <small>
                      {versao.resumo.bloqueios.length} bloqueio(s)
                    </small>
                  </td>
                  <td>{versao.responsavel ?? versao.criado_por}</td>
                  <td>{dataHora(versao.decidido_em)}</td>
                  <td>{versao.hash_fontes.slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {versoes.length === 0 && (
          <div className="empty-state">
            <FileLock2 size={28} />
            <strong>Nenhuma versão congelada</strong>
            <p>
              Congele o diagnóstico para iniciar a execução paralela desta
              competência.
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
