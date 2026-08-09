import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  abrirMenuMovimentacao,
  abrirSessaoGiw,
  giwBaseUrl,
} from "./cliente.mjs";

const formularios = [
  { entidade: "lancamentos_eventos", formId: "464569425", menu: /lançamentos?.*eventos?/i },
  { entidade: "produtividade", formId: "464569461", menu: /produtividade/i },
  { entidade: "folhas_historicas", formId: "464569390", menu: /^folha(?:s| de pagamento)?$/i },
  { entidade: "guias_inss_historicas", formId: "464569421", menu: /(emiss[aã]o.*gps|gps)/i },
];

const output = resolve(
  process.env.GIW_OUTPUT_CONSULTAS ??
    `.private/importacoes/giw/consultas-movimentos-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);

async function clicarMenu(menu, formulario) {
  const links = menu.locator("a").filter({ hasText: formulario.menu });
  if ((await links.count()) !== 1) {
    throw new Error(`Menu de ${formulario.entidade} não foi identificado unicamente.`);
  }
  await links.click();
}

async function abrirFormulario(sistema, formId) {
  await sistema.locator(`iframe[src*="formID=${formId}"]`).waitFor();
  const formulario = sistema
    .frameLocator(`iframe[src*="formID=${formId}"]`)
    .frameLocator('iframe[name="mainform"]');
  await formulario.locator("body").waitFor();
  return formulario;
}

async function abrirConsulta(formulario) {
  const existente = formulario.locator('iframe[src^="basic_query.jsp"]');
  if ((await existente.count()) === 0) {
    const aba = formulario.getByRole("tab", { name: /localizar/i });
    if ((await aba.count()) !== 1) throw new Error("Aba Localizar não encontrada.");
    await aba.click();
  }
  const consulta = formulario.frameLocator('iframe[src^="basic_query.jsp"]');
  await consulta.locator("body").waitFor();
  return consulta;
}

async function descreverConsulta(consulta) {
  return consulta.locator("body").evaluate((body) => {
    const normalizar = (texto) => (texto ?? "").replace(/\s+/g, " ").trim();
    const visivel = (element) => {
      const estilo = window.getComputedStyle(element);
      const caixa = element.getBoundingClientRect();
      return estilo.display !== "none" && estilo.visibility !== "hidden" && caixa.width > 0;
    };
    const campos = Array.from(body.querySelectorAll("input, select, textarea, button"))
      .filter(visivel)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        name: element.getAttribute("name"),
        type: element.getAttribute("type"),
        value: "value" in element ? element.value : null,
        texto: normalizar(element.textContent),
      }));
    const rotulos = Array.from(body.querySelectorAll("label, th, legend"))
      .filter(visivel)
      .map((element) => ({
        texto: normalizar(element.textContent),
        for: element.getAttribute("for"),
      }))
      .filter((item) => item.texto);
    return { titulo: normalizar(document.title), rotulos, campos };
  });
}

const { browser, sistema, menu } = await abrirSessaoGiw();
try {
  const resultado = {
    schemaVersion: "1.0",
    mode: "READ_ONLY_QUERY_DISCOVERY",
    source: { system: "GIW", baseUrl: giwBaseUrl, extractedAt: new Date().toISOString() },
    formularios: {},
  };
  for (const item of formularios) {
    await abrirMenuMovimentacao(menu);
    await clicarMenu(menu, item);
    const formulario = await abrirFormulario(sistema, item.formId);
    const consulta = await abrirConsulta(formulario);
    resultado.formularios[item.entidade] = {
      formId: item.formId,
      consulta: await descreverConsulta(consulta),
    };
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(resultado, null, 2)}\n`, { mode: 0o600 });
  console.log(`Estrutura de consultas GIW gravada em ${output}.`);
} finally {
  await browser.close();
}
