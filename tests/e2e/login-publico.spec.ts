import { expect, test, type Page } from "playwright/test";

async function semEstouroHorizontal(page: Page) {
  const dimensoes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    conteudo: document.documentElement.scrollWidth,
  }));
  expect(dimensoes.conteudo).toBeLessThanOrEqual(dimensoes.viewport);
}

async function esperarContratoDeFormas(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const raio = (seletor: string) => {
      const elemento = document.querySelector<HTMLElement>(seletor);
      return elemento ? getComputedStyle(elemento).borderRadius : null;
    };
    return {
      cartao: raio(".login-card"),
      campo: raio(".login-form input"),
      acao: raio(".login-form .button"),
    };
  })).toEqual({ cartao: "4px", campo: "2px", acao: "2px" });
}

test("login público entrega a identidade Veredas sem ruptura visual", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("login");

  const logo = page.getByRole("img", { name: "Veredas" });
  await expect(logo).toBeVisible();
  await expect.poll(async () => logo.evaluate(
    (imagem) => (imagem as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("Login")).toBeFocused();
  await esperarContratoDeFormas(page);
  await semEstouroHorizontal(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await semEstouroHorizontal(page);
  await expect(logo).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await esperarContratoDeFormas(page);
});
