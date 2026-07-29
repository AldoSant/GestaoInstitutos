import {
  diagnosticarConsolidacaoMensal,
  listarCasosConsolidacao,
  type ExecutorConsolidacao,
} from "@/db/consolidacoes";
import {
  diagnosticarAtualidadeSimulacaoFiscal,
  listarSimulacoesConsolidacaoFiscal,
} from "@/db/simulacoes-consolidacao";
import {
  avaliarProntidaoCompetencia,
  competenciasCampanha,
  conteudoHomologacaoCompetencia,
  normalizarDecisaoCompetencia,
  statusPorContagem,
  type ItemChecklistCompetencia,
  type StatusChecklistCompetencia,
  type TipoChecklistCompetencia,
} from "@/lib/homologacao-competencia";
import { hashJson } from "@/lib/json-canonico";
import { getPool } from "./index";

type Executor = ExecutorConsolidacao;

export type HomologacaoCompetencia = {
  id: string;
  competencia: string;
  versao: number;
  hash_fontes: string;
  status:
    | "PENDENTE"
    | "EM_ANALISE"
    | "APROVADA"
    | "REJEITADA"
    | "INVALIDADA";
  resumo: {
    pronta: boolean;
    bloqueios: TipoChecklistCompetencia[];
    conformes: number;
    total: number;
  };
  justificativa: string;
  responsavel: string | null;
  decidido_em: Date | null;
  criado_por: string;
  criado_em: Date;
  atualizado_em: Date;
  itens: Array<{
    id: string;
    tipo: TipoChecklistCompetencia;
    status: StatusChecklistCompetencia;
    obrigatorio: boolean;
    total: number;
    conformes: number;
    pendentes: number;
    hashEvidencia: string;
    detalhes: Record<string, unknown>;
  }>;
};

function validarId(valor: string, campo: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      valor,
    )
  ) {
    throw new Error(`${campo} inválido.`);
  }
}

function competenciaData(valor: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
  return `${valor}-01`;
}

function atorValido(valor: string) {
  const ator = valor.trim();
  if (ator.length < 3 || ator.length > 160) {
    throw new Error("O responsável deve ter entre 3 e 160 caracteres.");
  }
  return ator;
}

function item(
  tipo: TipoChecklistCompetencia,
  input: {
    status: StatusChecklistCompetencia;
    total: number;
    conformes: number;
    pendentes: number;
    detalhes: Record<string, unknown>;
    obrigatorio?: boolean;
  },
): ItemChecklistCompetencia {
  return {
    tipo,
    status: input.status,
    obrigatorio: input.obrigatorio ?? true,
    total: input.total,
    conformes: input.conformes,
    pendentes: input.pendentes,
    hashEvidencia: hashJson(input.detalhes),
    detalhes: input.detalhes,
  };
}

async function diagnosticarMedicoes(
  executor: Executor,
  empresaId: string,
  data: string,
) {
  const resultado = await executor.query<{
    total: number;
    conformes: number;
    fontes: Array<Record<string, unknown>>;
  }>(
    `select count(*)::int total,
            count(medicao.id)::int conformes,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'vinculoId', vinculo.id,
                  'termoId', vinculo.termo_id,
                  'metaId', vinculo.meta_id,
                  'medicaoId', medicao.id,
                  'tipo', medicao.tipo,
                  'valorContratual', vinculo.valor_retribuicao::text,
                  'valorApurado', medicao.valor_apurado::text,
                  'evidenciaHash', medicao.evidencia_hash,
                  'conferente', medicao.conferente
                )
                order by vinculo.id
              ),
              '[]'::jsonb
            ) fontes
       from prestador_vinculo vinculo
       join prestador
         on prestador.empresa_id = vinculo.empresa_id
        and prestador.id = vinculo.prestador_id
        and prestador.ativo
       left join medicao_mensal medicao
         on medicao.empresa_id = vinculo.empresa_id
        and medicao.vinculo_id = vinculo.id
        and medicao.competencia = $2::date
      where vinculo.empresa_id = $1
        and vinculo.ativo
        and vinculo.exige_medicao_mensal
        and vinculo.inicio <= $2::date
        and (vinculo.fim is null or vinculo.fim >= $2::date)`,
    [empresaId, data],
  );
  const linha = resultado.rows[0] ?? { total: 0, conformes: 0, fontes: [] };
  const pendentes = linha.total - linha.conformes;
  const detalhes = { competencia: data, fontes: linha.fontes };
  return item("MEDICOES", {
    status: statusPorContagem({
      total: linha.total,
      pendentes,
      vazio: "NAO_APLICAVEL",
      bloqueio: true,
    }),
    total: linha.total,
    conformes: linha.conformes,
    pendentes,
    detalhes,
  });
}

