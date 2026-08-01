import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarEspelhoObrigacao, listarGuiasGpsIndividuais } from "@/db/obrigacoes";
import { montarResumoDossieObrigacao } from "@/lib/relatorio-obrigacao";
import { nomeInstrumentoRecolhimento } from "@/lib/perfil-recolhimento";

export const dynamic = "force-dynamic";

function moeda(valor: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function moedaCentavos(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor / 100);
}

function formatarCnpj(valor: string) {
  return valor.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5",
  );
}

function competencia(valor: string) {
  return valor.slice(0, 7).split("-").reverse().join("/");
}

function data(valor: string | Date | null) {
  if (!valor) return "—";
  const instante =
    valor instanceof Date
      ? valor
      : new Date(`${valor.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(instante);
}

export default async function RelatorioObrigacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarEspelhoObrigacao>>;
  let guiasGps: Awaited<ReturnType<typeof listarGuiasGpsIndividuais>> = [];
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarEspelhoObrigacao(empresa.id, id);
    guiasGps = await listarGuiasGpsIndividuais(empresa.id, id);
  } catch {
    notFound();
  }
  const obrigacao = dados.obrigacao;
  const resumo = montarResumoDossieObrigacao({
    status: obrigacao.status,
    principal: obrigacao.principal,
    juros: obrigacao.juros,
    multa: obrigacao.multa,
    total: obrigacao.total,
    itens: dados.itens.map((item) => ({
      id: item.id,
      natureza: item.natureza,
      valor: item.valor,
    })),
    documentos: dados.documentos.map((documento) => ({
      tipo: documento.tipo,
      valorTotal: documento.valor_total,
      verificado: documento.verificado,
    })),
    guiasGpsIndividuais: guiasGps.map((guia) => ({
      id: guia.id,
      status: guia.status,
      total: guia.total,
      verificado: guia.verificado,
    })),
    instrumento: obrigacao.perfil_instrumento,
  });
  const usaGps = obrigacao.perfil_instrumento === "GPS_EXCECAO";

  return (
    <main className="print-document">
      <nav className="print-toolbar" aria-label="Ações do relatório">
        <Link className="button secondary" href="/obrigacoes">
          <ArrowLeft size={16} /> Voltar às obrigações
        </Link>
        <PrintButton label="Imprimir dossiê" />
      </nav>
      <article className="print-sheet">
        <header className="print-header">
          <div>
            <span>Dossiê interno de obrigação previdenciária</span>
            <h1>{empresa.razaoSocial}</h1>
            <p>CNPJ {formatarCnpj(empresa.cnpj)}</p>
          </div>
          <div className="print-document-code">
            <strong>Competência {competencia(obrigacao.competencia)}</strong>
            <span>Obrigação previdenciária</span>
            <span>Status: {obrigacao.status}</span>
          </div>
        </header>

        <section className="print-warning">
          <strong>Este dossiê não é uma guia de arrecadação.</strong>
          <p>{usaGps
            ? "Cada GPS oficial é registrada por retenção de prestador. Este dossiê registra a conferência interna e não substitui os documentos de arrecadação."
            : "O documento oficial para pagamento é o DARF emitido no ambiente competente. Este relatório apenas reconcilia a apuração interna com totalizador, recibo e DARF registrados."}</p>
        </section>

        <section className="print-totals">
          <div>
            <span>Principal</span>
            <strong>{moeda(obrigacao.principal)}</strong>
          </div>
          <div>
            <span>Juros</span>
            <strong>{moeda(obrigacao.juros)}</strong>
          </div>
          <div>
            <span>Multa</span>
            <strong>{moeda(obrigacao.multa)}</strong>
          </div>
          <div>
            <span>Total interno</span>
            <strong>{moeda(obrigacao.total)}</strong>
          </div>
          <div>
            <span>Declarado</span>
            <strong>
              {obrigacao.valor_declarado
                ? moeda(obrigacao.valor_declarado)
                : "Pendente"}
            </strong>
          </div>
          <div>
            <span>Diferença</span>
            <strong>
              {obrigacao.diferenca ? moeda(obrigacao.diferenca) : "—"}
            </strong>
          </div>
        </section>

        <dl className="print-meta">
          <div>
            <dt>Instrumento congelado</dt>
            <dd>{obrigacao.perfil_instrumento ? nomeInstrumentoRecolhimento(obrigacao.perfil_instrumento) : "Perfil histórico não registrado"}{obrigacao.perfil_codigo_receita ? ` · código ${obrigacao.perfil_codigo_receita}` : ""}</dd>
          </div>
          <div>
            <dt>Conciliação</dt>
            <dd>{data(obrigacao.conciliada_em)}</dd>
          </div>
          <div>
            <dt>Itens rastreáveis</dt>
            <dd>{resumo.itens}</dd>
          </div>
          {usaGps ? (
            <div><dt>GPS individuais</dt><dd>{resumo.documentos.gpsRegistradas}/{resumo.documentos.gpsIndividuais} registradas · {moedaCentavos(resumo.documentos.gpsTotalCentavos)}</dd></div>
          ) : (
            <>
              <div><dt>Totalizador / recibo</dt><dd>{resumo.documentos.totalizadorVerificado ? "Verificado" : "Pendente"} / {resumo.documentos.reciboVerificado ? "verificado" : "pendente"}</dd></div>
              <div><dt>DARF</dt><dd>{resumo.documentos.darfVerificado ? "Verificado e conciliado" : "Pendente"}</dd></div>
            </>
          )}
        </dl>

        {obrigacao.perfil_evidencia && (
          <section className="print-warning subtle">
            <strong>Fundamentação do instrumento</strong>
            <p>{obrigacao.perfil_evidencia}</p>
            <p>Conferido por: {obrigacao.perfil_responsavel ?? "Não informado"}</p>
          </section>
        )}

        {obrigacao.bloqueio_motivo && (
          <section className="print-warning subtle">
            <strong>Bloqueio atual</strong>
            <p>{obrigacao.bloqueio_motivo}</p>
          </section>
        )}

        <h2 className="print-section-title">Composição por natureza</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Natureza</th>
              <th>Itens</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {resumo.naturezas.map((natureza) => (
              <tr key={natureza.natureza}>
                <td>{natureza.natureza}</td>
                <td>{natureza.itens}</td>
                <td>{moedaCentavos(natureza.valorCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="print-section-title">Itens previdenciários</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Folha / prestador</th>
              <th>Natureza</th>
              <th>Base</th>
              <th>Alíquota</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((item) => {
              const snapshot = item.snapshot as {
                pessoa?: { nome?: string };
                prestador?: { matricula?: string };
              };
              return (
                <tr key={item.id}>
                  <td>
                    <strong>{snapshot.pessoa?.nome ?? "Prestador"}</strong>
                    <small>
                      Matrícula {snapshot.prestador?.matricula ?? "—"} · lote{" "}
                      {item.folha_numero ?? "—"} · revisão{" "}
                      {item.folha_revisao ?? "—"}
                    </small>
                    <small>
                      Termo {item.termo_numero ?? "—"} · Meta{" "}
                      {item.meta_codigo ?? "—"}
                    </small>
                  </td>
                  <td>
                    {item.natureza}
                    <small>{item.descricao}</small>
                  </td>
                  <td>{moeda(item.base_calculo)}</td>
                  <td>
                    {item.aliquota
                      ? `${Number(item.aliquota).toLocaleString("pt-BR")}%`
                      : "—"}
                  </td>
                  <td>{moeda(item.valor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2 className="print-section-title">Documentos externos registrados</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Referência</th>
              <th>Emissão</th>
              <th>Valor</th>
              <th>Conferência / evidência</th>
            </tr>
          </thead>
          <tbody>
            {dados.documentos.map((documento) => (
              <tr key={`${documento.tipo}:${documento.referencia}`}>
                <td>{documento.tipo}</td>
                <td>{documento.referencia}</td>
                <td>{data(documento.emitido_em)}</td>
                <td>{moeda(documento.valor_total)}</td>
                <td>
                  {documento.verificado ? "Verificado" : "Pendente"}
                  <small>{documento.localizador}</small>
                  <small>
                    {documento.hash_sha256
                      ? `SHA-256 ${documento.hash_sha256}`
                      : "Hash não informado"}
                  </small>
                </td>
              </tr>
            ))}
            {dados.documentos.length === 0 && (
              <tr>
                <td colSpan={5}>Nenhum documento externo registrado.</td>
              </tr>
            )}
          </tbody>
        </table>

        {dados.retificacoes.length > 0 && (
          <>
            <h2 className="print-section-title">Histórico de retificações</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Estado</th>
                  <th>Responsável</th>
                  <th>Motivo</th>
                  <th>Snapshot anterior</th>
                  <th>Protocolo / conclusão</th>
                </tr>
              </thead>
              <tbody>
                {dados.retificacoes.map((retificacao) => (
                  <tr key={retificacao.id}>
                    <td>v{retificacao.versao}</td>
                    <td>{retificacao.status.replaceAll("_", " ")}</td>
                    <td>{retificacao.responsavel}</td>
                    <td>{retificacao.motivo}</td>
                    <td>
                      SHA-256
                      <small>{retificacao.hash_snapshot_anterior}</small>
                    </td>
                    <td>
                      {retificacao.protocolo ?? "—"}
                      <small>
                        Solicitada {data(retificacao.solicitada_em)} · concluída{" "}
                        {data(retificacao.concluida_em)}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <section className="print-integrity">
          <strong>Fontes congeladas</strong>
          {[...new Map(
            dados.itens
              .filter((item) => item.folha_hash)
              .map((item) => [
                item.folha_hash!,
                `Lote ${item.folha_numero} · revisão ${item.folha_revisao} · ${item.folha_hash}`,
              ]),
          ).values()].map((fonte) => (
            <p key={fonte}>{fonte}</p>
          ))}
        </section>

        <div className="signature-grid">
          <div>Elaboração</div>
          <div>Conferência contábil</div>
          <div>Aprovação administrativa</div>
        </div>
      </article>
    </main>
  );
}
