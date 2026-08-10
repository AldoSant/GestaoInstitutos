import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getPool } from "../../db";
import {
  compararFolhaParalelaGiw,
  compararGpsParalelaGiw,
  type LinhaFolhaParalelaGiw,
  type LinhaGpsParalelaGiw,
} from "../../lib/comparacao-paralela-giw";

function argumentos(nome: string) {
  return process.argv.slice(2).flatMap((valor, indice, itens) =>
    valor === nome && itens[indice + 1] ? [itens[indice + 1]] : [],
  );
}

function emPrivate(caminho: string) {
  return caminho.split(/[\\/]/).some((parte) => parte.toLowerCase() === ".private");
}

function validarCompetencia(competencia: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
}

async function resolverEmpresaId(empresaInformada: string | undefined) {
  const pool = getPool();
  if (empresaInformada) return empresaInformada;
  const resultado = await pool.query<{ id: string }>(
    "select id from empresa where ativo order by criado_em limit 2",
  );
  if (resultado.rows.length !== 1) {
    throw new Error(
      "Informe --empresa-id quando não houver exatamente uma empresa ativa.",
    );
  }
  return resultado.rows[0].id;
}

async function competenciasComHistorico(empresaId: string) {
  const resultado = await getPool().query<{ competencia: string }>(
    `select to_char(competencia, 'YYYY-MM') competencia
       from legado_folha
      where empresa_id = $1 and origem = 'GIW'
      group by competencia
      order by competencia`,
    [empresaId],
  );
  return resultado.rows.map((item) => item.competencia);
}

async function compararCompetencia(empresaId: string, competencia: string) {
  const data = `${competencia}-01`;
  const pool = getPool();
  const [folhaLegado, folhaNova, gpsLegado, gpsNova] = await Promise.all([
    pool.query<LinhaFolhaParalelaGiw>(
      `select i.pessoa_legacy_id "pessoaLegacyId",
              sum(i.total_proventos)::text proventos,
              sum(i.total_descontos)::text descontos,
              sum(i.total_liquido)::text liquido,
              sum(i.base_inss)::text "baseInss",
              sum(i.valor_inss)::text inss,
              sum(i.base_irrf)::text "baseIrrf",
              sum(i.valor_irrf)::text irrf
         from legado_folha f
         join legado_folha_item i on i.folha_legado_id = f.id
        where f.empresa_id = $1 and f.origem = 'GIW' and f.competencia = $2::date
        group by i.pessoa_legacy_id`,
      [empresaId, data],
    ),
    pool.query<LinhaFolhaParalelaGiw>(
      `select chave.legacy_id "pessoaLegacyId",
              sum(item.total_proventos)::text proventos,
              sum(item.total_descontos)::text descontos,
              sum(item.total_liquido)::text liquido,
              sum(item.base_inss)::text "baseInss",
              sum(item.valor_inss)::text inss,
              sum(item.base_irrf)::text "baseIrrf",
              sum(item.valor_irrf)::text irrf
         from folha folha
         join folha_item item
           on item.folha_id = folha.id and item.empresa_id = folha.empresa_id
         join prestador_vinculo vinculo
           on vinculo.id = item.vinculo_id and vinculo.empresa_id = item.empresa_id
         join prestador prestador
           on prestador.id = vinculo.prestador_id and prestador.empresa_id = vinculo.empresa_id
         join legado_chave chave
           on chave.empresa_id = folha.empresa_id and chave.origem = 'GIW'
          and chave.entidade = 'pessoas' and chave.destino_tabela = 'pessoa'
          and chave.destino_id = prestador.pessoa_id
        where folha.empresa_id = $1 and folha.competencia = $2::date
          and folha.status = 'FECHADA'
        group by chave.legacy_id`,
      [empresaId, data],
    ),
    pool.query<LinhaGpsParalelaGiw>(
      `select pessoa_legacy_id "pessoaLegacyId", identificador,
              principal::text principal, total::text total
         from legado_guia_inss
        where empresa_id = $1 and origem = 'GIW' and competencia = $2::date
          and tipo = 'GPS'`,
      [empresaId, data],
    ),
    pool.query<LinhaGpsParalelaGiw>(
      `select chave.legacy_id "pessoaLegacyId", guia.identificador,
              guia.principal::text principal, guia.total::text total
         from guia_gps_individual guia
         join obrigacao_fiscal_item obrigacao_item
           on obrigacao_item.id = guia.obrigacao_item_id
         join folha_item item on item.id = obrigacao_item.folha_item_id
         join prestador_vinculo vinculo
           on vinculo.id = item.vinculo_id and vinculo.empresa_id = item.empresa_id
         join prestador prestador
           on prestador.id = vinculo.prestador_id and prestador.empresa_id = vinculo.empresa_id
         join legado_chave chave
           on chave.empresa_id = guia.empresa_id and chave.origem = 'GIW'
          and chave.entidade = 'pessoas' and chave.destino_tabela = 'pessoa'
          and chave.destino_id = prestador.pessoa_id
        where guia.empresa_id = $1 and guia.competencia = $2::date
          and guia.status <> 'CANCELADA'`,
      [empresaId, data],
    ),
  ]);
  const folha = compararFolhaParalelaGiw(folhaLegado.rows, folhaNova.rows);
  const gps = compararGpsParalelaGiw(gpsLegado.rows, gpsNova.rows);
  return {
    competencia,
    evidencia: {
      folhaLegado: folhaLegado.rows.length,
      gpsLegado: gpsLegado.rows.length,
      folhaNova: folhaNova.rows.length,
      gpsNova: gpsNova.rows.length,
    },
    folha,
    gps,
    aprovada: folha.aprovado && gps.aprovado,
  };
}

