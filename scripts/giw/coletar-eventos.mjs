import {
  abrirMenuCadastro,
  abrirSessaoGiw,
  salvarSnapshot,
} from "./cliente.mjs";

const timestamp = new Date().toISOString();
const { browser, page, sistema, menu } = await abrirSessaoGiw();

try {
  await abrirMenuCadastro(menu);
  const submenuTabelas = menu.locator("#MenuLateralGamma-submenu-1745586");
  const className = await submenuTabelas.getAttribute("class");
  if (!className?.includes("show")) {
    await menu.locator('a[href="#MenuLateralGamma-submenu-1745586"]').click();
  }
  await menu.locator("#MenuLateralGamma-item-788528").click();

  const janela = sistema.locator('iframe[src*="formID=8716"]');
  await janela.waitFor();
  const formulario = sistema
    .frameLocator('iframe[src*="formID=8716"]')
    .frameLocator('iframe[name="mainform"]');
  await formulario.getByRole("tab", { name: "Localizar", exact: true }).click();
  const consulta = formulario.frameLocator('iframe[src^="basic_query.jsp"]');
  await consulta.locator("#results-table tbody tr").first().waitFor();

  const eventos = [];
  const vistos = new Set();
  let pagina = 1;
  let concluiu = false;
  const valor = async (selector) =>
    ((await formulario.locator(selector).inputValue().catch(() => "")) ?? "").trim();
  const sim = async (selector) => (await valor(selector)).toLowerCase() === "s";

  while (pagina <= 100) {
    const linhas = consulta.locator("#results-table tbody tr");
    const rows = await linhas.evaluateAll((elements) =>
      elements.map((row) =>
        Array.from(row.querySelectorAll("td"), (cell) =>
          (cell.textContent ?? "").replace(/\u00a0/g, " ").trim(),
        ),
      ),
    );
    for (let index = 0; index < rows.length; index += 1) {
      const [codigoResumo, descricaoResumo] = rows[index];
      if (!codigoResumo || vistos.has(codigoResumo)) continue;
      await linhas.nth(index).dblclick();
      let codigo = "";
      for (let attempt = 0; attempt < 100; attempt += 1) {
        codigo = await valor("#WFRInput1025105");
        if (codigo === codigoResumo) break;
        await page.waitForTimeout(100);
      }
      if (codigo !== codigoResumo) {
        throw new Error(`O Evento ${codigoResumo} não abriu para coleta completa.`);
      }
      const tipo = await valor('input[name="WFRInput1025107"]');
      const composicoes = (
        await formulario.locator('tr[role="listitem"]').allTextContents()
      )
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const tipoCalculo = /percentual/i.test(composicoes)
        ? "PERCENTUAL"
        : /valor informado/i.test(composicoes)
          ? "VALOR"
          : null;
      if (!tipoCalculo || !["p", "d"].includes(tipo)) {
        throw new Error(`O Evento ${codigo} possui tipo ou modo de cálculo desconhecido.`);
      }
      vistos.add(codigo);
      eventos.push({
        legacyId: codigo,
        codigo,
        descricao: (await valor("#WFRInput1025106")) || descricaoResumo,
        natureza: tipo === "p" ? "PROVENTO" : "DESCONTO",
        tipoCalculo,
        incideInss: await sim('input[name="WFRInput1025255"]'),
        incideIrrf: await sim('input[name="WFRInput1025121"]'),
        ativo: await sim('input[name="WFRInput1025246"]'),
      });
      await formulario.getByRole("tab", { name: "Localizar", exact: true }).click();
      await consulta.locator("#results-table").waitFor();
    }
    console.log(`GIW: página ${pagina}, ${eventos.length} Evento(s) coletado(s).`);
    const nextContainer = consulta.locator("#nav-item-next");
    const nextClass = await nextContainer.getAttribute("class");
    if (nextClass?.includes("disabled")) {
      concluiu = true;
      break;
    }
    const firstBefore =
      (await consulta.locator("#results-table tbody tr td").first().textContent())?.trim() ?? "";
    await nextContainer.locator("a").click();
    let avancou = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const firstAfter =
        (await consulta.locator("#results-table tbody tr td").first().textContent())?.trim() ??
        "";
      if (firstAfter && firstAfter !== firstBefore) {
        avancou = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (!avancou) throw new Error(`A página ${pagina + 1} de Eventos não carregou.`);
    pagina += 1;
  }
  if (!concluiu) throw new Error("A coleta de Eventos ultrapassou 100 páginas.");
  if (eventos.length === 0) throw new Error("O GIW não retornou Eventos.");

  await salvarSnapshot({
    entity: "eventos",
    formId: "8716",
    extractedAt: timestamp,
    records: eventos,
    output: process.env.GIW_OUTPUT_EVENTOS,
  });
} finally {
  await browser.close();
}
