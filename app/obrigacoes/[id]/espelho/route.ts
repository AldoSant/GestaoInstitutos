import { createHash } from "node:crypto";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarEspelhoObrigacao } from "@/db/obrigacoes";
import { gerarCsvEspelhoObrigacao } from "@/lib/exportacao-obrigacao";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const empresa = await resolverEmpresaAtiva();
    const dados = await carregarEspelhoObrigacao(empresa.id, id);
    const csv = gerarCsvEspelhoObrigacao(dados);
    const hash = createHash("sha256").update(csv, "utf8").digest("hex");
    const competencia = dados.obrigacao.competencia.slice(0, 7);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="espelho-previdenciario-${competencia}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Content-SHA256": hash,
      },
    });
  } catch (error) {
    return Response.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Espelho previdenciário indisponível.",
      },
      { status: 404 },
    );
  }
}
