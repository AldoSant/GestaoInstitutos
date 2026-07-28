import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";
import { gerarCsvConferenciaFolha } from "@/lib/exportacao-folha";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ competencia: string }> },
) {
  try {
    const { competencia: folhaId } = await params;
    const empresa = await resolverEmpresaAtiva();
    const dados = await carregarFolha(empresa.id, folhaId);
    const csv = gerarCsvConferenciaFolha(dados);
    const nome =
      `conferencia-folha-${dados.folha.competencia.slice(0, 7)}` +
      `-lote-${dados.folha.numero}-revisao-${dados.folha.revisao}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Relatório de conferência indisponível.",
      },
      { status: 404 },
    );
  }
}
