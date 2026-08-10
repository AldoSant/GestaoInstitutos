import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  abrirMenuMovimentacao,
  abrirSessaoGiw,
  giwBaseUrl,
} from "./cliente.mjs";

const formId = "464569390";
const output = resolve(
  process.env.GIW_OUTPUT_SELETOR_FOLHA ??
    `.private/importacoes/giw/seletor-folha-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);

const { browser, page, sistema, menu } = await abrirSessaoGiw();
try {
  await abrirMenuMovimentacao(menu);
  const links = menu.locator("a").filter({ hasText: /^folha(?:s| de pagamento)?$/i });
  if ((await links.count()) !== 1) {
    throw new Error("O menu de Folha do GIW não foi identificado unicamente.");
  }
  await links.click();
  await sistema.locator(`iframe[src*="formID=${formId}"]`).waitFor();
  const formulario = sistema
    .frameLocator(`iframe[src*="formID=${formId}"]`)
    .frameLocator('iframe[name="mainform"]');
  const parceiro = formulario.locator("#WFRInput1025269");
  await parceiro.waitFor();
  const botaoParceiro = parceiro.locator("xpath=following-sibling::button[1]");
  if ((await botaoParceiro.count()) !== 1) {
    throw new Error("O seletor de Parceiro da Folha não possui botão de consulta único.");
  }

  const estruturaControle = await parceiro.evaluate((input) => {
    const normalizar = (texto) => (texto ?? "").replace(/\s+/g, " ").trim();
    const atributos = (element) => Object.fromEntries(
      ["id", "name", "type", "class", "onclick", "aria-controls", "data-target"]
        .map((nome) => [nome, element.getAttribute(nome)])
        .filter(([, valor]) => valor),
    );
    const pai = input.parentElement;
    return {
      pai: pai ? { tag: pai.tagName.toLowerCase(), atributos: atributos(pai) } : null,
      filhos: Array.from(pai?.children ?? []).map((element) => ({
        tag: element.tagName.toLowerCase(),
        atributos: atributos(element),
        texto: normalizar(element.textContent),
      })),
    };
  });
  const janelasAntes = await sistema.locator('[id^="WFRIframeForm"]').evaluateAll((items) =>
    items.map((item) => item.id),
  );
  await botaoParceiro.click();
  await page.waitForTimeout(1_000);
  const janelasDepois = await sistema.locator('[id^="WFRIframeForm"]').evaluateAll((items) =>
    items.map((item) => ({
      id: item.id,
      frameSrc: item.querySelector("iframe")?.getAttribute("src") ?? null,
    })),
  );
  const popup = await formulario.locator("body").evaluate((body) => {
    const normalizar = (texto) => (texto ?? "").replace(/\s+/g, " ").trim();
    return Array.from(
      body.querySelectorAll("[role='dialog'], .dropdown-menu, .lookup-results, .ui-autocomplete"),
    ).map((element) => ({
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      texto: normalizar(element.textContent).slice(0, 500),
    }));
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify({
      schemaVersion: "1.0",
      mode: "READ_ONLY_SELECTOR_DISCOVERY",
      source: {
        system: "GIW",
        formId,
        campo: "Parceiro",
        baseUrl: giwBaseUrl,
        extractedAt: new Date().toISOString(),
      },
      estruturaControle,
      janelasAntes,
      janelasDepois,
      popup,
    }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(`Seletor de Parceiro da Folha inspecionado em ${output}.`);
} finally {
  await browser.close();
}
