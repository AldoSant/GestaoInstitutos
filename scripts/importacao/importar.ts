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
  type GiwTermo,
  type GiwVinculo,
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
  destinoTabela:
    | "pessoa"
    | "atividade"
    | "lotacao"
    | "termo"
    | "prestador_vinculo";
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
  const dadosPessoais = [
    pessoa.tipo,
    pessoa.nome,
    pessoa.cpf,
    pessoa.cnpj,
    pessoa.sexo,
    pessoa.nascimento,
    pessoa.rg,
    pessoa.rgOrgaoEmissor,
    pessoa.rgUf,
    pessoa.rgEmissao,
    pessoa.estadoCivil,
    pessoa.naturalidade,
    pessoa.inscricaoInss,
    pessoa.conselhoTipo,
    pessoa.conselhoNumero,
    pessoa.aposentado,
    pessoa.cnh,
    pessoa.cnhCategoria,
    pessoa.cnhValidade,
    pessoa.nomeFantasia,
    pessoa.representanteLegal,
    pessoa.inscricaoMunicipal,
    pessoa.inscricaoEstadual,
    pessoa.papelPrestador,
    pessoa.papelParceiro,
    pessoa.papelFornecedor,
    pessoa.email,
    pessoa.telefone,
    pessoa.celular,
    pessoa.celularAlternativo,
  ];

  if (pessoaId) {
    if (pessoa.dadosCompletos) {
      await client.query(
        `update pessoa
            set tipo = $3, nome_razao_social = $4, cpf = $5, cnpj = $6,
                sexo = $7, nascimento = $8, rg = $9, rg_orgao_emissor = $10,
                rg_uf = $11, rg_emissao = $12, estado_civil = $13,
                naturalidade = $14, inscricao_inss = $15, conselho_tipo = $16,
                conselho_numero = $17, aposentado = $18, cnh = $19,
                cnh_categoria = $20, cnh_validade = $21, nome_fantasia = $22,
                representante_legal = $23, inscricao_municipal = $24,
                inscricao_estadual = $25, papel_prestador = $26,
                papel_parceiro = $27, papel_fornecedor = $28, email = $29,
                telefone = $30, celular = $31, celular_alternativo = $32,
                ativo = true, atualizado_em = now()
          where id = $1 and empresa_id = $2`,
        [pessoaId, empresaId, ...dadosPessoais],
      );
    } else {
      await client.query(
        `update pessoa
            set tipo = $3, nome_razao_social = $4, cpf = $5, cnpj = $6,
                ativo = true, atualizado_em = now()
          where id = $1 and empresa_id = $2`,
        [pessoaId, empresaId, pessoa.tipo, pessoa.nome, pessoa.cpf, pessoa.cnpj],
      );
    }
    status = "ATUALIZADO";
  } else {
    const insert = await client.query<{ id: string }>(
      `insert into pessoa
         (empresa_id, tipo, nome_razao_social, cpf, cnpj, sexo, nascimento, rg,
          rg_orgao_emissor, rg_uf, rg_emissao, estado_civil, naturalidade,
          inscricao_inss, conselho_tipo, conselho_numero, aposentado, cnh,
          cnh_categoria, cnh_validade, nome_fantasia, representante_legal,
          inscricao_municipal, inscricao_estadual, papel_prestador, papel_parceiro,
          papel_fornecedor, email, telefone, celular, celular_alternativo, ativo)
       values
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, true)
       returning id`,
      [empresaId, ...dadosPessoais],
    );
    pessoaId = insert.rows[0].id;
    status = "INSERIDO";
  }

  if (pessoa.dadosCompletos && pessoa.endereco) {
    await client.query(
      `insert into pessoa_endereco
         (empresa_id, pessoa_id, cep, logradouro, numero, bairro, municipio,
          municipio_legacy_id, complemento, referencia)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (empresa_id, pessoa_id)
       do update set cep = excluded.cep, logradouro = excluded.logradouro,
                     numero = excluded.numero, bairro = excluded.bairro,
                     municipio = excluded.municipio,
                     municipio_legacy_id = excluded.municipio_legacy_id,
                     complemento = excluded.complemento,
                     referencia = excluded.referencia, atualizado_em = now()`,
      [
        empresaId,
        pessoaId,
        pessoa.endereco.cep,
        pessoa.endereco.logradouro,
        pessoa.endereco.numero,
        pessoa.endereco.bairro,
        pessoa.endereco.municipio,
        pessoa.endereco.municipioLegacyId,
        pessoa.endereco.complemento,
        pessoa.endereco.referencia,
      ],
    );
  }

  if (pessoa.dadosCompletos && pessoa.contaBancaria) {
    await client.query(
      `insert into pessoa_conta_bancaria
         (empresa_id, pessoa_id, agencia_legacy_id, agencia, numero, digito,
          variacao, tipo)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (empresa_id, pessoa_id)
       do update set agencia_legacy_id = excluded.agencia_legacy_id,
                     agencia = excluded.agencia, numero = excluded.numero,
                     digito = excluded.digito, variacao = excluded.variacao,
                     tipo = excluded.tipo, atualizado_em = now()`,
      [
        empresaId,
        pessoaId,
        pessoa.contaBancaria.agenciaLegacyId,
        pessoa.contaBancaria.agencia,
        pessoa.contaBancaria.numero,
        pessoa.contaBancaria.digito,
        pessoa.contaBancaria.variacao,
        pessoa.contaBancaria.tipo,
      ],
    );
  }

  if (pessoa.dadosCompletos) {
    const chavesDependentes: string[] = [];
    for (const dependente of pessoa.dependentes) {
      chavesDependentes.push(dependente.origemLegacyKey);
      await client.query(
        `insert into dependente
           (empresa_id, pessoa_id, origem_legacy_key, nome, nascimento,
            parentesco, estudante, cpf, baixa_salario_familia, baixa_irrf, ativo)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
         on conflict (pessoa_id, origem_legacy_key)
         do update set nome = excluded.nome, nascimento = excluded.nascimento,
                       parentesco = excluded.parentesco,
                       estudante = excluded.estudante, cpf = excluded.cpf,
                       baixa_salario_familia = excluded.baixa_salario_familia,
                       baixa_irrf = excluded.baixa_irrf, ativo = true,
                       atualizado_em = now()`,
        [
          empresaId,
          pessoaId,
          dependente.origemLegacyKey,
          dependente.nome,
          dependente.nascimento,
          dependente.parentesco,
          dependente.estudante,
          dependente.cpf,
          dependente.baixaSalarioFamilia,
          dependente.baixaIrrf,
        ],
      );
    }
    await client.query(
      `update dependente
          set ativo = false, atualizado_em = now()
        where empresa_id = $1 and pessoa_id = $2
          and not (origem_legacy_key = any($3::text[]))`,
      [empresaId, pessoaId, chavesDependentes],
    );
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

async function importarTermo(
  client: PoolClient,
  empresaId: string,
  execucaoId: string,
  termo: GiwTermo,
): Promise<ResultadoRegistro> {
  const registroChecksum = checksum(termo);
  const chave = await client.query<{ destino_id: string; checksum: string }>(
    `select destino_id, checksum
       from legado_chave
      where empresa_id = $1 and origem = 'GIW' and entidade = 'termos'
        and legacy_id = $2`,
    [empresaId, termo.legacyId],
  );

  if (chave.rows[0]?.checksum === registroChecksum) {
    const destinos = await client.query<{ total: string }>(
      `select
         (select count(*) from termo where id = $1 and empresa_id = $2) +
         (select count(*)
            from legado_chave lc
            join termo_meta tm on tm.id = lc.destino_id
            join termo t on t.id = tm.termo_id
           where lc.empresa_id = $2 and lc.origem = 'GIW'
             and lc.entidade = 'metas'
             and lc.legacy_id = any($3::text[])
             and t.id = $1 and t.empresa_id = $2) as total`,
      [chave.rows[0].destino_id, empresaId, termo.metas.map((meta) => meta.legacyId)],
    );
    if (Number(destinos.rows[0]?.total) === termo.metas.length + 1) {
      return {
        status: "IGNORADO",
        destinoTabela: "termo",
        destinoId: chave.rows[0].destino_id,
        registroChecksum,
      };
    }
  }

  const existente = await client.query<{ id: string }>(
    `select id
       from termo
      where empresa_id = $1 and (id = $2::uuid or numero = $3)
      order by case when id = $2::uuid then 0 else 1 end
      limit 1`,
    [empresaId, chave.rows[0]?.destino_id ?? null, termo.numero],
  );
  let termoId = existente.rows[0]?.id;
  let status: "INSERIDO" | "ATUALIZADO";
  if (termoId) {
    await client.query(
      `update termo
          set numero = $3, descricao = $4, modalidade = $5, inicio = $6,
              fim = $7, valor_global = $8, ativo = $9, atualizado_em = now()
        where id = $1 and empresa_id = $2`,
      [
        termoId,
        empresaId,
        termo.numero,
        termo.descricao,
        termo.modalidade,
        termo.inicio,
        termo.fim,
        termo.valorGlobal,
        termo.ativo,
      ],
    );
    status = "ATUALIZADO";
  } else {
    const insert = await client.query<{ id: string }>(
      `insert into termo
         (empresa_id, numero, descricao, modalidade, inicio, fim, valor_global, ativo)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        empresaId,
        termo.numero,
        termo.descricao,
        termo.modalidade,
        termo.inicio,
        termo.fim,
        termo.valorGlobal,
        termo.ativo,
      ],
    );
    termoId = insert.rows[0].id;
    status = "INSERIDO";
  }

  for (const meta of termo.metas) {
    const metaChecksum = checksum(meta);
    const metaChave = await client.query<{ destino_id: string }>(
      `select destino_id
         from legado_chave
        where empresa_id = $1 and origem = 'GIW' and entidade = 'metas'
          and legacy_id = $2`,
      [empresaId, meta.legacyId],
    );
    const metaExistente = await client.query<{ id: string }>(
      `select tm.id
         from termo_meta tm
         join termo t on t.id = tm.termo_id
        where t.empresa_id = $1 and tm.termo_id = $2
          and (tm.id = $3::uuid or tm.codigo = $4)
        order by case when tm.id = $3::uuid then 0 else 1 end
        limit 1`,
      [empresaId, termoId, metaChave.rows[0]?.destino_id ?? null, meta.codigo],
    );
    let metaId = metaExistente.rows[0]?.id;
    if (metaId) {
      await client.query(
        `update termo_meta
            set codigo = $3, descricao = $4, tipo_calculo = $5,
                valor_previsto = $6, ativo = $7
          where id = $1 and termo_id = $2`,
        [
          metaId,
          termoId,
          meta.codigo,
          meta.descricao,
          meta.tipoCalculo,
          meta.valorPrevisto,
          meta.ativo,
        ],
      );
    } else {
      const insert = await client.query<{ id: string }>(
        `insert into termo_meta
           (termo_id, codigo, descricao, tipo_calculo, valor_previsto, ativo)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [
          termoId,
          meta.codigo,
          meta.descricao,
          meta.tipoCalculo,
          meta.valorPrevisto,
          meta.ativo,
        ],
      );
      metaId = insert.rows[0].id;
    }
    await client.query(
      `insert into legado_chave
         (empresa_id, origem, entidade, legacy_id, destino_tabela, destino_id,
          checksum, primeira_execucao_id, ultima_execucao_id)
       values ($1, 'GIW', 'metas', $2, 'termo_meta', $3, $4, $5, $5)
       on conflict (empresa_id, origem, entidade, legacy_id)
       do update set destino_tabela = excluded.destino_tabela,
                     destino_id = excluded.destino_id,
                     checksum = excluded.checksum,
                     ultima_execucao_id = excluded.ultima_execucao_id,
                     atualizado_em = now()`,
      [empresaId, meta.legacyId, metaId, metaChecksum, execucaoId],
    );
  }

  await client.query(
    `insert into legado_chave
       (empresa_id, origem, entidade, legacy_id, destino_tabela, destino_id,
        checksum, primeira_execucao_id, ultima_execucao_id)
     values ($1, 'GIW', 'termos', $2, 'termo', $3, $4, $5, $5)
     on conflict (empresa_id, origem, entidade, legacy_id)
     do update set destino_tabela = excluded.destino_tabela,
                   destino_id = excluded.destino_id,
                   checksum = excluded.checksum,
                   ultima_execucao_id = excluded.ultima_execucao_id,
                   atualizado_em = now()`,
    [empresaId, termo.legacyId, termoId, registroChecksum, execucaoId],
  );
  return { status, destinoTabela: "termo", destinoId: termoId, registroChecksum };
}

