import { MODELO_CSV_HOMOLOGACAO } from "@/lib/homologacao-folha";

export async function GET() {
  return new Response(MODELO_CSV_HOMOLOGACAO, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="modelo-conferencia-folha.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
