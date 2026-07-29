import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import pg, { type PoolClient } from "pg";
import {
  construirExpectativaMigracaoGiw,
  formatarCentavos,
  type ChaveMigracaoGiwEsperada,
} from "../../lib/auditoria-migracao-giw";
import {
  checksum,
  validarSnapshotGiw,
  type GiwSnapshot,
} from "../../lib/importacao-giw";
import { validarIntegridadeLoteGiw } from "../../lib/integridade-lote-giw";

const { Pool } = pg;
const LIMITE_ARQUIVOS = 100;
const LIMITE_ARQUIVO = 50 * 1024 * 1024;

type Problema = {
  codigo: string;
  detalhe: string;
};

type Aviso = Problema;

type ChaveBanco = {
  entidade: string;
  legacy_id: string;
  destino_tabela: string;
  destino_id: string;
  checksum: string;
};

type ExecucaoBanco = {
  entidade: string;
  checksum_arquivo: string;
  modo: string;
  status: string;
  total_lidos: number;
  total_inseridos: number;
  total_atualizados: number;
  total_ignorados: number;
  total_erros: number;
  iniciado_em: Date;
};

type ResumoFinanceiroBanco = {
  competencia: string;
  folhas: number;
  itens_folha: number;
  rubricas: number;
  guias: number;
  proventos: string;
  descontos: string;
  liquido: string;
  base_inss: string;
  inss: string;
  guias_total: string;
};

function argumentos(args: string[], nome: string) {
  return args.flatMap((valor, indice) =>
    valor === nome && args[indice + 1] ? [args[indice + 1]] : [],
  );
}

function argumento(args: string[], nome: string) {
  return argumentos(args, nome)[0];
}

async function resolverEmpresa(
  client: PoolClient,
  empresaId: string | undefined,
) {
  if (empresaId) {
    const resultado = await client.query<{ id: string }>(
      "select id from empresa where id = $1 and ativo = true",
      [empresaId],
    );
    if (resultado.rowCount !== 1) {
      throw new Error("Empresa não encontrada ou inativa.");
    }
    return resultado.rows[0].id;
  }
  const resultado = await client.query<{ id: string }>(
    "select id from empresa where ativo = true order by criado_em limit 2",
  );
  if (resultado.rowCount !== 1) {
    throw new Error(
      "Informe --empresa-id quando não houver exatamente uma empresa ativa.",
    );
  }
  return resultado.rows[0].id;
}

async function carregarSnapshots(args: string[]) {
  const arquivos = argumentos(args, "--arquivo").map((item) => resolve(item));
  for (const diretorioInformado of argumentos(args, "--diretorio")) {
    const diretorio = resolve(diretorioInformado);
    const nomes = (await readdir(diretorio))
      .filter((nome) => nome.toLowerCase().endsWith(".json"))
      .sort();
    arquivos.push(...nomes.map((nome) => resolve(diretorio, nome)));
  }
  if (arquivos.length === 0 || arquivos.length > LIMITE_ARQUIVOS) {
    throw new Error(`Informe entre 1 e ${LIMITE_ARQUIVOS} snapshots.`);
  }

  const snapshots: GiwSnapshot[] = [];
  for (const arquivo of arquivos) {
    const informacao = await stat(arquivo);
    if (!informacao.isFile() || informacao.size <= 0 || informacao.size > LIMITE_ARQUIVO) {
      throw new Error(`Snapshot ausente, vazio ou maior que 50 MB: ${arquivo}`);
    }
    const validacao = validarSnapshotGiw(
      JSON.parse(await readFile(arquivo, "utf8")),
    );
    if (!validacao.snapshot) {
      throw new Error(
        `Snapshot inválido (${basename(arquivo)}): ${validacao.issues.length} pendência(s).`,
      );
    }
    snapshots.push(validacao.snapshot);
  }
  const integridade = validarIntegridadeLoteGiw(snapshots);
  if (integridade.length > 0) {
    throw new Error(
      `Lote inválido: ${integridade.length} chave(s) duplicada(s) ou dependência(s) ausente(s).`,
    );
  }
  return snapshots;
}

