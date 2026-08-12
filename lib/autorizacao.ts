import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO, lerTokenSessao } from "@/lib/sessao";
import { rotaAplicacao } from "@/lib/base-path";

export async function exigirAdministrador() {
  const jar = await cookies();
  const sessao = lerTokenSessao(jar.get(COOKIE_SESSAO)?.value);

  if (!sessao) {
    redirect(rotaAplicacao("/login"));
  }
  if (sessao.perfil !== "ADMINISTRADOR") {
    redirect(rotaAplicacao("/"));
  }

  return sessao;
}
