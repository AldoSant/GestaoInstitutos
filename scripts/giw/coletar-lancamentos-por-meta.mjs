import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { abrirMenuMovimentacao, abrirSessaoGiw, giwBaseUrl } from "./cliente.mjs";

const termoId = process.env.GIW_TERMO_ID?.trim();
const metaId = process.env.GIW_META_ID?.trim();
const termoLabel = process.env.GIW_TERMO_LABEL?.trim();
const metaLabel = process.env.GIW_META_LABEL?.trim();
if (!/^\d+$/.test(termoId ?? "") || !/^\d+$/.test(metaId ?? "")) {
  throw new Error("GIW_TERMO_ID e GIW_META_ID numéricos são obrigatórios.");
}
if (!termoLabel || !metaLabel) {
  throw new Error("GIW_TERMO_LABEL e GIW_META_LABEL são obrigatórios.");
}
const output = resolve(
  process.env.GIW_OUTPUT_LANCAMENTOS ??
    `.private/importacoes/giw/lancamentos-termo-${termoId}-meta-${metaId}.json`,
);
const maxPages = Number(process.env.GIW_MAP_MAX_PAGES ?? "100");

async function definirLookup(formulario, nome, valor, label) {
  const visivel = formulario.locator(`input#${nome}`);
  if (await visivel.count() !== 1) throw new Error(`Campo visível ${nome} não encontrado.`);
  await visivel.fill(label);
  await new Promise((resolveWait) => setTimeout(resolveWait, 600));
  await visivel.press("ArrowDown");
  await visivel.press("Enter");
  const oculto = formulario.locator(`input[type="hidden"][name="${nome}"]`);
  if (await oculto.count() !== 1) throw new Error(`Campo interno ${nome} não encontrado.`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  if (await oculto.inputValue() !== valor) {
    throw new Error(`O lookup ${nome} não confirmou o identificador solicitado.`);
  }
}

async function lerPagina(consulta) {
  return consulta.locator("body").evaluate((body) => {
    const tabelas = Array.from(body.querySelectorAll("table")).map((item) => ({
      id: item.id || null,
      headers: item.querySelectorAll("thead th").length,
      rows: item.querySelectorAll("tbody tr").length,
      cells: item.querySelectorAll("tbody tr td").length,
    }));
    const mensagens = Array.from(body.querySelectorAll('[role="alert"], .alert, .modal, [id^="modalConfirm"]'))
      .map((item) => (item.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 10);
    const frames = Array.from(body.querySelectorAll("iframe"), (frame) => ({
      id: frame.id || null,
      name: frame.getAttribute("name"),
      src: frame.getAttribute("src"),
    }));
    const tabela = body.querySelector("#results-table") ??
      Array.from(body.querySelectorAll("table"))
        .filter((item) => item.querySelectorAll("tbody tr td").length > 0)
        .sort((a, b) => b.querySelectorAll("tbody tr td").length - a.querySelectorAll("tbody tr td").length)[0];
    if (!tabela) return { headers: [], rows: [], tabelas, mensagens, frames };
    return {
      headers: Array.from(tabela.querySelectorAll("thead th"), (cell) =>
        (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
      ),
      rows: Array.from(tabela.querySelectorAll("tbody tr"))
        .map((row) => Array.from(row.querySelectorAll("td"), (cell) =>
          (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
        ))
        .filter((row) => row.some(Boolean)),
      tabelas,
      mensagens,
      frames,
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

const { browser, page, sistema, menu } = await abrirSessaoGiw();
try {
  const requisicoes = [];
  const respostasNavegacao = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/instituto/")) {
      requisicoes.push({ metodo: request.method(), url: url.replace(/([?&](?:senha|password)=[^&]*)/gi, "$1=REDACTED") });
    }
  });
  page.on("response", async (response) => {
    if (!response.url().includes("/navigate.do?")) return;
    try {
      respostasNavegacao.push({
        status: response.status(),
        url: response.url(),
        corpo: await response.text(),
      });
    } catch {
      // A coleta de grade continua útil mesmo se o navegador descartar a resposta.
    }
  });
  await abrirMenuMovimentacao(menu);
  const link = menu.locator("a").filter({ hasText: /lançamentos?.*eventos?/i });
  if (await link.count() !== 1) throw new Error("Menu de lançamentos de eventos não identificado.");
  await link.click();
  await sistema.locator('iframe[src*="formID=464569425"]').waitFor();
  const formulario = sistema
    .frameLocator('iframe[src*="formID=464569425"]')
    .frameLocator('iframe[name="mainform"]');
  await definirLookup(formulario, "WFRInput1026011", termoId, termoLabel);
  await definirLookup(formulario, "WFRInput1026012", metaId, metaLabel);
  await formulario.getByRole("button", { name: "Pesquisar", exact: true }).click();
  const iframeConsulta = formulario.locator('iframe[src^="basic_query.jsp"]');
  for (let tentativa = 0; tentativa < 50 && await iframeConsulta.count() === 0; tentativa += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
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
    filter: { termoId, metaId, termoLabel, metaLabel },
    requisicoes: requisicoes.slice(-100),
    respostasNavegacao: respostasNavegacao.slice(-20),
    pages,
  }, null, 2)}\n`, { mode: 0o600 });
  console.log(`Lançamentos GIW coletados em ${output}. Páginas: ${pages.length}; linhas: ${pages.reduce((total, page) => total + page.rows.length, 0)}.`);
} finally {
  await browser.close();
}
