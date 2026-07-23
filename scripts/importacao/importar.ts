import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import pg, { type PoolClient } from "pg";
import {
  checksum,
  validarSnapshotGiw,
  type GiwAtividade,
  type GiwLotacao,
  type GiwPessoa,
  type GiwSnapshot,
} from "../../lib/importacao-giw";

const { Pool } = pg;

type Opcoes = {
  arquivo: string;
  empresaId: string | null;
  aplicar: boolean;
};

type Resumo = {
  lidos: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: number;
};

type ResultadoRegistro = {
  status: "INSERIDO" | "ATUALIZADO" | "IGNORADO";
  destinoTabela: "pessoa" | "atividade" | "lotacao";
  destinoId: string;
  registroChecksum: string;
};

function lerOpcoes(argv: string[]): Opcoes {
  let arquivo = "";
  let empresaId: string | null = null;
  let aplicar = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--arquivo") arquivo = argv[++index] ?? "";
    else if (arg === "--empresa-id") empresaId = argv[++index] ?? null;
    else if (arg === "--aplicar") aplicar = true;
    else if (arg !== "--dry-run") throw new Error(`Opção desconhecida: ${arg}`);
  }

  if (!arquivo) {
    throw new Error(
      "Informe --arquivo <snapshot.json>. O modo padrão é dry-run; use --aplicar para gravar.",
    );
  }
  return { arquivo: resolve(arquivo), empresaId, aplicar };
}

async function resolverEmpresa(client: PoolClient, empresaId: string | null) {
  if (empresaId) {
    const result = await client.query<{ id: string }>(
      "select id from empresa where id = $1 and ativo = true",
      [empresaId],
    );
    if (result.rowCount !== 1) throw new Error("Empresa não encontrada ou inativa.");
    return result.rows[0].id;
  }

  const result = await client.query<{ id: string }>(
    "select id from empresa where ativo = true order by criado_em limit 2",
  );
  if (result.rowCount !== 1) {
    throw new Error(
      "Informe --empresa-id quando não houver exatamente uma empresa ativa.",
    );
  }
  return result.rows[0].id;
}

async function localizarPessoa(
  client: PoolClient,
  empresaId: string,
  pessoa: GiwPessoa,
  destinoMapeado: string | null,
) {
  if (destinoMapeado) {
    const result = await client.query<{ id: string }>(
      "select id from pessoa where id = $1 and empresa_id = $2",
      [destinoMapeado, empresaId],
    );
    if (result.rowCount === 1) return result.rows[0].id;
  }

  const result = await client.query<{ id: string }>(
    `select id
       from pessoa
      where empresa_id = $1
        and (($2::text is not null and cpf = $2) or ($3::text is not null and cnpj = $3))
      limit 2`,
    [empresaId, pessoa.cpf, pessoa.cnpj],
  );
  if ((result.rowCount ?? 0) > 1) {
    throw new Error("Mais de uma pessoa local possui o mesmo documento.");
  }
  return result.rows[0]?.id ?? null;
}

