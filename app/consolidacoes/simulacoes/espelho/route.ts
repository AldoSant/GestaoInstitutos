import { createHash } from "node:crypto";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarSimulacoesConsolidacaoFiscal } from "@/db/simulacoes-consolidacao";
import { gerarCsvSimulacoesConsolidacao } from "@/lib/exportacao-simulacao-consolidacao";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const competencia =
      new URL(request.url).searchParams.get("competencia") ?? "";
    const empresa = await resolverEmpresaAtiva();
    const simulacoes = await listarSimulacoesConsolidacaoFiscal(
      empresa.id,
      competencia,
    );
    const csv = gerarCsvSimulacoesConsolidacao(simulacoes);
    const hash = createHash("sha256").update(csv, "utf8").digest("hex");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="simulacoes-fiscais-${competencia}.csv"`,
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
            : "Espelho de simulações indisponível.",
      },
      { status: 400 },
    );
  }
}