async function diagnosticarFolhas(
  executor: Executor,
  empresaId: string,
  data: string,
) {
  const resultado = await executor.query<{
    total: number;
    conformes: number;
    fontes: Array<Record<string, unknown>>;
  }>(
    `with grupos as (
       select distinct vinculo.termo_id, vinculo.meta_id
         from prestador_vinculo vinculo
         join prestador
           on prestador.empresa_id = vinculo.empresa_id
          and prestador.id = vinculo.prestador_id
          and prestador.ativo
        where vinculo.empresa_id = $1
          and vinculo.ativo
          and vinculo.inicio <= $2::date
          and (vinculo.fim is null or vinculo.fim >= $2::date)
     ),
     fontes as (
       select grupo.termo_id, termo.numero termo_numero,
              grupo.meta_id, meta.codigo meta_codigo,
              folha.id folha_id, folha.numero folha_numero,
              folha.revisao, folha.status::text, folha.hash_resultado
         from grupos grupo
         join termo on termo.id = grupo.termo_id and termo.empresa_id = $1
         join termo_meta meta
           on meta.id = grupo.meta_id and meta.termo_id = grupo.termo_id
         left join lateral (
           select f.id, f.numero, f.revisao, f.status, f.hash_resultado
             from folha f
            where f.empresa_id = $1
              and f.competencia = $2::date
              and f.termo_id = grupo.termo_id
              and f.meta_id = grupo.meta_id
              and f.status <> 'CANCELADA'
            order by f.numero desc
            limit 1
         ) folha on true
     )
     select count(*)::int total,
            count(*) filter (where status = 'FECHADA')::int conformes,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'termoId', termo_id,
                  'termoNumero', termo_numero,
                  'metaId', meta_id,
                  'metaCodigo', meta_codigo,
                  'folhaId', folha_id,
                  'folhaNumero', folha_numero,
                  'revisao', revisao,
                  'status', status,
                  'hashResultado', hash_resultado
                )
                order by termo_numero, meta_codigo
              ),
              '[]'::jsonb
            ) fontes
       from fontes`,
    [empresaId, data],
  );
  const linha = resultado.rows[0] ?? { total: 0, conformes: 0, fontes: [] };
  const pendentes = linha.total - linha.conformes;
  const detalhes = { competencia: data, fontes: linha.fontes };
  return item("FOLHAS", {
    status: statusPorContagem({
      total: linha.total,
      pendentes,
      vazio: "BLOQUEIO",
      bloqueio: true,
    }),
    total: linha.total,
    conformes: linha.conformes,
    pendentes,
    detalhes,
  });
}

async function diagnosticarConferencias(
  executor: Executor,
  empresaId: string,
  data: string,
) {
  const resultado = await executor.query<{
    total: number;
    conformes: number;
    fontes: Array<Record<string, unknown>>;
  }>(
    `with folhas_atuais as (
       select distinct on (folha.termo_id, folha.meta_id)
              folha.id, folha.numero, folha.revisao, folha.status::text,
              folha.hash_resultado
         from folha
        where folha.empresa_id = $1
          and folha.competencia = $2::date
          and folha.status <> 'CANCELADA'
        order by folha.termo_id, folha.meta_id, folha.numero desc
     )
     select count(*)::int total,
            count(*) filter (
              where folha.status = 'FECHADA' and conferencia.id is not null
            )::int conformes,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'folhaId', folha.id,
                  'folhaNumero', folha.numero,
                  'revisao', folha.revisao,
                  'status', folha.status,
                  'hashResultado', folha.hash_resultado,
                  'conferenciaId', conferencia.id,
                  'conferente', conferencia.conferente,
                  'resultado', conferencia.resultado
                )
                order by folha.numero
              ),
              '[]'::jsonb
            ) fontes
       from folhas_atuais folha
       left join lateral (
         select conferencia.id, conferencia.conferente,
                conferencia.resultado
           from folha_conferencia conferencia
          where conferencia.empresa_id = $1
            and conferencia.folha_id = folha.id
            and conferencia.revisao = folha.revisao
            and conferencia.hash_resultado = folha.hash_resultado
            and conferencia.resultado = 'APROVADA'
          order by conferencia.criado_em desc
          limit 1
       ) conferencia on true`,
    [empresaId, data],
  );
  const linha = resultado.rows[0] ?? { total: 0, conformes: 0, fontes: [] };
  const pendentes = linha.total - linha.conformes;
  return item("CONFERENCIA_RH", {
    status: statusPorContagem({
      total: linha.total,
      pendentes,
      vazio: "BLOQUEIO",
      bloqueio: true,
    }),
    total: linha.total,
    conformes: linha.conformes,
    pendentes,
    detalhes: { competencia: data, fontes: linha.fontes },
  });
}

