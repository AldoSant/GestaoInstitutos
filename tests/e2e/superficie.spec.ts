import { expect, type Page, test } from "playwright/test";

const login = process.env.E2E_LOGIN;
const senha = process.env.E2E_PASSWORD;

test.skip(!login || !senha, "Defina E2E_LOGIN e E2E_PASSWORD.");

async function autenticar(page: Page) {
  await page.goto("login");
  await page.getByLabel("Login").fill(login!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
}

const paginas = [
  "/",
  "/cadastros",
  "/prestadores",
  "/vinculos",
  "/termos-e-metas",
  "/medicoes?competencia=2026-06",
  "/eventos",
  "/folhas",
  "/folhas/nova?competencia=2026-06",
  "/demonstrativos?competencia=2026-06",
  "/obrigacoes?competencia=2026-06",
  "/fgts?competencia=2026-06",
  "/fechamento-mensal?competencia=2026-06",
  "/conferencia-entre-folhas?competencia=2026-06",
  "/conferencia-entre-folhas/simulacoes?competencia=2026-06",
  "/administracao",
  "/migracoes?competencia=2026-06",
  "/parametros",
  "/ajuda",
] as const;

test("todas as páginas e seus controles básicos estão operacionais", async ({
  page,
}) => {
  await autenticar(page);
  const errosDaPagina: string[] = [];
  const destinosInternos = new Set<string>();
  const destinosComAncora = new Set<string>();
  page.on("pageerror", (erro) => errosDaPagina.push(erro.message));

  for (const caminho of paginas) {
    await test.step(caminho, async () => {
      const resposta = await page.goto(caminho);
      expect(resposta?.status(), `${caminho} não respondeu`).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.locator(".feedback-banner.error")).toHaveCount(0);

      const formularios = page.locator("form");
      for (let indice = 0; indice < (await formularios.count()); indice += 1) {
        const formulario = formularios.nth(indice);
        if (!(await formulario.isVisible())) continue;
        await expect(
          formulario.locator('button[type="submit"], input[type="submit"]'),
          `Formulário sem ação de confirmação em ${caminho}`,
        ).not.toHaveCount(0);
      }

      const botoes = page.getByRole("button");
      for (let indice = 0; indice < (await botoes.count()); indice += 1) {
        const botao = botoes.nth(indice);
        if (!(await botao.isVisible())) continue;
        const nome = await botao.evaluate((elemento) =>
          (
            elemento.getAttribute("aria-label") ??
            elemento.getAttribute("title") ??
            elemento.textContent ??
            ""
          ).trim(),
        );
        expect(nome, `Botão sem nome acessível em ${caminho}`).not.toBe("");
      }

      const linksInvalidos = await page.locator("a").evaluateAll((links) =>
        links
          .filter((link) => !link.getAttribute("href")?.trim())
          .map((link) => link.textContent?.trim() || "(sem texto)"),
      );
      expect(linksInvalidos, `Links sem destino em ${caminho}`).toEqual([]);
      const origem = new URL(page.url()).origin;
      for (const href of await page.locator("a").evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href),
      )) {
        const destino = new URL(href);
        if (destino.origin !== origem) continue;
        if (destino.hash) {
          destinosComAncora.add(destino.href);
          continue;
        }
        destinosInternos.add(destino.href);
      }
    });
  }

  for (const destino of destinosInternos) {
    const status = await page.evaluate(async (url) => {
      const resposta = await fetch(url, { credentials: "same-origin" });
      return resposta.status;
    }, destino);
    expect(
      status,
      `Link interno indisponível: ${destino}`,
    ).toBeLessThan(400);
  }
  for (const destino of destinosComAncora) {
    const resposta = await page.goto(destino);
    expect(resposta?.status(), `Link com âncora indisponível: ${destino}`).toBeLessThan(
      400,
    );
    const id = decodeURIComponent(new URL(destino).hash.slice(1));
    await expect(
      page.locator(`[id="${id}"]`),
      `Âncora inexistente: ${destino}`,
    ).toHaveCount(1);
  }
  expect(errosDaPagina, "Erros JavaScript durante a navegação").toEqual([]);
});

