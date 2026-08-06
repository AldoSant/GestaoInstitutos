import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";
import { caminhoAplicacao } from "@/lib/base-path";
import {
  extrairItemRelacaoPagamento,
  montarRelacaoPagamentos,
} from "@/lib/relacao-pagamentos";

export const dynamic = "force-dynamic";

function moedaCentavos(centavos: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function competencia(valor: string) {
  const [ano, mes] = valor.slice(0, 7).split("-");
  return `${mes}/${ano}`;
}

function documento(valor: string | null) {
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

function contaFormatada(
  conta: ReturnType<typeof montarRelacaoPagamentos>["linhas"][number]["conta"],
) {
  if (!conta) return "Não cadastrada";
  const numero = [conta.numero, conta.digito].filter(Boolean).join("-");
  return numero || "Número não informado";
}

const nomesPendencias: Record<string, string> = {
  CONTA_NAO_CADASTRADA: "Conta não cadastrada",
  AGENCIA_NAO_INFORMADA: "Agência não informada",
  CONTA_NAO_INFORMADA: "Número da conta não informado",
  TIPO_NAO_INFORMADO: "Tipo de conta não informado",
};

export default async function RelacaoPagamentosPage({
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
  const folha = dados.folha;
  const relacao = montarRelacaoPagamentos(
    dados.itens.map(extrairItemRelacaoPagamento),
  );
  const folhaFechada = folha.status === "FECHADA";
  const liberada = folhaFechada && relacao.pronta;

  return (
    <main className="print-document">
      <nav className="print-toolbar" aria-label="Ações da relação">
        <Link className="button secondary" href={caminhoAplicacao(`/folhas/${folha.id}`)}>
          <ArrowLeft size={16} /> Voltar à Folha
        </Link>
        <div className="row-actions">
          <a
            className="button secondary"
            href={caminhoAplicacao(`/folhas/${folha.id}/pagamentos/espelho`)}
          >
            <Download size={16} /> Baixar espelho CSV
          </a>
          <PrintButton />
        </div>
      </nav>

      <article className="print-sheet">
        <header className="print-header">
          <div>
            <span>Relação interna de pagamentos</span>
            <h1>{empresa.razaoSocial}</h1>
            <p>CNPJ {documento(empresa.cnpj)}</p>
          </div>
          <div className="print-document-code">
            <span>Folha</span>
            <strong>
              {competencia(folha.competencia)} · lote {folha.numero} · revisão{" "}
              {folha.revisao}
            </strong>
            <span>Liberação financeira</span>
            <strong>{liberada ? "LIBERADA" : "BLOQUEADA"}</strong>
          </div>
        </header>

        <dl className="print-meta">
          <div>
            <dt>Status da Folha</dt>
            <dd>{folha.status}</dd>
          </div>
          <div>
            <dt>Contas aptas</dt>
            <dd>
              {relacao.aptos} de {relacao.linhas.length}
            </dd>
          </div>
          <div>
            <dt>Prestadores pendentes</dt>
            <dd>{relacao.pendentes}</dd>
          </div>
          <div>
            <dt>Total líquido</dt>
            <dd>{moedaCentavos(relacao.totalLiquidoCentavos)}</dd>
          </div>
        </dl>

        {!liberada && (
          <section className="print-warning">
            <strong>Pagamento bloqueado</strong>
            <p>
              {!folhaFechada
                ? "A Folha ainda não está fechada. "
                : ""}
              {relacao.pendentes > 0
                ? `${relacao.pendentes} prestador(es) possuem dados bancários ausentes ou incompletos. `
                : ""}
              Este documento serve para saneamento e conferência, não para
              autorizar movimentação financeira.
            </p>
          </section>
        )}

        {relacao.reprocessamentoNecessario && (
          <section className="print-warning">
            <strong>Guia ou retenção encontrada na relação de pagamentos</strong>
            <p>
              {relacao.itensForaPagamento.length} item(ns) foram classificados como
              guia/recolhimento e não podem ser tratados como prestador bancário.
              Esta revisão precisa ser reprocessada antes de liberar pagamentos.
            </p>
          </section>
        )}

        {liberada && (
          <section className="print-evidence">
            <strong>Relação apta à autorização financeira</strong>
            <p>
              A Folha está fechada e todas as contas congeladas no processamento
              possuem agência, número e tipo válidos. A autorização e a execução
              bancária continuam sob responsabilidade dos signatários.
            </p>
          </section>
        )}

        <table className="print-table">
          <thead>
            <tr>
              <th>Prestador</th>
              <th>Matrícula / atividade</th>
              <th>Agência</th>
              <th>Conta</th>
              <th>Tipo</th>
              <th>Situação</th>
              <th>Líquido</th>
            </tr>
          </thead>
          <tbody>
            {relacao.linhas.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.nome}</strong>
                  <small>{documento(item.documento)}</small>
                </td>
                <td>
                  {item.matricula}
                  <small>{item.atividade}</small>
                </td>
                <td>
                  {item.conta?.agencia || "—"}
                  {item.conta?.agenciaLegacyId && (
                    <small>Legado: {item.conta.agenciaLegacyId}</small>
                  )}
                </td>
                <td>{contaFormatada(item.conta)}</td>
                <td>{item.conta?.tipo || "—"}</td>
                <td>
                  <strong>{item.apto ? "APTO" : "PENDENTE"}</strong>
                  {item.pendencias.map((pendencia) => (
                    <small key={pendencia}>
                      {nomesPendencias[pendencia] ?? pendencia}
                    </small>
                  ))}
                </td>
                <td>{moedaCentavos(item.liquidoCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="print-integrity">
          <p>
            <strong>Folha ID:</strong> {folha.id}
          </p>
          <p>
            <strong>Hash SHA-256 da Folha:</strong> {folha.hash_resultado}
          </p>
          <p>
            Os dados bancários exibidos são o snapshot congelado na revisão
            processada. Alterações cadastrais posteriores exigem reprocessamento e
            nova conferência do RH.
          </p>
        </section>

        <div className="signature-grid">
          <div>Conferência do RH</div>
          <div>Conferência financeira</div>
          <div>Autorização de pagamento</div>
        </div>

        <p className="print-footnote">
          Documento operacional interno. Não é ordem bancária, comprovante de
          transferência ou arquivo CNAB. O CSV correspondente preserva o hash da
          Folha e possui hash próprio no cabeçalho HTTP de download.
        </p>
      </article>
    </main>
  );
}
