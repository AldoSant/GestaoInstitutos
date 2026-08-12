import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  abrirMenuMovimentacao,
  abrirSessaoGiw,
  giwBaseUrl,
} from "./cliente.mjs";

const formId = "464569390";
const output = resolve(
  process.env.GIW_OUTPUT_RELATORIO_FOLHA ??
    `.private/importacoes/giw/relatorio-folha-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);

const { browser, page, sistema, menu } = await abrirSessaoGiw();
try {
  const respostas = [];
  page.on("response", (response) => {
    const tipo = response.headers()["content-type"] ?? "";
    if (/pdf|report|jasper|folha/i.test(`${response.url()} ${tipo}`)) {
      respostas.push({
        status: response.status(),
        contentType: tipo,
        url: response.url().replace(/([?&](?:senha|password)=[^&]*)/gi, "$1=REDACTED"),
      });
    }
  });
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

  const camposAntes = await formulario.locator("body").evaluate((body) =>
    Array.from(body.querySelectorAll("input, select, textarea"))
      .map((campo) => ({
        id: campo.id || null,
        name: campo.getAttribute("name"),
        type: campo.getAttribute("type"),
        possuiValor: "value" in campo && String(campo.value ?? "").trim().length > 0,
      }))
      .filter((campo) => campo.id || campo.name),
  );

  await formulario.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page.waitForTimeout(1_500);
  const botoes = await formulario.locator("button:visible").allTextContents();
  const botaoFolha = formulario.getByRole("button", { name: "Folha", exact: true });
  if ((await botaoFolha.count()) !== 1) {
    throw new Error("O botão de relatório da Folha não foi encontrado.");
  }
  await botaoFolha.click();
  await page.waitForTimeout(3_000);

  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify({
      schemaVersion: "1.0",
      mode: "READ_ONLY_REPORT_DISCOVERY",
      source: { system: "GIW", formId, baseUrl: giwBaseUrl, extractedAt: new Date().toISOString() },
      camposAntes,
      botoes: botoes.map((texto) => texto.replace(/\s+/g, " ").trim()).filter(Boolean),
      respostas,
    }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(`Emissão de relatório GIW inspecionada em ${output}.`);
} finally {
  await browser.close();
}
