import { expect, test } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

test("login respeita exatamente um prefixo de implantação", async ({ page }) => {
  await page.goto("login");
  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  const base = new URL(
    process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
  ).pathname.replace(/\/+$/u, "");
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(base || "/");
});
