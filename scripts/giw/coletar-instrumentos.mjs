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

async function lerVinculos(metaWindow, termoLegacyId, metaLegacyId) {
  const formulario = sistema
    .frameLocator("#WFRIframeForm464569258 iframe")
    .frameLocator('iframe[name="mainform"]');
  await formulario.locator('a[href="#tab1"]').click();
  const localizador = formulario.frameLocator("#tab1 iframe");
  const linhas = localizador.locator("tbody tr").filter({ has: localizador.locator("td") });
  const total = await linhas.count();
  const vinculos = [];

  for (let index = 0; index < total; index += 1) {
    await linhas.nth(index).click();
    await formulario.locator('a[href="#tab0"][aria-selected="true"]').waitFor();
    const valor = async (selector) => formulario.locator(selector).inputValue();
    const sim = async (selector) => (await valor(selector)).toLowerCase() === "s";
    vinculos.push({
      legacyId: await valor('input[name="WFRInput1109255246"]'),
      pessoaLegacyId: await valor('input[name="WFRInput1026352"]'),
      matricula: await valor("#WFRInput1024878"),
      termoLegacyId,
      metaLegacyId,
      atividadeLegacyId: await valor('input[name="WFRInput1024887"]'),
      lotacaoLegacyId: await valor('input[name="WFRInput1026296"]'),
      numeroContrato: (await valor("#WFRInput1024886")) || null,
      inicio: await valor("#WFRInput1024879"),
      fim: (await valor("#WFRInput1024880")) || null,
      valorRetribuicao: await valor("#WFRInput1024882"),
      cargaHoraria: (await valor("#WFRInput1024888")) || null,
      descontaInss: await sim('input[name="WFRInput1026416"]'),
      descontaIrrf: await sim('input[name="WFRInput1026417"]'),
      ativo: await sim('input[name="WFRInput1024881"]'),
    });
    await formulario.locator('a[href="#tab1"]').click();
  }

  await metaWindow.locator(".OptionClose").click();
  await metaWindow.waitFor({ state: "detached" });
  return vinculos;
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
  const vinculos = [];
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
      vinculos.push(...(await lerVinculos(metaWindow, legacyId, metaLegacyId)));

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
  await salvarSnapshot({
    entity: "vinculos",
    formId: "464569258",
    extractedAt: timestamp,
    records: vinculos,
    output: process.env.GIW_OUTPUT_VINCULOS,
  });
} finally {
  await browser.close();
}
