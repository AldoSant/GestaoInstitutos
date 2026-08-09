import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { abrirMenuMovimentacao, abrirSessaoGiw, giwBaseUrl } from "./cliente.mjs";

const output = resolve(process.env.GIW_OUTPUT_SELETOR_META ?? ".private/importacoes/giw/seletor-meta.json");

const { browser, sistema, menu } = await abrirSessaoGiw();
try {
  await abrirMenuMovimentacao(menu);
  const link = menu.locator("a").filter({ hasText: /lançamentos?.*eventos?/i });
  if ((await link.count()) !== 1) throw new Error("Menu de lançamentos de eventos não identificado.");
  await link.click();
  await sistema.locator('iframe[src*="formID=464569425"]').waitFor();
  const formulario = sistema
    .frameLocator('iframe[src*="formID=464569425"]')
    .frameLocator('iframe[name="mainform"]');
  const meta = formulario.locator("#WFRInput1026012");
  await meta.waitFor();
  const estrutura = await meta.evaluate((element) => {
    const limpar = (html) => html.replace(/value="[^"]*"/gi, 'value=""');
    return limpar(element.parentElement?.outerHTML ?? element.outerHTML);
  });
  const botoes = formulario.locator("button");
  const antes = await sistema.locator('[id^="WFRIframeForm"]').evaluateAll((items) => items.map((item) => item.id));
  await botoes.nth(2).click();
  await new Promise((resolveWait) => setTimeout(resolveWait, 750));
  const depois = await sistema.locator('[id^="WFRIframeForm"]').evaluateAll((items) =>
    items.map((item) => ({ id: item.id, iframe: item.querySelector("iframe")?.getAttribute("src") ?? null })),
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({
    schemaVersion: "1.0", mode: "READ_ONLY_SELECTOR_DISCOVERY",
    source: { system: "GIW", baseUrl: giwBaseUrl, extractedAt: new Date().toISOString() },
    metaInputParent: estrutura, janelasAntes: antes, janelasDepois: depois,
  }, null, 2)}\n`, { mode: 0o600 });
  console.log(`Seletor de Meta inspecionado em ${output}.`);
} finally {
  await browser.close();
}