async function diagnosticarParalelo(
  executor: Executor,
  empresaId: string,
  data: string,
) {
  const resultado = await executor.query<{
    total: number;
    conformes: number;
    fontes: Array<Record<string, unknown>>;
  }>(
    `with folhas_atuais as (
       select distinct on (folha.termo_id, folha.meta_id)
              folha.id, folha.numero, folha.revisao, folha.status::text,
              folha.hash_resultado
         from folha
        where folha.empresa_id = $1
          and folha.competencia = $2::date
          and folha.status <> 'CANCELADA'
        order by folha.termo_id, folha.meta_id, folha.numero desc
     )
     select count(*)::int total,
            count(*) filter (
              where folha.status = 'FECHADA'
                and homologacao.status = 'CONCILIADA'
            )::int conformes,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'folhaId', folha.id,
                  'folhaNumero', folha.numero,
                  'revisao', folha.revisao,
                  'status', folha.status,
                  'hashResultado', folha.hash_resultado,
                  'homologacaoId', homologacao.id,
                  'origem', homologacao.origem,
                  'referencia', homologacao.referencia,
                  'hashArquivo', homologacao.hash_arquivo,
                  'resultado', homologacao.status,
                  'divergentes', homologacao.divergentes
                )
                order by folha.numero
              ),
              '[]'::jsonb
            ) fontes
       from folhas_atuais folha
       left join lateral (
         select lote.id, lote.origem, lote.referencia, lote.hash_arquivo,
                lote.status, lote.divergentes
           from folha_homologacao lote
          where lote.empresa_id = $1
            and lote.folha_id = folha.id
            and lote.revisao = folha.revisao
            and lote.hash_folha = folha.hash_resultado
          order by (lote.status = 'CONCILIADA') desc, lote.criado_em desc
          limit 1
       ) homologacao on true`,
    [empresaId, data],
  );
  const linha = resultado.rows[0] ?? { total: 0, conformes: 0, fontes: [] };
  const pendentes = linha.total - linha.conformes;
  return item("PARALELO_GIW", {
    status: statusPorContagem({
      total: linha.total,
      pendentes,
      vazio: "BLOQUEIO",
    }),
    total: linha.total,
    conformes: linha.conformes,
    pendentes,
    detalhes: { competencia: data, fontes: linha.fontes },
  });
}

async function diagnosticarObrigacao(
  executor: Executor,
  empresaId: string,
  data: string,
) {
  const resultado = await executor.query<{
    id: string;
    status: string;
    principal: string;
    total: string;
    valor_declarado: string | null;
    diferenca: string | null;
    bloqueio_motivo: string | null;
  }>(
    `select id, status::text, principal::text, total::text,
            valor_declarado::text, diferenca::text, bloqueio_motivo
       from obrigacao_fiscal
      where empresa_id = $1 and competencia = $2::date
        and tipo = 'PREVIDENCIARIA_DCTFWEB'
        and status <> 'CANCELADA'
      limit 1`,
    [empresaId, data],
  );
  const obrigacao = resultado.rows[0] ?? null;
  const conforme =
    obrigacao &&
    ["APURADA", "EMITIDA"].includes(obrigacao.status) &&
    Number(obrigacao.diferenca ?? 0) === 0
      ? 1
      : 0;
  return item("OBRIGACAO", {
    status: conforme === 1 ? "OK" : "BLOQUEIO",
    total: 1,
    conformes: conforme,
    pendentes: 1 - conforme,
    detalhes: { competencia: data, obrigacao },
  });
}

