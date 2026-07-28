import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarMigracaoHistorica } from "@/db/migracoes-historicas";
import { gerarDossieMigracaoCsv } from "@/lib/exportacao-migracao-historica";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const competencia =
    new URL(request.url).searchParams.get("competencia") ??
    new Date().toISOString().slice(0, 7);
  try {
    const empresa = await resolverEmpresaAtiva();
    const dados = await carregarMigracaoHistorica(empresa.id, competencia);
    const csv = gerarDossieMigracaoCsv(
      competencia,
      empresa.nomeFantasia ?? empresa.razaoSocial,
      dados,
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="migracao-giw-${competencia}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o dossiê.",
      },
      { status: 400 },
    );
  }
}
