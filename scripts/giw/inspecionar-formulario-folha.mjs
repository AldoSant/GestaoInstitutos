import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  abrirMenuMovimentacao,
  abrirSessaoGiw,
  giwBaseUrl,
} from "./cliente.mjs";

const formId = "464569390";
const output = resolve(
  process.env.GIW_OUTPUT_FOLHA_FORMULARIO ??
    `.private/importacoes/giw/formulario-folha-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);

const { browser, sistema, menu } = await abrirSessaoGiw();
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
  await formulario.locator("body").waitFor();

  const estrutura = await formulario.locator("body").evaluate((body) => {
    const normalizar = (texto) => (texto ?? "").replace(/\s+/g, " ").trim();
    const visivel = (element) => {
      const estilo = window.getComputedStyle(element);
      const caixa = element.getBoundingClientRect();
      return estilo.display !== "none" && estilo.visibility !== "hidden" && caixa.width > 0;
    };
    const atributos = (element) => Object.fromEntries(
      ["id", "name", "type", "class", "onclick", "onchange", "data-target", "aria-controls"]
        .map((nome) => [nome, element.getAttribute(nome)])
        .filter(([, valor]) => valor),
    );
    const labels = Array.from(body.querySelectorAll("label"))
      .filter(visivel)
      .map((label) => ({ texto: normalizar(label.textContent), for: label.htmlFor || null }))
      .filter((label) => label.texto);
    const campos = Array.from(body.querySelectorAll("input, select, textarea"))
      .filter(visivel)
      .map((campo) => ({
        tag: campo.tagName.toLowerCase(),
        atributos: atributos(campo),
        possuiValor: "value" in campo && String(campo.value ?? "").trim().length > 0,
        proximoBotao: (() => {
          const botao = campo.parentElement?.querySelector("button, input[type='button'], a");
          return botao ? { atributos: atributos(botao), texto: normalizar(botao.textContent) } : null;
        })(),
      }));
    const botoes = Array.from(body.querySelectorAll("button, input[type='button']"))
      .filter(visivel)
      .map((botao) => ({ atributos: atributos(botao), texto: normalizar(botao.textContent || botao.value) }));
    return { labels, campos, botoes };
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify({
      schemaVersion: "1.0",
      mode: "READ_ONLY_FORM_DISCOVERY",
      source: { system: "GIW", formId, baseUrl: giwBaseUrl, extractedAt: new Date().toISOString() },
      estrutura,
    }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(`Estrutura da Folha GIW gravada em ${output}.`);
} finally {
  await browser.close();
}