async function diagnosticarPagamentos(
  executor: Executor,
  empresaId: string,
  data: string,
) {
  const resultado = await executor.query<{
    total: number;
    conformes: number;
    fontes: Array<Record<string, unknown>>;
  }>(
    `with folhas_atuais as (
       select distinct on (folha.termo_id, folha.meta_id)
              folha.id, folha.numero, folha.revisao, folha.status::text,
              folha.hash_resultado
         from folha
        where folha.empresa_id = $1
          and folha.competencia = $2::date
          and folha.status <> 'CANCELADA'
        order by folha.termo_id, folha.meta_id, folha.numero desc
     ),
     fontes as (
       select folha.id folha_id, folha.numero folha_numero,
              folha.revisao, folha.status folha_status,
              folha.hash_resultado,
              item.id folha_item_id, item.total_liquido::text,
              item.snapshots #>> '{pessoa,nome}' nome,
              item.snapshots #>> '{pessoa,cpf}' cpf,
              item.snapshots #>> '{pessoa,cnpj}' cnpj,
              item.snapshots #>> '{prestador,matricula}' matricula,
              item.snapshots #>> '{contaBancaria,agencia}' agencia,
              item.snapshots #>> '{contaBancaria,numero}' conta,
              item.snapshots #>> '{contaBancaria,digito}' digito,
              item.snapshots #>> '{contaBancaria,tipo}' tipo_conta,
              (
                folha.status = 'FECHADA'
                and nullif(btrim(item.snapshots #>> '{contaBancaria,agencia}'), '') is not null
                and nullif(btrim(item.snapshots #>> '{contaBancaria,numero}'), '') is not null
                and item.snapshots #>> '{contaBancaria,tipo}' in ('CORRENTE', 'POUPANCA')
              ) conforme
         from folhas_atuais folha
         join folha_item item on item.folha_id = folha.id
     )
     select count(*)::int total,
            count(*) filter (where conforme)::int conformes,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'folhaId', folha_id,
                  'folhaNumero', folha_numero,
                  'revisao', revisao,
                  'folhaStatus', folha_status,
                  'hashResultado', hash_resultado,
                  'folhaItemId', folha_item_id,
                  'nome', nome,
                  'documento', coalesce(cpf, cnpj),
                  'matricula', matricula,
                  'agencia', agencia,
                  'conta', conta,
                  'digito', digito,
                  'tipoConta', tipo_conta,
                  'totalLiquido', total_liquido,
                  'conforme', conforme
                )
                order by nome, matricula, folha_item_id
              ),
              '[]'::jsonb
            ) fontes
       from fontes`,
    [empresaId, data],
  );
  const linha = resultado.rows[0] ?? { total: 0, conformes: 0, fontes: [] };
  const pendentes = linha.total - linha.conformes;
  return item("PAGAMENTOS", {
    status: statusPorContagem({
      total: linha.total,
      pendentes,
      vazio: "BLOQUEIO",
      bloqueio: true,
    }),
    total: linha.total,
    conformes: linha.conformes,
    pendentes,
    detalhes: { competencia: data, fontes: linha.fontes },
  });
}

async function diagnosticarDocumentos(
  executor: Executor,
  empresaId: string,
  data: string,
) {
  const resultado = await executor.query<{
    obrigacao_id: string | null;
    obrigacao_status: string | null;
    conformes: number;
    documentos: Array<Record<string, unknown>>;
  }>(
    `with obrigacao as (
       select id, status::text
         from obrigacao_fiscal
        where empresa_id = $1 and competencia = $2::date
          and tipo = 'PREVIDENCIARIA_DCTFWEB'
          and status <> 'CANCELADA'
        limit 1
     )
     select obrigacao.id obrigacao_id,
            obrigacao.status obrigacao_status,
            count(distinct documento.tipo) filter (
              where documento.verificado
                and documento.tipo in (
                  'TOTALIZADOR_DCTFWEB', 'RECIBO_DCTFWEB', 'DARF'
                )
            )::int conformes,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', documento.id,
                  'tipo', documento.tipo,
                  'referencia', documento.referencia,
                  'valorTotal', documento.valor_total::text,
                  'emitidoEm', documento.emitido_em,
                  'hashSha256', documento.hash_sha256,
                  'verificado', documento.verificado
                )
                order by documento.tipo
              ) filter (where documento.id is not null),
              '[]'::jsonb
            ) documentos
       from obrigacao
       left join obrigacao_fiscal_documento documento
         on documento.empresa_id = $1
        and documento.obrigacao_id = obrigacao.id
      group by obrigacao.id, obrigacao.status`,
    [empresaId, data],
  );
  const linha = resultado.rows[0] ?? {
    obrigacao_id: null,
    obrigacao_status: null,
    conformes: 0,
    documentos: [],
  };
  const conformes =
    linha.obrigacao_status === "EMITIDA" ? linha.conformes : Math.min(linha.conformes, 2);
  const pendentes = 3 - conformes;
  return item("DOCUMENTOS_DCTFWEB", {
    status: pendentes === 0 ? "OK" : "PENDENTE",
    total: 3,
    conformes,
    pendentes,
    detalhes: {
      competencia: data,
      obrigacaoId: linha.obrigacao_id,
      obrigacaoStatus: linha.obrigacao_status,
      documentos: linha.documentos,
    },
  });
}

