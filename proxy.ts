import { NextRequest, NextResponse } from "next/server";
import { basePathAplicacao, caminhoAplicacao } from "@/lib/base-path";
import { COOKIE_SESSAO, lerTokenSessao } from "@/lib/sessao";

export function proxy(request: NextRequest) {
  const sessao = lerTokenSessao(request.cookies.get(COOKIE_SESSAO)?.value);
  const basePath = request.nextUrl.basePath || basePathAplicacao();
  const loginPath = caminhoAplicacao("/login", basePath);
  const homePath = caminhoAplicacao("/", basePath);
  const pathnameLogin = request.nextUrl.basePath ? "/login" : loginPath;
  const pathnameHome = request.nextUrl.basePath ? "/" : homePath;
  const login =
    request.nextUrl.pathname === pathnameLogin ||
    request.nextUrl.pathname === loginPath;

  if (!sessao && !login) {
    if (!request.headers.get("accept")?.includes("text/html")) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    const destino = request.nextUrl.clone();
    destino.pathname = pathnameLogin;
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  if (sessao && login) {
    const destino = request.nextUrl.clone();
    destino.pathname = pathnameHome;
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!api/health(?:/|$)|_next/static|_next/image|favicon\\.svg$).*)"],
};
