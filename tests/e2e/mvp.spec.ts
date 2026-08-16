import { expect, test } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

test("jornada não destrutiva do MVP publicado", async ({ page }) => {
  await test.step("autenticar e carregar a visão geral", async () => {
    await page.goto("login");
    await page.getByLabel("Login").fill(login!);
    await page.getByLabel("Senha").fill(senha!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Competência em foco" }),
    ).toBeVisible();
  });

  await test.step("consultar cadastros operacionais", async () => {
    await page.goto("cadastros");
    await expect(page.getByRole("heading", { name: "Cadastros" })).toBeVisible();
    await expect(page.getByLabel("Filtrar situação")).toHaveValue("ativas");
    await expect(
      page.getByRole("heading", { name: "Pessoas", exact: true }),
    ).toBeVisible();
  });

  await test.step("consultar o fluxo mensal da folha", async () => {
    await page.goto("folhas");
    await expect(
      page.getByRole("heading", { name: "Folha mensal" }),
    ).toBeVisible();
    await expect(page.getByText("Competências processadas")).toBeVisible();
    await expect(page.getByRole("link", { name: /Novo processamento/i })).toBeVisible();
  });

  await test.step("confirmar que módulos técnicos e legados estão adormecidos", async () => {
    await expect(
      page.getByRole("link", { name: "Importação do GIW" }),
    ).toHaveCount(0);
    await page.goto("administracao");
    await expect(
      page.getByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    await expect(
      page.getByText("Módulo fora da rotina atual"),
    ).toBeVisible();
  });

  await test.step("consultar obrigações e o caminho de recolhimento", async () => {
    await page.goto("obrigacoes");
    await expect(
      page.getByRole("heading", { name: "Obrigações e GPS" }),
    ).toBeVisible();
    await expect(
      page.getByText("Da folha fechada ao documento para pagamento"),
    ).toBeVisible();
  });
});
