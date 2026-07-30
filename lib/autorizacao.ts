import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO, lerTokenSessao } from "@/lib/sessao";

export async function exigirAdministrador() {
  const jar = await cookies();
  const sessao = lerTokenSessao(jar.get(COOKIE_SESSAO)?.value);

  if (!sessao) {
    redirect("/login");
  }
  if (sessao.perfil !== "ADMINISTRADOR") {
    redirect("/");
  }

  return sessao;
}
