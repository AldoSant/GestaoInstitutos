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
  const detalhes = bloqueios
    .map(
      (item) =>
        `${item.id}: ${item.help} (${item.nodes
          .map((node) => node.target.join(" "))
          .join(", ")})`,
    )
    .join("\n");

  expect(
    bloqueios,
    `${contexto} possui violações sérias ou críticas:\n${detalhes}`,
  ).toEqual([]);
}

test("telas críticas não possuem violações sérias de acessibilidade", async ({
  page,
}) => {
  await page.goto("login");
  await esperarPagina(page, "Acessar sistema");
  await auditar(page, "Login");

  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await esperarPagina(page, "Visão geral");

  const telas = [
    { caminho: "", titulo: "Visão geral" },
    { caminho: "cadastros", titulo: "Cadastros" },
    { caminho: "folhas", titulo: "Folhas" },
    { caminho: "obrigacoes", titulo: "Obrigações" },
    { caminho: "fgts", titulo: "FGTS Digital" },
    { caminho: "administracao", titulo: "Administração" },
  ];

  for (const tela of telas) {
    await page.goto(tela.caminho);
    await esperarPagina(page, tela.titulo);
    await auditar(page, tela.titulo);
  }
});
