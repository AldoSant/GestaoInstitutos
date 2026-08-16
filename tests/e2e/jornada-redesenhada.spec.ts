import { expect, test, type Page } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

async function autenticar(page: Page) {
  await page.goto("login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
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
      await page.goto(etapa.href);
      await expect(page).toHaveURL(new RegExp(`${etapa.href}(?:\\?.*)?$`));
      await expect(
        page.getByRole("heading", { level: 1, name: etapa.titulo }),
      ).toBeVisible();
      await expect(
        page.locator(`.sidebar a.nav-link[href="${etapa.href}"]`),
      ).toContainText(etapa.menu);
      await expect(page.getByRole("link", { name: etapa.acao })).toBeVisible();
      await expect(page.locator(".feedback-banner.error")).toHaveCount(0);
    });
  }

  await page.goto("/ajuda");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ajuda" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir folha mensal" }),
  ).toHaveAttribute("href", "/folhas");

  for (const ancora of [
    "#roteiro-mensal",
    "#bloqueios",
    "#documentos-oficiais",
  ]) {
    await expect(page.locator(ancora)).toHaveCount(1);
  }
});