async function importarPessoa(
  client: PoolClient,
  empresaId: string,
  execucaoId: string,
  pessoa: GiwPessoa,
) {
  const registroChecksum = checksum(pessoa);
  const chave = await client.query<{ destino_id: string; checksum: string }>(
    `select destino_id, checksum
       from legado_chave
      where empresa_id = $1 and origem = 'GIW' and entidade = 'pessoas' and legacy_id = $2`,
    [empresaId, pessoa.legacyId],
  );

  if (chave.rows[0]?.checksum === registroChecksum) {
    const destinoExiste = await client.query(
      "select 1 from pessoa where id = $1 and empresa_id = $2",
      [chave.rows[0].destino_id, empresaId],
    );
    if (destinoExiste.rowCount === 1) {
      return {
        status: "IGNORADO" as const,
        destinoTabela: "pessoa" as const,
        destinoId: chave.rows[0].destino_id,
        registroChecksum,
      };
    }
  }

  const destinoId = await localizarPessoa(
    client,
    empresaId,
    pessoa,
    chave.rows[0]?.destino_id ?? null,
  );
  let pessoaId = destinoId;
  let status: "INSERIDO" | "ATUALIZADO";

  if (pessoaId) {
    await client.query(
      `update pessoa
          set tipo = $3, nome_razao_social = $4, cpf = $5, cnpj = $6,
              ativo = true, atualizado_em = now()
        where id = $1 and empresa_id = $2`,
      [pessoaId, empresaId, pessoa.tipo, pessoa.nome, pessoa.cpf, pessoa.cnpj],
    );
    status = "ATUALIZADO";
  } else {
    const insert = await client.query<{ id: string }>(
      `insert into pessoa (empresa_id, tipo, nome_razao_social, cpf, cnpj, ativo)
       values ($1, $2, $3, $4, $5, true)
       returning id`,
      [empresaId, pessoa.tipo, pessoa.nome, pessoa.cpf, pessoa.cnpj],
    );
    pessoaId = insert.rows[0].id;
    status = "INSERIDO";
  }

  await client.query(
    `insert into legado_chave
       (empresa_id, origem, entidade, legacy_id, destino_tabela, destino_id,
        checksum, primeira_execucao_id, ultima_execucao_id)
     values ($1, 'GIW', 'pessoas', $2, 'pessoa', $3, $4, $5, $5)
     on conflict (empresa_id, origem, entidade, legacy_id)
     do update set destino_tabela = excluded.destino_tabela,
                   destino_id = excluded.destino_id,
                   checksum = excluded.checksum,
                   ultima_execucao_id = excluded.ultima_execucao_id,
                   atualizado_em = now()`,
    [empresaId, pessoa.legacyId, pessoaId, registroChecksum, execucaoId],
  );

  return {
    status,
    destinoTabela: "pessoa" as const,
    destinoId: pessoaId,
    registroChecksum,
  };
}

