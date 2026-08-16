import { expect, test, type Page } from "playwright/test";
import { COOKIE_SESSAO, criarTokenSessao } from "../../lib/sessao";

test.skip(!process.env.AUTH_SECRET, "Defina AUTH_SECRET para a sessão de teste.");

async function autenticar(page: Page) {
  await page.goto("login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.context().addCookies([
    {
      name: COOKIE_SESSAO,
      value: criarTokenSessao({
        login: "E2E_REDESIGN_HML",
        perfil: "ADMINISTRADOR",
      }),
      url: new URL("/", page.url()).toString(),
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("");
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
}

function caminhoPublico(page: Page, rota: string) {
  const base = new URL(process.env.E2E_BASE_URL ?? page.url()).pathname.replace(
    /\/+$/u,
    "",
  );
  return `${base}${rota}`;
}

test("jornada mensal redesenhada mantém contexto e rotas de consulta", async ({
  page,
}) => {
  await autenticar(page);

  const jornada = [
    {
      href: "/folhas",
      menu: "Folha mensal",
      titulo: "Folha mensal",
      acao: /Novo processamento/i,
    },
    {
      href: "/obrigacoes",
      menu: "Obrigações e GPS",
      titulo: "Obrigações e GPS",
      acao: /Abrir folhas mensais|Ir para apuração|Registrar GPS oficiais|Ver detalhes da apuração/i,
    },
  ] as const;

  for (const etapa of jornada) {
    await test.step(etapa.titulo, async () => {
      await page.goto(etapa.href.slice(1));
      await expect(page).toHaveURL(new RegExp(`${caminhoPublico(page, etapa.href)}(?:\\?.*)?$`));
      await expect(
        page.getByRole("heading", { level: 1, name: etapa.titulo }),
      ).toBeVisible();
      await expect(
        page.locator(`.app-bar a.nav-link[href$="${etapa.href}"]`),
      ).toContainText(etapa.menu);
      await expect(page.getByRole("link", { name: etapa.acao })).toBeVisible();
      await expect(page.locator(".feedback-banner.error")).toHaveCount(0);
    });
  }

  await page.goto("ajuda");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ajuda" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir folha mensal" }),
  ).toHaveAttribute("href", /\/folhas$/);

  for (const ancora of [
    "#roteiro-mensal",
    "#bloqueios",
    "#documentos-oficiais",
  ]) {
    await expect(page.locator(ancora)).toHaveCount(1);
  }
});