function chaveId(chave: { entidade: string; legacyId?: string; legacy_id?: string }) {
  return `${chave.entidade}/${chave.legacyId ?? chave.legacy_id}`;
}

async function validarEstrutura(client: PoolClient, problemas: Problema[]) {
  const colunas = await client.query<{ tabela: string; coluna: string }>(
    `select table_name tabela, column_name coluna
       from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'legado_folha_item' and column_name = 'cnpj')
          or (
            table_name = 'legado_guia_inss'
            and column_name in ('pessoa_legacy_id', 'beneficiario_nome', 'lote')
          )
        )`,
  );
  const encontradas = new Set(
    colunas.rows.map((item) => `${item.tabela}.${item.coluna}`),
  );
  for (const coluna of [
    "legado_folha_item.cnpj",
    "legado_guia_inss.pessoa_legacy_id",
    "legado_guia_inss.beneficiario_nome",
    "legado_guia_inss.lote",
  ]) {
    if (!encontradas.has(coluna)) {
      problemas.push({
        codigo: "MIGRACAO_SQL_AUSENTE",
        detalhe: `A coluna ${coluna} não existe; execute npm run db:migrate.`,
      });
    }
  }
}

async function carregarChaves(
  client: PoolClient,
  empresaId: string,
  entidades: string[],
) {
  const resultado = await client.query<ChaveBanco>(
    `select entidade, legacy_id, destino_tabela, destino_id, checksum
       from legado_chave
      where empresa_id = $1 and origem = 'GIW'
        and entidade = any($2::text[])`,
    [empresaId, entidades],
  );
  return resultado.rows;
}

async function destinosExistentes(
  client: PoolClient,
  empresaId: string,
  chaves: ChaveBanco[],
) {
  const consultas: Record<string, string> = {
    pessoa: "select id from pessoa where empresa_id = $1 and id = any($2::uuid[])",
    atividade:
      "select id from atividade where empresa_id = $1 and id = any($2::uuid[])",
    lotacao: "select id from lotacao where empresa_id = $1 and id = any($2::uuid[])",
    termo: "select id from termo where empresa_id = $1 and id = any($2::uuid[])",
    termo_meta:
      "select tm.id from termo_meta tm join termo t on t.id = tm.termo_id where t.empresa_id = $1 and tm.id = any($2::uuid[])",
    prestador_vinculo:
      "select id from prestador_vinculo where empresa_id = $1 and id = any($2::uuid[])",
    evento: "select id from evento where empresa_id = $1 and id = any($2::uuid[])",
    lancamento_evento_recorrente:
      "select id from lancamento_evento_recorrente where empresa_id = $1 and id = any($2::uuid[])",
    medicao_mensal:
      "select id from medicao_mensal where empresa_id = $1 and id = any($2::uuid[])",
    legado_folha:
      "select id from legado_folha where empresa_id = $1 and id = any($2::uuid[])",
    legado_guia_inss:
      "select id from legado_guia_inss where empresa_id = $1 and id = any($2::uuid[])",
  };
  const existentes = new Set<string>();
  for (const [tabela, consulta] of Object.entries(consultas)) {
    const ids = chaves
      .filter((chave) => chave.destino_tabela === tabela)
      .map((chave) => chave.destino_id);
    if (ids.length === 0) continue;
    const resultado = await client.query<{ id: string }>(consulta, [
      empresaId,
      ids,
    ]);
    resultado.rows.forEach((item) => existentes.add(`${tabela}/${item.id}`));
  }
  return existentes;
}

async function carregarExecucoes(
  client: PoolClient,
  empresaId: string,
  checksums: string[],
) {
  const resultado = await client.query<ExecucaoBanco>(
    `select distinct on (entidade, checksum_arquivo, modo)
        entidade, checksum_arquivo, modo, status, total_lidos, total_inseridos,
        total_atualizados, total_ignorados, total_erros, iniciado_em
       from importacao_execucao
      where empresa_id = $1 and origem = 'GIW'
        and checksum_arquivo = any($2::text[])
        and modo in ('APLICAR', 'DRY_RUN')
      order by entidade, checksum_arquivo, modo, iniciado_em desc`,
    [empresaId, checksums],
  );
  return resultado.rows;
}

