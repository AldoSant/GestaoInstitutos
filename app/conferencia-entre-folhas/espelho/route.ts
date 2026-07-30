import { createHash } from "node:crypto";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  diagnosticarConsolidacaoMensal,
  listarCasosConsolidacao,
} from "@/db/consolidacoes";
import { gerarCsvDiagnosticoConsolidacao } from "@/lib/exportacao-consolidacao";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const competencia = new URL(request.url).searchParams.get("competencia") ?? "";
    const empresa = await resolverEmpresaAtiva();
    const [diagnostico, casos] = await Promise.all([
      diagnosticarConsolidacaoMensal(empresa.id, competencia),
      listarCasosConsolidacao(empresa.id, competencia),
    ]);
    const csv = gerarCsvDiagnosticoConsolidacao(diagnostico, casos);
    const hash = createHash("sha256").update(csv, "utf8").digest("hex");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="conferencia-entre-folhas-${competencia}.csv"`,
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
            : "Diagnóstico de consolidação indisponível.",
      },
      { status: 400 },
    );
  }
}
