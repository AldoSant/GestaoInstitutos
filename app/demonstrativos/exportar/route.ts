import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarDemonstrativo } from "@/db/demonstrativos";
import { primeiraCompetencia } from "@/lib/competencia";
import { exportarDemonstrativoCsv } from "@/lib/exportacao-demonstrativo";

export async function GET(request: Request) {
  const competencia = primeiraCompetencia(
    new URL(request.url).searchParams.get("competencia") ?? undefined,
  );
  if (!competencia) {
    return new Response("Competência inválida.", { status: 400 });
  }
  const empresa = await resolverEmpresaAtiva();
  const dados = await carregarDemonstrativo(empresa.id, competencia);
  if (!dados.demonstrativo) {
    return new Response("Demonstrativo não encontrado.", { status: 404 });
  }
  const csv = exportarDemonstrativoCsv({
    competencia: dados.demonstrativo.competencia,
    numero: dados.demonstrativo.numero,
    revisao: dados.demonstrativo.revisao,
    status: dados.demonstrativo.status,
    hash: dados.demonstrativo.hash_resultado,
    pagamentos: dados.pagamentos,
    guias: dados.guias,
  });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="demonstrativo-${competencia}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
