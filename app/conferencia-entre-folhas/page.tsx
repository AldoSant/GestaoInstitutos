import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileLock2,
  GitMerge,
  History,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  diagnosticarConsolidacaoMensal,
  listarCasosConsolidacao,
} from "@/db/consolidacoes";
import { rotuloDecisao } from "@/lib/caso-consolidacao";
import { destinoInternoSeguro } from "@/lib/bloqueios-orientados";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import { congelarDiagnostico, revisarCaso } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  competencia?: string | string[];
  retorno?: string | string[];
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

function tomCaso(status: string) {
  if (status === "RESOLVIDO") return "success" as const;
  if (status === "INVALIDADO") return "neutral" as const;
  if (status === "EM_ANALISE") return "warning" as const;
  return "danger" as const;
}

export default async function ConsolidacoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const competencia = await lerCompetenciaContexto(params.competencia);
  const retorno = destinoInternoSeguro(
    primeiro(params.retorno),
    `/folhas?competencia=${encodeURIComponent(competencia)}`,
  );
  const sucesso = primeiro(params.sucesso);
  let erro = primeiro(params.erro);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let diagnostico: Awaited<ReturnType<typeof diagnosticarConsolidacaoMensal>> | null =
    null;
  let casos: Awaited<ReturnType<typeof listarCasosConsolidacao>> = [];
  try {
    empresa = await resolverEmpresaAtiva();
    [diagnostico, casos] = await Promise.all([
      diagnosticarConsolidacaoMensal(empresa.id, competencia),
      listarCasosConsolidacao(empresa.id, competencia),
    ]);
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
          title="Conferência entre folhas"
          eyebrow="Diagnóstico"
          organization="Não configurada"
        >
          <section className="alert-box danger">
            <AlertTriangle size={22} />
            <div>
              <strong>Diagnóstico indisponível</strong>
              <p>{erro}</p>
            </div>
          </section>
        </AppShell>
      );
    }
  }

  const hashesAtuais = new Set(
    diagnostico?.conflitos.map((conflito) => conflito.hash_fontes) ?? [],
  );
  const casosAtuais = casos.filter(
    (caso) =>
      caso.status !== "INVALIDADO" && hashesAtuais.has(caso.hash_fontes),
  );
  const hashesResolvidos = new Set(
    casosAtuais
      .filter((caso) => caso.status === "RESOLVIDO")
      .map((caso) => caso.hash_fontes),
  );
  const pendentes =
    diagnostico?.conflitos.filter(
      (conflito) => !hashesResolvidos.has(conflito.hash_fontes),
    ).length ?? 0;
  const pronto = Boolean(diagnostico) && pendentes === 0;
  const proximaAcao = !diagnostico
    ? {
        titulo: "Analise a competência",
        detalhe: "Carregue as fontes atuais para identificar pessoas presentes em mais de um vínculo.",
        destino: "#preparo-conferencia",
        rotulo: "Analisar competência",
      }
    : diagnostico.conflitos.length === 0
      ? {
          titulo: "Nenhum conflito em aberto",
          detalhe: "A competência não possui pessoa ativa em múltiplos vínculos. Você pode voltar à rotina de Folha.",
          destino: retorno,
          rotulo: "Voltar à Folha",
        }
      : casosAtuais.length === 0
        ? {
            titulo: "Congele as fontes atuais",
            detalhe: "Registre o responsável para iniciar uma análise que continue válida somente para este conjunto de fontes.",
            destino: "#congelar-conferencia",
            rotulo: "Congelar diagnóstico",
          }
        : pendentes > 0
          ? {
              titulo: `Resolva ${pendentes} caso${pendentes === 1 ? "" : "s"}`,
              detalhe: "As decisões do RH precisam corresponder aos hashes atuais antes de qualquer simulação fiscal.",
              destino: "#casos-conferencia",
              rotulo: "Abrir casos em análise",
            }
          : {
              titulo: "Avance para as simulações",
              detalhe: "Todos os conflitos atuais possuem decisão. Casos elegíveis podem seguir para a memória de rateio controlada.",
              destino: `/conferencia-entre-folhas/simulacoes?competencia=${encodeURIComponent(competencia)}&retorno=${encodeURIComponent(retorno)}`,
              rotulo: "Abrir simulações",
            };

  return (
    <AppShell
      title="Conferência entre folhas"
      eyebrow="Pessoas em múltiplos vínculos"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: pronto ? "Diagnóstico pronto" : "Decisão humana pendente",
        text: pronto
          ? "Todas as fontes atuais possuem decisão registrada ou não há conflito multi-lote."
          : "Congele o diagnóstico e registre a análise do RH para cada pessoa.",
      }}
      actions={
        <div className="button-row">
          <Link className="button secondary" href={retorno}>
            Voltar à folha
          </Link>
          <Link
            className="button secondary"
            href={`/conferencia-entre-folhas/simulacoes?competencia=${encodeURIComponent(competencia)}&retorno=${encodeURIComponent(retorno)}`}
          >
            <GitMerge size={16} /> Simulações fiscais
          </Link>
          {diagnostico && diagnostico.pessoasMultilote > 0 && (
            <Link
              className="button secondary"
              href={`/conferencia-entre-folhas/espelho?competencia=${encodeURIComponent(competencia)}`}
            >
              <Download size={16} /> Exportar CSV
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

      <section className="conferencia-overview" id="preparo-conferencia">
        <div>
          <span className="section-kicker">Competência analisada</span>
          <h2>Antecipe conflitos antes que eles alcancem a Folha.</h2>
          <p>
            A análise localiza a mesma pessoa em mais de um Termo ou Meta, versiona as fontes e preserva a decisão responsável do RH.
          </p>
          <div className="conferencia-resumo" aria-label="Resumo da conferência">
            <div><span>Pessoas ativas</span><strong>{diagnostico?.pessoas ?? "—"}</strong></div>
            <div><span>Vínculos ativos</span><strong>{diagnostico?.vinculos ?? "—"}</strong></div>
            <div><span>Multi-lote</span><strong>{diagnostico?.pessoasMultilote ?? "—"}</strong></div>
            <div><span>Pendentes</span><strong>{pendentes}</strong></div>
          </div>
        </div>
        <aside className="conferencia-proxima-acao" aria-label="Próxima ação">
          <span>Próxima ação</span>
          <strong>{proximaAcao.titulo}</strong>
          <p>{proximaAcao.detalhe}</p>
          <a className="button secondary" href={proximaAcao.destino}>
            {proximaAcao.rotulo} <GitMerge size={16} />
          </a>
        </aside>
        <div className="conferencia-controles">
        <form method="get" className="crud-form conferencia-form">
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
            Analisar competência
          </button>
        </form>
        {diagnostico && diagnostico.pessoasMultilote > 0 && (
          <form id="congelar-conferencia" action={congelarDiagnostico} className="crud-form conferencia-form">
            <input type="hidden" name="competencia" value={competencia} />
            <input type="hidden" name="retorno" value={retorno} />
            <label>
              <span>Responsável pelo congelamento</span>
              <input
                name="responsavel"
                minLength={3}
                maxLength={160}
                required
                placeholder="Nome do operador do RH"
              />
            </label>
            <button className="button secondary" type="submit">
              <FileLock2 size={16} /> Congelar diagnóstico atual
            </button>
          </form>
        )}
        </div>
      </section>

      {diagnostico && (
        <>
          <section className="conferencia-conflitos" id="conflitos-conferencia">
          {diagnostico.conflitos.map((pessoa) => (
            <section className="panel" key={pessoa.pessoa_id}>
              <div className="panel-header">
                <div>
                  <span className="section-kicker">
                    Matrícula {pessoa.matricula}
                  </span>
                  <h2>{pessoa.nome}</h2>
                  <p>
                    {pessoa.quantidade_vinculos} vínculos · Retribuição
                    prevista {moeda(pessoa.retribuicao_prevista)} · Outras
                    fontes {moeda(pessoa.base_outras_fontes)}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    hashesResolvidos.has(pessoa.hash_fontes)
                      ? "success"
                      : pessoa.medicao_pendente
                        ? "danger"
                        : "warning"
                  }
                >
                  {hashesResolvidos.has(pessoa.hash_fontes) ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <AlertTriangle size={14} />
                  )}
                  {hashesResolvidos.has(pessoa.hash_fontes)
                    ? "Decisão registrada"
                    : pessoa.medicao_pendente
                      ? "Medição pendente"
                      : "Exige decisão"}
                </StatusBadge>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Termo e Meta</th>
                      <th>Atividade</th>
                      <th>Contratual</th>
                      <th>Previsto</th>
                      <th>Medição</th>
                      <th>Folha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoa.fontes.map((fonte) => (
                      <tr key={fonte.vinculoId}>
                        <td>
                          <strong>Termo {fonte.termoNumero}</strong>
                          <small>Meta {fonte.metaCodigo}</small>
                        </td>
                        <td>{fonte.atividade}</td>
                        <td>{moeda(fonte.valorContratual)}</td>
                        <td>
                          <strong>{moeda(fonte.valorPrevisto)}</strong>
                        </td>
                        <td>
                          {fonte.exigeMedicao
                            ? fonte.medicaoId
                              ? fonte.medicaoTipo
                              : "Pendente"
                            : "Não exigida"}
                        </td>
                        <td>
                          {fonte.folhaId ? (
                            <Link href={`/folhas/${fonte.folhaId}`}>
                              Lote {fonte.folhaNumero}
                              <small>{fonte.folhaStatus}</small>
                            </Link>
                          ) : (
                            "Não criada"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {diagnostico.conflitos.length === 0 && (
            <section className="alert-box success">
              <CheckCircle2 size={22} />
              <div>
                <strong>Nenhum conflito multi-lote identificado</strong>
                <p>
                  Cada pessoa ativa participa de um único Vínculo na
                  competência analisada.
                </p>
              </div>
            </section>
          )}
          </section>
        </>
      )}

      <nav className="consulta-nav" aria-label="Seções da conferência">
        <a href="#conflitos-conferencia">Conflitos atuais</a>
        <a href="#casos-conferencia">Casos e decisões</a>
        <a href="#limite-conferencia">Limites do processo</a>
      </nav>

      <section className="panel" id="casos-conferencia">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Trilha persistente</span>
            <h2>Casos em análise na competência</h2>
            <p>
              O hash identifica exatamente o conjunto de fontes analisado.
              Mudanças posteriores invalidam a decisão, sem apagar o histórico.
            </p>
          </div>
          <StatusBadge tone="info">
            <History size={14} /> {casos.length} versão(ões)
          </StatusBadge>
        </div>
        {casos.map((caso) => (
          <article className="cadastro-section" key={caso.id}>
            <div className="panel-header">
              <div>
                <span className="section-kicker">
                  {caso.hash_fontes.slice(0, 12)} · criado por {caso.criado_por}
                </span>
                <h3>{caso.nome}</h3>
                <p>
                  {caso.matricula} · {rotuloDecisao(caso.decisao)} · Atualizado
                  em {dataHora(caso.atualizado_em)}
                </p>
              </div>
              <StatusBadge
                tone={
                  hashesAtuais.has(caso.hash_fontes)
                    ? tomCaso(caso.status)
                    : "neutral"
                }
              >
                {hashesAtuais.has(caso.hash_fontes)
                  ? caso.status.replace("_", " ")
                  : "FONTES ALTERADAS"}
              </StatusBadge>
            </div>
            {caso.status !== "INVALIDADO" &&
            hashesAtuais.has(caso.hash_fontes) ? (
              <form action={revisarCaso} className="crud-form">
                <input type="hidden" name="competencia" value={competencia} />
                <input type="hidden" name="retorno" value={retorno} />
                <input type="hidden" name="casoId" value={caso.id} />
                <label>
                  <span>Andamento</span>
                  <select
                    name="status"
                    defaultValue={
                      caso.status === "RESOLVIDO"
                        ? "RESOLVIDO"
                        : "EM_ANALISE"
                    }
                    required
                  >
                    <option value="EM_ANALISE">Em análise</option>
                    <option value="RESOLVIDO">Resolvido</option>
                  </select>
                </label>
                <label>
                  <span>Decisão final</span>
                  <select name="decisao" defaultValue={caso.decisao ?? ""}>
                    <option value="">Ainda sem decisão</option>
                    <option value="UNIFICAR_VINCULOS">
                      Unificar vínculos
                    </option>
                    <option value="RATEIO_NECESSARIO">
                      Rateio necessário
                    </option>
                    <option value="NAO_APLICAVEL">Não aplicável</option>
                  </select>
                </label>
                <label>
                  <span>Responsável</span>
                  <input
                    name="responsavel"
                    minLength={3}
                    maxLength={160}
                    required
                    defaultValue={caso.responsavel ?? ""}
                  />
                </label>
                <label>
                  <span>Justificativa e evidência</span>
                  <textarea
                    name="justificativa"
                    minLength={10}
                    maxLength={2000}
                    required
                    defaultValue={caso.justificativa}
                  />
                </label>
                <button className="button primary" type="submit">
                  Registrar revisão
                </button>
              </form>
            ) : (
              <div className="alert-box warning">
                <History size={20} />
                <div>
                  <strong>Versão histórica sem validade atual</strong>
                  <p>
                    As fontes mudaram depois desta análise. A justificativa foi
                    preservada, mas não conta para a prontidão atual.
                  </p>
                </div>
              </div>
            )}
          </article>
        ))}
        {casos.length === 0 && (
          <div className="empty-state">
            <FileLock2 size={28} />
            <strong>Nenhum diagnóstico congelado</strong>
            <p>
              Analise a competência e congele as fontes para iniciar a
              análise.
            </p>
          </div>
        )}
      </section>

      <section className="alert-box warning" id="limite-conferencia">
        <AlertTriangle size={22} />
        <div>
          <strong>A decisão não executa rateio tributário</strong>
          <p>
            Esta conferência organiza a evidência do RH. O bloqueio
            previdenciário entre folhas permanece até o cálculo de rateio ser
            homologado com casos reais e memória de cálculo.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
