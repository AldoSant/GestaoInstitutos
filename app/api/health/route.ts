import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "gestao-institutos",
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
