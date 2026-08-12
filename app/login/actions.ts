"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verificarCredenciais } from "@/lib/autenticacao";
import { basePathAplicacao, rotaAplicacao } from "@/lib/base-path";
import {
  COOKIE_SESSAO,
  criarTokenSessao,
  DURACAO_SESSAO_SEGUNDOS,
} from "@/lib/sessao";

function voltarComErro(mensagem: string) {
  redirect(rotaAplicacao(`/login?erro=${encodeURIComponent(mensagem)}`));
}

export async function entrar(formData: FormData) {
  const login = String(formData.get("login") ?? "");
  const senha = String(formData.get("senha") ?? "");
  if (!login || !senha || !verificarCredenciais(login, senha)) {
    voltarComErro("Login ou senha inválidos.");
  }

  const token = criarTokenSessao({
    login,
    perfil: "ADMINISTRADOR",
  });
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: basePathAplicacao() || "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
  redirect(rotaAplicacao("/"));
}

export async function sair() {
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: basePathAplicacao() || "/",
    maxAge: 0,
  });
  redirect(rotaAplicacao("/login"));
}
