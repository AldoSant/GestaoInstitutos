import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  abrirMenuMovimentacao,
  abrirSessaoGiw,
  salvarSnapshot,
} from "./cliente.mjs";

const timestamp = new Date().toISOString();
const atividadesReferenciadas = new Map();
const atividadesAtuais = new Set();
const pessoasReferenciadas = new Map();
const pessoasAtuais = new Set();
if (process.env.GIW_ATIVIDADES_BASE) {
  const snapshotAtividades = JSON.parse(
    await readFile(resolve(process.env.GIW_ATIVIDADES_BASE), "utf8"),
  );
  if (snapshotAtividades.entity !== "atividades" || !Array.isArray(snapshotAtividades.records)) {
    throw new Error("GIW_ATIVIDADES_BASE não é um snapshot de Atividades.");
  }
  snapshotAtividades.records.forEach((atividade) => {
    if (atividade.legacyId) atividadesAtuais.add(String(atividade.legacyId));
  });
}
if (process.env.GIW_PESSOAS_BASE) {
  const snapshotPessoas = JSON.parse(
    await readFile(resolve(process.env.GIW_PESSOAS_BASE), "utf8"),
  );
  if (snapshotPessoas.entity !== "pessoas" || !Array.isArray(snapshotPessoas.records)) {
    throw new Error("GIW_PESSOAS_BASE não é um snapshot de Pessoas.");
  }
  snapshotPessoas.records.forEach((pessoa) => {
    if (pessoa.legacyId) pessoasAtuais.add(String(pessoa.legacyId));
  });
}
const { browser, page, sistema, menu } = await abrirSessaoGiw();

function registrarAtividadeReferenciada(legacyId, descricao) {
  if (!legacyId) return;
  if (atividadesAtuais.has(legacyId)) return;
  if (!descricao) {
    throw new Error(`A descrição da Atividade ${legacyId} não foi exibida pelo GIW.`);
  }
  const anterior = atividadesReferenciadas.get(legacyId);
  if (anterior && anterior.descricao !== descricao) {
    throw new Error(`A Atividade ${legacyId} possui descrições divergentes nos Vínculos.`);
  }
  atividadesReferenciadas.set(legacyId, {
    legacyId,
    descricao,
    cargaHoraria: null,
    valor: null,
    ativo: false,
  });
}

function registrarPessoaReferenciada(legacyId, nome) {
  if (!legacyId || pessoasAtuais.has(legacyId)) return;
  if (!nome) {
    throw new Error(`O nome da Pessoa histórica ${legacyId} não foi exibido pelo GIW.`);
  }
  const anterior = pessoasReferenciadas.get(legacyId);
  if (anterior && anterior.nome !== nome) {
    throw new Error(`A Pessoa histórica ${legacyId} possui nomes divergentes.`);
  }
  pessoasReferenciadas.set(legacyId, {
    legacyId,
    dadosCompletos: false,
    nome,
  });
}

function idFiltro(src, nome) {
  const decoded = decodeURIComponent(src ?? "");
  const match = new RegExp(`${nome}=([^@;&]+)`).exec(decoded);
  if (!match?.[1]) throw new Error(`O GIW não informou ${nome} no filtro.`);
  return match[1];
}

async function esperarLinhasEstaveis(localizador) {
  let contagemAnterior = -1;
  let repeticoes = 0;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const contagem = await localizador.locator("#results-table tbody tr").count();
    if (contagem === contagemAnterior) repeticoes += 1;
    else repeticoes = 0;
    if (repeticoes >= 5) return contagem;
    contagemAnterior = contagem;
    await page.waitForTimeout(200);
  }
  throw new Error("A grade de Vínculos não estabilizou dentro do limite.");
}

