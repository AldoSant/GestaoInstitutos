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
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
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
  try {
    empresa = await resolverEmpresaAtiva();
    instrumentos = await listarOpcoesNovaFolha(empresa.id, competencia);
  } catch {
    return (
      <AppShell title="Nova folha" eyebrow="Processamento mensal" organization="Não configurada">
        <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar</Link>
        <section className="alert-box danger">
          <Database size={22} />
          <div><strong>Cadastro indisponível</strong><p>Não foi possível carregar os instrumentos disponíveis.</p></div>
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
      pronta:
        Number(item.vinculos) > 0 &&
        bloqueios === 0 &&
        !item.folha_existente,
    };
  });
  const opcoesProntas = opcoes.filter((item) => item.pronta);
  const vinculos = opcoes.reduce(
    (total, item) => total + Number(item.vinculos),
    0,
  );
  const contasPendentes = opcoes.reduce(
    (total, item) => total + Number(item.contas_pendentes),
    0,
  );
  const primeiraOpcao = opcoesProntas[0];

  return (
      <AppShell
        title="Nova folha"
        eyebrow="Processamento mensal"
        organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      >
        <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar</Link>
        {erro && (
          <section className="feedback-banner error" role="alert">
            <strong>Folha não criada</strong><span>{erro}</span>
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
            label="Vínculos encontrados"
            value={String(vinculos)}
            detail={`na competência ${competencia}`}
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

        <section className="panel cadastro-section">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Lote mensal</span>
              <h2>Selecionar competência e instrumento</h2>
              <p>Serão incluídos os vínculos ativos no primeiro dia da competência.</p>
            </div>
            <StatusBadge tone={opcoesProntas.length ? "success" : "warning"}>
              {opcoesProntas.length
                ? `${opcoesProntas.length} pronta(s)`
                : "Nenhuma opção pronta"}
            </StatusBadge>
          </div>
          <form action={criarNovaFolha} className="crud-form">
            <label>
              <span>Competência</span>
              <input
                name="competencia"
                type="month"
                required
                defaultValue={competencia}
              />
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
                    disabled={!item.pronta}
                  >
                    Termo {item.termo_numero} · Meta {item.meta_codigo} —{" "}
                    {item.pronta
                      ? `${item.vinculos} vínculo(s)`
                      : item.folha_existente
                        ? "folha já criada"
                        : item.vinculos === 0
                          ? "sem vínculos"
                          : `${item.bloqueios} pendência(s)`}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" type="submit" disabled={!opcoesProntas.length}>
              <PlayCircle size={16} /> Criar e processar
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
                  <th>Fiscal</th>
                  <th>NIT</th>
                  <th>Documento</th>
                  <th>Medições</th>
                  <th>Outras fontes</th>
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
                    <td>{item.vinculos}</td>
                    <td>{item.enquadramentos_pendentes}</td>
                    <td>{item.nit_pendente}</td>
                    <td>{item.documentos_pendentes}</td>
                    <td>{item.medicoes_pendentes}</td>
                    <td>{item.outras_fontes_pendentes}</td>
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
                    <td colSpan={9} className="empty-cell">
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
                  Revise vínculos, fichas de pessoas e medições da competência
                  antes de tentar novamente.
                </p>
              </div>
              <Link className="button secondary" href="/vinculos">
                Revisar vínculos
              </Link>
              <Link className="button secondary" href="/cadastros">
                Revisar pessoas
              </Link>
              <Link
                className="button secondary"
                href={`/medicoes?competencia=${competencia}`}
              >
                Revisar medições
              </Link>
            </div>
          )}
        </section>
      </AppShell>
  );
}
