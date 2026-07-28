import { createHash } from "node:crypto";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  diagnosticarHomologacaoCompetencia,
  listarHomologacoesCompetencia,
} from "@/db/homologacoes-competencia";
import { gerarCsvHomologacaoCompetencia } from "@/lib/exportacao-homologacao-competencia";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const competencia =
      new URL(request.url).searchParams.get("competencia") ?? "";
    const empresa = await resolverEmpresaAtiva();
    const [diagnostico, versoes] = await Promise.all([
      diagnosticarHomologacaoCompetencia(empresa.id, competencia),
      listarHomologacoesCompetencia(empresa.id, competencia),
    ]);
    const atual = versoes.find(
      (versao) =>
        versao.hash_fontes === diagnostico.hashFontes &&
        versao.status !== "INVALIDADA",
    );
    if (!atual) {
      throw new Error(
        "Congele os controles atuais antes de exportar o dossiê.",
      );
    }
    const csv = gerarCsvHomologacaoCompetencia(atual);
    const hash = createHash("sha256").update(csv, "utf8").digest("hex");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="dossie-homologacao-${competencia}-v${atual.versao}.csv"`,
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
            : "Dossiê mensal indisponível.",
      },
      { status: 400 },
    );
  }
}
