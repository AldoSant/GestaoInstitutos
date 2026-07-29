import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  abrirMenuCadastro,
  abrirMenuMovimentacao,
  abrirSessaoGiw,
  giwBaseUrl,
} from "./cliente.mjs";

const formularios = [
  {
    entity: "eventos",
    formId: "8716",
    menu: /(^eventos?$|rubricas?)/i,
    section: "cadastro",
  },
  {
    entity: "lancamentos_eventos",
    formId: "464569425",
    menu: /lançamentos?.*eventos?/i,
    section: "movimentacao",
  },
  {
    entity: "produtividade",
    formId: "464569461",
    menu: /produtividade/i,
    section: "movimentacao",
  },
  {
    entity: "folhas_historicas",
    formId: "464569390",
    menu: /^folha(?:s| de pagamento)?$/i,
    section: "movimentacao",
  },
  {
    entity: "guias_inss_historicas",
    formId: "464569421",
    menu: /(emiss[aã]o.*gps|gps)/i,
    section: "movimentacao",
  },
];
const timestamp = new Date().toISOString();
const output = resolve(
  process.env.GIW_OUTPUT_HISTORICO ??
    `.private/importacoes/giw/mapeamento-historico-${timestamp.replace(/[:.]/g, "-")}.json`,
);
const limitePaginas = Number(process.env.GIW_MAP_MAX_PAGES ?? "200");
const limiteDetalhes = Number(process.env.GIW_MAP_MAX_DETAILS ?? "5");

if (!Number.isSafeInteger(limitePaginas) || limitePaginas < 1) {
  throw new Error("GIW_MAP_MAX_PAGES deve ser um inteiro positivo.");
}
if (!Number.isSafeInteger(limiteDetalhes) || limiteDetalhes < 0 || limiteDetalhes > 50) {
  throw new Error("GIW_MAP_MAX_DETAILS deve estar entre 0 e 50.");
}

async function checkpoint(state) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function estadoInicial() {
  if (process.env.GIW_RESUME !== "true") {
    return {
      schemaVersion: "1.0",
      source: { system: "GIW", baseUrl: giwBaseUrl, extractedAt: timestamp },
      mode: "READ_ONLY_DISCOVERY",
      forms: {},
    };
  }
  const anterior = JSON.parse(await readFile(output, "utf8"));
  if (anterior.mode !== "READ_ONLY_DISCOVERY" || typeof anterior.forms !== "object") {
    throw new Error("O checkpoint não é um mapeamento histórico do GIW.");
  }
  return anterior;
}

async function clicarMenu(menu, form) {
  const links = menu.locator("a").filter({ hasText: form.menu });
  const total = await links.count();
  if (total !== 1) {
    const candidatos = await menu.locator("a").allTextContents();
    throw new Error(
      `Menu do formulário ${form.formId} não foi identificado de forma única (${total}). ` +
        `Candidatos visíveis: ${candidatos.map((item) => item.trim()).filter(Boolean).join(" | ")}`,
    );
  }
  await links.click();
}

async function abrirSubmenuTabelas(menu) {
  const submenu = menu.locator("#MenuLateralGamma-submenu-1745586");
  const className = await submenu.getAttribute("class");
  if (!className?.includes("show")) {
    await menu.locator('a[href="#MenuLateralGamma-submenu-1745586"]').click();
  }
}

async function localizarFormulario(sistema, formId) {
  const janela = sistema.locator(`iframe[src*="formID=${formId}"]`);
  await janela.waitFor();
  const formulario = sistema
    .frameLocator(`iframe[src*="formID=${formId}"]`)
    .frameLocator('iframe[name="mainform"]');
  await formulario.locator("body").waitFor();
  return formulario;
}

async function abrirLocalizador(formulario) {
  const consulta = formulario.frameLocator('iframe[src^="basic_query.jsp"]');
  if ((await formulario.locator('iframe[src^="basic_query.jsp"]').count()) === 1) {
    await consulta.locator("#results-table").waitFor();
    await page.waitForTimeout(1_000);
    return consulta;
  }
  const tab = formulario.getByRole("tab", { name: /localizar/i });
  if ((await tab.count()) === 0) return null;
  if ((await tab.count()) !== 1) throw new Error("A aba Localizar é ambígua.");
  await tab.click();
  await consulta.locator("#results-table").waitFor();
  await page.waitForTimeout(1_000);
  return consulta;
}

