import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

async function esperarPagina(page: Page, titulo: string) {
  await expect(
    page.getByRole("heading", { name: titulo, exact: true }),
  ).toBeVisible();
}

async function auditar(page: Page, contexto: string) {
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const bloqueios = resultado.violations.filter((item) =>
    ["serious", "critical"].includes(item.impact ?? ""),
  );
  return bloqueios.map(
    (item) =>
      `${contexto} — ${item.id}: ${item.help} (${item.nodes
        .map((node) => node.target.join(" "))
        .join(", ")})`,
  );
}

test("telas críticas não possuem violações sérias de acessibilidade", async ({
  page,
}) => {
  const problemas: string[] = [];
  await page.goto("login");
  await esperarPagina(page, "Entrar");
  problemas.push(...(await auditar(page, "Login")));

  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await esperarPagina(page, "Visão geral");

  const telas = [
    { caminho: "", titulo: "Visão geral" },
    { caminho: "cadastros", titulo: "Cadastros" },
    { caminho: "folhas", titulo: "Processamentos mensais" },
    { caminho: "obrigacoes", titulo: "Guias GPS" },
  ];

  for (const tela of telas) {
    await page.goto(tela.caminho);
    await esperarPagina(page, tela.titulo);
    problemas.push(...(await auditar(page, tela.titulo)));
  }

  expect(
    problemas,
    `Foram encontradas violações sérias ou críticas:\n${problemas.join("\n")}`,
  ).toEqual([]);
});