async function importarAtividade(
  client: PoolClient,
  empresaId: string,
  execucaoId: string,
  atividade: GiwAtividade,
): Promise<ResultadoRegistro> {
  const registroChecksum = checksum(atividade);
  const chave = await client.query<{ destino_id: string; checksum: string }>(
    `select destino_id, checksum
       from legado_chave
      where empresa_id = $1 and origem = 'GIW' and entidade = 'atividades'
        and legacy_id = $2`,
    [empresaId, atividade.legacyId],
  );

  if (chave.rows[0]?.checksum === registroChecksum) {
    const destinoExiste = await client.query(
      "select 1 from atividade where id = $1 and empresa_id = $2",
      [chave.rows[0].destino_id, empresaId],
    );
    if (destinoExiste.rowCount === 1) {
      return {
        status: "IGNORADO",
        destinoTabela: "atividade",
        destinoId: chave.rows[0].destino_id,
        registroChecksum,
      };
    }
  }

  const existente = await client.query<{ id: string }>(
    `select id
       from atividade
      where empresa_id = $1 and (id = $2::uuid or codigo = $3)
      order by case when id = $2::uuid then 0 else 1 end
      limit 1`,
    [empresaId, chave.rows[0]?.destino_id ?? null, atividade.legacyId],
  );
  let destinoId = existente.rows[0]?.id;
  let status: "INSERIDO" | "ATUALIZADO";
  if (destinoId) {
    await client.query(
      `update atividade
          set codigo = $3, descricao = $4, carga_horaria = $5, valor = $6,
              ativo = $7, atualizado_em = now()
        where id = $1 and empresa_id = $2`,
      [
        destinoId,
        empresaId,
        atividade.legacyId,
        atividade.descricao,
        atividade.cargaHoraria,
        atividade.valor,
        atividade.ativo,
      ],
    );
    status = "ATUALIZADO";
  } else {
    const insert = await client.query<{ id: string }>(
      `insert into atividade
         (empresa_id, codigo, descricao, carga_horaria, valor, ativo)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        empresaId,
        atividade.legacyId,
        atividade.descricao,
        atividade.cargaHoraria,
        atividade.valor,
        atividade.ativo,
      ],
    );
    destinoId = insert.rows[0].id;
    status = "INSERIDO";
  }

  await client.query(
    `insert into legado_chave
       (empresa_id, origem, entidade, legacy_id, destino_tabela, destino_id,
        checksum, primeira_execucao_id, ultima_execucao_id)
     values ($1, 'GIW', 'atividades', $2, 'atividade', $3, $4, $5, $5)
     on conflict (empresa_id, origem, entidade, legacy_id)
     do update set destino_tabela = excluded.destino_tabela,
                   destino_id = excluded.destino_id,
                   checksum = excluded.checksum,
                   ultima_execucao_id = excluded.ultima_execucao_id,
                   atualizado_em = now()`,
    [empresaId, atividade.legacyId, destinoId, registroChecksum, execucaoId],
  );
  return {
    status,
    destinoTabela: "atividade",
    destinoId,
    registroChecksum,
  };
}

async function importarLotacao(
  client: PoolClient,
  empresaId: string,
  execucaoId: string,
  lotacao: GiwLotacao,
): Promise<ResultadoRegistro> {
  const registroChecksum = checksum(lotacao);
  const chave = await client.query<{ destino_id: string; checksum: string }>(
    `select destino_id, checksum
       from legado_chave
      where empresa_id = $1 and origem = 'GIW' and entidade = 'lotacoes'
        and legacy_id = $2`,
    [empresaId, lotacao.legacyId],
  );

  if (chave.rows[0]?.checksum === registroChecksum) {
    const destinoExiste = await client.query(
      "select 1 from lotacao where id = $1 and empresa_id = $2",
      [chave.rows[0].destino_id, empresaId],
    );
    if (destinoExiste.rowCount === 1) {
      return {
        status: "IGNORADO",
        destinoTabela: "lotacao",
        destinoId: chave.rows[0].destino_id,
        registroChecksum,
      };
    }
  }

  const existente = await client.query<{ id: string }>(
    `select id
       from lotacao
      where empresa_id = $1 and (id = $2::uuid or codigo = $3)
      order by case when id = $2::uuid then 0 else 1 end
      limit 1`,
    [empresaId, chave.rows[0]?.destino_id ?? null, lotacao.legacyId],
  );
  let destinoId = existente.rows[0]?.id;
  let status: "INSERIDO" | "ATUALIZADO";
  if (destinoId) {
    await client.query(
      `update lotacao
          set codigo = $3, descricao = $4, ativo = $5, atualizado_em = now()
        where id = $1 and empresa_id = $2`,
      [destinoId, empresaId, lotacao.legacyId, lotacao.descricao, lotacao.ativo],
    );
    status = "ATUALIZADO";
  } else {
    const insert = await client.query<{ id: string }>(
      `insert into lotacao (empresa_id, codigo, descricao, ativo)
       values ($1, $2, $3, $4)
       returning id`,
      [empresaId, lotacao.legacyId, lotacao.descricao, lotacao.ativo],
    );
    destinoId = insert.rows[0].id;
    status = "INSERIDO";
  }

  await client.query(
    `insert into legado_chave
       (empresa_id, origem, entidade, legacy_id, destino_tabela, destino_id,
        checksum, primeira_execucao_id, ultima_execucao_id)
     values ($1, 'GIW', 'lotacoes', $2, 'lotacao', $3, $4, $5, $5)
     on conflict (empresa_id, origem, entidade, legacy_id)
     do update set destino_tabela = excluded.destino_tabela,
                   destino_id = excluded.destino_id,
                   checksum = excluded.checksum,
                   ultima_execucao_id = excluded.ultima_execucao_id,
                   atualizado_em = now()`,
    [empresaId, lotacao.legacyId, destinoId, registroChecksum, execucaoId],
  );
  return { status, destinoTabela: "lotacao", destinoId, registroChecksum };
}

async function importarRegistro(
  client: PoolClient,
  empresaId: string,
  execucaoId: string,
  snapshot: GiwSnapshot,
  index: number,
) {
  if (snapshot.entity === "pessoas") {
    const registro = snapshot.records[index];
    return {
      registro,
      result: await importarPessoa(client, empresaId, execucaoId, registro),
    };
  }
  if (snapshot.entity === "atividades") {
    const registro = snapshot.records[index];
    return {
      registro,
      result: await importarAtividade(client, empresaId, execucaoId, registro),
    };
  }
  const registro = snapshot.records[index];
  return {
    registro,
    result: await importarLotacao(client, empresaId, execucaoId, registro),
  };
}

async function executar() {
  const opcoes = lerOpcoes(process.argv.slice(2));
  const conteudo = await readFile(opcoes.arquivo, "utf8");
  const parsed: unknown = JSON.parse(conteudo);
  const validacao = validarSnapshotGiw(parsed);

  if (!validacao.snapshot) {
    console.error(`Snapshot rejeitado com ${validacao.issues.length} problema(s):`);
    validacao.issues.slice(0, 50).forEach((issue) => {
      const prefix = issue.record ? `registro ${issue.record}` : "arquivo";
      console.error(`- ${prefix}, ${issue.field}: ${issue.message}`);
    });
    process.exitCode = 1;
    return;
  }

  const snapshot = validacao.snapshot;
  const arquivoChecksum = checksum(snapshot);
  console.log(
    `Snapshot válido: ${snapshot.records.length} registro(s) de ${snapshot.entity}, ` +
      `checksum ${arquivoChecksum.slice(0, 12)}.`,
  );

  if (!process.env.DATABASE_URL) {
    if (opcoes.aplicar) throw new Error("DATABASE_URL é obrigatória com --aplicar.");
    console.log("Dry-run estrutural concluído; DATABASE_URL ausente, banco não consultado.");
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
  const client = await pool.connect();
  const resumo: Resumo = {
    lidos: snapshot.records.length,
    inseridos: 0,
    atualizados: 0,
    ignorados: 0,
    erros: 0,
  };

  try {
    await client.query("begin");
    const empresaId = await resolverEmpresa(client, opcoes.empresaId);
    const execucao = await client.query<{ id: string }>(
      `insert into importacao_execucao
         (empresa_id, origem, entidade, arquivo, checksum_arquivo, modo, status, total_lidos)
       values ($1, 'GIW', $2, $3, $4, $5, 'EM_ANDAMENTO', $6)
       returning id`,
      [
        empresaId,
        snapshot.entity,
        basename(opcoes.arquivo),
        arquivoChecksum,
        opcoes.aplicar ? "APLICAR" : "DRY_RUN",
        resumo.lidos,
      ],
    );
    const execucaoId = execucao.rows[0].id;

    for (let index = 0; index < snapshot.records.length; index += 1) {
      const savepoint = `registro_${index + 1}`;
      await client.query(`savepoint ${savepoint}`);
      let registro: GiwPessoa | GiwAtividade | GiwLotacao = snapshot.records[index];
      try {
        const imported = await importarRegistro(
          client,
          empresaId,
          execucaoId,
          snapshot,
          index,
        );
        registro = imported.registro;
        const result = imported.result;
        if (result.status === "INSERIDO") resumo.inseridos += 1;
        else if (result.status === "ATUALIZADO") resumo.atualizados += 1;
        else resumo.ignorados += 1;

        await client.query(
          `insert into importacao_registro
             (execucao_id, ordem, legacy_id, checksum, status, destino_tabela, destino_id, payload)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            execucaoId,
            index + 1,
            registro.legacyId,
            result.registroChecksum,
            result.status,
            result.destinoTabela,
            result.destinoId,
            registro,
          ],
        );
        await client.query(`release savepoint ${savepoint}`);
      } catch (error) {
        resumo.erros += 1;
        await client.query(`rollback to savepoint ${savepoint}`);
        await client.query(
          `insert into importacao_registro
             (execucao_id, ordem, legacy_id, checksum, status, erro, payload)
           values ($1, $2, $3, $4, 'ERRO', $5, $6)`,
          [
            execucaoId,
            index + 1,
            registro.legacyId,
            checksum(registro),
            error instanceof Error ? error.message : "Erro desconhecido",
            registro,
          ],
        );
      }
    }

    await client.query(
      `update importacao_execucao
          set status = $2, total_inseridos = $3, total_atualizados = $4,
              total_ignorados = $5, total_erros = $6, resumo = $7, concluido_em = now()
        where id = $1`,
      [
        execucaoId,
        resumo.erros > 0 ? "CONCLUIDA_COM_ERROS" : "CONCLUIDA",
        resumo.inseridos,
        resumo.atualizados,
        resumo.ignorados,
        resumo.erros,
        resumo,
      ],
    );

    if (opcoes.aplicar) await client.query("commit");
    else await client.query("rollback");

    console.log(
      `${opcoes.aplicar ? "Importação aplicada" : "Dry-run revertido"}: ` +
        `${resumo.inseridos} inserir, ${resumo.atualizados} atualizar, ` +
        `${resumo.ignorados} ignorar, ${resumo.erros} erro(s).`,
    );
    if (resumo.erros > 0) process.exitCode = 2;
  } catch (error) {
    await client.query("rollback");
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
