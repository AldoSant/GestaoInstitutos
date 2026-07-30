import { expect, test, type Page } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

async function abrirMenu(page: Page) {
  const menu = page.getByRole("button", { name: "Abrir menu" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
}

async function semEstouroHorizontal(page: Page) {
  const dimensoes = await page.evaluate(() => ({
    largura: document.documentElement.clientWidth,
    conteudo: document.documentElement.scrollWidth,
  }));
  expect(
    dimensoes.conteudo,
    `A página excede a largura móvel: ${dimensoes.conteudo}px para ${dimensoes.largura}px.`,
  ).toBeLessThanOrEqual(dimensoes.largura);
}

test.use({ viewport: { width: 390, height: 844 } });

test("jornada principal permanece operável no celular", async ({ page }) => {
  await page.goto("login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await semEstouroHorizontal(page);

  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await semEstouroHorizontal(page);

  await abrirMenu(page);
  await page.getByRole("link", { name: "Folha mensal" }).click();
  await expect(page.getByRole("heading", { name: "Folhas" })).toBeVisible();
  await semEstouroHorizontal(page);

  await abrirMenu(page);
  await page.getByText("Pessoas e vínculos", { exact: true }).click();
  await page.getByRole("link", { name: "Pessoas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cadastros" })).toBeVisible();
  await semEstouroHorizontal(page);

  await abrirMenu(page);
  await page.getByRole("link", { name: "Obrigações e guias" }).click();
  await expect(page.getByRole("heading", { name: "Obrigações" })).toBeVisible();
  await semEstouroHorizontal(page);

  await abrirMenu(page);
  await page.getByRole("link", { name: "Administração" }).click();
  await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
  await semEstouroHorizontal(page);
});
