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
    await expect(page.getByRole("heading", { name: "Pessoas" })).toBeVisible();
  });

  await test.step("consultar o fluxo mensal da folha", async () => {
    await page.goto("folhas");
    await expect(page.getByRole("heading", { name: "Folhas" })).toBeVisible();
    await expect(page.getByText("Competências processadas")).toBeVisible();
    await expect(page.getByRole("link", { name: /Nova folha/i })).toBeVisible();
  });

  await test.step("confirmar o isolamento da administração e do legado", async () => {
    await expect(
      page.getByRole("link", { name: "Importação do GIW" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Administração" }).click();
    await expect(
      page.getByRole("heading", { name: "Administração" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Importação do GIW/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Parâmetros fiscais/ }),
    ).toBeVisible();
  });

  await test.step("consultar obrigações e o diagnóstico de FGTS", async () => {
    await page.goto("obrigacoes");
    await expect(page.getByRole("heading", { name: "Obrigações" })).toBeVisible();
    await expect(
      page.getByText("Da folha fechada ao DARF para pagamento"),
    ).toBeVisible();

    await page.goto("fgts");
    await expect(page.getByRole("heading", { name: "FGTS Digital" })).toBeVisible();
    await expect(page.getByText("Categorias encontradas na folha")).toBeVisible();
    await expect(page.getByText(/GFD oficial/).first()).toBeVisible();
  });
});
