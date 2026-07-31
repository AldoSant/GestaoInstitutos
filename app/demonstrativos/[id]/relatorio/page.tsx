import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarRelatorioDemonstrativo } from "@/db/demonstrativos";
import {
  montarResumoRelatorioDemonstrativo,
  nomeBeneficiarioSnapshot,
} from "@/lib/relatorio-demonstrativo";

export const dynamic = "force-dynamic";

function moeda(valor: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor ?? 0));
}

function competencia(valor: unknown) {
  const texto = String(valor ?? "").slice(0, 7);
  const [ano, mes] = texto.split("-");
  return mes && ano ? `${mes}/${ano}` : "—";
}

function dataHora(valor: unknown) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(String(valor)));
}

function formatarCnpj(valor: string) {
  return valor.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5",
  );
}

function texto(valor: unknown, padrao = "—") {
  return valor === null || valor === undefined || valor === ""
    ? padrao
    : String(valor);
}

export default async function RelatorioDemonstrativoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revisao?: string | string[] }>;
}) {
  const { id } = await params;
  const consulta = await searchParams;
  const revisaoTexto = Array.isArray(consulta.revisao)
    ? consulta.revisao[0]
    : consulta.revisao;
  const revisao = revisaoTexto ? Number(revisaoTexto) : undefined;
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarRelatorioDemonstrativo>>;
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarRelatorioDemonstrativo({
      empresaId: empresa.id,
      demonstrativoId: id,
      revisao,
    });
  } catch {
    notFound();
  }
  const resumo = montarResumoRelatorioDemonstrativo(dados.conteudo);
  const cabecalho = resumo.demonstrativo;
  const conferencia = dados.conferencia as Record<string, unknown> | null;
  const fechado = dados.demonstrativo.status === "FECHADO";

  return (
    <main className="print-document">
      <nav className="print-toolbar" aria-label="Ações do dossiê">
        <Link
          className="button secondary"
          href={`/demonstrativos?competencia=${String(cabecalho.competencia).slice(0, 7)}`}
        >
          <ArrowLeft size={16} /> Voltar ao demonstrativo
        </Link>
        <PrintButton label="Imprimir ou salvar PDF" />
      </nav>

      <article className="print-sheet">
        <header className="print-header">
          <div>
            <span>Dossiê interno de pagamentos, retenções e guias</span>
            <h1>{empresa.razaoSocial}</h1>
            <p>CNPJ {formatarCnpj(empresa.cnpj)}</p>
          </div>
          <div className="print-document-code">
            <strong>Competência {competencia(cabecalho.competencia)}</strong>
            <span>
              Demonstrativo {texto(cabecalho.numero)} · revisão{" "}
              {dados.demonstrativo.revisao}
            </span>
            <span>Status: {dados.demonstrativo.status}</span>
          </div>
        </header>

        <section className={`print-warning${fechado ? " subtle" : ""}`}>
          <strong>
            {fechado
              ? "Dossiê do fechamento financeiro interno."
              : "Prévia ainda não fechada."}
          </strong>
          <p>
            Guias oficiais continuam sendo os documentos emitidos no ambiente
            governamental competente. Este dossiê consolida pagamentos, retenções,
            obrigações e evidências registradas no sistema.
          </p>
        </section>

        <dl className="print-meta">
          <div>
            <dt>Fechamento</dt>
            <dd>{dataHora(dados.demonstrativo.fechado_em)}</dd>
          </div>
          <div>
            <dt>Responsável</dt>
            <dd>{texto(dados.demonstrativo.fechado_por, "Pendente")}</dd>
          </div>
          <div>
            <dt>Conferência</dt>
            <dd>
              {conferencia
                ? `${texto(conferencia.resultado)} · ${texto(conferencia.conferente)}`
                : "Pendente"}
            </dd>
          </div>
          <div>
            <dt>Integridade</dt>
            <dd>{dados.integridadeValida ? "SHA-256 confirmado" : "DIVERGENTE"}</dd>
          </div>
        </dl>

        <section className="print-totals">
          <div>
            <span>Pagamentos</span>
            <strong>{resumo.pagamentos.length}</strong>
          </div>
          <div>
            <span>Pessoas físicas</span>
            <strong>{resumo.quantidadePf}</strong>
          </div>
          <div>
            <span>Pessoas jurídicas</span>
            <strong>{resumo.quantidadePj}</strong>
          </div>
          <div>
            <span>Valor bruto</span>
            <strong>{moeda(cabecalho.total_bruto)}</strong>
          </div>
          <div>
            <span>Retenções</span>
            <strong>{moeda(cabecalho.total_retencoes)}</strong>
          </div>
          <div>
            <span>Valor líquido</span>
            <strong>{moeda(cabecalho.total_liquido)}</strong>
          </div>
        </section>

        <h2 className="print-section-title">Pagamentos a prestadores</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Beneficiário</th>
              <th>Natureza / origem</th>
              <th>Documento</th>
              <th>Bruto</th>
              <th>Retenções</th>
              <th>Líquido</th>
            </tr>
          </thead>
          <tbody>
            {resumo.pagamentos.map((pagamento, indice) => {
              const beneficiario = nomeBeneficiarioSnapshot(pagamento);
              return (
                <tr key={`${texto(pagamento.folha_item_id)}:${texto(pagamento.prestador_id)}:${indice}`}>
                  <td>
                    <strong>{beneficiario.nome}</strong>
                    <small>
                      {beneficiario.matricula
                        ? `Matrícula ${beneficiario.matricula}`
                        : texto(pagamento.tipo_pessoa)}
                    </small>
                  </td>
                  <td>
                    PAGAMENTO_PRESTADOR
                    <small>{texto(pagamento.origem)}</small>
                  </td>
                  <td>{texto(pagamento.documento_referencia)}</td>
                  <td>{moeda(pagamento.valor_bruto)}</td>
                  <td>{moeda(pagamento.total_retencoes)}</td>
                  <td><strong>{moeda(pagamento.valor_liquido)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2 className="print-section-title">Retenções vinculadas</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Pagamento / documento</th>
              <th>Tributo</th>
              <th>Base</th>
              <th>Alíquota</th>
              <th>Valor</th>
              <th>Evidência</th>
            </tr>
          </thead>
          <tbody>
            {resumo.retencoes.map((retencao, indice) => (
              <tr key={`${texto(retencao.documento_referencia)}:${texto(retencao.tributo)}:${indice}`}>
                <td>
                  {texto(retencao.documento_referencia)}
                  <small>{texto(retencao.pagamento_origem)}</small>
                </td>
                <td>{texto(retencao.tributo)}</td>
                <td>{moeda(retencao.base_calculo)}</td>
                <td>
                  {retencao.aliquota === null
                    ? "—"
                    : `${Number(retencao.aliquota).toLocaleString("pt-BR")}%`}
                </td>
                <td>{moeda(retencao.valor)}</td>
                <td className="wrap-cell">
                  {texto(retencao.evidencia_referencia)}
                  <small>{texto(retencao.evidencia_hash, "Sem hash próprio")}</small>
                </td>
              </tr>
            ))}
            {resumo.retencoes.length === 0 && (
              <tr><td colSpan={6}>Nenhuma retenção vinculada.</td></tr>
            )}
          </tbody>
        </table>

        <h2 className="print-section-title">Obrigações e guias</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Principal</th>
              <th>Juros</th>
              <th>Multa</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {resumo.obrigacoes.map((obrigacao) => (
              <tr key={texto(obrigacao.id)}>
                <td>{texto(obrigacao.tipo)}</td>
                <td>{texto(obrigacao.status)}</td>
                <td>{moeda(obrigacao.principal)}</td>
                <td>{moeda(obrigacao.juros)}</td>
                <td>{moeda(obrigacao.multa)}</td>
                <td><strong>{moeda(obrigacao.total)}</strong></td>
              </tr>
            ))}
            {resumo.obrigacoes.length === 0 && (
              <tr><td colSpan={6}>Nenhuma obrigação vinculada.</td></tr>
            )}
          </tbody>
        </table>

        <h2 className="print-section-title">Documentos das obrigações</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Obrigação</th>
              <th>Documento</th>
              <th>Referência</th>
              <th>Emissão</th>
              <th>Valor</th>
              <th>Verificação / hash</th>
            </tr>
          </thead>
          <tbody>
            {resumo.documentos.map((documento, indice) => (
              <tr key={`${texto(documento.obrigacao_id)}:${texto(documento.tipo)}:${indice}`}>
                <td>{texto(documento.obrigacao_tipo)}</td>
                <td>{texto(documento.tipo)}</td>
                <td>{texto(documento.referencia)}</td>
                <td>{dataHora(documento.emitido_em)}</td>
                <td>{moeda(documento.valor_total)}</td>
                <td className="wrap-cell">
                  {documento.verificado ? "Verificado" : "Pendente"}
                  <small>{texto(documento.hash_sha256, "Hash não informado")}</small>
                </td>
              </tr>
            ))}
            {resumo.documentos.length === 0 && (
              <tr><td colSpan={6}>Nenhum documento registrado.</td></tr>
            )}
          </tbody>
        </table>

        {dados.revisoes.length > 0 && (
          <>
            <h2 className="print-section-title">Histórico de revisões</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Revisão</th>
                  <th>Responsável</th>
                  <th>Data</th>
                  <th>Motivo</th>
                  <th>Hash preservado</th>
                </tr>
              </thead>
              <tbody>
                {dados.revisoes.map((item) => (
                  <tr key={item.revisao_origem}>
                    <td>
                      <Link
                        href={`/demonstrativos/${id}/relatorio?revisao=${item.revisao_origem}`}
                      >
                        v{item.revisao_origem} → v{item.revisao_destino}
                      </Link>
                    </td>
                    <td>{item.responsavel}</td>
                    <td>{dataHora(item.criado_em)}</td>
                    <td className="wrap-cell">{item.motivo}</td>
                    <td className="wrap-cell"><small>{item.hash_resultado}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {dados.historico && (
          <section className="print-evidence">
            <strong>Origem desta revisão histórica</strong>
            <p>
              Preservada por {dados.historico.responsavel} em{" "}
              {dataHora(dados.historico.criadoEm)} para abertura da revisão{" "}
              {dados.historico.revisaoDestino}.
            </p>
            <p>{dados.historico.motivo}</p>
          </section>
        )}

        <section className="print-integrity">
          <p>
            <strong>Hash armazenado:</strong>{" "}
            {texto(dados.demonstrativo.hash_resultado, "Ainda não fechado")}
          </p>
          <p>
            <strong>Hash calculado:</strong> {dados.hashCalculado}
          </p>
          <p>
            <strong>Verificação:</strong>{" "}
            {dados.integridadeValida
              ? "conteúdo íntegro"
              : "DIVERGÊNCIA — não utilizar este documento"}
          </p>
          <p>
            <strong>Conferência:</strong>{" "}
            {conferencia
              ? `${texto(conferencia.conferente)} · ${dataHora(conferencia.criado_em)}`
              : "não registrada"}
          </p>
        </section>

        <div className="signature-grid">
          <div>Elaboração</div>
          <div>Conferência do RH / contabilidade</div>
          <div>Aprovação administrativa</div>
        </div>
      </article>
    </main>
  );
}
