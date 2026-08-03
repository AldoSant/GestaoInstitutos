import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";
import {
  montarResumoRelatorioFolha,
  type ItemRelatorioFolha,
} from "@/lib/relatorio-folha";

export const dynamic = "force-dynamic";

function moedaCentavos(centavos: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function moeda(valor: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function formatarCpfCnpj(valor: string | null) {
  if (!valor) return "Não informado";
  if (valor.length === 11) {
    return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (valor.length === 14) {
    return valor.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }
  return valor;
}

function competencia(valor: string) {
  const [ano, mes] = valor.slice(0, 7).split("-");
  return `${mes}/${ano}`;
}

function dataHora(valor: Date | string | null) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(valor));
}

function referenciaConsolidada(memoria: unknown) {
  if (!memoria || typeof memoria !== "object") {
    return { simulacaoId: null, hashSimulacao: null };
  }
  const consolidacao = (memoria as Record<string, unknown>).consolidacaoFiscal;
  if (!consolidacao || typeof consolidacao !== "object") {
    return { simulacaoId: null, hashSimulacao: null };
  }
  const dados = consolidacao as Record<string, unknown>;
  return {
    simulacaoId:
      typeof dados.simulacaoId === "string" ? dados.simulacaoId : null,
    hashSimulacao:
      typeof dados.hashResultado === "string" ? dados.hashResultado : null,
  };
}

export default async function RelatorioFolhaPage({
  params,
}: {
  params: Promise<{ competencia: string }>;
}) {
  const { competencia: folhaId } = await params;
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarFolha>>;
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarFolha(empresa.id, folhaId);
  } catch {
    notFound();
  }
  if (!dados.folha.hash_resultado || dados.itens.length === 0) {
    notFound();
  }
  const itens: ItemRelatorioFolha[] = dados.itens.map((item) => {
    const snapshot = item.snapshots as {
      pessoa?: {
        nome?: string;
        tipo?: "FISICA" | "JURIDICA";
        cpf?: string | null;
        cnpj?: string | null;
      };
      prestador?: {
        matricula?: string;
        nitPisPasep?: string | null;
      };
      vinculo?: { atividade?: string };
    };
    const consolidacao = referenciaConsolidada(item.memoria);
    return {
      id: item.id,
      nome: snapshot.pessoa?.nome ?? "Prestador não identificado",
      tipoPessoa: snapshot.pessoa?.tipo === "JURIDICA" ? "JURIDICA" : "FISICA",
      documento: snapshot.pessoa?.cpf ?? snapshot.pessoa?.cnpj ?? null,
      matricula: snapshot.prestador?.matricula ?? "—",
      nitPisPasep: snapshot.prestador?.nitPisPasep ?? null,
      atividade: snapshot.vinculo?.atividade ?? "—",
      totalProventos: item.total_proventos,
      totalDescontos: item.total_descontos,
      baseInss: item.base_inss,
      valorInss: item.valor_inss,
      baseIrrf: item.base_irrf,
      valorIrrf: item.valor_irrf,
      totalLiquido: item.total_liquido,
      ...consolidacao,
      linhas: (item.eventos as Array<Record<string, unknown>>).map(
        (linha) => ({
          codigo: String(linha.codigo ?? ""),
          descricao: String(linha.descricao ?? ""),
          natureza: String(linha.natureza ?? ""),
          origem: String(linha.origem ?? ""),
          incideInss: linha.incide_inss === true,
          incideIrrf: linha.incide_irrf === true,
          referencia:
            linha.referencia === null || linha.referencia === undefined
              ? null
              : String(linha.referencia),
          baseCalculo: String(linha.base_calculo ?? "0"),
          valor: String(linha.valor ?? "0"),
          ordem: Number(linha.ordem ?? 0),
        }),
      ),
    };
  });
  const relatorio = montarResumoRelatorioFolha(itens);
  const folha = dados.folha;
  const conferencia = dados.conferencias.find(
    (item) =>
      item.hash_resultado === folha.hash_resultado &&
      item.resultado === "APROVADA",
  );

  return (
    <main className="print-document">
      <nav className="print-toolbar" aria-label="Ações do relatório">
        <Link className="button secondary" href={`/folhas/${folha.id}`}>
          <ArrowLeft size={16} /> Voltar à Folha
        </Link>
        <PrintButton />
      </nav>

      <article className="print-sheet">
        <header className="print-header">
          <div>
            <span>Relatório interno de Folha de Pagamentos</span>
            <h1>{empresa.razaoSocial}</h1>
            <p>CNPJ {formatarCpfCnpj(empresa.cnpj)}</p>
          </div>
          <div className="print-document-code">
            <strong>Competência {competencia(folha.competencia)}</strong>
            <span>
              Lote {folha.numero} · revisão {folha.revisao}
            </span>
            <span>Status: {folha.status}</span>
          </div>
        </header>

        <dl className="print-meta">
          <div>
            <dt>Termo</dt>
            <dd>
              {folha.termo_numero} — {folha.termo_descricao}
            </dd>
          </div>
          <div>
            <dt>Meta</dt>
            <dd>
              {folha.meta_codigo} — {folha.meta_descricao}
            </dd>
          </div>
          <div>
            <dt>Regra fiscal</dt>
            <dd>
              {folha.regra_codigo} v{folha.regra_versao}
            </dd>
          </div>
          <div>
            <dt>Processamento / fechamento</dt>
            <dd>
              {dataHora(folha.processada_em)} / {dataHora(folha.fechada_em)}
            </dd>
          </div>
        </dl>

        <section className="print-totals">
          <div>
            <span>Prestadores</span>
            <strong>{relatorio.itens.length}</strong>
          </div>
          <div>
            <span>Proventos</span>
            <strong>{moedaCentavos(relatorio.totais.proventosCentavos)}</strong>
          </div>
          <div>
            <span>INSS</span>
            <strong>{moedaCentavos(relatorio.totais.inssCentavos)}</strong>
          </div>
          <div>
            <span>IRRF</span>
            <strong>{moedaCentavos(relatorio.totais.irrfCentavos)}</strong>
          </div>
          <div>
            <span>Descontos</span>
            <strong>{moedaCentavos(relatorio.totais.descontosCentavos)}</strong>
          </div>
          <div>
            <span>Líquido</span>
            <strong>{moedaCentavos(relatorio.totais.liquidoCentavos)}</strong>
          </div>
        </section>

        {relatorio.simulacoes.length > 0 && (
          <section className="print-evidence">
            <strong>Rateio fiscal consolidado</strong>
            {relatorio.simulacoes.map((simulacao) => (
              <p key={simulacao.simulacaoId}>
                Simulação {simulacao.simulacaoId} · SHA-256{" "}
                {simulacao.hashResultado}
              </p>
            ))}
          </section>
        )}

        <table className="print-table">
          <thead>
            <tr>
              <th>Prestador</th>
              <th>Proventos</th>
              <th>INSS</th>
              <th>IRRF</th>
              <th>Descontos</th>
              <th>Líquido</th>
            </tr>
          </thead>
          <tbody>
            {relatorio.itens.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.nome}</strong>
                  <small>
                    {item.tipoPessoa === "FISICA" ? "PF" : "PJ"} · matrícula {item.matricula} · {item.atividade}
                  </small>
                </td>
                <td>{moeda(item.totalProventos)}</td>
                <td>{moeda(item.valorInss)}</td>
                <td>{moeda(item.valorIrrf)}</td>
                <td>{moeda(item.totalDescontos)}</td>
                <td>
                  <strong>{moeda(item.totalLiquido)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="print-section-title">Resumo por rubrica</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Código / rubrica</th>
              <th>Natureza</th>
              <th>Incidências</th>
              <th>Qtd.</th>
              <th>Base</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {relatorio.rubricas.map((rubrica) => (
              <tr
                key={[
                  rubrica.codigo,
                  rubrica.descricao,
                  rubrica.natureza,
                  rubrica.origem,
                  rubrica.incideInss,
                  rubrica.incideIrrf,
                ].join(":")}
              >
                <td>
                  <strong>{rubrica.codigo}</strong>
                  <small>{rubrica.descricao}</small>
                </td>
                <td>
                  {rubrica.natureza}
                  <small>{rubrica.origem}</small>
                </td>
                <td>
                  INSS {rubrica.incideInss ? "sim" : "não"} · IRRF{" "}
                  {rubrica.incideIrrf ? "sim" : "não"}
                </td>
                <td>{rubrica.quantidade}</td>
                <td>
                  {rubrica.baseCalculoCentavos
                    ? moedaCentavos(rubrica.baseCalculoCentavos)
                    : "—"}
                </td>
                <td>{moedaCentavos(rubrica.valorCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="print-integrity">
          <p>
            <strong>Hash da Folha:</strong> {folha.hash_resultado}
          </p>
          <p>
            <strong>Conferência do RH:</strong>{" "}
            {conferencia
              ? `${conferencia.conferente} · ${dataHora(conferencia.criado_em)}`
              : "Não registrada para este hash"}
          </p>
        </section>

        <div className="signature-grid">
          <div>Responsável pela elaboração</div>
          <div>Conferência do RH</div>
          <div>Aprovação administrativa</div>
        </div>
      </article>

      {relatorio.itens.map((item) => (
        <article className="print-sheet print-person-sheet" key={item.id}>
          <header className="print-header compact">
            <div>
              <span>Demonstrativo individual da Folha</span>
              <h2>{item.nome}</h2>
              <p>
                {item.tipoPessoa === "FISICA" ? "Pessoa física" : "Pessoa jurídica"} · {formatarCpfCnpj(item.documento)} · matrícula {item.matricula}
                {item.tipoPessoa === "FISICA" && ` · NIT/PIS/PASEP ${item.nitPisPasep ?? "não informado"}`}
              </p>
            </div>
            <div className="print-document-code">
              <strong>Competência {competencia(folha.competencia)}</strong>
              <span>
                Lote {folha.numero} · revisão {folha.revisao}
              </span>
            </div>
          </header>

          <p className="print-activity">
            <strong>Atividade:</strong> {item.atividade}
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Rubrica</th>
                <th>Natureza</th>
                <th>Referência/base</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {item.linhas.map((linha, indice) => (
                <tr key={`${linha.codigo}:${linha.ordem}:${indice}`}>
                  <td>{linha.codigo}</td>
                  <td>
                    <strong>{linha.descricao}</strong>
                    <small>{linha.origem}</small>
                  </td>
                  <td>{linha.natureza}</td>
                  <td>
                    {linha.referencia ?? "—"}
                    <small>Base {moeda(linha.baseCalculo)}</small>
                  </td>
                  <td>{moeda(linha.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <section className="print-totals individual">
            <div>
              <span>Base INSS</span>
              <strong>{moeda(item.baseInss)}</strong>
            </div>
            <div>
              <span>INSS</span>
              <strong>{moeda(item.valorInss)}</strong>
            </div>
            <div>
              <span>Base IRRF</span>
              <strong>{moeda(item.baseIrrf)}</strong>
            </div>
            <div>
              <span>IRRF</span>
              <strong>{moeda(item.valorIrrf)}</strong>
            </div>
            <div>
              <span>Proventos</span>
              <strong>{moeda(item.totalProventos)}</strong>
            </div>
            <div>
              <span>Descontos</span>
              <strong>{moeda(item.totalDescontos)}</strong>
            </div>
            <div>
              <span>Líquido</span>
              <strong>{moeda(item.totalLiquido)}</strong>
            </div>
          </section>
          {item.simulacaoId && (
            <p className="print-footnote">
              Tributos rateados pela simulação homologada {item.simulacaoId},
              hash {item.hashSimulacao}.
            </p>
          )}
          <div className="signature-grid two">
            <div>Responsável pela conferência</div>
            <div>Ciência do prestador</div>
          </div>
          <p className="print-footnote">
            Demonstrativo interno da memória de cálculo. A natureza jurídica do
            pagamento e os documentos fiscais aplicáveis devem seguir o contrato e
            a orientação contábil da entidade.
          </p>
        </article>
      ))}
    </main>
  );
}
