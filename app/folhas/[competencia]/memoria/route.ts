import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ competencia: string }> },
) {
  try {
    const { competencia: folhaId } = await params;
    const empresa = await resolverEmpresaAtiva();
    const dados = await carregarFolha(empresa.id, folhaId);
    if (!dados.folha.hash_resultado) {
      return Response.json(
        { erro: "A Folha ainda não possui memória processada." },
        { status: 409 },
      );
    }
    const corpo = {
      formato: "GESTAO_INSTITUTOS_MEMORIA_FOLHA",
      versao: 1,
      exportadaEm: new Date().toISOString(),
      empresa: { id: empresa.id, razaoSocial: empresa.razaoSocial },
      ...dados,
    };
    const nome = `memoria-folha-${dados.folha.competencia.slice(0, 7)}-lote-${dados.folha.numero}.json`;
    return new Response(JSON.stringify(corpo, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { erro: error instanceof Error ? error.message : "Memória indisponível." },
      { status: 404 },
    );
  }
}
