import { expect, test, type Page } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

async function abrirMenu(page: Page) {
  const menu = page.locator('summary[aria-label="Abrir menu"]');
  await expect(menu).toBeVisible();
  await menu.click();
  const painel = page.locator(".mobile-menu-panel");
  await expect(
    painel.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeVisible();
  return painel;
}

async function semEstouroHorizontal(page: Page) {
  const dimensoes = await page.evaluate(() => ({
    largura: document.documentElement.clientWidth,
    conteudo: document.documentElement.scrollWidth,
    excedentes: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((elemento) => {
        const caixa = elemento.getBoundingClientRect();
        return {
          seletor: `${elemento.tagName.toLowerCase()}${elemento.id ? `#${elemento.id}` : ""}${Array.from(elemento.classList)
            .map((classe) => `.${classe}`)
            .join("")}`,
          esquerda: Math.round(caixa.left),
          direita: Math.round(caixa.right),
          largura: Math.round(caixa.width),
        };
      })
      .filter((item) => item.esquerda < -1 || item.direita > document.documentElement.clientWidth + 1)
      .slice(0, 8),
  }));
  expect(
    dimensoes.conteudo,
    `A página excede a largura móvel: ${dimensoes.conteudo}px para ${dimensoes.largura}px. Elementos: ${JSON.stringify(dimensoes.excedentes)}`,
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

  let menu = await abrirMenu(page);
  await menu.getByRole("link", { name: "Folhas mensais" }).click();
  await expect(
    page.getByRole("heading", { name: "Folhas mensais" }),
  ).toBeVisible();
  await semEstouroHorizontal(page);

  menu = await abrirMenu(page);
  await menu.getByText("Pessoas e vínculos", { exact: true }).click();
  await menu.getByRole("link", { name: "Cadastros", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cadastros" })).toBeVisible();
  await semEstouroHorizontal(page);

  menu = await abrirMenu(page);
  await menu.getByRole("link", { name: "Obrigações e guias" }).click();
  await expect(
    page.getByRole("heading", { name: "Obrigações e guias" }),
  ).toBeVisible();
  await semEstouroHorizontal(page);

  menu = await abrirMenu(page);
  await menu.getByRole("link", { name: "Administração" }).click();
  await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
  await semEstouroHorizontal(page);
});

test("cabeçalho preserva contexto e não quebra com título longo", async ({
  page,
}) => {
  await page.goto("login");
  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();

  await page.goto("cadastros");
  const primeiraFicha = page.locator('a[href*="/cadastros/pessoas/"]');
  expect(await primeiraFicha.count()).toBeGreaterThan(0);
  await primeiraFicha.first().click();

  const titulo = page.locator(".page-heading h1");
  await expect(titulo).toBeVisible();
  const dimensoes = await titulo.evaluate((elemento) => ({
    altura: elemento.getBoundingClientRect().height,
    linha: Number.parseFloat(getComputedStyle(elemento).lineHeight),
  }));
  expect(dimensoes.altura).toBeLessThanOrEqual(dimensoes.linha + 1);

  const seletor = page.getByRole("combobox", { name: "Competência em foco" });
  await expect(seletor).toBeVisible();
  const caminhoAntes = new URL(page.url()).pathname;
  await seletor.selectOption("2026-05");
  await expect(page).toHaveURL(/competencia=2026-05/);
  expect(new URL(page.url()).pathname).toBe(caminhoAntes);
  await semEstouroHorizontal(page);
});
