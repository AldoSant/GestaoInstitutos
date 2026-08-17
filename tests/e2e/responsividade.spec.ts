import { expect, test, type Page } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

async function abrirMenu(page: Page) {
  const menu = page.locator('summary[aria-label="Abrir navegação principal"]');
  await expect(menu).toBeVisible();
  await menu.click();
  const painel = page.locator(".quiet-navigation-panel");
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
  await menu.getByRole("link", { name: "Folha mensal" }).click();
  await expect(
    page.getByRole("heading", { name: "Folha mensal" }),
  ).toBeVisible();
  await semEstouroHorizontal(page);

  menu = await abrirMenu(page);
  await menu.locator("summary.nav-group-label", { hasText: "Pessoas e vínculos" }).click();
  await menu.getByRole("link", { name: "Cadastros", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cadastros" })).toBeVisible();
  await semEstouroHorizontal(page);

  menu = await abrirMenu(page);
  await menu.getByRole("link", { name: "Obrigações e GPS" }).click();
  await expect(
    page.getByRole("heading", { name: "Obrigações e GPS" }),
  ).toBeVisible();
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
  await Promise.all([
    page.waitForURL(/\/cadastros\/pessoas\/[^/]+$/),
    primeiraFicha.first().click(),
  ]);

  const titulo = page.locator(".quiet-page-heading h1");
  await expect(titulo).toBeVisible();
  await expect(titulo).toHaveCSS("white-space", "normal");
  await expect(titulo).toHaveCSS("overflow", "visible");

  const seletor = page.getByRole("combobox", { name: "Competência em foco" });
  await expect(seletor).toBeVisible();
  const caminhoAntes = new URL(page.url()).pathname;
  const opcoes = await seletor.locator("option").evaluateAll((itens) =>
    itens.map((item) => (item as HTMLOptionElement).value),
  );
  expect(opcoes.length).toBeGreaterThan(1);
  const atual = await seletor.inputValue();
  const destino = opcoes.find((opcao) => opcao !== atual)!;
  await seletor.selectOption(destino);
  await expect(page).toHaveURL(new RegExp(`competencia=${destino}`));
  expect(new URL(page.url()).pathname).toBe(caminhoAntes);
  await semEstouroHorizontal(page);
});

test("ficha completa não estoura a largura de notebook", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("login");
  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();

  await page.goto("cadastros");
  const primeiraFicha = page.locator('a[href*="/cadastros/pessoas/"]');
  expect(await primeiraFicha.count()).toBeGreaterThan(0);
  await primeiraFicha.first().click();
  await expect(page.locator(".person-form")).toBeVisible();
  await semEstouroHorizontal(page);
});
