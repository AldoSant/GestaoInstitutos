import { expect, test, type Page } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

async function autenticar(page: Page) {
  await page.goto("login");
  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
}

async function semEstouroHorizontal(page: Page) {
  const dimensoes = await page.evaluate(() => ({
    largura: document.documentElement.clientWidth,
    conteudo: document.documentElement.scrollWidth,
  }));
  expect(dimensoes.conteudo).toBeLessThanOrEqual(dimensoes.largura);
}

test("cadastros ficam ocultos até a ação explícita e abrem em modal", async ({
  page,
}) => {
  await autenticar(page);
  await page.goto("cadastros");
  await expect(page.locator("form.crud-form")).toHaveCount(0);

  await page.getByRole("link", { name: "Nova pessoa" }).click();
  const modal = page.getByRole("dialog", { name: "Cadastrar pessoa" });
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("Nome ou razão social")).toBeEditable();
  await modal.getByRole("link", { name: "Fechar janela" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("ficha, prestador e vínculo formam uma jornada acionável", async ({
  page,
}) => {
  await autenticar(page);
  await page.goto("cadastros");
  const fichas = page.locator('a[href*="/cadastros/pessoas/"]');
  expect(await fichas.count()).toBeGreaterThan(0);
  await fichas.first().click();
  await expect(page.locator(".readiness-action")).toHaveCount(6);
  await expect(page.getByText("Prestador ativo", { exact: true })).toBeVisible();
  await expect(page.getByText("Vínculo ativo", { exact: true })).toBeVisible();

  await page.goto("prestadores");
  const açõesFicha = page.getByRole("link", { name: "Abrir ficha" });
  expect(await açõesFicha.count()).toBeGreaterThan(0);
});

test("termo e meta com pendências continuam selecionáveis para validação", async ({
  page,
}) => {
  await autenticar(page);
  await page.goto("folhas/nova?competencia=2026-05");
  const seletor = page.getByRole("combobox", { name: "Termo e Meta" });
  await expect(seletor).toBeVisible();
  const opçõesDisponíveis = await seletor.locator("option:not([disabled])").count();
  expect(opçõesDisponíveis).toBeGreaterThan(0);
});

test("ações cadastrais permanecem operáveis em tela estreita", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await autenticar(page);

  for (const cenário of [
    { pagina: "prestadores", ação: "Novo prestador", titulo: "Cadastrar prestador" },
    { pagina: "vinculos", ação: "Novo vínculo", titulo: "Cadastrar vínculo" },
    { pagina: "termos-e-metas", ação: "Novo termo", titulo: "Cadastrar termo" },
    { pagina: "eventos", ação: "Novo evento", titulo: "Cadastrar evento" },
  ]) {
    await page.goto(cenário.pagina);
    await semEstouroHorizontal(page);
    await page.getByRole("link", { name: cenário.ação }).click();
    await expect(page.getByRole("dialog", { name: cenário.titulo })).toBeVisible();
    await semEstouroHorizontal(page);
  }
});
