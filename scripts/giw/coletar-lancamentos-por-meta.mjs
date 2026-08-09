import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { abrirMenuMovimentacao, abrirSessaoGiw, giwBaseUrl } from "./cliente.mjs";

const termoId = process.env.GIW_TERMO_ID?.trim();
const metaId = process.env.GIW_META_ID?.trim();
if (!/^\d+$/.test(termoId ?? "") || !/^\d+$/.test(metaId ?? "")) {
  throw new Error("GIW_TERMO_ID e GIW_META_ID numéricos são obrigatórios.");
}
const output = resolve(
  process.env.GIW_OUTPUT_LANCAMENTOS ??
    `.private/importacoes/giw/lancamentos-termo-${termoId}-meta-${metaId}.json`,
);
const maxPages = Number(process.env.GIW_MAP_MAX_PAGES ?? "100");

async function definirLookup(formulario, nome, valor) {
  const oculto = formulario.locator(`input[type="hidden"][name="${nome}"]`);
  if (await oculto.count() !== 1) throw new Error(`Campo interno ${nome} não encontrado.`);
  await oculto.evaluate((element, value) => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, valor);
}

async function lerPagina(consulta) {
  return consulta.locator("body").evaluate((body) => {
    const tabela = body.querySelector("#results-table") ??
      Array.from(body.querySelectorAll("table")).find((item) => item.querySelector("tbody tr"));
    if (!tabela) return { headers: [], rows: [] };
    return {
      headers: Array.from(tabela.querySelectorAll("thead th"), (cell) =>
        (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
      ),
      rows: Array.from(tabela.querySelectorAll("tbody tr"))
        .map((row) => Array.from(row.querySelectorAll("td"), (cell) =>
          (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
        ))
        .filter((row) => row.some(Boolean)),
    };
  });
}

async function proximaPagina(consulta) {
  const next = consulta.locator("#nav-item-next");
  if (await next.count() !== 1 || (await next.getAttribute("class"))?.includes("disabled")) return false;
  const antes = (await consulta.locator("#results-table tbody tr").first().textContent())?.trim() ?? "";
  await next.locator("a").click();
  for (let tentativa = 0; tentativa < 100; tentativa += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    const depois = (await consulta.locator("#results-table tbody tr").first().textContent())?.trim() ?? "";
    if (depois && depois !== antes) return true;
  }
  throw new Error("A paginação de lançamentos não respondeu.");
}

const { browser, sistema, menu } = await abrirSessaoGiw();
try {
  await abrirMenuMovimentacao(menu);
  const link = menu.locator("a").filter({ hasText: /lançamentos?.*eventos?/i });
  if (await link.count() !== 1) throw new Error("Menu de lançamentos de eventos não identificado.");
  await link.click();
  await sistema.locator('iframe[src*="formID=464569425"]').waitFor();
  const formulario = sistema
    .frameLocator('iframe[src*="formID=464569425"]')
    .frameLocator('iframe[name="mainform"]');
  await definirLookup(formulario, "WFRInput1026011", termoId);
  await definirLookup(formulario, "WFRInput1026012", metaId);
  await formulario.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  const iframeConsulta = formulario.locator('iframe[src^="basic_query.jsp"]');
  const consulta = await iframeConsulta.count() === 1
    ? formulario.frameLocator('iframe[src^="basic_query.jsp"]')
    : formulario;
  await consulta.locator("body").waitFor();

  const pages = [];
  for (let pagina = 1; pagina <= maxPages; pagina += 1) {
    const dados = await lerPagina(consulta);
    pages.push({ number: pagina, ...dados });
    if (dados.rows.length === 0 || !(await proximaPagina(consulta))) break;
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({
    schemaVersion: "1.0",
    mode: "READ_ONLY_HISTORICAL_LAUNCHES",
    source: { system: "GIW", formId: "464569425", baseUrl: giwBaseUrl, extractedAt: new Date().toISOString() },
    filter: { termoId, metaId },
    pages,
  }, null, 2)}\n`, { mode: 0o600 });
  console.log(`Lançamentos GIW coletados em ${output}. Páginas: ${pages.length}; linhas: ${pages.reduce((total, page) => total + page.rows.length, 0)}.`);
} finally {
  await browser.close();
}