async function diagnosticarConsolidacao(
  executor: Executor,
  empresaId: string,
  competencia: string,
) {
  const [diagnostico, casos, simulacoes] = await Promise.all([
    diagnosticarConsolidacaoMensal(empresaId, competencia, executor),
    listarCasosConsolidacao(empresaId, competencia, executor),
    listarSimulacoesConsolidacaoFiscal(empresaId, competencia, executor),
  ]);
  const resolvidos = new Map(
    casos
      .filter((caso) => caso.status === "RESOLVIDO")
      .map((caso) => [caso.hash_fontes, caso]),
  );
  const simulacoesHomologadas = new Map<string, (typeof simulacoes)[number]>();
  for (const simulacao of simulacoes) {
    if (
      simulacao.status === "HOMOLOGADA" &&
      !simulacoesHomologadas.has(simulacao.caso_id)
    ) {
      simulacoesHomologadas.set(simulacao.caso_id, simulacao);
    }
  }
  const fontes = await Promise.all(diagnostico.conflitos.map(async (conflito) => {
    const caso = resolvidos.get(conflito.hash_fontes);
    const exigeSimulacao =
      caso?.decisao === "RATEIO_NECESSARIO" ||
      caso?.decisao === "UNIFICAR_VINCULOS";
    const simulacao = caso
      ? simulacoesHomologadas.get(caso.id)
      : undefined;
    const atualidade =
      exigeSimulacao && simulacao
        ? await diagnosticarAtualidadeSimulacaoFiscal(
            empresaId,
            simulacao.id,
            executor,
          )
        : {
            atual: !exigeSimulacao && caso?.decisao === "NAO_APLICAVEL",
            motivo: exigeSimulacao
              ? "Simulação fiscal homologada não encontrada."
              : null,
          };
    const conforme =
      caso?.status === "RESOLVIDO" &&
      (caso.decisao === "NAO_APLICAVEL" || atualidade.atual);
    return {
      pessoaId: conflito.pessoa_id,
      nome: conflito.nome,
      hashFontes: conflito.hash_fontes,
      casoId: caso?.id ?? null,
      status: caso?.status ?? null,
      decisao: caso?.decisao ?? null,
      responsavel: caso?.responsavel ?? null,
      resolvidoEm: caso?.resolvido_em ?? null,
      simulacaoId: simulacao?.id ?? null,
      simulacaoVersao: simulacao?.versao ?? null,
      simulacaoStatus: simulacao?.status ?? null,
      simulacaoHashResultado: simulacao?.hash_resultado ?? null,
      simulacaoAtual: atualidade.atual,
      simulacaoMotivo: atualidade.motivo,
      conforme,
    };
  }));
  const total = fontes.length;
  const conformes = fontes.filter((fonte) => fonte.conforme).length;
  const pendentes = total - conformes;
  return item("CONSOLIDACAO", {
    status: statusPorContagem({
      total,
      pendentes,
      vazio: "NAO_APLICAVEL",
      bloqueio: true,
    }),
    total,
    conformes,
    pendentes,
    detalhes: { competencia, fontes },
  });
}

export async function diagnosticarHomologacaoCompetencia(
  empresaId: string,
  competencia: string,
  executor: Executor = getPool(),
) {
  validarId(empresaId, "Empresa");
  const data = competenciaData(competencia);
  const itens = await Promise.all([
    diagnosticarMedicoes(executor, empresaId, data),
    diagnosticarConsolidacao(executor, empresaId, competencia),
    diagnosticarFolhas(executor, empresaId, data),
    diagnosticarConferencias(executor, empresaId, data),
    diagnosticarParalelo(executor, empresaId, data),
    diagnosticarPagamentos(executor, empresaId, data),
    diagnosticarObrigacao(executor, empresaId, data),
    diagnosticarDocumentos(executor, empresaId, data),
  ]);
  const resumo = avaliarProntidaoCompetencia(itens);
  const hashFontes = hashJson(
    conteudoHomologacaoCompetencia({ competencia, itens }),
  );
  return { competencia, hashFontes, resumo, itens };
}

