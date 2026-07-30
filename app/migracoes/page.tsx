import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileArchive,
  History,
  Link2Off,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  carregarCoberturaMigracao,
  carregarMigracaoHistorica,
} from "@/db/migracoes-historicas";
import { exigirAdministrador } from "@/lib/autorizacao";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ competencia?: string | string[] }>;

function moeda(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function data(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function dataHora(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(value));
}

const rotulosEntidade: Record<string, string> = {
  pessoas: "Pessoas",
  atividades: "Atividades",
  lotacoes: "Lotações",
  termos: "Termos e Metas",
  vinculos: "Vínculos",
  eventos: "Eventos/Rubricas",
  lancamentos_eventos: "Lançamentos de Eventos",
  produtividade: "Produtividade/Medições",
  folhas_historicas: "Folhas históricas",
  guias_inss_historicas: "Guias previdenciárias",
};

function igual(a: string, b: string) {
  return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}

export default async function MigracoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await exigirAdministrador();
  const params = await searchParams;
  const competencia = await lerCompetenciaContexto(params.competencia);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  try {
    empresa = await resolverEmpresaAtiva();
  } catch (error) {
    return (
      <AppShell
        title="Migração histórica"
        eyebrow="GIW"
        organization="Não configurada"
      >
        <section className="alert-box danger">
          <AlertTriangle size={22} />
          <div>
            <strong>Empresa indisponível</strong>
            <p>{error instanceof Error ? error.message : "Configure a organização."}</p>
          </div>
        </section>
      </AppShell>
    );
  }

  let dados: Awaited<ReturnType<typeof carregarMigracaoHistorica>> | null = null;
  let controle: Awaited<ReturnType<typeof carregarCoberturaMigracao>> = {
    cobertura: [],
    execucoes: [],
  };
  let erro = "";
  try {
    [dados, controle] = await Promise.all([
      carregarMigracaoHistorica(empresa.id, competencia),
      carregarCoberturaMigracao(empresa.id),
    ]);
  } catch (error) {
    erro =
      error instanceof Error
        ? error.message
        : "Não foi possível consultar o acervo histórico.";
  }
  const resumo = dados?.resumo;
  const temLegado = Boolean(resumo?.folhas_legado || resumo?.guias_legado);
  const pessoasMapeadas =
    resumo && resumo.pessoas_legado > 0
      ? Math.round((resumo.pessoas_mapeadas / resumo.pessoas_legado) * 100)
      : 0;
  const liquidoConfere = resumo
    ? igual(resumo.liquido_legado, resumo.liquido_novo)
    : false;
  const inssConfere = resumo ? igual(resumo.inss_legado, resumo.inss_novo) : false;

  return (
    <AppShell
      title="Migração histórica"
      eyebrow="Acervo GIW e operação paralela"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: temLegado ? "Evidência importada" : "Aguardando snapshot",
        text: temLegado
          ? "Os registros do legado permanecem separados da folha oficial e podem ser reimportados com idempotência."
          : "Colete as folhas e guias do GIW, valide em dry-run e aplique somente após conferir as contagens.",
      }}
      actions={
        dados && temLegado ? (
          <Link
            className="button secondary"
            href={`/migracoes/espelho?competencia=${encodeURIComponent(competencia)}`}
          >
            <Download size={16} /> Exportar dossiê CSV
          </Link>
        ) : undefined
      }
    >
      {erro && (
        <section className="alert-box danger">
          <AlertTriangle size={22} />
          <div>
            <strong>Acervo histórico indisponível</strong>
            <p>
              {erro} Aplique as migrações do banco antes de importar snapshots
              históricos.
            </p>
          </div>
        </section>
      )}

      <section className="panel cadastro-section">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Competência de comparação</span>
            <h2>Legado versus motor novo</h2>
            <p>
              Compara totais por lote e pessoa sem converter automaticamente um
              resultado antigo em folha oficial.
            </p>
          </div>
          <StatusBadge
            tone={liquidoConfere && inssConfere && temLegado ? "success" : "warning"}
          >
            {liquidoConfere && inssConfere && temLegado ? (
              <CheckCircle2 size={14} />
            ) : (
              <History size={14} />
            )}
            {liquidoConfere && inssConfere && temLegado
              ? "Totais conciliados"
              : "Conciliação pendente"}
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
            Comparar competência
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Cadeia de dependências</span>
            <h2>Cobertura das chaves do GIW</h2>
            <p>
              Mostra o que já possui correspondência durável entre o código do
              legado e o UUID local. Zero significa que a etapa ainda não foi
              aplicada nesta organização.
            </p>
          </div>
          <StatusBadge
            tone={
              controle.cobertura.length > 0 &&
              controle.cobertura.every((item) => item.registros_mapeados > 0)
                ? "success"
                : "warning"
            }
          >
            <History size={14} />
            {
              controle.cobertura.filter((item) => item.registros_mapeados > 0)
                .length
            }
            /{controle.cobertura.length} etapas iniciadas
          </StatusBadge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Entidade</th>
                <th>Chaves mapeadas</th>
                <th>Última atualização</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {controle.cobertura.map((item) => (
                <tr key={item.entidade}>
                  <td>{item.ordem}</td>
                  <td>
                    <strong>
                      {rotulosEntidade[item.entidade] ?? item.entidade}
                    </strong>
                    <small>{item.entidade}</small>
                  </td>
                  <td>{item.registros_mapeados}</td>
                  <td>{dataHora(item.ultima_atualizacao)}</td>
                  <td>
                    <StatusBadge
                      tone={item.registros_mapeados > 0 ? "success" : "warning"}
                    >
                      {item.registros_mapeados > 0 ? "Importada" : "Pendente"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Trilha operacional</span>
            <h2>Últimas execuções de importação</h2>
            <p>
              Dry-runs e aplicações preservam arquivo, modo, contagens,
              resultado e horário para conferência.
            </p>
          </div>
          <StatusBadge tone="info">
            <FileArchive size={14} /> {controle.execucoes.length} execução(ões)
          </StatusBadge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entidade / arquivo</th>
                <th>Modo</th>
                <th>Lidos</th>
                <th>Inseridos</th>
                <th>Atualizados</th>
                <th>Ignorados</th>
                <th>Erros</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {controle.execucoes.map((execucao) => (
                <tr key={execucao.id}>
                  <td>
                    <strong>
                      {rotulosEntidade[execucao.entidade] ?? execucao.entidade}
                    </strong>
                    <small>
                      {execucao.arquivo} · {dataHora(execucao.iniciado_em)}
                    </small>
                  </td>
                  <td>{execucao.modo === "APLICAR" ? "Aplicação" : "Dry-run"}</td>
                  <td>{execucao.total_lidos}</td>
                  <td>{execucao.total_inseridos}</td>
                  <td>{execucao.total_atualizados}</td>
                  <td>{execucao.total_ignorados}</td>
                  <td>{execucao.total_erros}</td>
                  <td>
                    <StatusBadge
                      tone={
                        execucao.status === "CONCLUIDA"
                          ? "success"
                          : execucao.status === "CONCLUIDA_COM_ERROS"
                            ? "warning"
                            : execucao.status === "FALHA"
                              ? "danger"
                              : "info"
                      }
                    >
                      {execucao.status.replaceAll("_", " ")}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {controle.execucoes.length === 0 && (
          <div className="empty-state">
            <History size={28} />
            <strong>Nenhuma execução registrada</strong>
            <p>Faça primeiro um dry-run contra o PostgreSQL.</p>
          </div>
        )}
      </section>

      {resumo && (
        <>
          <section className="detail-summary">
            <div>
              <span>Folhas GIW</span>
              <strong>{resumo.folhas_legado}</strong>
            </div>
            <div>
              <span>Pessoas mapeadas</span>
              <strong>
                {resumo.pessoas_mapeadas}/{resumo.pessoas_legado}
              </strong>
              <small>{pessoasMapeadas}% do acervo</small>
            </div>
            <div>
              <span>Rubricas preservadas</span>
              <strong>{resumo.rubricas_legado}</strong>
            </div>
            <div>
              <span>Guias GIW</span>
              <strong>{resumo.guias_legado}</strong>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Reconciliação financeira</span>
                <h2>Totais da competência</h2>
                <p>
                  Diferença zero é requisito técnico, não prova isolada de
                  conformidade fiscal.
                </p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Grandeza</th>
                    <th>GIW</th>
                    <th>Sistema novo</th>
                    <th>Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Proventos", resumo.proventos_legado, resumo.proventos_novo],
                    ["Descontos", resumo.descontos_legado, resumo.descontos_novo],
                    ["Líquido", resumo.liquido_legado, resumo.liquido_novo],
                    ["Base de INSS", resumo.base_inss_legado, resumo.base_inss_novo],
                    ["INSS dos segurados", resumo.inss_legado, resumo.inss_novo],
                    [
                      "Guia/obrigação",
                      resumo.guias_total_legado,
                      resumo.obrigacoes_total_novo,
                    ],
                  ].map(([rotulo, legado, novo]) => {
                    const diferenca = Number(novo) - Number(legado);
                    return (
                      <tr key={rotulo}>
                        <td>
                          <strong>{rotulo}</strong>
                        </td>
                        <td>{moeda(legado)}</td>
                        <td>{moeda(novo)}</td>
                        <td>
                          <StatusBadge tone={Math.abs(diferenca) < 0.005 ? "success" : "danger"}>
                            {moeda(diferenca)}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Folhas preservadas</span>
                <h2>Lotes encontrados no GIW</h2>
                <p>Cada lote mantém checksum, data de extração, itens e rubricas.</p>
              </div>
              <StatusBadge tone="info">
                <FileArchive size={14} /> {dados?.folhas.length ?? 0} lote(s)
              </StatusBadge>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Status</th>
                    <th>Pessoas / rubricas</th>
                    <th>Base INSS</th>
                    <th>INSS</th>
                    <th>Líquido</th>
                    <th>Extraído</th>
                  </tr>
                </thead>
                <tbody>
                  {dados?.folhas.map((folha) => (
                    <tr key={folha.id}>
                      <td>
                        <strong>{folha.numero}</strong>
                        <small>GIW {folha.legacy_id}</small>
                      </td>
                      <td>
                        {folha.status}
                        <small>Pagamento: {data(folha.data_pagamento)}</small>
                      </td>
                      <td>
                        {folha.pessoas} / {folha.rubricas}
                      </td>
                      <td>{moeda(folha.base_inss)}</td>
                      <td>{moeda(folha.valor_inss)}</td>
                      <td>
                        <strong>{moeda(folha.total_liquido)}</strong>
                      </td>
                      <td>{dataHora(folha.extraido_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dados?.folhas.length === 0 && (
              <div className="empty-state">
                <FileArchive size={28} />
                <strong>Nenhuma folha histórica importada</strong>
                <p>Execute o coletor e o importador para esta competência.</p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Comparação individual</span>
                <h2>Pessoa a pessoa</h2>
                <p>
                  Pessoas sem chave legada aparecem primeiro; depois vêm as
                  maiores diferenças de líquido.
                </p>
              </div>
              <StatusBadge
                tone={
                  resumo.pessoas_mapeadas === resumo.pessoas_legado &&
                  resumo.pessoas_legado > 0
                    ? "success"
                    : "warning"
                }
              >
                {resumo.pessoas_mapeadas === resumo.pessoas_legado &&
                resumo.pessoas_legado > 0 ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Link2Off size={14} />
                )}
                {pessoasMapeadas}% mapeado
              </StatusBadge>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th>Mapeamento</th>
                    <th>Líquido GIW</th>
                    <th>Líquido novo</th>
                    <th>Diferença líquido</th>
                    <th>Diferença INSS</th>
                  </tr>
                </thead>
                <tbody>
                  {dados?.pessoas.map((pessoa) => (
                    <tr key={pessoa.pessoa_legacy_id}>
                      <td>
                        <strong>{pessoa.nome_legado}</strong>
                        <small>
                          Matrícula {pessoa.matricula_legado} · GIW{" "}
                          {pessoa.pessoa_legacy_id}
                        </small>
                      </td>
                      <td>
                        <StatusBadge tone={pessoa.pessoa_id ? "success" : "danger"}>
                          {pessoa.pessoa_id ? "Mapeada" : "Sem cadastro"}
                        </StatusBadge>
                      </td>
                      <td>{moeda(pessoa.liquido_legado)}</td>
                      <td>{moeda(pessoa.liquido_novo)}</td>
                      <td>{moeda(pessoa.diferenca_liquido)}</td>
                      <td>{moeda(pessoa.diferenca_inss)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Documentos históricos</span>
                <h2>Guias previdenciárias</h2>
                <p>
                  GPS é tratada como evidência legada; o fluxo oficial atual
                  continua condicionado ao enquadramento e à DCTFWeb.
                </p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Status</th>
                    <th>Vencimento</th>
                    <th>Principal</th>
                    <th>Acréscimos</th>
                    <th>Compensações</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados?.guias.map((guia) => (
                    <tr key={guia.id}>
                      <td>
                        <strong>{guia.tipo}</strong>
                        <small>
                          {guia.identificador || `GIW ${guia.legacy_id}`}
                        </small>
                      </td>
                      <td>
                        {guia.status}
                        <small>Pagamento: {data(guia.pagamento)}</small>
                      </td>
                      <td>{data(guia.vencimento)}</td>
                      <td>{moeda(guia.principal)}</td>
                      <td>{moeda(Number(guia.juros) + Number(guia.multa))}</td>
                      <td>{moeda(guia.compensacoes)}</td>
                      <td>
                        <strong>{moeda(guia.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