async function carregarFinanceiro(
  client: PoolClient,
  empresaId: string,
) {
  const resultado = await client.query<ResumoFinanceiroBanco>(
    `with
      folhas as (
        select to_char(competencia, 'YYYY-MM') competencia,
               count(*)::int folhas,
               coalesce(sum(total_proventos), 0)::numeric(18,2)::text proventos,
               coalesce(sum(total_descontos), 0)::numeric(18,2)::text descontos,
               coalesce(sum(total_liquido), 0)::numeric(18,2)::text liquido,
               coalesce(sum(base_inss), 0)::numeric(18,2)::text base_inss,
               coalesce(sum(valor_inss), 0)::numeric(18,2)::text inss
          from legado_folha
         where empresa_id = $1 and origem = 'GIW'
         group by competencia
      ),
      itens as (
        select to_char(f.competencia, 'YYYY-MM') competencia,
               count(i.id)::int itens_folha
          from legado_folha f
          left join legado_folha_item i on i.folha_legado_id = f.id
         where f.empresa_id = $1 and f.origem = 'GIW'
         group by f.competencia
      ),
      rubricas as (
        select to_char(f.competencia, 'YYYY-MM') competencia,
               count(r.id)::int rubricas
          from legado_folha f
          left join legado_folha_item i on i.folha_legado_id = f.id
          left join legado_folha_item_rubrica r on r.folha_item_legado_id = i.id
         where f.empresa_id = $1 and f.origem = 'GIW'
         group by f.competencia
      ),
      guias as (
        select to_char(competencia, 'YYYY-MM') competencia,
               count(*)::int guias,
               coalesce(sum(total), 0)::numeric(18,2)::text guias_total
          from legado_guia_inss
         where empresa_id = $1 and origem = 'GIW'
         group by competencia
      ),
      competencias as (
        select competencia from folhas union select competencia from guias
      )
      select c.competencia,
             coalesce(f.folhas, 0)::int folhas,
             coalesce(i.itens_folha, 0)::int itens_folha,
             coalesce(r.rubricas, 0)::int rubricas,
             coalesce(g.guias, 0)::int guias,
             coalesce(f.proventos, '0.00') proventos,
             coalesce(f.descontos, '0.00') descontos,
             coalesce(f.liquido, '0.00') liquido,
             coalesce(f.base_inss, '0.00') base_inss,
             coalesce(f.inss, '0.00') inss,
             coalesce(g.guias_total, '0.00') guias_total
        from competencias c
        left join folhas f using (competencia)
        left join itens i using (competencia)
        left join rubricas r using (competencia)
        left join guias g using (competencia)
       order by c.competencia`,
    [empresaId],
  );
  return resultado.rows;
}

async function carregarOrfaos(client: PoolClient, empresaId: string) {
  const resultado = await client.query<{
    itens_sem_pessoa: number;
    itens_sem_vinculo: number;
    guias_sem_pessoa: number;
    referencias_folha_ausentes: number;
  }>(
    `select
      (select count(*)::int
         from legado_folha_item i
         left join legado_chave c
           on c.empresa_id = i.empresa_id and c.origem = 'GIW'
          and c.entidade = 'pessoas' and c.legacy_id = i.pessoa_legacy_id
        where i.empresa_id = $1 and c.destino_id is null) itens_sem_pessoa,
      (select count(*)::int
         from legado_folha_item i
         left join legado_chave c
           on c.empresa_id = i.empresa_id and c.origem = 'GIW'
          and c.entidade = 'vinculos' and c.legacy_id = i.vinculo_legacy_id
        where i.empresa_id = $1 and c.destino_id is null) itens_sem_vinculo,
      (select count(*)::int
         from legado_guia_inss g
         left join legado_chave c
           on c.empresa_id = g.empresa_id and c.origem = 'GIW'
          and c.entidade = 'pessoas' and c.legacy_id = g.pessoa_legacy_id
        where g.empresa_id = $1 and c.destino_id is null) guias_sem_pessoa,
      (select count(*)::int
         from legado_guia_inss g
         cross join lateral jsonb_array_elements_text(g.folha_legacy_ids) ref
         left join legado_folha f
           on f.empresa_id = g.empresa_id and f.origem = 'GIW'
          and f.legacy_id = ref
        where g.empresa_id = $1 and f.id is null) referencias_folha_ausentes`,
    [empresaId],
  );
  return resultado.rows[0];
}

