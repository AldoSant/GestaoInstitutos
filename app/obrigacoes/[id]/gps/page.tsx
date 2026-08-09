import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarEspelhoObrigacao } from "@/db/obrigacoes";
import { montarMemoriasGpsIndividuais } from "@/lib/memoria-gps";

export const dynamic = "force-dynamic";

function moeda(centavos: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function competencia(valor: string) {
  return valor.slice(0, 7).split("-").reverse().join("/");
}

function formatarCnpj(valor: string) {
  return valor.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5",
  );
}

export default async function MemoriasGpsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let conteudo:
    | {
        empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
        dados: Awaited<ReturnType<typeof carregarEspelhoObrigacao>>;
        memorias: ReturnType<typeof montarMemoriasGpsIndividuais>;
        total: number;
      }
    | undefined;
  let erro = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const dados = await carregarEspelhoObrigacao(empresa.id, id);
    const memorias = montarMemoriasGpsIndividuais({
      instrumento: dados.obrigacao.perfil_instrumento,
      codigoReceita: dados.obrigacao.perfil_codigo_receita,
      competencia: dados.obrigacao.competencia,
      itens: dados.itens,
    });
    const total = memorias.reduce(
      (acumulado, item) => acumulado + item.valorCentavos,
      0,
    );
    conteudo = { empresa, dados, memorias, total };
  } catch (error) {
    erro =
      error instanceof Error
        ? error.message
        : "Não foi possível preparar as memórias.";
  }
  if (!conteudo) {
    return (
      <main className="print-document">
        <article className="print-sheet">
          <section className="print-warning">
            <strong>Memórias GPS indisponíveis</strong>
            <p>{erro}</p>
          </section>
          <Link className="button secondary" href="/obrigacoes">
            Voltar às obrigações
          </Link>
        </article>
      </main>
    );
  }
  const { empresa, dados, memorias, total } = conteudo;
  return (
    <main className="print-document">
      <nav className="print-toolbar" aria-label="Ações das memórias GPS">
        <Link className="button secondary" href="/obrigacoes">
          <ArrowLeft size={16} /> Voltar às obrigações
        </Link>
        <Link className="button secondary" href={`/obrigacoes/${id}/gps/espelho`}>
          Baixar CSV
        </Link>
        <PrintButton label="Imprimir memórias GPS" />
      </nav>
      <article className="print-sheet">
        <header className="print-header">
          <div>
            <span>Guias da Previdência Social (GPS)</span>
            <h1>{empresa.razaoSocial}</h1>
            <p>CNPJ {formatarCnpj(empresa.cnpj)}</p>
          </div>
          <div className="print-document-code">
            <strong>Competência {competencia(dados.obrigacao.competencia)}</strong>
            <span>GPS · código {dados.obrigacao.perfil_codigo_receita}</span>
            <span>{memorias.length} prestador(es) · {moeda(total)}</span>
          </div>
        </header>
        <section className="print-warning">
          <strong>GPS individual com linha digitável para o fluxo legado.</strong>
          <p>
            Confira os dados antes do pagamento. A autenticação bancária será
            registrada depois da quitação no canal bancário.
          </p>
        </section>
        {memorias.map((item, indice) => (
          <section
            className="print-sheet"
            key={item.itemId}
            style={{ marginTop: indice === 0 ? 0 : 24 }}
          >
            <header className="print-header">
              <div>
                <span>Memória GPS {String(indice + 1).padStart(2, "0")}</span>
                <h2>{item.nome}</h2>
                <p>Identificador NIT/PIS/PASEP: {item.identificador}</p>
              </div>
              <div className="print-document-code">
                <strong>{moeda(item.valorCentavos)}</strong>
                <span>Código {item.codigoReceita}</span>
                <span>Competência {competencia(item.competencia)}</span>
              </div>
            </header>
            <dl className="print-meta">
              <div><dt>Principal INSS</dt><dd>{moeda(item.valorCentavos)}</dd></div>
              <div><dt>Juros e multa</dt><dd>R$ 0,00</dd></div>
              <div><dt>Total para conferência</dt><dd>{moeda(item.valorCentavos)}</dd></div>
              <div><dt>Vencimento nominal</dt><dd>{item.vencimento.split("-").reverse().join("/")}</dd></div>
            </dl>
            <p className="gps-digitavel"><strong>Linha digitável</strong><br />{item.linhaDigitavel}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
