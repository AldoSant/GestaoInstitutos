import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { abrirMenuMovimentacao, abrirSessaoGiw, giwBaseUrl } from "./cliente.mjs";

const output = resolve(process.env.GIW_OUTPUT_SELETOR_META ?? ".private/importacoes/giw/seletor-meta.json");

const { browser, page, sistema, menu } = await abrirSessaoGiw();
try {
  const requisicoes = [];
  const respostasLookup = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("GIW") || url.includes("lookup") || url.includes("query")) {
      requisicoes.push({ metodo: request.method(), url: url.replace(/([?&](?:password|senha)=[^&]*)/gi, "$1=REDACTED") });
    }
  });
  page.on("response", async (response) => {
    if (!response.url().includes("/search.do?")) return;
    try {
      respostasLookup.push({
        status: response.status(),
        url: response.url(),
        corpo: (await response.text()).slice(0, 20_000),
      });
    } catch {
      // A inspeção permanece útil mesmo se o navegador descartar a resposta.
    }
  });
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
  if (process.env.GIW_TERMO_BUSCA) {
    await formulario.locator("#WFRInput1026011").fill(process.env.GIW_TERMO_BUSCA);
    await new Promise((resolveWait) => setTimeout(resolveWait, 750));
  }
  if (process.env.GIW_META_BUSCA) {
    await meta.fill(process.env.GIW_META_BUSCA);
    await new Promise((resolveWait) => setTimeout(resolveWait, 750));
  }
  const estrutura = await meta.evaluate((element) => {
    const limpar = (html) => html.replace(/value="[^"]*"/gi, 'value=""');
    return limpar(element.parentElement?.outerHTML ?? element.outerHTML);
  });
  const antes = await sistema.locator('[id^="WFRIframeForm"]').evaluateAll((items) => items.map((item) => item.id));
  const botaoMeta = meta.locator("xpath=following-sibling::button");
  if ((await botaoMeta.count()) !== 1) throw new Error("Botão do lookup de Meta não encontrado.");
  await botaoMeta.click();
  await new Promise((resolveWait) => setTimeout(resolveWait, 750));
  await new Promise((resolveWait) => setTimeout(resolveWait, 750));
  const depois = await sistema.locator('[id^="WFRIframeForm"]').evaluateAll((items) =>
    items.map((item) => ({ id: item.id, iframe: item.querySelector("iframe")?.getAttribute("src") ?? null })),
  );
  const popups = await formulario.locator("body").evaluate((body) =>
    Array.from(body.querySelectorAll("[role='dialog'], .dropdown-menu, .lookup-results, .ui-autocomplete"))
      .map((item) => ({ tag: item.tagName, id: item.id || null, className: item.className, texto: (item.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 500) }))
      .filter((item) => item.texto || item.id || item.className),
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({
    schemaVersion: "1.0", mode: "READ_ONLY_SELECTOR_DISCOVERY",
    source: { system: "GIW", baseUrl: giwBaseUrl, extractedAt: new Date().toISOString() },
    metaInputParent: estrutura, janelasAntes: antes, janelasDepois: depois, popups,
    requisicoes: requisicoes.slice(-50),
    respostasLookup: respostasLookup.slice(-10),
  }, null, 2)}\n`, { mode: 0o600 });
  console.log(`Seletor de Meta inspecionado em ${output}.`);
} finally {
  await browser.close();
}