function compararChaves(
  esperadas: ChaveMigracaoGiwEsperada[],
  banco: ChaveBanco[],
  destinos: Set<string>,
  problemas: Problema[],
  avisos: Aviso[],
) {
  const porId = new Map(banco.map((chave) => [chaveId(chave), chave]));
  const idsEsperados = new Set(esperadas.map(chaveId));
  for (const esperada of esperadas) {
    const atual = porId.get(chaveId(esperada));
    if (!atual) {
      problemas.push({
        codigo: "CHAVE_AUSENTE",
        detalhe: `${chaveId(esperada)} não foi importada.`,
      });
      continue;
    }
    if (atual.destino_tabela !== esperada.destinoTabela) {
      problemas.push({
        codigo: "DESTINO_INCORRETO",
        detalhe: `${chaveId(esperada)} aponta para ${atual.destino_tabela}.`,
      });
    }
    if (atual.checksum !== esperada.checksum) {
      problemas.push({
        codigo: "CHECKSUM_DIVERGENTE",
        detalhe: `${chaveId(esperada)} diverge do snapshot validado.`,
      });
    }
    if (!destinos.has(`${atual.destino_tabela}/${atual.destino_id}`)) {
      problemas.push({
        codigo: "DESTINO_AUSENTE",
        detalhe: `${chaveId(esperada)} aponta para registro inexistente.`,
      });
    }
  }
  const destinosMapeados = new Map<string, string>();
  for (const chave of banco.filter((item) => idsEsperados.has(chaveId(item)))) {
    const destino = `${chave.entidade}/${chave.destino_tabela}/${chave.destino_id}`;
    const anterior = destinosMapeados.get(destino);
    if (anterior) {
      problemas.push({
        codigo: "DESTINO_COMPARTILHADO",
        detalhe: `${anterior} e ${chaveId(chave)} apontam para o mesmo destino.`,
      });
    } else {
      destinosMapeados.set(destino, chaveId(chave));
    }
  }
  banco
    .filter((chave) => !idsEsperados.has(chaveId(chave)))
    .forEach((chave) =>
      avisos.push({
        codigo: "CHAVE_EXTRA",
        detalhe: `${chaveId(chave)} existe no banco, mas não neste lote.`,
      }),
    );
}

async function validarEvidenciasHistoricas(
  client: PoolClient,
  empresaId: string,
  esperadas: ChaveMigracaoGiwEsperada[],
  chavesBanco: ChaveBanco[],
  problemas: Problema[],
) {
  const idsFolha = esperadas
    .filter((item) => item.entidade === "folhas_historicas")
    .map((item) => item.legacyId);
  const idsGuia = esperadas
    .filter((item) => item.entidade === "guias_inss_historicas")
    .map((item) => item.legacyId);
  type Evidencia = {
    id: string;
    legacy_id: string;
    checksum: string;
    snapshot: unknown;
  };
  const [folhas, guias] = await Promise.all([
    idsFolha.length === 0
      ? Promise.resolve({ rows: [] as Evidencia[] })
      : client.query<Evidencia>(
          `select id, legacy_id, checksum, snapshot
             from legado_folha
            where empresa_id = $1 and origem = 'GIW'
              and legacy_id = any($2::text[])`,
          [empresaId, idsFolha],
        ),
    idsGuia.length === 0
      ? Promise.resolve({ rows: [] as Evidencia[] })
      : client.query<Evidencia>(
          `select id, legacy_id, checksum, snapshot
             from legado_guia_inss
            where empresa_id = $1 and origem = 'GIW'
              and legacy_id = any($2::text[])`,
          [empresaId, idsGuia],
        ),
  ]);
  const linhas = [
    ...folhas.rows.map((item) => ({ ...item, entidade: "folhas_historicas" })),
    ...guias.rows.map((item) => ({
      ...item,
      entidade: "guias_inss_historicas",
    })),
  ];
  const porId = new Map(esperadas.map((item) => [chaveId(item), item]));
  const chavesPorId = new Map(
    chavesBanco.map((item) => [chaveId(item), item]),
  );
  for (const linha of linhas) {
    const identificador = `${linha.entidade}/${linha.legacy_id}`;
    const esperado = porId.get(identificador);
    const chaveBanco = chavesPorId.get(identificador);
    if (
      esperado &&
      (chaveBanco?.destino_id !== linha.id ||
        linha.checksum !== esperado.checksum ||
        checksum(linha.snapshot) !== esperado.checksum)
    ) {
      problemas.push({
        codigo: "EVIDENCIA_HISTORICA_DIVERGENTE",
        detalhe: `${linha.entidade}/${linha.legacy_id} não preserva o snapshot importado.`,
      });
    }
  }
}