async function descreverFormulario(formulario) {
  return formulario.locator("body").evaluate((body) => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
    };
    const labels = Array.from(body.querySelectorAll("label"))
      .filter(visible)
      .map((label) => ({
        text: (label.textContent ?? "").replace(/\s+/g, " ").trim(),
        for: label.getAttribute("for"),
      }))
      .filter((label) => label.text);
    const fields = Array.from(body.querySelectorAll("input, select, textarea"))
      .filter(visible)
      .map((field) => ({
        tag: field.tagName.toLowerCase(),
        id: field.id || null,
        name: field.getAttribute("name"),
        type: field.getAttribute("type"),
        value:
          field instanceof HTMLSelectElement
            ? field.value
            : field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
              ? field.value
              : null,
        selectedText:
          field instanceof HTMLSelectElement
            ? field.selectedOptions[0]?.textContent?.trim() ?? null
            : null,
      }));
    const tabs = Array.from(body.querySelectorAll('[role="tab"], a[href^="#tab"]'))
      .filter(visible)
      .map((tab) => ({
        text: (tab.textContent ?? "").replace(/\s+/g, " ").trim(),
        id: tab.id || null,
        href: tab.getAttribute("href"),
      }));
    const grids = Array.from(body.querySelectorAll("table"))
      .filter(visible)
      .map((table) => ({
        id: table.id || null,
        headers: Array.from(table.querySelectorAll("thead th"), (cell) =>
          (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
        ),
        rows: Array.from(table.querySelectorAll("tbody tr"))
          .slice(0, 10)
          .map((row) =>
            Array.from(row.querySelectorAll("td"), (cell) =>
              (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
            ),
          ),
      }))
      .filter((grid) => grid.headers.length > 0 || grid.rows.length > 0);
    return { labels, fields, tabs, grids };
  });
}

async function lerPagina(consulta) {
  return consulta.locator("body").evaluate((body) => {
    const table =
      body.querySelector("#results-table") ??
      Array.from(body.querySelectorAll("table")).find((candidate) =>
        candidate.querySelector("tbody tr"),
      );
    if (!table) return { headers: [], rows: [] };
    return {
      headers: Array.from(table.querySelectorAll("thead th"), (cell) =>
        (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
      ),
      rows: Array.from(table.querySelectorAll("tbody tr"))
        .map((row) =>
          Array.from(row.querySelectorAll("td"), (cell) =>
            (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
          ),
        )
        .filter((row) => row.some(Boolean)),
    };
  });
}

async function proximaPagina(consulta) {
  const next = consulta.locator("#nav-item-next");
  if ((await next.count()) !== 1) return false;
  const className = await next.getAttribute("class");
  if (className?.includes("disabled")) return false;
  const firstBefore =
    (await consulta.locator("#results-table tbody tr").first().textContent())?.trim() ?? "";
  await next.locator("a").click();
  await consulta
    .locator("#results-table tbody tr")
    .first()
    .waitFor({ state: "visible" });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const firstAfter =
      (await consulta.locator("#results-table tbody tr").first().textContent())?.trim() ?? "";
    if (firstAfter && firstAfter !== firstBefore) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("A paginação do localizador não respondeu.");
}

const state = await estadoInicial();
const { browser, page, sistema, menu } = await abrirSessaoGiw();
try {
  for (const form of formularios) {
    if (state.forms[form.entity]?.completed) continue;
    if (form.section === "cadastro") {
      await abrirMenuCadastro(menu);
      if (form.entity === "eventos") await abrirSubmenuTabelas(menu);
    } else await abrirMenuMovimentacao(menu);
    await clicarMenu(menu, form);
    const formulario = await localizarFormulario(sistema, form.formId);
    const formState = state.forms[form.entity] ?? {
      formId: form.formId,
      completed: false,
      pages: [],
      details: [],
    };
    formState.structure = await descreverFormulario(formulario);
    const consulta = await abrirLocalizador(formulario);
    if (!consulta) {
      formState.completed = true;
      state.forms[form.entity] = formState;
      await checkpoint(state);
      continue;
    }
    let pageNumber = formState.pages.length + 1;
    for (let skip = 1; skip < pageNumber; skip += 1) {
      if (!(await proximaPagina(consulta))) {
        throw new Error(`O formulário ${form.formId} terminou antes da página ${pageNumber}.`);
      }
    }
    while (pageNumber <= limitePaginas) {
      const pageData = await lerPagina(consulta);
      if (pageData.rows.length === 0) {
        formState.completed = true;
        break;
      }
      formState.pages.push({ number: pageNumber, ...pageData });
      state.forms[form.entity] = formState;
      await checkpoint(state);

      if (formState.details.length < limiteDetalhes) {
        const rows = consulta.locator("#results-table tbody tr");
        const max = Math.min(
          await rows.count(),
          limiteDetalhes - formState.details.length,
        );
        for (let index = 0; index < max; index += 1) {
          await rows.nth(index).dblclick();
          await formulario
            .locator("input:visible, select:visible, textarea:visible")
            .first()
            .waitFor();
          formState.details.push(await descreverFormulario(formulario));
          const localizar = formulario.getByRole("tab", { name: /localizar/i });
          if ((await localizar.count()) === 1) await localizar.click();
        }
        await checkpoint(state);
      }
      if (!(await proximaPagina(consulta))) {
        formState.completed = true;
        break;
      }
      pageNumber += 1;
    }
    if (!formState.completed && pageNumber > limitePaginas) {
      throw new Error(`O formulário ${form.formId} excedeu ${limitePaginas} páginas.`);
    }
    state.forms[form.entity] = formState;
    await checkpoint(state);
  }
  console.log(`Mapeamento histórico somente leitura gravado em ${output}.`);
} finally {
  await browser.close();
}
