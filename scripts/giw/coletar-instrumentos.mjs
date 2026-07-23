import {
  abrirMenuMovimentacao,
  abrirSessaoGiw,
  salvarSnapshot,
} from "./cliente.mjs";

const timestamp = new Date().toISOString();
const { browser, sistema, menu } = await abrirSessaoGiw();

function idFiltro(src, nome) {
  const decoded = decodeURIComponent(src ?? "");
  const match = new RegExp(`${nome}=([^@;&]+)`).exec(decoded);
  if (!match?.[1]) throw new Error(`O GIW não informou ${nome} no filtro.`);
  return match[1];
}

try {
  await abrirMenuMovimentacao(menu);
  await menu.locator("#MenuLateralGamma-item-833878").click();

  const janela = sistema.locator('iframe[src*="formID=464569250"]');
  await janela.waitFor();
  const formulario = sistema
    .frameLocator('iframe[src*="formID=464569250"]')
    .frameLocator('iframe[name="mainform"]');

  await formulario.locator('a[href="#tab3"]').click();
  const localizador = formulario.frameLocator("#tab3 iframe");
  const linhas = localizador.locator("tbody tr").filter({ has: localizador.locator("td") });
  const total = await linhas.count();
  if (total === 0) throw new Error("O GIW não retornou Termos para o ano selecionado.");

  const termos = [];
  for (let index = 0; index < total; index += 1) {
    await linhas.nth(index).click();
    await formulario.locator('a[href="#tab0"][aria-selected="true"]').waitFor();

    const valor = async (selector) => formulario.locator(selector).inputValue();
    const legacyId = await valor('input[name="WFRInput432550980"]');
    const numero = await valor("#WFRInput1025601");
    const descricao = await valor("#WFRInput1025602");
    const modalidade = await valor("#WFRInput1026315");
    const modalidadeExibida = await valor('input[name="WFRInput1026315Show"]');
    const inicio = await valor("#WFRInput1025603");
    const fim = await valor("#WFRInput1025604");
    const valorGlobal = await valor("#WFRInput1025605");

    await formulario.locator('a[href="#tab1"]').click();
    const metaRows = formulario.locator('#tab1 tr[role="listitem"]');
    const metaTotal = await metaRows.count();
    const metas = [];
    for (let metaIndex = 0; metaIndex < metaTotal; metaIndex += 1) {
      const row = metaRows.nth(metaIndex);
      const cells = await row.locator("td").allTextContents();
      if (cells.length < 5) continue;

      const action = row.locator('img[id^="grid1026106button"]').first();
      await action.click();
      const metaWindow = sistema.locator("#WFRIframeForm464569258");
      await metaWindow.waitFor();
      const src = await metaWindow.locator("iframe").getAttribute("src");
      const metaLegacyId = idFiltro(src, "par_meta_associado.met_cod");
      await metaWindow.locator(".OptionClose").click();
      await metaWindow.waitFor({ state: "detached" });

      metas.push({
        legacyId: metaLegacyId,
        codigo: metaLegacyId,
        descricao: cells[0].replace(/\u00a0/g, " ").trim(),
        tipoCalculo: cells[1].replace(/\u00a0/g, " ").trim() || null,
        valorPrevisto: cells[3].replace(/\u00a0/g, " ").trim() || null,
        ativo: true,
      });
    }

    termos.push({
      legacyId,
      numero,
      descricao,
      modalidade: modalidadeExibida || modalidade,
      inicio,
      fim: fim || null,
      valorGlobal,
      ativo: true,
      metas,
    });
    await formulario.locator('a[href="#tab3"]').click();
  }

  await salvarSnapshot({
    entity: "termos",
    formId: "464569250",
    extractedAt: timestamp,
    records: termos,
    output: process.env.GIW_OUTPUT_TERMOS,
  });
} finally {
  await browser.close();
}
