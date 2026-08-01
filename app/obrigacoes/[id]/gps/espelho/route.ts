import { createHash } from "node:crypto";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarEspelhoObrigacao } from "@/db/obrigacoes";
import { gerarCsvMemoriasGps } from "@/lib/exportacao-memoria-gps";
import { montarMemoriasGpsIndividuais } from "@/lib/memoria-gps";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const empresa = await resolverEmpresaAtiva();
    const dados = await carregarEspelhoObrigacao(empresa.id, id);
    const memorias = montarMemoriasGpsIndividuais({
      instrumento: dados.obrigacao.perfil_instrumento,
      codigoReceita: dados.obrigacao.perfil_codigo_receita,
      competencia: dados.obrigacao.competencia,
      itens: dados.itens,
    });
    const csv = gerarCsvMemoriasGps(memorias);
    const hash = createHash("sha256").update(csv, "utf8").digest("hex");
    const competencia = dados.obrigacao.competencia.slice(0, 7);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="memorias-gps-${competencia}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Content-SHA256": hash,
      },
    });
  } catch (error) {
    return Response.json(
      { erro: error instanceof Error ? error.message : "Exportação GPS indisponível." },
      { status: 404 },
    );
  }
}