export async function listarHomologacoesCompetencia(
  empresaId: string,
  competencia: string,
  executor: Executor = getPool(),
) {
  validarId(empresaId, "Empresa");
  const data = competenciaData(competencia);
  const resultado = await executor.query<HomologacaoCompetencia>(
    `select lote.id, lote.competencia::text, lote.versao, lote.hash_fontes,
            lote.status, lote.resumo, lote.justificativa, lote.responsavel,
            lote.decidido_em, lote.criado_por, lote.criado_em,
            lote.atualizado_em,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', item.id,
                  'tipo', item.tipo,
                  'status', item.status,
                  'obrigatorio', item.obrigatorio,
                  'total', item.total,
                  'conformes', item.conformes,
                  'pendentes', item.pendentes,
                  'hashEvidencia', item.hash_evidencia,
                  'detalhes', item.detalhes
                )
                order by item.tipo
              ) filter (where item.id is not null),
              '[]'::jsonb
            ) itens
       from homologacao_competencia lote
       left join homologacao_competencia_item item
         on item.empresa_id = lote.empresa_id
        and item.homologacao_id = lote.id
      where lote.empresa_id = $1 and lote.competencia = $2::date
      group by lote.id
      order by lote.versao desc`,
    [empresaId, data],
  );
  return resultado.rows;
}

export async function diagnosticarCampanhaHomologacao(
  empresaId: string,
  competenciaFinal: string,
) {
  validarId(empresaId, "Empresa");
  const competencias = competenciasCampanha(competenciaFinal);
  return Promise.all(
    competencias.map(async (competencia) => {
      const [diagnostico, versoes] = await Promise.all([
        diagnosticarHomologacaoCompetencia(empresaId, competencia),
        listarHomologacoesCompetencia(empresaId, competencia),
      ]);
      const versaoAtual = versoes.find(
        (versao) =>
          versao.hash_fontes === diagnostico.hashFontes &&
          versao.status !== "INVALIDADA",
      );
      return { competencia, diagnostico, versoes, versaoAtual };
    }),
  );
}

