import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

export const giwBaseUrl =
  process.env.GIW_URL ??
  "http://ws.marvsolutions.com.br:9050/instituto/open.do?sys=GIW";

export async function abrirSessaoGiw() {
  const usuario = process.env.GIW_USUARIO;
  const senha = process.env.GIW_SENHA;
  if (!usuario || !senha) {
    throw new Error("Configure GIW_USUARIO e GIW_SENHA somente no ambiente local.");
  }

  const browser = await chromium.launch({ headless: process.env.GIW_HEADLESS !== "false" });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(giwBaseUrl, { waitUntil: "domcontentloaded" });

    const login = page.frameLocator('iframe[name="mainform"]');
    await login.getByLabel("Usuário", { exact: true }).fill(usuario);
    await login.getByLabel("Senha", { exact: true }).fill(senha);
    await login.getByRole("button", { name: /Autenticar/ }).click();

    await page.locator('iframe[name="mainsystem"]').waitFor();
    const sistema = page.frameLocator('iframe[name="mainsystem"]');
    const menu = sistema.frameLocator('iframe[name="mainform"]');
    return { browser, page, sistema, menu };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

export async function abrirMenuCadastro(menu) {
  const submenu = menu.locator("#MenuLateralGamma-submenu-788825");
  const className = await submenu.getAttribute("class");
  if (!className?.includes("show")) {
    await menu.locator('a[href="#MenuLateralGamma-submenu-788825"]').click();
  }
}

export async function salvarSnapshot({
  entity,
  formId,
  records,
  extractedAt,
  output,
}) {
  const safeTimestamp = extractedAt.replace(/[:.]/g, "-");
  const defaultFile = `.private/importacoes/giw/${entity}-${safeTimestamp}.json`;
  const outputFile = resolve(output || defaultFile);
  const snapshot = {
    schemaVersion: "1.0",
    source: { system: "GIW", formId, extractedAt, baseUrl: giwBaseUrl },
    entity,
    records,
  };
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`${entity}: ${records.length} registro(s) em ${outputFile}.`);
  return outputFile;
}
