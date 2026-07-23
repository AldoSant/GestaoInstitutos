import { abrirMenuCadastro, abrirSessaoGiw, salvarSnapshot } from "./cliente.mjs";

const timestamp = new Date().toISOString();
const { browser, sistema, menu } = await abrirSessaoGiw();

async function lerGrid(formId) {
  const janela = sistema.locator(`iframe[src*="formID=${formId}"]`);
  await janela.waitFor();
  const formulario = sistema
    .frameLocator(`iframe[src*="formID=${formId}"]`)
    .frameLocator('iframe[name="mainform"]');
  const rows = await formulario.locator('tr[role="listitem"]').evaluateAll((elements) =>
    elements.map((row) => ({
      cells: Array.from(row.querySelectorAll("td"), (cell) =>
        (cell.textContent ?? "").replace(/\u00a0/g, " ").trim(),
      ),
      ativo: Boolean(row.querySelector(".checkboxTrue")),
    })),
  );
  if (rows.length === 0) throw new Error(`O formulário ${formId} não retornou registros.`);
  return rows;
}

try {
  await abrirMenuCadastro(menu);

  await menu.locator("#MenuLateralGamma-item-1356098").click();
  const atividadeRows = await lerGrid("464569252");
  const atividades = atividadeRows.map(({ cells, ativo }) => {
    if (cells.length < 5) throw new Error("Grid de Atividades com colunas inesperadas.");
    return {
      legacyId: cells[0],
      descricao: cells[1],
      cargaHoraria: cells[2] || null,
      valor: cells[3] || null,
      ativo,
    };
  });
  await salvarSnapshot({
    entity: "atividades",
    formId: "464569252",
    extractedAt: timestamp,
    records: atividades,
    output: process.env.GIW_OUTPUT_ATIVIDADES,
  });

  await menu.locator("#MenuLateralGamma-item-1932490").click();
  const lotacaoRows = await lerGrid("464569449");
  const lotacoes = lotacaoRows.map(({ cells, ativo }) => {
    if (cells.length < 3) throw new Error("Grid de Lotações com colunas inesperadas.");
    return { legacyId: cells[0], descricao: cells[1], ativo };
  });
  await salvarSnapshot({
    entity: "lotacoes",
    formId: "464569449",
    extractedAt: timestamp,
    records: lotacoes,
    output: process.env.GIW_OUTPUT_LOTACOES,
  });
} finally {
  await browser.close();
}