export async function materializarHomologacaoCompetencia({
  empresaId,
  competencia,
  ator,
}: {
  empresaId: string;
  competencia: string;
  ator: string;
}) {
  validarId(empresaId, "Empresa");
  const data = competenciaData(competencia);
  const responsavel = atorValido(ator);
  const client = await getPool().connect();
  try {
    await client.query("begin isolation level repeatable read");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `HOMOLOGACAO_COMPETENCIA:${empresaId}:${data}`,
    ]);
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [responsavel, `Congelamento da homologação mensal ${competencia}.`],
    );
    const diagnostico = await diagnosticarHomologacaoCompetencia(
      empresaId,
      competencia,
      client,
    );
    const invalidados = await client.query(
      `update homologacao_competencia
          set status = 'INVALIDADA', atualizado_em = now()
        where empresa_id = $1 and competencia = $2::date
          and status <> 'INVALIDADA' and hash_fontes <> $3
      returning id`,
      [empresaId, data, diagnostico.hashFontes],
    );
    const existente = await client.query<{
      id: string;
      versao: number;
      status: HomologacaoCompetencia["status"];
    }>(
      `select id, versao, status
         from homologacao_competencia
        where empresa_id = $1 and competencia = $2::date and hash_fontes = $3
        for update`,
      [empresaId, data, diagnostico.hashFontes],
    );
    if (existente.rows[0]) {
      if (existente.rows[0].status === "INVALIDADA") {
        await client.query(
          `update homologacao_competencia
              set status = 'PENDENTE', resumo = $3, justificativa = '',
                  responsavel = null, decidido_em = null, atualizado_em = now()
            where empresa_id = $1 and id = $2`,
          [empresaId, existente.rows[0].id, diagnostico.resumo],
        );
      }
      await client.query("commit");
      return {
        id: existente.rows[0].id,
        versao: existente.rows[0].versao,
        criada: false,
        reativada: existente.rows[0].status === "INVALIDADA",
        invalidadas: invalidados.rowCount ?? 0,
        ...diagnostico,
      };
    }
    const proxima = await client.query<{ versao: number }>(
      `select coalesce(max(versao), 0)::int + 1 versao
         from homologacao_competencia
        where empresa_id = $1 and competencia = $2::date`,
      [empresaId, data],
    );
    const versao = proxima.rows[0].versao;
    const inserida = await client.query<{ id: string }>(
      `insert into homologacao_competencia
         (empresa_id, competencia, versao, hash_fontes, resumo, criado_por)
       values ($1, $2::date, $3, $4, $5, $6)
       returning id`,
      [
        empresaId,
        data,
        versao,
        diagnostico.hashFontes,
        diagnostico.resumo,
        responsavel,
      ],
    );
    for (const controle of diagnostico.itens) {
      await client.query(
        `insert into homologacao_competencia_item
           (empresa_id, homologacao_id, tipo, status, obrigatorio,
            total, conformes, pendentes, hash_evidencia, detalhes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          empresaId,
          inserida.rows[0].id,
          controle.tipo,
          controle.status,
          controle.obrigatorio,
          controle.total,
          controle.conformes,
          controle.pendentes,
          controle.hashEvidencia,
          controle.detalhes,
        ],
      );
    }
    await client.query("commit");
    return {
      id: inserida.rows[0].id,
      versao,
      criada: true,
      reativada: false,
      invalidadas: invalidados.rowCount ?? 0,
      ...diagnostico,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function atualizarHomologacaoCompetencia({
  empresaId,
  homologacaoId,
  status,
  justificativa,
  responsavel,
}: {
  empresaId: string;
  homologacaoId: string;
  status: string;
  justificativa: string;
  responsavel: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(homologacaoId, "Homologação");
  const ator = atorValido(responsavel);
  const client = await getPool().connect();
  try {
    const localizada = await client.query<{
      competencia: string;
      hash_fontes: string;
      status: HomologacaoCompetencia["status"];
    }>(
      `select competencia::text, hash_fontes, status
         from homologacao_competencia
        where empresa_id = $1 and id = $2`,
      [empresaId, homologacaoId],
    );
    if (!localizada.rows[0]) {
      throw new Error("Homologação da competência não encontrada.");
    }
    await client.query("begin isolation level repeatable read");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `HOMOLOGACAO_COMPETENCIA:${empresaId}:${localizada.rows[0].competencia}`,
    ]);
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [ator, "Revisão da decisão da homologação mensal."],
    );
    const bloqueada = await client.query<{
      competencia: string;
      hash_fontes: string;
      status: HomologacaoCompetencia["status"];
    }>(
      `select competencia::text, hash_fontes, status
         from homologacao_competencia
        where empresa_id = $1 and id = $2
        for update`,
      [empresaId, homologacaoId],
    );
    const atual = bloqueada.rows[0];
    if (!atual) throw new Error("Homologação da competência não encontrada.");
    if (atual.status === "INVALIDADA") {
      throw new Error("Esta versão foi invalidada e não pode receber decisão.");
    }
    const competencia = atual.competencia.slice(0, 7);
    const diagnostico = await diagnosticarHomologacaoCompetencia(
      empresaId,
      competencia,
      client,
    );
    if (diagnostico.hashFontes !== atual.hash_fontes) {
      await client.query(
        `update homologacao_competencia
            set status = 'INVALIDADA', atualizado_em = now()
          where empresa_id = $1 and id = $2`,
        [empresaId, homologacaoId],
      );
      await client.query("commit");
      return { id: homologacaoId, status: "INVALIDADA" as const };
    }
    const decisao = normalizarDecisaoCompetencia({
      status,
      justificativa,
      responsavel,
      pronta: diagnostico.resumo.pronta,
    });
    await client.query(
      `select set_config('app.motivo', $1, true)`,
      [`Decisão da homologação ${competencia}: ${decisao.status}.`],
    );
    await client.query(
      `update homologacao_competencia
          set status = $3, resumo = $4, justificativa = $5,
              responsavel = $6, decidido_em = $7, atualizado_em = now()
        where empresa_id = $1 and id = $2`,
      [
        empresaId,
        homologacaoId,
        decisao.status,
        diagnostico.resumo,
        decisao.justificativa,
        decisao.responsavel,
        decisao.decididoEm,
      ],
    );
    await client.query("commit");
    return { id: homologacaoId, ...decisao };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
