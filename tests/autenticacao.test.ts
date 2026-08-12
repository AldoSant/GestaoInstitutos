import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { verificarCredenciais } from "../lib/autenticacao";
import { basePathAplicacao, caminhoAplicacao, rotaAplicacao } from "../lib/base-path";
import {
  COOKIE_SESSAO,
  criarTokenSessao,
  lerTokenSessao,
} from "../lib/sessao";
import { config, proxy } from "../proxy";

test("credenciais administrativas são verificadas somente pelo ambiente", () => {
  process.env.ADMIN_LOGIN = "administrador";
  process.env.ADMIN_PASSWORD = "senha longa de teste";
  assert.equal(verificarCredenciais("administrador", "senha longa de teste"), true);
  assert.equal(verificarCredenciais("outro", "senha longa de teste"), false);
  assert.equal(verificarCredenciais("administrador", "outra senha"), false);
});

test("recusa senha administrativa curta", () => {
  process.env.ADMIN_LOGIN = "administrador";
  process.env.ADMIN_PASSWORD = "curta";
  assert.throws(
    () => verificarCredenciais("administrador", "curta"),
    /12 caracteres/,
  );
});

test("normaliza caminhos com e sem base path", () => {
  process.env.APP_BASE_PATH = "";
  assert.equal(basePathAplicacao(), "");
  assert.equal(caminhoAplicacao("/login"), "/login");
  process.env.APP_BASE_PATH = "/gestao-institutos/";
  assert.equal(basePathAplicacao(), "/gestao-institutos");
  assert.equal(caminhoAplicacao("/login"), "/gestao-institutos/login");
  assert.equal(caminhoAplicacao("/gestao-institutos/login"), "/gestao-institutos/login");
  assert.equal(rotaAplicacao("/login"), "/login");
  assert.equal(rotaAplicacao("/gestao-institutos/login"), "/login");
  delete process.env.APP_BASE_PATH;
});

test("sessão assinada rejeita adulteração e expiração", () => {
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-bytes";
  const agora = Date.UTC(2026, 6, 29);
  const token = criarTokenSessao({
    login: "administrador",
    perfil: "ADMINISTRADOR",
  }, agora);
  assert.equal(lerTokenSessao(token, agora)?.perfil, "ADMINISTRADOR");
  assert.equal(lerTokenSessao(`${token}x`, agora), null);
  assert.equal(lerTokenSessao(token, agora + 9 * 60 * 60 * 1000), null);
});

test("AUTH_SECRET curto é recusado", () => {
  process.env.AUTH_SECRET = "curto";
  assert.throws(
    () => criarTokenSessao({
      login: "admin", perfil: "ADMINISTRADOR",
    }),
    /32 bytes/,
  );
});

test("proxy redireciona HTML e responde 401 para chamadas não HTML", () => {
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-bytes";
  const html = proxy(new NextRequest("http://localhost/folhas", {
    headers: { accept: "text/html,application/xhtml+xml" },
  }));
  assert.equal(html.status, 307);
  assert.equal(html.headers.get("location"), "http://localhost/login");

  const api = proxy(new NextRequest("http://localhost/folhas", {
    headers: { accept: "application/json" },
  }));
  assert.equal(api.status, 401);
});

test("proxy aceita sessão válida e tira usuário autenticado do login", () => {
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-bytes";
  const token = criarTokenSessao({ login: "admin", perfil: "ADMINISTRADOR" });
  const protegida = proxy(new NextRequest("http://localhost/folhas", {
    headers: { cookie: `${COOKIE_SESSAO}=${token}` },
  }));
  assert.equal(protegida.status, 200);
  const login = proxy(new NextRequest("http://localhost/login", {
    headers: { cookie: `${COOKIE_SESSAO}=${token}` },
  }));
  assert.equal(login.status, 307);
  assert.equal(login.headers.get("location"), "http://localhost/");
});

test("proxy mantém módulos adormecidos fora do operacional autenticado", () => {
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-bytes";
  const token = criarTokenSessao({ login: "admin", perfil: "ADMINISTRADOR" });
  for (const rota of [
    "/administracao",
    "/demonstrativos",
    "/fechamento-mensal",
    "/fgts",
    "/migracoes",
    "/parametros",
  ]) {
    const resposta = proxy(new NextRequest(`http://localhost${rota}`, {
      headers: { cookie: `${COOKIE_SESSAO}=${token}` },
    }));
    assert.equal(resposta.status, 307, rota);
    assert.equal(
      resposta.headers.get("location"),
      "http://localhost/?aviso=modulo-reservado",
      rota,
    );
  }
});

test("proxy mantém a consolidação fiscal acessível ao operacional autenticado", () => {
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-bytes";
  const token = criarTokenSessao({ login: "admin", perfil: "ADMINISTRADOR" });
  const resposta = proxy(new NextRequest("http://localhost/conferencia-entre-folhas", {
    headers: { cookie: `${COOKIE_SESSAO}=${token}` },
  }));
  assert.equal(resposta.status, 200);
});

test("proxy preserva o base path no redirecionamento", () => {
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-bytes";
  const resposta = proxy(new NextRequest(
    "http://localhost/gestao-institutos/folhas",
    {
      headers: { accept: "text/html" },
      nextConfig: { basePath: "/gestao-institutos" },
    },
  ));
  assert.equal(resposta.status, 307);
  assert.equal(
    resposta.headers.get("location"),
    "http://localhost/gestao-institutos/login",
  );
});

test("proxy protege a raiz do base path para HTML e chamadas não HTML", () => {
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-bytes";
  assert.ok(config.matcher.includes("/"));
  const nextConfig = { basePath: "/gestao-institutos" };
  const html = proxy(new NextRequest(
    "http://localhost/gestao-institutos",
    {
      headers: { accept: "text/html" },
      nextConfig,
    },
  ));
  assert.equal(html.status, 307);
  assert.equal(
    html.headers.get("location"),
    "http://localhost/gestao-institutos/login",
  );

  const api = proxy(new NextRequest(
    "http://localhost/gestao-institutos",
    {
      headers: { accept: "application/json" },
      nextConfig,
    },
  ));
  assert.equal(api.status, 401);
});
