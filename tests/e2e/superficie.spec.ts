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
  "/obrigacoes?competencia=2026-06",
  "/ajuda",
] as const;

test("todas as páginas e seus controles básicos estão operacionais", async ({
  page,
}) => {
  test.setTimeout(90_000);
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

      const formulariosSemAcao = await page.locator("form").evaluateAll((formularios) =>
        formularios
          .filter((formulario) => {
            const estilo = getComputedStyle(formulario);
            const visivel =
              estilo.display !== "none" &&
              estilo.visibility !== "hidden" &&
              formulario.getClientRects().length > 0;
            if (!visivel) return false;
            const temCampoEditavel = formulario.querySelector(
              'input:not([type="hidden"]), select, textarea',
            );
            return (
              Boolean(temCampoEditavel) &&
              !formulario.querySelector('button[type="submit"], input[type="submit"]')
            );
          })
          .map((formulario) => formulario.getAttribute("id") || formulario.className || "(sem identificação)"),
      );
      expect(formulariosSemAcao, `Formulário sem ação de confirmação em ${caminho}`).toEqual([]);

      const botoesSemNome = await page.getByRole("button").evaluateAll((botoes) =>
        botoes
          .filter((botao) => {
            const estilo = getComputedStyle(botao);
            const visivel =
              estilo.display !== "none" &&
              estilo.visibility !== "hidden" &&
              botao.getClientRects().length > 0;
            if (!visivel) return false;
            return !(
              botao.getAttribute("aria-label") ??
              botao.getAttribute("title") ??
              botao.textContent ??
              ""
            ).trim();
          })
          .map((botao) => botao.outerHTML.slice(0, 200)),
      );
      expect(botoesSemNome, `Botão sem nome acessível em ${caminho}`).toEqual([]);

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

  const destinosRepresentativos = new Map<string, string>();
  for (const destino of destinosInternos) {
    const url = new URL(destino);
    const rotaNormalizada = url.pathname
      .replace(/\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, "/:id")
      .replace(/\/\d+/g, "/:id");
    const chave = `${rotaNormalizada}${url.searchParams.has("competencia") ? "?competencia" : ""}`;
    if (!destinosRepresentativos.has(chave)) {
      destinosRepresentativos.set(chave, destino);
    }
  }
  const respostasInternas = await page.evaluate(async (destinos) =>
    Promise.all(
      destinos.map(async (url) => ({
        url,
        status: (await fetch(url, { credentials: "same-origin" })).status,
      })),
    ),
  [...destinosRepresentativos.values()]);
  for (const { url, status } of respostasInternas) {
    expect(
      status,
      `Link interno indisponível: ${url}`,
    ).toBeLessThan(400);
  }
  const ancorasRepresentativas = new Map<string, string>();
  for (const destino of destinosComAncora) {
    const url = new URL(destino);
    const rotaNormalizada = url.pathname
      .replace(/\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, "/:id")
      .replace(/\/\d+/g, "/:id");
    const chave = `${rotaNormalizada}#${url.hash}`;
    if (!ancorasRepresentativas.has(chave)) {
      ancorasRepresentativas.set(chave, destino);
    }
  }
  for (const destino of ancorasRepresentativas.values()) {
    await page.goto(destino);
    const id = decodeURIComponent(new URL(destino).hash.slice(1));
    await expect(
      page.locator(`[id="${id}"]`),
      `Âncora inexistente: ${destino}`,
    ).toHaveCount(1);
  }
  expect(errosDaPagina, "Erros JavaScript durante a navegação").toEqual([]);
});

test("módulos técnicos e paralelos ficam fora da superfície operacional", async ({
  page,
}) => {
  await autenticar(page);
  for (const rota of [
    "/administracao",
    "/demonstrativos?competencia=2026-06",
    "/fechamento-mensal?competencia=2026-06",
    "/fgts",
    "/migracoes?competencia=2026-06",
    "/parametros",
  ]) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByText("Módulo fora da rotina atual")).toBeVisible();
  }
});

test("menu, títulos e URLs usam a mesma linguagem operacional", async ({ page }) => {
  await autenticar(page);
  const destinos = [
    { href: "/folhas", menu: "Folha mensal", titulo: "Folha mensal" },
    { href: "/cadastros", menu: "Cadastros", titulo: "Cadastros" },
    { href: "/termos-e-metas", menu: "Termos e metas", titulo: "Termos e metas" },
    {
      href: "/obrigacoes",
      menu: "Obrigações e GPS",
      titulo: "Obrigações e GPS",
    },
  ] as const;

  for (const destino of destinos) {
    await page.goto(destino.href);
    await expect(
      page.locator(`.quiet-navigation a.nav-link[href="${destino.href}"]`),
    ).toContainText(destino.menu);
    await expect(
      page.getByRole("heading", { level: 1, name: destino.titulo }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(destino.href);
  }
});

test("URLs antigas preservam a competência e redirecionam para o nome canônico", async ({
  page,
}) => {
  await autenticar(page);
  const legadas = [
    {
      antiga: "/homologacoes?competencia=2026-06",
      atual: "/?aviso=modulo-reservado",
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
