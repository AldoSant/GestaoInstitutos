import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  PlayCircle,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard, StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarOpcoesNovaFolha } from "@/db/folhas";
import { listarPerfisRecolhimento } from "@/db/perfis-recolhimento";
import { caminhoAplicacao } from "@/lib/base-path";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import { nomeInstrumentoRecolhimento } from "@/lib/perfil-recolhimento";
import { criarNovaFolha } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  competencia?: string | string[];
  erro?: string | string[];
}>;

export default async function NovaFolhaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const erro = Array.isArray(params.erro) ? params.erro[0] : params.erro;
  const competencia = await lerCompetenciaContexto(params.competencia);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let instrumentos: Awaited<ReturnType<typeof listarOpcoesNovaFolha>>;
  let perfisRecolhimento: Awaited<ReturnType<typeof listarPerfisRecolhimento>>;
  try {
    empresa = await resolverEmpresaAtiva();
    [instrumentos, perfisRecolhimento] = await Promise.all([
      listarOpcoesNovaFolha(empresa.id, competencia),
      listarPerfisRecolhimento(empresa.id),
    ]);
  } catch {
    return (
      <AppShell title="Novo processamento" eyebrow="PF, PJ e GPS" organization="Não configurada">
        <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar</Link>
        <section className="alert-box danger">
          <Database size={22} />
          <div><strong>Cadastro indisponível</strong><p>Não foi possível carregar os termos e metas disponíveis.</p></div>
        </section>
      </AppShell>
    );
  }
  const opcoes = instrumentos.map((item) => {
    const bloqueios =
      Number(item.enquadramentos_pendentes) +
      Number(item.nit_pendente) +
      Number(item.medicoes_pendentes) +
      Number(item.documentos_pendentes) +
      Number(item.outras_fontes_pendentes);
    return {
      ...item,
      bloqueios,
      vinculosPf: Number(item.vinculos_pf),
      vinculosPj: Number(item.vinculos) - Number(item.vinculos_pf),
      selecionavel: Number(item.vinculos) > 0 && !item.folha_existente,
      pronta:
        Number(item.vinculos) > 0 &&
        bloqueios === 0 &&
        !item.folha_existente,
    };
  });
  const opcoesProntas = opcoes.filter((item) => item.pronta);
  const opcoesSelecionaveis = opcoes.filter((item) => item.selecionavel);
  const vinculosPf = opcoes.reduce(
    (total, item) => total + item.vinculosPf,
    0,
  );
  const vinculosPj = opcoes.reduce((total, item) => total + item.vinculosPj, 0);
  const contasPendentes = opcoes.reduce(
    (total, item) => total + Number(item.contas_pendentes),
    0,
  );
  const primeiraOpcao = opcoesProntas[0] ?? opcoesSelecionaveis[0];
  const competenciaData = `${competencia}-01`;
  const perfilRecolhimento = perfisRecolhimento.find(
    (item) =>
      item.publicado &&
      item.inicio_vigencia <= competenciaData &&
      item.fim_vigencia >= competenciaData,
  );
  const competenciaRotulo = competencia.split("-").reverse().join("/");

  return (
      <AppShell
        title="Novo processamento"
        eyebrow="PF, PJ e GPS"
        organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      >
        <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar</Link>
        {erro && (
          <section className="feedback-banner error" role="alert">
            <strong>Processamento não criado</strong><span>{erro}</span>
          </section>
        )}
        <section className="metrics-grid" aria-label="Pré-requisitos da folha">
          <MetricCard
            label="Instrumentos aptos"
            value={String(opcoesProntas.length)}
            detail={`de ${opcoes.length} opção(ões) ativas`}
            icon={CheckCircle2}
          />
          <MetricCard
            label="Prestadores no processamento"
            value={String(vinculosPf + vinculosPj)}
            detail={`${vinculosPf} PF e ${vinculosPj} PJ`}
            icon={UsersRound}
            tone="blue"
          />
          <MetricCard
            label="Contas pendentes"
            value={String(contasPendentes)}
            detail="não bloqueiam o cálculo, mas bloqueiam o pagamento"
            icon={WalletCards}
            tone={contasPendentes ? "amber" : "teal"}
          />
        </section>

        <section className="panel compact-panel">
          <form action={caminhoAplicacao("/folhas/nova")} method="get" className="search-field">
            <label>
              <span>Competência para preparar</span>
              <input name="competencia" type="month" required defaultValue={competencia} />
            </label>
            <button className="button secondary" type="submit">Atualizar competência</button>
          </form>
          <p className="field-help">
            A seleção de Termo e Meta abaixo sempre corresponde à competência escolhida aqui.
          </p>
        </section>

        {!perfilRecolhimento && (
          <section className="alert-box warning">
            <AlertTriangle size={22} />
            <div>
              <strong>Recolhimento previdenciário ainda não configurado para {competenciaRotulo}</strong>
              <p>A Folha pode ser preparada e conferida, mas a apuração de retenções ficará bloqueada até a publicação do instrumento fiscal vigente.</p>
            </div>
            <Link className="button secondary" href={`/parametros?novoPerfil=1&competencia=${competencia}`}>
              Configurar recolhimento
            </Link>
          </section>
        )}

        {perfilRecolhimento && (
          <section className="alert-box success">
            <CheckCircle2 size={22} />
            <div>
              <strong>Recolhimento configurado: {nomeInstrumentoRecolhimento(perfilRecolhimento.instrumento)}</strong>
              <p>Esta vigência será congelada na apuração previdenciária da competência.</p>
            </div>
          </section>
        )}

        <section className="panel cadastro-section">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Lote mensal</span>
              <h2>Selecionar competência e instrumento</h2>
              <p>Serão incluídos os vínculos PF e PJ ativos no primeiro dia da competência. INSS e GPS individual são apurados apenas para PF elegível.</p>
            </div>
            <StatusBadge tone={opcoesSelecionaveis.length ? "info" : "warning"}>
              {opcoesSelecionaveis.length
                ? `${opcoesSelecionaveis.length} selecionável(is)`
                : "Nenhuma opção disponível"}
            </StatusBadge>
          </div>
          <form action={criarNovaFolha} className="crud-form">
            <label>
              <span>Competência selecionada</span>
              <input value={competenciaRotulo} readOnly aria-readonly="true" />
              <input name="competencia" type="hidden" value={competencia} />
            </label>
            <label className="field-wide">
              <span>Termo e Meta</span>
              <select
                name="instrumento"
                required
                defaultValue={
                  primeiraOpcao
                    ? `${primeiraOpcao.termo_id}:${primeiraOpcao.meta_id}`
                    : ""
                }
              >
                <option value="" disabled>Selecione o instrumento</option>
                {opcoes.map((item) => (
                  <option
                    key={item.meta_id}
                    value={`${item.termo_id}:${item.meta_id}`}
                    disabled={!item.selecionavel}
                  >
                    Termo {item.termo_numero} · Meta {item.meta_codigo} —{" "}
                    {item.pronta
                      ? `${item.vinculosPf} PF + ${item.vinculosPj} PJ · pronta`
                      : item.folha_existente
                        ? "folha já criada"
                        : item.vinculos === 0
                          ? "sem vínculos"
                          : `${item.vinculosPf} PF + ${item.vinculosPj} PJ · ${item.bloqueios} pendência(s) para resolver`}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" type="submit" disabled={!opcoesSelecionaveis.length}>
              <PlayCircle size={16} /> Validar e gerar processamento mensal
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Diagnóstico antes do cálculo</span>
              <h2>Prontidão por instrumento</h2>
              <p>
                Corrija os bloqueios antes de criar a folha. Pendências bancárias
                permitem calcular, mas precisam ser resolvidas antes do pagamento.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Termo e meta</th>
                  <th>Vínculos</th>
                  <th>Pendências do processamento</th>
                  <th>Conta</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {opcoes.map((item) => (
                  <tr key={item.meta_id}>
                    <td>
                      <strong>Termo {item.termo_numero}</strong>
                      <small>Meta {item.meta_codigo} · {item.meta_descricao}</small>
                    </td>
                    <td>
                      <strong>{item.vinculosPf} PF</strong>
                      <small>{item.vinculosPj} PJ</small>
                    </td>
                    <td>
                      {item.bloqueios === 0 ? (
                        <strong>Sem bloqueios</strong>
                      ) : (
                        <>
                          <strong>{item.bloqueios} pendência(s)</strong>
                          <small>
                            {[
                              Number(item.enquadramentos_pendentes) > 0 && `${item.enquadramentos_pendentes} enquadramento(s)`,
                              Number(item.nit_pendente) > 0 && `${item.nit_pendente} NIT`,
                              Number(item.documentos_pendentes) > 0 && `${item.documentos_pendentes} documento(s)`,
                              Number(item.medicoes_pendentes) > 0 && `${item.medicoes_pendentes} medição(ões)`,
                              Number(item.outras_fontes_pendentes) > 0 && `${item.outras_fontes_pendentes} outra(s) fonte(s)`,
                            ].filter(Boolean).join(" · ")}
                          </small>
                        </>
                      )}
                    </td>
                    <td>{item.contas_pendentes}</td>
                    <td>
                      <StatusBadge
                        tone={
                          item.pronta
                            ? Number(item.contas_pendentes)
                              ? "warning"
                              : "success"
                            : "danger"
                        }
                      >
                        {item.pronta ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <AlertTriangle size={13} />
                        )}
                        {item.pronta
                          ? Number(item.contas_pendentes)
                            ? "Calculável"
                            : "Pronta"
                          : item.folha_existente
                            ? "Já criada"
                            : "Bloqueada"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
                {opcoes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Nenhum termo e meta ativo foi encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!opcoesProntas.length && (
            <div className="guided-actions">
              <AlertTriangle size={19} />
              <div>
                <strong>Há pré-requisitos pendentes</strong>
                <p>
                  Agora você pode selecionar o termo/meta para obter a validação
                  nominal. Use os atalhos para corrigir os cadastros bloqueadores.
                </p>
              </div>
              <Link className="button secondary" href="/vinculos">
                Revisar vínculos
              </Link>
              <Link className="button secondary" href="/cadastros">
                Revisar pessoas
              </Link>
              <Link className="button secondary" href="/termos-e-metas">
                Revisar termos e metas
              </Link>
              <Link
                className="button secondary"
                href={`/medicoes?competencia=${competencia}`}
              >
                Revisar medições
              </Link>
              {vinculosPj > 0 && (
                <Link
                  className="button secondary"
                  href={`/demonstrativos?competencia=${competencia}`}
                >
                  Registrar pagamentos PJ
                </Link>
              )}
            </div>
          )}
        </section>
      </AppShell>
  );
}
