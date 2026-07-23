import { abrirMenuCadastro, abrirSessaoGiw, salvarSnapshot } from "./cliente.mjs";

const timestamp = new Date().toISOString();
const { browser, page, sistema, menu } = await abrirSessaoGiw();

try {
  await abrirMenuCadastro(menu);
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
  if (records.length === 0) {
    throw new Error("O GIW não retornou pessoas; nenhum snapshot foi gravado.");
  }

  await salvarSnapshot({
    entity: "pessoas",
    formId: "464569402",
    extractedAt: timestamp,
    records,
    output: process.env.GIW_OUTPUT,
  });
} finally {
  await browser.close();
}