test("parâmetros separa consulta e publicação condicional do enquadramento", async ({
  page,
}) => {
  await autenticar(page);
  await page.goto("parametros");
  await expect(
    page.getByRole("heading", { name: "Enquadramento previdenciário" }),
  ).toBeVisible();
  await expect(page.locator("form.parameter-form")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Regime geral — Lucro Real, Presumido ou Arbitrado",
      level: 4,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Simples Nacional — Anexo IV", level: 4 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Contribuição sobre a receita bruta (CPRB)",
      level: 4,
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Publicar nova vigência" }).click();
  const formulario = page.locator("form.parameter-form");
  await expect(formulario).toBeVisible();
  await expect(formulario.locator('[name="cebasNumero"]')).toHaveCount(0);
  await formulario.locator('[name="regime"]').selectOption("BENEFICENTE_IMUNE");
  await expect(formulario.locator('[name="cebasNumero"]')).toBeVisible();
  await expect(formulario.locator('[name="cebasInicio"]')).toBeVisible();
  await expect(formulario.locator('[name="cebasFim"]')).toBeVisible();
  await formulario.locator('[name="regime"]').selectOption("SIMPLES_SUBSTITUIDA");
  await expect(formulario.locator('[name="cebasNumero"]')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const largura = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(largura.documento).toBeLessThanOrEqual(largura.viewport);
});

test("menu, títulos e URLs usam a mesma linguagem operacional", async ({ page }) => {
  await autenticar(page);
  const destinos = [
    { href: "/folhas", menu: "Folhas mensais", titulo: "Folhas mensais" },
    {
      href: "/demonstrativos",
      menu: "Demonstrativo mensal",
      titulo: "Demonstrativo mensal",
    },
    { href: "/cadastros", menu: "Cadastros", titulo: "Cadastros" },
    { href: "/termos-e-metas", menu: "Termos e metas", titulo: "Termos e metas" },
    {
      href: "/obrigacoes",
      menu: "Obrigações e guias",
      titulo: "Obrigações e guias",
    },
    {
      href: "/fechamento-mensal",
      menu: "Fechamento mensal",
      titulo: "Fechamento mensal",
    },
    {
      href: "/conferencia-entre-folhas",
      menu: "Conferência entre folhas",
      titulo: "Conferência entre folhas",
    },
  ] as const;

  for (const destino of destinos) {
    await page.goto(destino.href);
    await expect(
      page.locator(`.sidebar a.nav-link[href="${destino.href}"]`),
    ).toContainText(destino.menu);
    await expect(
      page.getByRole("heading", { level: 1, name: destino.titulo }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(destino.href);
  }

  await page.goto("/administracao");
  await expect(page.locator('a.admin-card[href="/fechamento-mensal"]')).toHaveCount(0);
  await expect(
    page.locator('a.admin-card[href="/conferencia-entre-folhas"]'),
  ).toHaveCount(0);
});

test("URLs antigas preservam a competência e redirecionam para o nome canônico", async ({
  page,
}) => {
  await autenticar(page);
  const legadas = [
    {
      antiga: "/homologacoes?competencia=2026-06",
      atual: "/fechamento-mensal?competencia=2026-06",
    },
    {
      antiga: "/consolidacoes?competencia=2026-06",
      atual: "/conferencia-entre-folhas?competencia=2026-06",
    },
    {
      antiga: "/consolidacoes/simulacoes?competencia=2026-06",
      atual: "/conferencia-entre-folhas/simulacoes?competencia=2026-06",
    },
    {
      antiga: "/instrumentos",
      atual: "/termos-e-metas",
    },
  ] as const;

  for (const rota of legadas) {
    await page.goto(rota.antiga);
    await expect(page).toHaveURL(new RegExp(`${rota.atual.replace("?", "\\?")}$`));
  }
});

test("a ficha completa da pessoa pode ser carregada e persistida", async ({
  page,
}) => {
  await autenticar(page);
  await page.goto("cadastros");
  await page.locator('a[href*="/cadastros/pessoas/"]').first().click();
  await expect(page.getByRole("heading", { name: "Dados pessoais" })).toBeVisible();

  const camposPessoa = [
    "tipo",
    "nome",
    "documento",
    "nascimento",
    "sexo",
    "rg",
    "rgOrgaoEmissor",
    "rgUf",
    "rgEmissao",
    "estadoCivil",
    "naturalidade",
    "inscricaoInss",
    "conselhoTipo",
    "conselhoNumero",
    "aposentado",
    "cnh",
    "cnhCategoria",
    "cnhValidade",
    "nomeFantasia",
    "representanteLegal",
    "inscricaoMunicipal",
    "inscricaoEstadual",
    "email",
    "telefone",
    "celular",
    "celularAlternativo",
    "papelPrestador",
    "papelParceiro",
    "papelFornecedor",
  ];
  const formularioPessoa = page.locator("#identidade form");
  for (const campo of camposPessoa) {
    await expect(formularioPessoa.locator(`[name="${campo}"]`)).toBeEditable();
  }
  await formularioPessoa.getByRole("button", { name: "Salvar dados pessoais" }).click();
  await expect(page.getByText("Dados pessoais atualizados.")).toBeVisible();

  const formularioEndereco = page.locator("#endereco form");
  for (const campo of [
    "cep",
    "logradouro",
    "numero",
    "bairro",
    "municipio",
    "complemento",
    "referencia",
  ]) {
    await expect(formularioEndereco.locator(`[name="${campo}"]`)).toBeEditable();
  }
  await formularioEndereco.getByRole("button", { name: "Salvar endereço" }).click();
  await expect(page.getByText("Endereço atualizado.")).toBeVisible();

  const formularioConta = page.locator("#pagamento form");
  for (const campo of ["tipo", "agencia", "numero", "digito", "variacao"]) {
    await expect(formularioConta.locator(`[name="${campo}"]`)).toBeEditable();
  }
  await formularioConta.getByRole("button", { name: "Salvar conta" }).click();
  await expect(page.getByText("Conta bancária atualizada.")).toBeVisible();

  await page.locator('#dependentes a[href*="dependente="]').first().click();
  const formularioDependente = page.locator("#dependentes form.crud-form");
  for (const campo of [
    "nome",
    "cpf",
    "nascimento",
    "parentesco",
    "estudante",
    "baixaSalarioFamilia",
    "baixaIrrf",
  ]) {
    await expect(formularioDependente.locator(`[name="${campo}"]`)).toBeEditable();
  }
  await formularioDependente
    .getByRole("button", { name: "Salvar dependente" })
    .click();
  await expect(page.getByText("Dependente atualizado.")).toBeVisible();
});

test("os cadastros operacionais existentes podem ser abertos e salvos", async ({
  page,
}) => {
  await autenticar(page);
  const edicoes = [
    {
      pagina: "/cadastros",
      destino: 'a[href*="editar=atividade:"]',
      salvar: "Salvar atividade",
    },
    {
      pagina: "/cadastros",
      destino: 'a[href*="editar=lotacao:"]',
      salvar: "Salvar lotação",
    },
    {
      pagina: "/prestadores",
      destino: 'a[href*="editar="]',
      salvar: "Salvar prestador",
    },
    {
      pagina: "/vinculos",
      destino: 'a[href*="editar="]',
      salvar: "Salvar vínculo",
    },
    {
      pagina: "/termos-e-metas",
      destino: 'a[href*="editar=termo:"]',
      salvar: "Salvar termo",
    },
    {
      pagina: "/termos-e-metas",
      destino: 'a[href*="editar=meta:"]',
      salvar: "Salvar meta",
    },
    {
      pagina: "/eventos",
      destino: 'a[href*="editarEvento="]',
      salvar: "Salvar Evento",
    },
    {
      pagina: "/eventos",
      destino: 'a[href*="editarRecorrente="]',
      salvar: "Salvar recorrência",
    },
  ] as const;

  for (const edicao of edicoes) {
    await test.step(edicao.salvar, async () => {
      await page.goto(edicao.pagina);
      const link = page.locator(edicao.destino).first();
      await expect(link).toBeVisible();
      await link.click();

      const botao = page.getByRole("button", {
        name: edicao.salvar,
        exact: true,
      });
      await expect(botao).toBeVisible();
      const formulario = page.locator("form.crud-form").filter({ has: botao });
      await expect(formulario).toHaveCount(1);

      const campos = formulario.locator(
        'input:not([type="hidden"]), select, textarea',
      );
      for (let indice = 0; indice < (await campos.count()); indice += 1) {
        await expect(
          campos.nth(indice),
          `Campo bloqueado na ação ${edicao.salvar}`,
        ).toBeEditable();
      }
      const obrigatorios = formulario.locator("[required]");
      for (let indice = 0; indice < (await obrigatorios.count()); indice += 1) {
        const campo = obrigatorios.nth(indice);
        if ((await campo.inputValue()) === "") {
          expect(
            await campo.evaluate((elemento) => elemento.tagName),
            `Campo textual obrigatório sem valor em ${edicao.salvar}`,
          ).toBe("SELECT");
          const primeiraOpcao = await campo
            .locator('option:not([disabled]):not([value=""])')
            .first()
            .getAttribute("value");
          expect(
            primeiraOpcao,
            `Cadastro sem opção válida para corrigir ${edicao.salvar}`,
          ).toBeTruthy();
          await campo.selectOption(primeiraOpcao!);
        }
        await expect(campo).not.toHaveValue("");
      }

      await botao.click();
      await expect(page.locator(".feedback-banner.success")).toBeVisible();
      await expect(page.locator(".feedback-banner.error")).toHaveCount(0);
    });
  }
});