async function lerVinculos(metaWindow, termoLegacyId, metaLegacyId) {
  const formulario = sistema
    .frameLocator("#WFRIframeForm464569258 iframe")
    .frameLocator('iframe[name="mainform"]');
  await formulario.locator('a[href="#tab1"]').click();
  const localizador = formulario.frameLocator("#tab1 iframe");
  await localizador.locator("#results-table").waitFor();
  await page.waitForTimeout(5_000);
  await esperarLinhasEstaveis(localizador);
  const vinculos = [];
  const vistos = new Set();
  let pagina = 1;
  let concluiu = false;
  while (pagina <= 100) {
    const linhas = localizador.locator("#results-table tbody tr");
    const total = await linhas.count();
    for (let index = 0; index < total; index += 1) {
      await linhas.nth(index).dblclick();
      await formulario.locator('a[href="#tab0"][aria-selected="true"]').waitFor();
      const valor = async (selector) =>
        ((await formulario.locator(selector).inputValue().catch(() => "")) ?? "").trim();
      let legacyId = "";
      for (let attempt = 0; attempt < 100; attempt += 1) {
        legacyId = await valor('input[name="WFRInput1109255246"]');
        if (legacyId) break;
        await page.waitForTimeout(100);
      }
      if (!legacyId) {
        throw new Error(
          `O Vínculo do Termo ${termoLegacyId}, Meta ${metaLegacyId}, não abriu.`,
        );
      }
      if (!vistos.has(legacyId)) {
        vistos.add(legacyId);
        const sim = async (selector) => (await valor(selector)).toLowerCase() === "s";
        const atividadeLegacyId = await valor('input[name="WFRInput1024887"]');
        const pessoaLegacyId = await valor('input[name="WFRInput1026352"]');
        registrarAtividadeReferenciada(
          atividadeLegacyId,
          await valor("#WFRInput1024887"),
        );
        registrarPessoaReferenciada(
          pessoaLegacyId,
          await valor("#WFRInput1026352"),
        );
        vinculos.push({
          legacyId,
          pessoaLegacyId,
          matricula: await valor("#WFRInput1024878"),
          termoLegacyId,
          metaLegacyId,
          atividadeLegacyId,
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
        if (vinculos.length % 25 === 0) {
          console.log(
            `GIW: Meta ${metaLegacyId}, ${vinculos.length} ficha(s) lida(s) até agora.`,
          );
        }
      }
      await formulario.locator('a[href="#tab1"]').click();
      await localizador.locator("#results-table").waitFor();
    }
    const nextContainer = localizador.locator("#nav-item-next");
    if ((await nextContainer.count()) !== 1) {
      concluiu = true;
      break;
    }
    const className = await nextContainer.getAttribute("class");
    if (className?.includes("disabled")) {
      concluiu = true;
      break;
    }
    const firstBefore =
      (await localizador.locator("#results-table tbody tr td").first().textContent())?.trim() ??
      "";
    await nextContainer.locator("a").click();
    let avancou = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const firstAfter =
        (await localizador.locator("#results-table tbody tr td").first().textContent())?.trim() ??
        "";
      if (firstAfter && firstAfter !== firstBefore) {
        avancou = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (!avancou) {
      throw new Error(
        `A página ${pagina + 1} de Vínculos da Meta ${metaLegacyId} não carregou.`,
      );
    }
    pagina += 1;
  }
  if (!concluiu) {
    throw new Error(`A Meta ${metaLegacyId} ultrapassou o limite de 100 páginas.`);
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
  await linhas.first().waitFor();
  const total = await linhas.count();
  if (total === 0) throw new Error("O GIW não retornou Termos para o ano selecionado.");

  const termos = [];
  const vinculos = [];
  for (let index = 0; index < total; index += 1) {
    console.log(`GIW: lendo Termo ${index + 1} de ${total}.`);
    const primeiraCelulaTermo = linhas.nth(index).locator("td").first();
    await primeiraCelulaTermo.click();
    await primeiraCelulaTermo.press("Enter");
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
      const vinculosMeta = await lerVinculos(metaWindow, legacyId, metaLegacyId);
      console.log(`GIW: Meta ${metaLegacyId}, ${vinculosMeta.length} Vínculo(s).`);
      vinculos.push(...vinculosMeta);

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
  await salvarSnapshot({
    entity: "atividades",
    formId: "464569252",
    extractedAt: timestamp,
    records: [...atividadesReferenciadas.values()].sort((a, b) =>
      a.legacyId.localeCompare(b.legacyId, "pt-BR", { numeric: true }),
    ),
    output: process.env.GIW_OUTPUT_ATIVIDADES_REFERENCIADAS,
  });
  await salvarSnapshot({
    entity: "pessoas",
    formId: "464569402",
    extractedAt: timestamp,
    records: [...pessoasReferenciadas.values()].sort((a, b) =>
      a.legacyId.localeCompare(b.legacyId, "pt-BR", { numeric: true }),
    ),
    output: process.env.GIW_OUTPUT_PESSOAS_REFERENCIADAS,
  });
} finally {
  await browser.close();
}