async function executar() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL é obrigatória para auditar a migração.");
  }
  const args = process.argv.slice(2);
  const snapshots = await carregarSnapshots(args);
  const expectativa = construirExpectativaMigracaoGiw(snapshots);
  const problemas: Problema[] = [];
  const avisos: Aviso[] = [];
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
  const client = await pool.connect();

  try {
    await client.query("begin transaction read only");
    const empresaId = await resolverEmpresa(
      client,
      argumento(args, "--empresa-id"),
    );
    await validarEstrutura(client, problemas);
    if (problemas.some((item) => item.codigo === "MIGRACAO_SQL_AUSENTE")) {
      await client.query("rollback");
      throw new Error(problemas.map((item) => item.detalhe).join(" "));
    }

    const entidades = [...new Set(expectativa.chaves.map((item) => item.entidade))];
    const chavesBanco = await carregarChaves(client, empresaId, entidades);
    const destinos = await destinosExistentes(client, empresaId, chavesBanco);
    compararChaves(
      expectativa.chaves,
      chavesBanco,
      destinos,
      problemas,
      avisos,
    );
    await validarEvidenciasHistoricas(
      client,
      empresaId,
      expectativa.chaves,
      chavesBanco,
      problemas,
    );

    const execucoes = await carregarExecucoes(
      client,
      empresaId,
      expectativa.snapshots.map((item) => item.checksumArquivo),
    );
    for (const snapshot of expectativa.snapshots) {
      const execucaoAplicar = execucoes.find(
        (item) =>
          item.entidade === snapshot.entidade &&
          item.checksum_arquivo === snapshot.checksumArquivo &&
          item.modo === "APLICAR",
      );
      const execucaoDryRun = execucoes.find(
        (item) =>
          item.entidade === snapshot.entidade &&
          item.checksum_arquivo === snapshot.checksumArquivo &&
          item.modo === "DRY_RUN",
      );
      for (const modo of ["APLICAR", "DRY_RUN"]) {
        const execucao =
          modo === "APLICAR" ? execucaoAplicar : execucaoDryRun;
        if (!execucao) {
          problemas.push({
            codigo: `EXECUCAO_${modo}_AUSENTE`,
            detalhe: `${snapshot.entidade}/${snapshot.checksumArquivo.slice(0, 12)} não possui ${modo}.`,
          });
          continue;
        }
        const idempotente =
          modo !== "DRY_RUN" ||
          (execucao.total_inseridos === 0 &&
            execucao.total_atualizados === 0 &&
            execucao.total_ignorados === snapshot.registros);
        if (
          execucao.status !== "CONCLUIDA" ||
          execucao.total_lidos !== snapshot.registros ||
          execucao.total_erros !== 0 ||
          !idempotente
        ) {
          problemas.push({
            codigo: `EXECUCAO_${modo}_INVALIDA`,
            detalhe: `${snapshot.entidade}/${snapshot.checksumArquivo.slice(0, 12)} não comprova carga íntegra e idempotente.`,
          });
        }
      }
      if (
        execucaoAplicar &&
        execucaoDryRun &&
        execucaoDryRun.iniciado_em <= execucaoAplicar.iniciado_em
      ) {
        problemas.push({
          codigo: "IDEMPOTENCIA_FORA_DE_ORDEM",
          detalhe: `${snapshot.entidade}/${snapshot.checksumArquivo.slice(0, 12)} exige DRY_RUN posterior à aplicação.`,
        });
      }
    }

    const financeiroBanco = await carregarFinanceiro(client, empresaId);
    const competenciasEsperadas = new Set(
      expectativa.financeiro.map((item) => item.competencia),
    );
    for (const esperado of expectativa.financeiro) {
      const atual = financeiroBanco.find(
        (item) => item.competencia === esperado.competencia,
      );
      const campos = atual
        ? [
            ["folhas", esperado.folhas, atual.folhas],
            ["itens", esperado.itensFolha, atual.itens_folha],
            ["rubricas", esperado.rubricas, atual.rubricas],
            ["guias", esperado.guias, atual.guias],
            ["proventos", formatarCentavos(esperado.proventosCentavos), atual.proventos],
            ["descontos", formatarCentavos(esperado.descontosCentavos), atual.descontos],
            ["líquido", formatarCentavos(esperado.liquidoCentavos), atual.liquido],
            ["base INSS", formatarCentavos(esperado.baseInssCentavos), atual.base_inss],
            ["INSS", formatarCentavos(esperado.inssCentavos), atual.inss],
            ["guias total", formatarCentavos(esperado.guiasCentavos), atual.guias_total],
          ]
        : [];
      if (!atual || campos.some(([, esperadoValor, atualValor]) => String(esperadoValor) !== String(atualValor))) {
        problemas.push({
          codigo: "FINANCEIRO_DIVERGENTE",
          detalhe: `A competência ${esperado.competencia} diverge dos snapshots.`,
        });
      }
    }
    financeiroBanco
      .filter((item) => !competenciasEsperadas.has(item.competencia))
      .forEach((item) =>
        avisos.push({
          codigo: "COMPETENCIA_EXTRA",
          detalhe: `A competência ${item.competencia} existe no banco, mas não neste lote.`,
        }),
      );

    const orfaos = await carregarOrfaos(client, empresaId);
    for (const [campo, quantidade] of Object.entries(orfaos)) {
      if (quantidade > 0) {
        problemas.push({
          codigo: "REFERENCIA_ORFA",
          detalhe: `${campo}: ${quantidade}.`,
        });
      }
    }
    await client.query("commit");

    const relatorio = {
      status: problemas.length === 0 ? "APROVADA" : "REPROVADA",
      geradoEm: new Date().toISOString(),
      empresaId,
      lote: {
        snapshots: expectativa.snapshots.length,
        chaves: expectativa.chaves.length,
        competencias: expectativa.financeiro.length,
      },
      financeiro: expectativa.financeiro.map((item) => ({
        competencia: item.competencia,
        folhas: item.folhas,
        itensFolha: item.itensFolha,
        rubricas: item.rubricas,
        guias: item.guias,
        proventos: formatarCentavos(item.proventosCentavos),
        descontos: formatarCentavos(item.descontosCentavos),
        liquido: formatarCentavos(item.liquidoCentavos),
        baseInss: formatarCentavos(item.baseInssCentavos),
        inss: formatarCentavos(item.inssCentavos),
        guiasTotal: formatarCentavos(item.guiasCentavos),
      })),
      orfaos,
      avisos,
      problemas,
    };
    const caminhoRelatorio = argumento(args, "--relatorio");
    if (caminhoRelatorio) {
      await writeFile(resolve(caminhoRelatorio), JSON.stringify(relatorio, null, 2));
    }
    console.log(JSON.stringify(relatorio, null, 2));
    if (problemas.length > 0) process.exitCode = 2;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

executar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
