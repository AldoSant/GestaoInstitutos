import { NextResponse } from "next/server";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";
import {
  extrairItemRelacaoPagamento,
  gerarRelacaoPagamentosCsv,
} from "@/lib/relacao-pagamentos";

export const dynamic = "force-dynamic";

function nomeSeguro(valor: string) {
  return valor.replace(/[^0-9A-Za-z._-]+/g, "-");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ competencia: string }> },
) {
  try {
    const { competencia: folhaId } = await params;
    const empresa = await resolverEmpresaAtiva();
    const dados = await carregarFolha(empresa.id, folhaId);
    if (!dados.folha.hash_resultado || dados.itens.length === 0) {
      return NextResponse.json(
        { erro: "A Folha ainda não possui resultado processado." },
        { status: 409 },
      );
    }
    const folha = dados.folha;
    const arquivo = gerarRelacaoPagamentosCsv({
      empresa: empresa.razaoSocial,
      competencia: folha.competencia.slice(0, 7),
      folhaNumero: folha.numero,
      revisao: folha.revisao,
      folhaStatus: folha.status,
      hashFolha: folha.hash_resultado,
      itens: dados.itens.map(extrairItemRelacaoPagamento),
    });
    const nome = nomeSeguro(
      `relacao-pagamentos-${folha.competencia.slice(0, 7)}-lote-${folha.numero}-r${folha.revisao}.csv`,
    );
    return new NextResponse(arquivo.conteudo, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, no-store",
        "X-Content-SHA256": arquivo.hashSha256,
        "X-Liberacao-Financeira": arquivo.liberada
          ? "LIBERADA"
          : "BLOQUEADA",
      },
    });
  } catch {
    return NextResponse.json(
      { erro: "Folha não encontrada." },
      { status: 404 },
    );
  }
}
