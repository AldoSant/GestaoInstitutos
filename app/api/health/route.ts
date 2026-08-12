import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = {
    service: "gestao-institutos",
    version: process.env.npm_package_version ?? "0.1.0",
    revision: process.env.APP_COMMIT_SHA ?? "unknown",
  };

  try {
    await getDb().execute(sql`select 1`);
    const schema = await getDb().execute(sql`
      select count(*)::int as total
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'contribuicao_outra_fonte'
         and column_name in ('inss_dedutivel_irrf', 'irrf_retido')
    `);
    const total = Number(schema.rows[0]?.total ?? 0);
    if (total !== 2) {
      throw new Error("Schema incompatível com a revisão em execução.");
    }
    return NextResponse.json({
      status: "ok",
      database: "ok",
      schema: "ok",
      ...base,
    });
  } catch {
    return NextResponse.json(
      { status: "indisponivel", database: "erro", schema: "incompativel", ...base },
      { status: 503 },
    );
  }
}
