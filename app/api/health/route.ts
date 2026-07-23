import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = {
    service: "gestao-institutos",
    version: process.env.npm_package_version ?? "0.1.0",
  };

  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "ok", ...base });
  } catch {
    return NextResponse.json(
      { status: "indisponivel", database: "erro", ...base },
      { status: 503 },
    );
  }
}
