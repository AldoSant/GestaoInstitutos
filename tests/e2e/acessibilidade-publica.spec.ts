import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

test("login público não possui violações sérias de acessibilidade", async ({ page }) => {
  await page.goto("login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const bloqueios = resultado.violations.filter((item) =>
    ["serious", "critical"].includes(item.impact ?? ""),
  );

  expect(
    bloqueios.map((item) => `${item.id}: ${item.help}`),
    "O login público não pode introduzir violações sérias ou críticas.",
  ).toEqual([]);
});