async function gravarRelatorioPrivado(caminho: string, relatorio: unknown) {
  const destino = resolve(caminho);
  if (!emPrivate(destino)) {
    throw new Error("--relatorio aceita somente um caminho dentro de .private.");
  }
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, `${JSON.stringify(relatorio, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function executar() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL é obrigatória para a comparação paralela.");
  }
  const empresaId = await resolverEmpresaId(argumentos("--empresa-id")[0]);
  const competenciasInformadas = argumentos("--competencia");
  competenciasInformadas.forEach(validarCompetencia);
  const competencias =
    competenciasInformadas.length > 0
      ? [...new Set(competenciasInformadas)].sort()
      : await competenciasComHistorico(empresaId);
  if (competencias.length === 0) {
    throw new Error("Não há Folhas históricas do GIW para comparar nesta empresa.");
  }

  const comparacoes = [];
  for (const competencia of competencias) {
    comparacoes.push(await compararCompetencia(empresaId, competencia));
  }
  const relatorio = {
    schemaVersion: "1.0",
    tipo: "COMPARACAO_PARALELA_GIW",
    geradoEm: new Date().toISOString(),
    empresaId,
    competencias: comparacoes,
    aprovada: comparacoes.every((item) => item.aprovada),
  };
  const resumo = comparacoes.map((item) => ({
    competencia: item.competencia,
    folha: {
      legado: item.evidencia.folhaLegado,
      novo: item.evidencia.folhaNova,
      divergentes: item.folha.divergentes,
    },
    gps: {
      legado: item.evidencia.gpsLegado,
      novo: item.evidencia.gpsNova,
      divergentes: item.gps.divergentes,
    },
    aprovada: item.aprovada,
  }));
  console.log(JSON.stringify({ aprovada: relatorio.aprovada, competencias: resumo }, null, 2));
  const caminhoRelatorio = argumentos("--relatorio")[0];
  if (caminhoRelatorio) await gravarRelatorioPrivado(caminhoRelatorio, relatorio);
  if (!relatorio.aprovada) process.exitCode = 2;
}

executar()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
