import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.GIW_URL ??
  "http://ws.marvsolutions.com.br:9050/instituto/open.do?sys=GIW";
const usuario = process.env.GIW_USUARIO;
const senha = process.env.GIW_SENHA;
const headless = process.env.GIW_HEADLESS !== "false";

if (!usuario || !senha) {
  throw new Error("Configure GIW_USUARIO e GIW_SENHA somente no ambiente local.");
}

const timestamp = new Date().toISOString();
const defaultFile = `.private/importacoes/giw/pessoas-${timestamp.replace(/[:.]/g, "-")}.json`;
const outputFile = resolve(process.env.GIW_OUTPUT ?? defaultFile);
const browser = await chromium.launch({ headless });

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(20_000);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const login = page.frameLocator('iframe[name="mainform"]');
  await login.getByLabel("Usuário", { exact: true }).fill(usuario);
  await login.getByLabel("Senha", { exact: true }).fill(senha);
  await login.getByRole("button", { name: /Autenticar/ }).click();

  await page.locator('iframe[name="mainsystem"]').waitFor();
  const sistema = page.frameLocator('iframe[name="mainsystem"]');
  const menu = sistema.frameLocator('iframe[name="mainform"]');
  await menu.locator('a[href="#MenuLateralGamma-submenu-788825"]').click();
  await menu.locator("#MenuLateralGamma-item-923723").click();

  const janelaPessoa = sistema.locator('iframe[src*="formID=464569402"]');
  await janelaPessoa.waitFor();
  const formularioPessoa = sistema
    .frameLocator('iframe[src*="formID=464569402"]')
    .frameLocator('iframe[name="mainform"]');
  await formularioPessoa.getByRole("tab", { name: "Localizar", exact: true }).click();

  const consulta = formularioPessoa.frameLocator('iframe[src^="basic_query.jsp"]');
  await consulta.locator("#results-table").waitFor();

  const records = [];
  const seen = new Set();
  let pageNumber = 1;
  let completed = false;

  while (pageNumber <= 100) {
    const rows = await consulta.locator("#results-table tbody tr").evaluateAll((elements) =>
      elements.map((row) =>
        Array.from(row.querySelectorAll("td"), (cell) => (cell.textContent ?? "").trim()),
      ),
    );

    for (const [legacyId, nome, cpf, cnpj] of rows) {
      if (!legacyId || seen.has(legacyId)) continue;
      seen.add(legacyId);
      records.push({ legacyId, nome, cpf: cpf || null, cnpj: cnpj || null });
    }

    console.log(`GIW: página ${pageNumber}, ${records.length} pessoa(s) coletada(s).`);
    const nextContainer = consulta.locator("#nav-item-next");
    const className = await nextContainer.getAttribute("class");
    if (className?.includes("disabled")) {
      completed = true;
      break;
    }

    const firstBefore = rows[0]?.[0] ?? "";
    await nextContainer.locator("a").click();
    let pageChanged = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const firstAfter =
        (await consulta.locator("#results-table tbody tr td").first().textContent())?.trim() ??
        "";
      if (firstAfter && firstAfter !== firstBefore) {
        pageChanged = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (!pageChanged) throw new Error(`A página ${pageNumber + 1} não carregou.`);
    pageNumber += 1;
  }

  if (!completed) throw new Error("A coleta ultrapassou o limite de 100 páginas.");

  const snapshot = {
    schemaVersion: "1.0",
    source: {
      system: "GIW",
      formId: "464569402",
      extractedAt: timestamp,
      baseUrl,
    },
    entity: "pessoas",
    records,
  };

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Snapshot privado salvo em ${outputFile}.`);
} finally {
  await browser.close();
}
