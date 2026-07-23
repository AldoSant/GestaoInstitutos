import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  if (process.env.GIW_RESUME === "true" && process.env.GIW_OUTPUT) {
    const anterior = JSON.parse(await readFile(resolve(process.env.GIW_OUTPUT), "utf8"));
    if (anterior.entity !== "pessoas" || !Array.isArray(anterior.records)) {
      throw new Error("O checkpoint informado não é um snapshot de Pessoas.");
    }
    for (const record of anterior.records) {
      if (!record.legacyId || seen.has(String(record.legacyId))) continue;
      seen.add(String(record.legacyId));
      records.push(record);
    }
  }
  let pageNumber = Math.floor(records.length / 100) + 1;
  let completed = false;
  const valor = async (selector) =>
    ((await formularioPessoa.locator(selector).inputValue().catch(() => "")) ?? "").trim();
  const marcado = async (selector) =>
    formularioPessoa.locator(selector).isChecked().catch(() => false);
  const normalizarConta = (value) =>
    value === "c" ? "CORRENTE" : value === "p" ? "POUPANCA" : null;
  const salvarCheckpoint = () =>
    salvarSnapshot({
      entity: "pessoas",
      formId: "464569402",
      extractedAt: timestamp,
      records,
      output: process.env.GIW_OUTPUT,
    });
  const avancarPagina = async (numeroDestino) => {
    const firstBefore =
      (await consulta.locator("#results-table tbody tr td").first().textContent())?.trim() ?? "";
    const nextContainer = consulta.locator("#nav-item-next");
    const className = await nextContainer.getAttribute("class");
    if (className?.includes("disabled")) {
      throw new Error(`O GIW terminou antes da página ${numeroDestino}.`);
    }
    await nextContainer.locator("a").click();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const firstAfter =
        (await consulta.locator("#results-table tbody tr td").first().textContent())?.trim() ?? "";
      if (firstAfter && firstAfter !== firstBefore) return;
      await page.waitForTimeout(100);
    }
    throw new Error(`A página ${numeroDestino} não carregou.`);
  };

  if (pageNumber > 1) {
    console.log(
      `GIW: retomando com ${records.length} pessoa(s), avançando até a página ${pageNumber}.`,
    );
    for (let pagina = 2; pagina <= pageNumber; pagina += 1) {
      await avancarPagina(pagina);
    }
  }

  while (pageNumber <= 100) {
    const linhas = consulta.locator("#results-table tbody tr");
    const rows = await linhas.evaluateAll((elements) =>
      elements.map((row) =>
        Array.from(row.querySelectorAll("td"), (cell) => (cell.textContent ?? "").trim()),
      ),
    );

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const [legacyId, nomeResumo, cpfResumo, cnpjResumo] = rows[rowIndex];
      if (!legacyId || seen.has(legacyId)) continue;
      seen.add(legacyId);

      await linhas.nth(rowIndex).dblclick();
      let abriuRegistro = false;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        if ((await valor("#WFRInput1025566")) === legacyId) {
          abriuRegistro = true;
          break;
        }
        await page.waitForTimeout(100);
      }
      if (!abriuRegistro) {
        throw new Error(
          `A Pessoa ${legacyId} não abriu para coleta completa (código exibido: ${
            (await valor("#WFRInput1025566")) || "vazio"
          }).`,
        );
      }

      const tipo = await formularioPessoa.locator("select").nth(0).inputValue();
      const sexo = await formularioPessoa.locator("select").nth(1).inputValue();
      const tipoConta = await formularioPessoa.locator("select").nth(2).inputValue();
      const nome = (await valor("#WFRInput1025567")) || nomeResumo;
      const cpf = (await valor("#WFRInput1025088")) || cpfResumo || null;
      const cnpj = (await valor("#WFRInput1025165")) || cnpjResumo || null;

      const abaDependentes = formularioPessoa.getByRole("tab", {
        name: "Dependentes",
        exact: true,
      });
      let dependentes = [];
      if ((await abaDependentes.count()) === 1) {
        await abaDependentes.click();
        dependentes = await formularioPessoa
          .locator('tr[role="listitem"]:visible')
          .evaluateAll((elements) =>
            elements.map((row) => {
              const cells = Array.from(row.querySelectorAll("td")).map((cell) => ({
                text: (cell.textContent ?? "").replace(/\u00a0/g, " ").trim(),
                checked: Boolean(cell.querySelector(".checkboxTrue, input:checked")),
              }));
              const dados = cells.slice(-7);
              const [nome, nascimento, parentesco, estudante, cpf, baixaSf, baixaIrrf] = dados;
              return {
                origemLegacyKey:
                  cpf?.text ||
                  `${nome?.text ?? ""}|${nascimento?.text ?? ""}|${parentesco?.text ?? ""}`,
                nome: nome?.text ?? "",
                nascimento: nascimento?.text || null,
                parentesco: parentesco?.text || null,
                estudante: estudante?.checked || estudante?.text.toLowerCase() === "sim",
                cpf: cpf?.text || null,
                baixaSalarioFamilia: baixaSf?.text || null,
                baixaIrrf: baixaIrrf?.text || null,
              };
            }),
          );
      }

      records.push({
        legacyId,
        dadosCompletos: true,
        nome,
        tipo: tipo === "j" ? "JURIDICA" : "FISICA",
        cpf: cpf || null,
        cnpj: cnpj || null,
        sexo: sexo === "m" ? "MASCULINO" : sexo === "f" ? "FEMININO" : null,
        nascimento: (await valor("#WFRInput1025087")) || null,
        rg: (await valor("#WFRInput1025089")) || null,
        rgOrgaoEmissor: (await valor("#WFRInput1025091")) || null,
        rgUf: (await valor("#WFRInput1025092")) || null,
        rgEmissao: (await valor("#WFRInput1025090")) || null,
        estadoCivil: (await valor("#WFRInput1025093")) || null,
        naturalidade: (await valor("#WFRInput1025576")) || null,
        inscricaoInss: (await valor("#WFRInput1025095")) || null,
        conselhoTipo: (await valor("#WFRInput1025096")) || null,
        conselhoNumero: (await valor("#WFRInput1025097")) || null,
        aposentado: await marcado("#prestadorAposentado-checkbox"),
        cnh: (await valor("#WFRInput1025577")) || null,
        cnhCategoria: (await valor("#WFRInput1025578")) || null,
        cnhValidade: (await valor("#WFRInput1025579")) || null,
        nomeFantasia: (await valor("#WFRInput1025164")) || null,
        representanteLegal: (await valor("#WFRInput1025168")) || null,
        inscricaoMunicipal: (await valor("#WFRInput1025167")) || null,
        inscricaoEstadual: (await valor("#WFRInput1025166")) || null,
        papelPrestador: await marcado("#EDTPES_ASSOCIADO-checkbox"),
        papelParceiro: await marcado("#EDTPES_PARCEIRO-checkbox"),
        papelFornecedor: await marcado("#fornecedor-checkbox"),
        email: (await valor("#WFRInput1025078")) || null,
        telefone: (await valor("#WFRInput1025079")) || null,
        celular: (await valor("#WFRInput1025080")) || null,
        celularAlternativo: (await valor("#WFRInput1025081")) || null,
        endereco: {
          cep: (await valor("#WFRInput1025073")) || null,
          logradouro: (await valor("#WFRInput1025069")) || null,
          numero: (await valor("#WFRInput1025070")) || null,
          bairro: (await valor("#WFRInput1025074")) || null,
          municipio: (await valor("#WFRInput1025075")) || null,
          municipioLegacyId:
            (await valor('input[name="WFRInput1025075"]')) || null,
          complemento: (await valor("#WFRInput1025071")) || null,
          referencia: (await valor("#WFRInput1025072")) || null,
        },
        contaBancaria: {
          agenciaLegacyId:
            (await valor('input[name="WFRInput1025584"]')) || null,
          agencia: (await valor("#WFRInput1025584")) || null,
          numero: (await valor("#WFRInput1025585")) || null,
          digito: (await valor("#WFRInput1025586")) || null,
          variacao: (await valor("#WFRInput1025587")) || null,
          tipo: normalizarConta(tipoConta),
        },
        dependentes,
      });
      if (records.length % 25 === 0) await salvarCheckpoint();

      await formularioPessoa.getByRole("tab", { name: "Localizar", exact: true }).click();
    }

    console.log(`GIW: página ${pageNumber}, ${records.length} pessoa(s) coletada(s).`);
    await salvarCheckpoint();
    const nextContainer = consulta.locator("#nav-item-next");
    const className = await nextContainer.getAttribute("class");
    if (className?.includes("disabled")) {
      completed = true;
      break;
    }

    await avancarPagina(pageNumber + 1);
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