async function importarVinculo(
  client: PoolClient,
  empresaId: string,
  execucaoId: string,
  vinculo: GiwVinculo,
): Promise<ResultadoRegistro> {
  const registroChecksum = checksum(vinculo);
  const chave = await client.query<{ destino_id: string; checksum: string }>(
    `select destino_id, checksum
       from legado_chave
      where empresa_id = $1 and origem = 'GIW' and entidade = 'vinculos'
        and legacy_id = $2`,
    [empresaId, vinculo.legacyId],
  );
  if (chave.rows[0]?.checksum === registroChecksum) {
    const destinoExiste = await client.query(
      "select 1 from prestador_vinculo where id = $1 and empresa_id = $2",
      [chave.rows[0].destino_id, empresaId],
    );
    if (destinoExiste.rowCount === 1) {
      return {
        status: "IGNORADO",
        destinoTabela: "prestador_vinculo",
        destinoId: chave.rows[0].destino_id,
        registroChecksum,
      };
    }
  }

  const dependencias = await client.query<{
    pessoa_id: string | null;
    termo_id: string | null;
    meta_id: string | null;
    atividade_id: string | null;
    atividade: string | null;
    lotacao_id: string | null;
    lotacao: string | null;
  }>(
    `select
       (select p.id
          from legado_chave lc join pessoa p on p.id = lc.destino_id
         where lc.empresa_id = $1 and lc.origem = 'GIW' and lc.entidade = 'pessoas'
           and lc.legacy_id = $2 and p.empresa_id = $1 limit 1) pessoa_id,
       (select t.id
          from legado_chave lc join termo t on t.id = lc.destino_id
         where lc.empresa_id = $1 and lc.origem = 'GIW' and lc.entidade = 'termos'
           and lc.legacy_id = $3 and t.empresa_id = $1 limit 1) termo_id,
       (select tm.id
          from legado_chave lc
          join termo_meta tm on tm.id = lc.destino_id
          join termo t on t.id = tm.termo_id
         where lc.empresa_id = $1 and lc.origem = 'GIW' and lc.entidade = 'metas'
           and lc.legacy_id = $4 and t.empresa_id = $1 limit 1) meta_id,
       (select a.id
          from legado_chave lc join atividade a on a.id = lc.destino_id
         where lc.empresa_id = $1 and lc.origem = 'GIW' and lc.entidade = 'atividades'
           and lc.legacy_id = $5 and a.empresa_id = $1 limit 1) atividade_id,
       (select a.descricao
          from legado_chave lc join atividade a on a.id = lc.destino_id
         where lc.empresa_id = $1 and lc.origem = 'GIW' and lc.entidade = 'atividades'
           and lc.legacy_id = $5 and a.empresa_id = $1 limit 1) atividade,
       (select l.id
          from legado_chave lc join lotacao l on l.id = lc.destino_id
         where lc.empresa_id = $1 and lc.origem = 'GIW' and lc.entidade = 'lotacoes'
           and lc.legacy_id = $6 and l.empresa_id = $1 limit 1) lotacao_id,
       (select l.descricao
          from legado_chave lc join lotacao l on l.id = lc.destino_id
         where lc.empresa_id = $1 and lc.origem = 'GIW' and lc.entidade = 'lotacoes'
           and lc.legacy_id = $6 and l.empresa_id = $1 limit 1) lotacao`,
    [
      empresaId,
      vinculo.pessoaLegacyId,
      vinculo.termoLegacyId,
      vinculo.metaLegacyId,
      vinculo.atividadeLegacyId,
      vinculo.lotacaoLegacyId,
    ],
  );
  const refs = dependencias.rows[0];
  const ausentes = [
    !refs.pessoa_id && "Pessoa",
    !refs.termo_id && "Termo",
    !refs.meta_id && "Meta",
    !refs.atividade_id && "Atividade",
    !refs.lotacao_id && "Lotação",
  ].filter(Boolean);
  if (ausentes.length > 0) {
    throw new Error(`Dependências ainda não importadas: ${ausentes.join(", ")}.`);
  }
  const metaDoTermo = await client.query(
    "select 1 from termo_meta where id = $1 and termo_id = $2",
    [refs.meta_id, refs.termo_id],
  );
  if (metaDoTermo.rowCount !== 1) {
    throw new Error("A Meta mapeada não pertence ao Termo informado pelo GIW.");
  }

  const prestadores = await client.query<{ id: string; pessoa_id: string }>(
    `select id, pessoa_id
       from prestador
      where empresa_id = $1 and (pessoa_id = $2 or matricula = $3)
      order by case when pessoa_id = $2 then 0 else 1 end
      limit 2`,
    [empresaId, refs.pessoa_id, vinculo.matricula],
  );
  if (
    prestadores.rows.some((prestador) => prestador.pessoa_id !== refs.pessoa_id)
  ) {
    throw new Error("A matrícula do GIW já pertence a outra Pessoa no sistema novo.");
  }
  let prestadorId = prestadores.rows[0]?.id;
  if (prestadorId) {
    await client.query(
      `update prestador
          set matricula = $3, ativo = true, atualizado_em = now()
        where id = $1 and empresa_id = $2`,
      [prestadorId, empresaId, vinculo.matricula],
    );
  } else {
    const insert = await client.query<{ id: string }>(
      `insert into prestador (empresa_id, pessoa_id, matricula, ativo)
       values ($1, $2, $3, true)
       returning id`,
      [empresaId, refs.pessoa_id, vinculo.matricula],
    );
    prestadorId = insert.rows[0].id;
  }
  await client.query(
    `insert into legado_chave
       (empresa_id, origem, entidade, legacy_id, destino_tabela, destino_id,
        checksum, primeira_execucao_id, ultima_execucao_id)
     values ($1, 'GIW', 'prestadores', $2, 'prestador', $3, $4, $5, $5)
     on conflict (empresa_id, origem, entidade, legacy_id)
     do update set destino_tabela = excluded.destino_tabela,
                   destino_id = excluded.destino_id,
                   checksum = excluded.checksum,
                   ultima_execucao_id = excluded.ultima_execucao_id,
                   atualizado_em = now()`,
    [
      empresaId,
      vinculo.pessoaLegacyId,
      prestadorId,
      checksum({ pessoaLegacyId: vinculo.pessoaLegacyId, matricula: vinculo.matricula }),
      execucaoId,
    ],
  );

  const existente = await client.query<{ id: string }>(
    `select id
       from prestador_vinculo
      where empresa_id = $1
        and (
          id = $2::uuid
          or (
            prestador_id = $3 and termo_id = $4 and meta_id = $5
            and numero_contrato is not distinct from $6
            and inicio = $7
          )
        )
      order by case when id = $2::uuid then 0 else 1 end
      limit 1`,
    [
      empresaId,
      chave.rows[0]?.destino_id ?? null,
      prestadorId,
      refs.termo_id,
      refs.meta_id,
      vinculo.numeroContrato,
      vinculo.inicio,
    ],
  );
  let destinoId = existente.rows[0]?.id;
  let status: "INSERIDO" | "ATUALIZADO";
  const values = [
    empresaId,
    prestadorId,
    refs.termo_id,
    refs.meta_id,
    refs.atividade_id,
    refs.lotacao_id,
    vinculo.numeroContrato,
    refs.atividade,
    refs.lotacao,
    vinculo.inicio,
    vinculo.fim,
    vinculo.valorRetribuicao,
    vinculo.cargaHoraria,
    vinculo.descontaInss,
    vinculo.descontaIrrf,
    vinculo.ativo,
  ];
  if (destinoId) {
    await client.query(
      `update prestador_vinculo
          set prestador_id = $3, termo_id = $4, meta_id = $5, atividade_id = $6,
              lotacao_id = $7, numero_contrato = $8, atividade = $9, lotacao = $10,
              inicio = $11, fim = $12, valor_retribuicao = $13, carga_horaria = $14,
              desconta_inss = $15, desconta_irrf = $16, ativo = $17,
              atualizado_em = now()
        where id = $1 and empresa_id = $2`,
      [destinoId, ...values],
    );
    status = "ATUALIZADO";
  } else {
    const insert = await client.query<{ id: string }>(
      `insert into prestador_vinculo
         (empresa_id, prestador_id, termo_id, meta_id, atividade_id, lotacao_id,
          numero_contrato, atividade, lotacao, inicio, fim, valor_retribuicao,
          carga_horaria, desconta_inss, desconta_irrf, ativo)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       returning id`,
      values,
    );
    destinoId = insert.rows[0].id;
    status = "INSERIDO";
  }

  await client.query(
    `insert into legado_chave
       (empresa_id, origem, entidade, legacy_id, destino_tabela, destino_id,
        checksum, primeira_execucao_id, ultima_execucao_id)
     values ($1, 'GIW', 'vinculos', $2, 'prestador_vinculo', $3, $4, $5, $5)
     on conflict (empresa_id, origem, entidade, legacy_id)
     do update set destino_tabela = excluded.destino_tabela,
                   destino_id = excluded.destino_id,
                   checksum = excluded.checksum,
                   ultima_execucao_id = excluded.ultima_execucao_id,
                   atualizado_em = now()`,
    [empresaId, vinculo.legacyId, destinoId, registroChecksum, execucaoId],
  );
  return {
    status,
    destinoTabela: "prestador_vinculo",
    destinoId,
    registroChecksum,
  };
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
  if (snapshot.entity === "lotacoes") {
    const registro = snapshot.records[index];
    return {
      registro,
      result: await importarLotacao(client, empresaId, execucaoId, registro),
    };
  }
  if (snapshot.entity === "termos") {
    const registro = snapshot.records[index];
    return {
      registro,
      result: await importarTermo(client, empresaId, execucaoId, registro),
    };
  }
  const registro = snapshot.records[index];
  return {
    registro,
    result: await importarVinculo(client, empresaId, execucaoId, registro),
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
      let registro: GiwPessoa | GiwAtividade | GiwLotacao | GiwTermo | GiwVinculo =
        snapshot.records[index];
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
        await client.query(`release savepoint ${savepoint}`);
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
