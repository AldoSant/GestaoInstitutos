import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  aplicarRateioConsolidadoNaFolha,
  avaliarAtivacaoConsolidacaoProdutiva,
  type RateioConsolidadoFonte,
} from "@/lib/aplicacao-consolidacao";
import {
  normalizarMotivoCancelamento,
  validarStatusCancelamentoFolha,
} from "@/lib/cancelamento";
import { normalizarConferenciaFolha } from "@/lib/conferencia-folha";
import { validarAusenciaDeConflitoPessoaCompetencia } from "@/lib/consolidacao-folha";
import { calcularHashResultadoFolha } from "@/lib/hash-folha";
import {
  processarVinculoFolha,
  type EventoCompetencia,
} from "@/lib/processamento-folha";
import {
  carregarEnquadramentoPorCompetencia,
  carregarEnquadramentoPorId,
} from "./enquadramentos";
import { getPool } from "./index";
import {
  carregarRegraFiscalPorCompetencia,
  carregarRegraFiscalPorId,
} from "./regras";
import { carregarRateioProdutivoHomologado } from "./simulacoes-consolidacao";

type StatusFolha =
  | "RASCUNHO"
  | "PROCESSANDO"
  | "ABERTA"
  | "FECHADA"
  | "CANCELADA";

type LinhaFolha = {
  id: string;
  empresa_id: string;
  termo_id: string;
  meta_id: string;
  regra_calculo_id: string | null;
  enquadramento_previdenciario_id: string | null;
  competencia: string;
  numero: number;
  revisao: number;
  status: StatusFolha;
  processada_em: Date | null;
  fechada_em: Date | null;
  hash_resultado: string | null;
};

type LinhaVinculo = {
  vinculo_id: string;
  pessoa_id: string;
  quantidade_vinculos_pessoa: number;
  prestador_id: string;
  valor_retribuicao: string;
  valor_contratual: string;
  exige_medicao_mensal: boolean;
  medicao_id: string | null;
  medicao_tipo: "PERCENTUAL" | "QUANTIDADE" | "VALOR" | null;
  medicao_percentual: string | null;
  medicao_quantidade: string | null;
  medicao_valor_unitario: string | null;
  medicao_valor_apurado: string | null;
  medicao_evidencia_referencia: string | null;
  medicao_evidencia_hash: string | null;
  medicao_conferente: string | null;
  medicao_conferida_em: string | null;
  desconta_inss: boolean;
  desconta_irrf: boolean;
  isento_inss: boolean;
  categoria_contribuinte: string | null;
  nit_pis_pasep: string | null;
  tipo_pessoa: "FISICA" | "JURIDICA";
  base_outras_fontes: string;
  outras_fontes: EntradaOutraFonte[];
  dependentes_irrf: number;
  evento_id: string | null;
  evento_codigo: string | null;
  evento_descricao: string | null;
  evento_natureza: EventoCompetencia["natureza"] | null;
  evento_tipo_calculo: EventoCompetencia["tipoCalculo"] | null;
  evento_valor: string | null;
  evento_incide_inss: boolean | null;
  evento_incide_irrf: boolean | null;
  snapshot: Record<string, unknown>;
};

type EntradaOutraFonte = {
  fontePagadora: string;
  documentoFonte: string;
  baseContribuicao: string;
  valorContribuicao: string;
  documentoReferencia: string;
};

function competenciaNormalizada(valor: string) {
  if (!/^\d{4}-\d{2}$/.test(valor)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
  const mes = Number(valor.slice(5));
  if (mes < 1 || mes > 12) throw new Error("Competência inválida.");
  return `${valor}-01`;
}

function validarId(valor: string, campo: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
    throw new Error(`${campo} inválido.`);
  }
  return valor;
}

function atorNormalizado(valor: string) {
  const ator = valor.trim();
  if (!ator || ator.length > 160) throw new Error("Ator inválido.");
  return ator;
}

function moedaSql(centavos: number) {
  if (!Number.isSafeInteger(centavos)) throw new Error("Valor monetário inseguro.");
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  return `${sinal}${Math.floor(absoluto / 100)}.${String(absoluto % 100).padStart(2, "0")}`;
}

async function transacao<T>(operacao: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const resultado = await operacao(client);
    await client.query("commit");
    return resultado;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function configurarAuditoria(
  client: PoolClient,
  ator: string,
  motivo: string,
) {
  await client.query(
    `select set_config('app.ator', $1, true),
            set_config('app.motivo', $2, true)`,
    [atorNormalizado(ator), motivo],
  );
}

async function bloquearCompetenciaDaFolha(
  client: PoolClient,
  folhaId: string,
) {
  const coordenadas = await client.query<{
    empresa_id: string;
    competencia: string;
  }>(
    `select empresa_id, competencia::text
       from folha
      where id = $1`,
    [folhaId],
  );
  if (!coordenadas.rows[0]) return;
  await client.query(
    "select pg_advisory_xact_lock(hashtext($1), hashtext($2))",
    [
      coordenadas.rows[0].empresa_id,
      coordenadas.rows[0].competencia,
    ],
  );
}

async function inserirHistorico(
  client: PoolClient,
  folhaId: string,
  statusAnterior: StatusFolha | null,
  statusNovo: StatusFolha,
  ator: string,
  motivo: string,
) {
  await client.query(
    `insert into folha_status_historico
       (folha_id, status_anterior, status_novo, ator, motivo)
     values ($1, $2, $3, $4, $5)`,
    [folhaId, statusAnterior, statusNovo, atorNormalizado(ator), motivo],
  );
}

async function enfileirarProcessamento(
  client: PoolClient,
  folha: Pick<LinhaFolha, "id" | "empresa_id" | "revisao">,
) {
  const chave = `folha:${folha.id}:revisao:${folha.revisao}`;
  await client.query(
    `insert into tarefa_processamento
       (empresa_id, tipo, chave_idempotencia, prioridade, payload)
     values ($1, 'PROCESSAR_FOLHA', $2, 20, $3)
     on conflict (empresa_id, tipo, chave_idempotencia) do nothing`,
    [
      folha.empresa_id,
      chave,
      { folhaId: folha.id, revisao: folha.revisao },
    ],
  );
}

async function prevalidarCriacaoFolha(
  client: PoolClient,
  empresaId: string,
  termoId: string,
  metaId: string,
  competencia: string,
) {
  const candidatos = await client.query<{
    vinculo_id: string;
    matricula: string;
    nome: string;
    tipo_pessoa: "FISICA" | "JURIDICA";
    cpf: string | null;
    cnpj: string | null;
    exige_medicao_mensal: boolean;
    medicao_id: string | null;
    pendencias_outras_fontes: number;
  }>(
    `select v.id vinculo_id, pr.matricula, p.nome_razao_social nome,
             p.tipo tipo_pessoa, p.cpf, p.cnpj,
             v.exige_medicao_mensal, mm.id medicao_id,
            (
              select count(*)::int
                from contribuicao_outra_fonte cof
               where cof.empresa_id = v.empresa_id
                 and cof.prestador_id = pr.id
                 and cof.competencia = $4::date
                 and not cof.comprovante_verificado
            ) pendencias_outras_fontes
       from prestador_vinculo v
       join prestador pr
         on pr.id = v.prestador_id and pr.empresa_id = v.empresa_id and pr.ativo
       join pessoa p
         on p.id = pr.pessoa_id and p.empresa_id = v.empresa_id and p.ativo
       left join medicao_mensal mm
         on mm.empresa_id = v.empresa_id and mm.vinculo_id = v.id
        and mm.competencia = $4::date
      where v.empresa_id = $1 and v.termo_id = $2 and v.meta_id = $3
        and v.ativo and v.inicio <= $4::date
        and (v.fim is null or v.fim >= $4::date)
        and not exists (
          select 1
            from legado_chave chave
            join classificacao_operacional_legado classificacao
              on classificacao.empresa_id = chave.empresa_id
             and classificacao.origem = chave.origem
             and classificacao.entidade = 'prestador'
             and classificacao.legacy_id = chave.legacy_id
             and classificacao.status = 'CONFIRMADA'
             and classificacao.natureza <> 'PAGAMENTO_PRESTADOR'
           where chave.empresa_id = v.empresa_id
             and chave.origem = 'GIW'
             and chave.entidade = 'prestadores'
             and chave.destino_tabela = 'prestador'
             and chave.destino_id = pr.id
        )
      order by p.nome_razao_social`,
    [empresaId, termoId, metaId, competencia],
  );
  if (candidatos.rowCount === 0) {
    throw new Error("Nenhum Vínculo ativo atende ao Termo, Meta e competência.");
  }

  const problemas: string[] = [];
  for (const candidato of candidatos.rows) {
    const identificacao = `${candidato.nome} (${candidato.matricula})`;
    if (candidato.tipo_pessoa === "FISICA") {
      if (!candidato.cpf) {
        problemas.push(`${identificacao}: documento fiscal não informado.`);
      }
    } else if (!candidato.cnpj) {
      problemas.push(`${identificacao}: documento fiscal não informado.`);
    }
    // A medição é um complemento de conferência, não uma condição para pagar.
    // O GIW sempre permitiu apurar a retribuição contratada quando não havia
    // medição destacada no mês. Se existir, ela continua prevalecendo no cálculo.
    if (
      candidato.tipo_pessoa === "FISICA" &&
      candidato.pendencias_outras_fontes > 0
    ) {
      problemas.push(
        `${identificacao}: ${candidato.pendencias_outras_fontes} comprovante(s) de outra fonte aguardam conferência.`,
      );
    }
  }
  if (problemas.length) {
    const exibidos = problemas.slice(0, 8);
    const restante = problemas.length - exibidos.length;
    throw new Error(
      `Pré-validação fiscal encontrou ${problemas.length} pendência(s): ${exibidos.join(" | ")}${restante > 0 ? ` | e mais ${restante}.` : ""}`,
    );
  }
}

async function validarPessoaEmFolhaUnicaNaCompetencia(
  client: PoolClient,
  {
    empresaId,
    termoId,
    metaId,
    competencia,
    folhaAtualId = null,
  }: {
    empresaId: string;
    termoId: string;
    metaId: string;
    competencia: string;
    folhaAtualId?: string | null;
  },
) {
  const conflitos = await client.query<{
    pessoa_id: string;
    nome: string;
    matricula: string;
    folha_id: string;
    termo_numero: string;
    meta_codigo: string;
  }>(
    `select distinct pessoa.id pessoa_id, pessoa.nome_razao_social nome, atual.matricula,
            f.id folha_id, termo.numero termo_numero, meta.codigo meta_codigo
       from prestador_vinculo vinculo_atual
       join prestador atual
         on atual.id = vinculo_atual.prestador_id
        and atual.empresa_id = vinculo_atual.empresa_id
       join pessoa
         on pessoa.id = atual.pessoa_id
        and pessoa.empresa_id = atual.empresa_id
       join folha f
         on f.empresa_id = vinculo_atual.empresa_id
        and f.competencia = $4::date
        and f.status <> 'CANCELADA'
        and ($5::uuid is null or f.id <> $5::uuid)
       join prestador_vinculo vinculo_existente
         on vinculo_existente.empresa_id = f.empresa_id
        and vinculo_existente.termo_id = f.termo_id
        and vinculo_existente.meta_id = f.meta_id
        and vinculo_existente.ativo
        and vinculo_existente.inicio <= f.competencia
        and (
          vinculo_existente.fim is null
          or vinculo_existente.fim >= f.competencia
        )
       join prestador existente
         on existente.id = vinculo_existente.prestador_id
        and existente.empresa_id = vinculo_existente.empresa_id
        and existente.pessoa_id = atual.pessoa_id
       join termo on termo.id = f.termo_id
       join termo_meta meta on meta.id = f.meta_id
      where vinculo_atual.empresa_id = $1
        and vinculo_atual.termo_id = $2
        and vinculo_atual.meta_id = $3
        and vinculo_atual.ativo
        and vinculo_atual.inicio <= $4::date
        and (
          vinculo_atual.fim is null
          or vinculo_atual.fim >= $4::date
        )
      order by pessoa.nome_razao_social
      limit 8`,
    [empresaId, termoId, metaId, competencia, folhaAtualId],
  );
  if (conflitos.rowCount === 0) return;
  const ativacao = avaliarAtivacaoConsolidacaoProdutiva({
    empresaId,
    competencia,
  });
  if (!ativacao.ativa) {
    validarAusenciaDeConflitoPessoaCompetencia(
      conflitos.rows.map((item) => ({
        nome: item.nome,
        matricula: item.matricula,
        folhaId: item.folha_id,
        termoNumero: item.termo_numero,
        metaCodigo: item.meta_codigo,
      })),
    );
    return;
  }
  for (const pessoaId of new Set(conflitos.rows.map((item) => item.pessoa_id))) {
    await carregarRateioProdutivoHomologado({
      empresaId,
      pessoaId,
      competencia,
      executor: client,
    });
  }
}

async function validarConsolidacaoProdutivaFechamento(
  client: PoolClient,
  folha: LinhaFolha,
) {
  const ativacao = avaliarAtivacaoConsolidacaoProdutiva({
    empresaId: folha.empresa_id,
    competencia: folha.competencia,
  });
  if (!ativacao.ativa) return;
  const pessoas = await client.query<{ pessoa_id: string; quantidade: number }>(
    `select pessoa.id pessoa_id, count(distinct todos.id)::int quantidade
       from folha_item item
       join prestador_vinculo vinculo
         on vinculo.empresa_id = item.empresa_id and vinculo.id = item.vinculo_id
       join prestador
         on prestador.empresa_id = vinculo.empresa_id
        and prestador.id = vinculo.prestador_id
       join pessoa
         on pessoa.empresa_id = prestador.empresa_id
        and pessoa.id = prestador.pessoa_id
       join prestador prestador_todos
         on prestador_todos.empresa_id = pessoa.empresa_id
        and prestador_todos.pessoa_id = pessoa.id
        and prestador_todos.ativo
       join prestador_vinculo todos
         on todos.empresa_id = prestador_todos.empresa_id
        and todos.prestador_id = prestador_todos.id
        and todos.ativo and todos.inicio <= $2::date
        and (todos.fim is null or todos.fim >= $2::date)
      where item.folha_id = $1
      group by pessoa.id
     having count(distinct todos.id) > 1`,
    [folha.id, folha.competencia],
  );
  for (const pessoa of pessoas.rows) {
    const rateio = await carregarRateioProdutivoHomologado({
      empresaId: folha.empresa_id,
      pessoaId: pessoa.pessoa_id,
      competencia: folha.competencia,
      exigirCoberturaFolhas: true,
      executor: client,
    });
    const divergentes = await client.query<{ total: number }>(
      `select count(*)::int total
         from prestador_vinculo vinculo
         join prestador
           on prestador.empresa_id = vinculo.empresa_id
          and prestador.id = vinculo.prestador_id
         left join lateral (
           select candidata.id, candidata.status
             from folha candidata
            where candidata.empresa_id = vinculo.empresa_id
              and candidata.termo_id = vinculo.termo_id
              and candidata.meta_id = vinculo.meta_id
              and candidata.competencia = $3::date
              and candidata.status <> 'CANCELADA'
            order by candidata.revisao desc, candidata.numero desc
            limit 1
         ) folha_origem on true
         left join folha_item item
           on item.empresa_id = vinculo.empresa_id
          and item.folha_id = folha_origem.id
          and item.vinculo_id = vinculo.id
        where vinculo.empresa_id = $1 and prestador.pessoa_id = $2
          and prestador.ativo and vinculo.ativo
          and vinculo.inicio <= $3::date
          and (vinculo.fim is null or vinculo.fim >= $3::date)
          and (
            folha_origem.id is null
            or folha_origem.status not in ('ABERTA', 'FECHADA')
            or item.id is null
            or item.memoria #>> '{consolidacaoFiscal,modo}'
              is distinct from 'RATEIO_HOMOLOGADO'
            or item.memoria #>> '{consolidacaoFiscal,simulacaoId}'
              is distinct from $4
            or item.memoria #>> '{consolidacaoFiscal,hashResultado}'
              is distinct from $5
          )`,
      [
        folha.empresa_id,
        pessoa.pessoa_id,
        folha.competencia,
        rateio.simulacaoId,
        rateio.hashResultado,
      ],
    );
    if (divergentes.rows[0].total > 0) {
      throw new Error(
        "Todas as Folhas da Pessoa devem estar processadas com a mesma simulação homologada antes do fechamento.",
      );
    }
  }
}

export async function criarFolha({
  empresaId,
  termoId,
  metaId,
  competencia,
  ator = "OPERADOR_INTERNO",
}: {
  empresaId: string;
  termoId: string;
  metaId: string;
  competencia: string;
  ator?: string;
}) {
  const data = competenciaNormalizada(competencia);
  validarId(empresaId, "Empresa");
  validarId(termoId, "Termo");
  validarId(metaId, "Meta");

  return transacao(async (client) => {
    await configurarAuditoria(client, ator, "Criação e enfileiramento da Folha.");
    await client.query(
      "select pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [empresaId, data],
    );
    const instrumento = await client.query(
      `select 1
         from termo t
         join termo_meta m on m.termo_id = t.id
        where t.id = $1 and m.id = $2 and t.empresa_id = $3
          and t.ativo and m.ativo
          and t.inicio <= $4::date
          and (t.fim is null or t.fim >= $4::date)`,
      [termoId, metaId, empresaId, data],
    );
    if (instrumento.rowCount !== 1) {
      throw new Error("Termo e Meta ativos não atendem à competência.");
    }
    await prevalidarCriacaoFolha(
      client,
      empresaId,
      termoId,
      metaId,
      data,
    );
    await validarPessoaEmFolhaUnicaNaCompetencia(client, {
      empresaId,
      termoId,
      metaId,
      competencia: data,
    });
    const enquadramento = await carregarEnquadramentoPorCompetencia(
      empresaId,
      data,
      client,
    );

    const numero = await client.query<{ proximo: number }>(
      `select coalesce(max(numero), 0)::int + 1 as proximo
         from folha
        where empresa_id = $1 and competencia = $2::date`,
      [empresaId, data],
    );
    const criada = await client.query<LinhaFolha>(
      `insert into folha
         (empresa_id, termo_id, meta_id, enquadramento_previdenciario_id,
          competencia, numero, revisao, status)
       values ($1, $2, $3, $4, $5::date, $6, 1, 'RASCUNHO')
       returning id, empresa_id, termo_id, meta_id, regra_calculo_id,
                 enquadramento_previdenciario_id,
                 competencia::text, numero, revisao, status, processada_em,
                 fechada_em, hash_resultado`,
      [
        empresaId,
        termoId,
        metaId,
        enquadramento.id,
        data,
        numero.rows[0].proximo,
      ],
    );
    await inserirHistorico(
      client,
      criada.rows[0].id,
      null,
      "RASCUNHO",
      ator,
      "Folha criada e aguardando processamento.",
    );
    await enfileirarProcessamento(client, criada.rows[0]);
    return criada.rows[0];
  });
}

async function carregarConteudoHash(client: PoolClient, folhaId: string) {
  const itens = await client.query<{
    vinculo_id: string;
    total_proventos: string;
    total_descontos: string;
    base_inss: string;
    valor_inss: string;
    base_irrf: string;
    irrf_bruto: string;
    irrf_reducao: string;
    valor_irrf: string;
    total_liquido: string;
    snapshots: unknown;
    memoria: unknown;
    eventos: unknown;
  }>(
    `select item.vinculo_id, item.total_proventos::text,
            item.total_descontos::text, item.base_inss::text,
            item.valor_inss::text, item.base_irrf::text,
            item.irrf_bruto::text, item.irrf_reducao::text,
            item.valor_irrf::text, item.total_liquido::text,
            item.snapshots, item.memoria,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'codigo', linha.codigo,
                  'descricao', linha.descricao,
                  'natureza', linha.natureza,
                  'origem', linha.origem,
                  'tipoCalculo', linha.tipo_calculo,
                  'referencia', linha.referencia,
                  'baseCalculo', linha.base_calculo::text,
                  'valor', linha.valor::text,
                  'incideInss', linha.incide_inss,
                  'incideIrrf', linha.incide_irrf,
                  'ordem', linha.ordem,
                  'snapshot', linha.snapshot
                ) order by linha.ordem
              ) filter (where linha.id is not null),
              '[]'::jsonb
            ) eventos
       from folha_item item
       left join folha_item_evento linha on linha.folha_item_id = item.id
      where item.folha_id = $1
      group by item.id
      order by item.vinculo_id`,
    [folhaId],
  );
  return itens.rows;
}

export async function processarFolha(
  folhaId: string,
  ator = "WORKER_FOLHA",
  empresaEsperadaId?: string,
  revisaoEsperada?: number,
) {
  validarId(folhaId, "Folha");
  return transacao(async (client) => {
    await configurarAuditoria(client, ator, "Processamento determinístico da Folha.");
    await bloquearCompetenciaDaFolha(client, folhaId);
    const bloqueada = await client.query<LinhaFolha>(
      `select id, empresa_id, termo_id, meta_id, regra_calculo_id,
              enquadramento_previdenciario_id,
              competencia::text, numero, revisao, status, processada_em,
              fechada_em, hash_resultado
         from folha where id = $1 for update`,
      [folhaId],
    );
    const folha = bloqueada.rows[0];
    if (!folha) throw new Error("Folha não encontrada.");
    if (empresaEsperadaId && folha.empresa_id !== empresaEsperadaId) {
      throw new Error("A Folha não pertence à empresa da tarefa.");
    }
    if (revisaoEsperada && folha.revisao !== revisaoEsperada) {
      throw new Error(
        `A Folha está na revisão ${folha.revisao}, mas a tarefa solicita a revisão ${revisaoEsperada}.`,
      );
    }
    if (!["RASCUNHO", "ABERTA"].includes(folha.status)) {
      throw new Error(`Folha em estado ${folha.status} não pode ser processada.`);
    }
    await validarPessoaEmFolhaUnicaNaCompetencia(client, {
      empresaId: folha.empresa_id,
      termoId: folha.termo_id,
      metaId: folha.meta_id,
      competencia: folha.competencia,
      folhaAtualId: folha.id,
    });

    const regra = await carregarRegraFiscalPorCompetencia(
      folha.competencia.slice(0, 7),
      folha.empresa_id,
      client,
    );
    const enquadramento = await carregarEnquadramentoPorCompetencia(
      folha.empresa_id,
      folha.competencia,
      client,
    );
    if (
      !folha.enquadramento_previdenciario_id ||
      folha.enquadramento_previdenciario_id !== enquadramento.id
    ) {
      throw new Error(
        "O enquadramento previdenciário congelado na Folha não corresponde à competência.",
      );
    }
    await client.query(
      `update folha
          set status = 'PROCESSANDO', regra_calculo_id = $2, atualizado_em = now()
        where id = $1`,
      [folha.id, regra.id],
    );

    const dados = await client.query<LinhaVinculo>(
      `select v.id vinculo_id, p.id pessoa_id, pr.id prestador_id,
              (
                select count(*)::int
                  from prestador prestador_pessoa
                  join prestador_vinculo vinculo_pessoa
                    on vinculo_pessoa.empresa_id = prestador_pessoa.empresa_id
                   and vinculo_pessoa.prestador_id = prestador_pessoa.id
                 where prestador_pessoa.empresa_id = v.empresa_id
                   and prestador_pessoa.pessoa_id = p.id
                   and prestador_pessoa.ativo and vinculo_pessoa.ativo
                   and vinculo_pessoa.inicio <= f.competencia
                   and (
                     vinculo_pessoa.fim is null
                     or vinculo_pessoa.fim >= f.competencia
                   )
              ) quantidade_vinculos_pessoa,
              coalesce(mm.valor_apurado, v.valor_retribuicao)::text valor_retribuicao,
              v.valor_retribuicao::text valor_contratual,
              v.exige_medicao_mensal,
              mm.id medicao_id, mm.tipo medicao_tipo,
              mm.percentual::text medicao_percentual,
              mm.quantidade::text medicao_quantidade,
              mm.valor_unitario::text medicao_valor_unitario,
              mm.valor_apurado::text medicao_valor_apurado,
              mm.evidencia_referencia medicao_evidencia_referencia,
              mm.evidencia_hash medicao_evidencia_hash,
              mm.conferente medicao_conferente,
              mm.conferida_em::text medicao_conferida_em,
               v.desconta_inss, v.desconta_irrf, pr.isento_inss,
              case when p.tipo = 'FISICA' then '701' else null end categoria_contribuinte,
              p.inscricao_inss nit_pis_pasep, p.tipo tipo_pessoa,
              coalesce(
                (
                  select sum(cof.base_contribuicao)
                    from contribuicao_outra_fonte cof
                   where cof.empresa_id = v.empresa_id
                     and cof.prestador_id = pr.id
                     and cof.competencia = f.competencia
                     and cof.comprovante_verificado
                ),
                0
              )::text base_outras_fontes,
              coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'fontePagadora', cof.fonte_pagadora,
                      'documentoFonte', cof.documento_fonte,
                      'baseContribuicao', cof.base_contribuicao::text,
                      'valorContribuicao', cof.valor_contribuicao::text,
                      'documentoReferencia', cof.documento_referencia
                    )
                    order by cof.fonte_pagadora, cof.documento_referencia
                  )
                    from contribuicao_outra_fonte cof
                   where cof.empresa_id = v.empresa_id
                     and cof.prestador_id = pr.id
                     and cof.competencia = f.competencia
                     and cof.comprovante_verificado
                ),
                '[]'::jsonb
              ) outras_fontes,
              (
                select count(*)::int
                  from dependente d
                 where d.empresa_id = v.empresa_id
                   and d.pessoa_id = p.id
                   and d.ativo
                   and (d.baixa_irrf is null or d.baixa_irrf >= f.competencia)
              ) dependentes_irrf,
              e.id evento_id, e.codigo evento_codigo,
              e.descricao evento_descricao, e.natureza evento_natureza,
              e.tipo_calculo evento_tipo_calculo, ler.valor::text evento_valor,
              e.incide_inss evento_incide_inss, e.incide_irrf evento_incide_irrf,
              jsonb_build_object(
                'pessoa', jsonb_build_object(
                  'id', p.id, 'tipo', p.tipo, 'nome', p.nome_razao_social,
                  'cpf', p.cpf, 'cnpj', p.cnpj
                ),
                  'prestador', jsonb_build_object(
                   'id', pr.id, 'matricula', pr.matricula,
                   'nitPisPasep', p.inscricao_inss,
                   'categoriaContribuinte', case when p.tipo = 'FISICA' then '701' else null end,
                   'isentoInss', pr.isento_inss,
                   'outrasFontes', coalesce(
                     (
                       select jsonb_agg(
                         jsonb_build_object(
                           'fontePagadora', cof.fonte_pagadora,
                           'documentoFonte', cof.documento_fonte,
                           'baseContribuicao', cof.base_contribuicao::text,
                           'valorContribuicao', cof.valor_contribuicao::text,
                           'documentoReferencia', cof.documento_referencia
                         )
                         order by cof.fonte_pagadora, cof.documento_referencia
                       )
                         from contribuicao_outra_fonte cof
                        where cof.empresa_id = v.empresa_id
                          and cof.prestador_id = pr.id
                          and cof.competencia = f.competencia
                          and cof.comprovante_verificado
                     ),
                     '[]'::jsonb
                    )
                  ),
                 'contaBancaria', (
                   select jsonb_build_object(
                     'id', conta.id,
                     'agenciaLegacyId', conta.agencia_legacy_id,
                     'agencia', conta.agencia,
                     'numero', conta.numero,
                     'digito', conta.digito,
                     'variacao', conta.variacao,
                     'tipo', conta.tipo
                   )
                     from pessoa_conta_bancaria conta
                    where conta.empresa_id = v.empresa_id
                      and conta.pessoa_id = p.id
                    limit 1
                 ),
                 'vinculo', to_jsonb(v),
                'termo', jsonb_build_object(
                  'id', t.id, 'numero', t.numero, 'descricao', t.descricao
                ),
                'meta', jsonb_build_object(
                  'id', m.id, 'codigo', m.codigo, 'descricao', m.descricao
                ),
                 'regra', jsonb_build_object(
                  'id', $2::uuid, 'codigo', $3::text, 'versao', $4::int,
                   'hashConteudo', $5::text
                 ),
                  'enquadramentoPrevidenciario', jsonb_build_object(
                   'id', $6::uuid,
                   'regime', $7::text,
                   'aliquotaSeguradoNumerador', $8::int,
                   'aliquotaSeguradoDenominador', $9::int,
                   'aliquotaPatronalNumerador', $10::int,
                   'aliquotaPatronalDenominador', $11::int,
                    'fonteNormativa', $12::text
                  ),
                  'medicaoMensal', case when mm.id is null then null else
                    jsonb_build_object(
                      'id', mm.id, 'tipo', mm.tipo,
                      'valorContratual', mm.valor_contratual::text,
                      'percentual', mm.percentual::text,
                      'quantidade', mm.quantidade::text,
                      'valorUnitario', mm.valor_unitario::text,
                      'valorApurado', mm.valor_apurado::text,
                      'evidenciaReferencia', mm.evidencia_referencia,
                      'evidenciaHash', mm.evidencia_hash,
                      'conferente', mm.conferente,
                      'conferidaEm', mm.conferida_em
                    )
                  end
               ) snapshot
         from folha f
         join prestador_vinculo v
           on v.empresa_id = f.empresa_id
          and v.termo_id = f.termo_id and v.meta_id = f.meta_id
          and v.ativo and v.inicio <= f.competencia
          and (v.fim is null or v.fim >= f.competencia)
         join prestador pr on pr.id = v.prestador_id and pr.ativo
         join pessoa p on p.id = pr.pessoa_id and p.ativo
         join termo t on t.id = v.termo_id
         join termo_meta m on m.id = v.meta_id and m.termo_id = t.id
         left join medicao_mensal mm
           on mm.empresa_id = v.empresa_id and mm.vinculo_id = v.id
          and mm.competencia = f.competencia
         left join lancamento_evento_recorrente ler
           on ler.vinculo_id = v.id and ler.empresa_id = v.empresa_id
          and ler.ativo and ler.inicio_competencia <= f.competencia
          and (ler.fim_competencia is null or ler.fim_competencia >= f.competencia)
         left join evento e on e.id = ler.evento_id and e.ativo
        where f.id = $1
          and not exists (
            select 1
              from legado_chave chave
              join classificacao_operacional_legado classificacao
                on classificacao.empresa_id = chave.empresa_id
               and classificacao.origem = chave.origem
               and classificacao.entidade = 'prestador'
               and classificacao.legacy_id = chave.legacy_id
               and classificacao.status = 'CONFIRMADA'
               and classificacao.natureza <> 'PAGAMENTO_PRESTADOR'
             where chave.empresa_id = v.empresa_id
               and chave.origem = 'GIW'
               and chave.entidade = 'prestadores'
               and chave.destino_tabela = 'prestador'
               and chave.destino_id = pr.id
          )
        order by v.id, e.codigo`,
      [
        folha.id,
        regra.id,
        regra.codigo,
        regra.versao,
        regra.hashConteudo,
        enquadramento.id,
        enquadramento.regime,
        enquadramento.aliquota_segurado_numerador,
        enquadramento.aliquota_segurado_denominador,
        enquadramento.aliquota_patronal_numerador,
        enquadramento.aliquota_patronal_denominador,
        enquadramento.fonte_normativa,
      ],
    );
    if (dados.rowCount === 0) {
      throw new Error("Nenhum Vínculo ativo atende ao Termo, Meta e competência.");
    }

    const agrupados = new Map<string, LinhaVinculo[]>();
    for (const linha of dados.rows) {
      const grupo = agrupados.get(linha.vinculo_id) ?? [];
      grupo.push(linha);
      agrupados.set(linha.vinculo_id, grupo);
    }

    const itens: Array<Record<string, unknown>> = [];
    const linhasPersistidas: Array<Record<string, unknown>> = [];
    const ativacaoConsolidada = avaliarAtivacaoConsolidacaoProdutiva({
      empresaId: folha.empresa_id,
      competencia: folha.competencia,
    });
    const rateiosPorPessoa = new Map<
      string,
      Map<string, RateioConsolidadoFonte>
    >();
    for (const [vinculoId, grupo] of agrupados) {
      const base = grupo[0];
      // Sem medição mensal, o processamento usa valor_retribuicao do vínculo.
      // A regra é intencionalmente compatível com o fluxo operacional legado;
      // uma medição conferida, quando disponível, continua substituindo o valor.
      const eventos: EventoCompetencia[] = grupo
        .filter((linha) => linha.evento_id !== null)
        .map((linha) => ({
          id: linha.evento_id!,
          codigo: linha.evento_codigo!,
          descricao: linha.evento_descricao!,
          natureza: linha.evento_natureza!,
          tipoCalculo: linha.evento_tipo_calculo!,
          valor: linha.evento_valor!,
          incideInss: linha.evento_incide_inss!,
          incideIrrf: linha.evento_incide_irrf!,
        }));
      let resultado = processarVinculoFolha(
        {
          vinculoId,
          tipoPessoa: base.tipo_pessoa,
          categoriaContribuinte: base.categoria_contribuinte,
          valorRetribuicao: base.valor_retribuicao,
          medicao: base.medicao_id
            ? {
                id: base.medicao_id,
                tipo: base.medicao_tipo!,
                valorContratual: base.valor_contratual,
                percentual: base.medicao_percentual,
                quantidade: base.medicao_quantidade,
                valorUnitario: base.medicao_valor_unitario,
                valorApurado: base.medicao_valor_apurado!,
                evidenciaReferencia: base.medicao_evidencia_referencia!,
                evidenciaHash: base.medicao_evidencia_hash,
                conferente: base.medicao_conferente!,
                conferidaEm: base.medicao_conferida_em!,
              }
            : null,
          descontaInss: base.desconta_inss,
          descontaIrrf: base.desconta_irrf,
          isentoInss: base.isento_inss,
          baseOutrasFontes: base.base_outras_fontes,
          outrasFontes: base.outras_fontes,
          enquadramentoPrevidenciario: {
            id: enquadramento.id,
            regime: enquadramento.regime,
            aliquotaSeguradoNumerador:
              enquadramento.aliquota_segurado_numerador,
            aliquotaSeguradoDenominador:
              enquadramento.aliquota_segurado_denominador,
            aliquotaPatronalNumerador:
              enquadramento.aliquota_patronal_numerador,
            aliquotaPatronalDenominador:
              enquadramento.aliquota_patronal_denominador,
            fonteNormativa: enquadramento.fonte_normativa,
          },
          dependentesIrrf: base.dependentes_irrf,
          eventos,
        },
        regra.parametros,
      );
      // NIT é requisito de identificação da GPS, não do cálculo da Folha.
      // A Folha precisa continuar processável para permitir conferência e a
      // regularização dirigida da pessoa antes da emissão individual da guia.
      if (ativacaoConsolidada.ativa && base.quantidade_vinculos_pessoa > 1) {
        let rateios = rateiosPorPessoa.get(base.pessoa_id);
        if (!rateios) {
          const homologado = await carregarRateioProdutivoHomologado({
            empresaId: folha.empresa_id,
            pessoaId: base.pessoa_id,
            competencia: folha.competencia,
            executor: client,
          });
          rateios = new Map(
            homologado.fontes.map((fonte) => [fonte.vinculoId, fonte]),
          );
          rateiosPorPessoa.set(base.pessoa_id, rateios);
        }
        const rateio = rateios.get(vinculoId);
        if (!rateio) {
          throw new Error(
            `A simulação homologada não contém o Vínculo ${vinculoId}.`,
          );
        }
        resultado = aplicarRateioConsolidadoNaFolha(resultado, rateio);
      }
      const itemId = randomUUID();
      itens.push({
        id: itemId,
        empresaId: folha.empresa_id,
        folhaId: folha.id,
        vinculoId,
        medicaoId: base.medicao_id,
        totalProventos: moedaSql(resultado.totalProventosCentavos),
        totalDescontos: moedaSql(resultado.totalDescontosCentavos),
        baseInss: moedaSql(resultado.baseInssCentavos),
        valorInss: moedaSql(resultado.valorInssCentavos),
        baseIrrf: moedaSql(resultado.baseIrrfCentavos),
        irrfBruto: moedaSql(resultado.irrfBrutoCentavos),
        irrfReducao: moedaSql(resultado.irrfReducaoCentavos),
        valorIrrf: moedaSql(resultado.valorIrrfCentavos),
        totalLiquido: moedaSql(resultado.totalLiquidoCentavos),
        snapshots:
          "consolidacaoFiscal" in resultado.memoria
            ? {
                ...base.snapshot,
                consolidacaoFiscal: resultado.memoria.consolidacaoFiscal,
              }
            : base.snapshot,
        memoria: resultado.memoria,
      });
      resultado.linhas.forEach((linha, indice) => {
        linhasPersistidas.push({
          id: randomUUID(),
          empresaId: folha.empresa_id,
          folhaItemId: itemId,
          eventoId: linha.eventoId,
          codigo: linha.codigo,
          descricao: linha.descricao,
          natureza: linha.natureza,
          origem: linha.origem,
          tipoCalculo: linha.tipoCalculo,
          referencia: linha.referencia,
          baseCalculo: moedaSql(linha.baseCalculoCentavos),
          valor: moedaSql(linha.valorCentavos),
          incideInss: linha.incideInss,
          incideIrrf: linha.incideIrrf,
          ordem: indice + 1,
          snapshot: linha,
        });
      });
    }

    await client.query("delete from folha_item where folha_id = $1", [folha.id]);
    await client.query(
      `insert into folha_item
          (id, empresa_id, folha_id, vinculo_id, medicao_id, total_proventos,
          total_descontos, base_inss, valor_inss, base_irrf, irrf_bruto,
          irrf_reducao, valor_irrf, total_liquido, snapshots, memoria)
        select x.id, x."empresaId", x."folhaId", x."vinculoId", x."medicaoId",
              x."totalProventos", x."totalDescontos", x."baseInss",
              x."valorInss", x."baseIrrf", x."irrfBruto", x."irrfReducao",
              x."valorIrrf", x."totalLiquido", x.snapshots, x.memoria
         from jsonb_to_recordset($1::jsonb) as x(
            id uuid, "empresaId" uuid, "folhaId" uuid, "vinculoId" uuid,
            "medicaoId" uuid,
           "totalProventos" numeric, "totalDescontos" numeric,
           "baseInss" numeric, "valorInss" numeric, "baseIrrf" numeric,
           "irrfBruto" numeric, "irrfReducao" numeric, "valorIrrf" numeric,
           "totalLiquido" numeric, snapshots jsonb, memoria jsonb
         )`,
      [JSON.stringify(itens)],
    );
    await client.query(
      `insert into folha_item_evento
         (id, empresa_id, folha_item_id, evento_id, codigo, descricao,
          natureza, origem, tipo_calculo, referencia, base_calculo, valor,
          incide_inss, incide_irrf, ordem, snapshot)
       select x.id, x."empresaId", x."folhaItemId", x."eventoId", x.codigo,
              x.descricao, x.natureza, x.origem, x."tipoCalculo",
              x.referencia, x."baseCalculo", x.valor, x."incideInss",
              x."incideIrrf", x.ordem, x.snapshot
         from jsonb_to_recordset($1::jsonb) as x(
           id uuid, "empresaId" uuid, "folhaItemId" uuid, "eventoId" uuid,
           codigo text, descricao text, natureza text, origem text,
           "tipoCalculo" text, referencia text, "baseCalculo" numeric,
           valor numeric, "incideInss" boolean, "incideIrrf" boolean,
           ordem integer, snapshot jsonb
         )`,
      [JSON.stringify(linhasPersistidas)],
    );

    const conteudo = await carregarConteudoHash(client, folha.id);
    const hashResultado = calcularHashResultadoFolha({
      folha: {
        empresaId: folha.empresa_id,
        termoId: folha.termo_id,
        metaId: folha.meta_id,
        competencia: folha.competencia,
        numero: folha.numero,
        revisao: folha.revisao,
      },
      regra: {
        id: regra.id,
        codigo: regra.codigo,
        versao: regra.versao,
        hashConteudo: regra.hashConteudo,
      },
      enquadramentoPrevidenciario: {
        id: enquadramento.id,
        regime: enquadramento.regime,
        aliquotaSeguradoNumerador:
          enquadramento.aliquota_segurado_numerador,
        aliquotaSeguradoDenominador:
          enquadramento.aliquota_segurado_denominador,
        aliquotaPatronalNumerador:
          enquadramento.aliquota_patronal_numerador,
        aliquotaPatronalDenominador:
          enquadramento.aliquota_patronal_denominador,
      },
      itens: conteudo,
    });
    await client.query(
      `update folha
          set status = 'ABERTA', processada_em = now(), fechada_em = null,
              hash_resultado = $2, atualizado_em = now()
        where id = $1`,
      [folha.id, hashResultado],
    );
    await inserirHistorico(
      client,
      folha.id,
      folha.status,
      "ABERTA",
      ator,
      `Revisão ${folha.revisao} processada com ${itens.length} item(ns).`,
    );
    return {
      folhaId: folha.id,
      revisao: folha.revisao,
      itens: itens.length,
      hashResultado,
      regraId: regra.id,
    };
  });
}

export async function solicitarReprocessamentoFolha(
  folhaId: string,
  ator = "OPERADOR_INTERNO",
) {
  validarId(folhaId, "Folha");
  return transacao(async (client) => {
    await configurarAuditoria(client, ator, "Solicitação de reprocessamento da Folha.");
    await bloquearCompetenciaDaFolha(client, folhaId);
    const atual = await client.query<LinhaFolha>(
      `select id, empresa_id, termo_id, meta_id, regra_calculo_id,
              enquadramento_previdenciario_id,
              competencia::text, numero, revisao, status, processada_em,
              fechada_em, hash_resultado
         from folha where id = $1 for update`,
      [folhaId],
    );
    const folha = atual.rows[0];
    if (!folha || folha.status !== "ABERTA") {
      throw new Error("Somente uma Folha aberta pode ser reprocessada.");
    }
    const enquadramento = await carregarEnquadramentoPorCompetencia(
      folha.empresa_id,
      folha.competencia,
      client,
    );
    const revisao = folha.revisao + 1;
    await client.query(
      `update folha
           set revisao = $2, status = 'RASCUNHO', regra_calculo_id = null,
               enquadramento_previdenciario_id = $3,
               processada_em = null, hash_resultado = null, atualizado_em = now()
         where id = $1`,
      [folha.id, revisao, enquadramento.id],
    );
    const nova = {
      ...folha,
      revisao,
      enquadramento_previdenciario_id: enquadramento.id,
    };
    await enfileirarProcessamento(client, nova);
    await inserirHistorico(
      client,
      folha.id,
      "ABERTA",
      "RASCUNHO",
      ator,
      `Reprocessamento solicitado para a revisão ${revisao}.`,
    );
    return nova;
  });
}

export async function tentarNovamenteProcessamentoFolha(
  folhaId: string,
  ator = "OPERADOR_INTERNO",
) {
  validarId(folhaId, "Folha");
  return transacao(async (client) => {
    await configurarAuditoria(
      client,
      ator,
      "Nova tentativa solicitada após falha no processamento da Folha.",
    );
    await bloquearCompetenciaDaFolha(client, folhaId);
    const atual = await client.query<LinhaFolha>(
      `select id, empresa_id, termo_id, meta_id, regra_calculo_id,
              enquadramento_previdenciario_id,
              competencia::text, numero, revisao, status, processada_em,
              fechada_em, hash_resultado
         from folha
        where id = $1
        for update`,
      [folhaId],
    );
    const folha = atual.rows[0];
    if (!folha || folha.status !== "RASCUNHO") {
      throw new Error(
        "A nova tentativa só pode ser solicitada para uma Folha que falhou antes do cálculo.",
      );
    }
    const tarefa = await client.query<{ id: string; status: string }>(
      `select id, status
         from tarefa_processamento
        where empresa_id = $1
          and tipo = 'PROCESSAR_FOLHA'
          and payload ->> 'folhaId' = $2
          and (payload ->> 'revisao')::int = $3
        order by criado_em desc, id desc
        limit 1
        for update`,
      [folha.empresa_id, folha.id, folha.revisao],
    );
    if (!tarefa.rows[0] || tarefa.rows[0].status !== "FALHA") {
      throw new Error("Não há uma falha encerrada disponível para nova tentativa.");
    }
    await client.query(
      `update tarefa_processamento
          set status = 'CANCELADA', atualizado_em = now()
        where id = $1`,
      [tarefa.rows[0].id],
    );
    const chave = `folha:${folha.id}:revisao:${folha.revisao}:retentativa:${randomUUID()}`;
    await client.query(
      `insert into tarefa_processamento
         (empresa_id, tipo, chave_idempotencia, prioridade, payload)
       values ($1, 'PROCESSAR_FOLHA', $2, 20, $3)`,
      [
        folha.empresa_id,
        chave,
        { folhaId: folha.id, revisao: folha.revisao },
      ],
    );
    return folha;
  });
}

export async function fecharFolha(
  folhaId: string,
  ator = "OPERADOR_INTERNO",
) {
  validarId(folhaId, "Folha");
  return transacao(async (client) => {
    await configurarAuditoria(client, ator, "Fechamento conferido da Folha.");
    await bloquearCompetenciaDaFolha(client, folhaId);
    const atual = await client.query<LinhaFolha>(
      `select id, empresa_id, termo_id, meta_id, regra_calculo_id,
              enquadramento_previdenciario_id,
              competencia::text, numero, revisao, status, processada_em,
              fechada_em, hash_resultado
         from folha where id = $1 for update`,
      [folhaId],
    );
    const folha = atual.rows[0];
    if (!folha || folha.status !== "ABERTA" || !folha.regra_calculo_id) {
      throw new Error("Somente uma Folha aberta e processada pode ser fechada.");
    }
    await validarConsolidacaoProdutivaFechamento(client, folha);
    const regra = await carregarRegraFiscalPorId(
      folha.regra_calculo_id,
      folha.empresa_id,
      client,
    );
    const conteudo = await carregarConteudoHash(client, folha.id);
    if (conteudo.length === 0) throw new Error("A Folha não possui itens calculados.");
    if (!folha.enquadramento_previdenciario_id) {
      throw new Error("A Folha não possui enquadramento previdenciário congelado.");
    }
    const enquadramento = await carregarEnquadramentoPorId(
      folha.empresa_id,
      folha.enquadramento_previdenciario_id,
      client,
    );
    const hashAtual = calcularHashResultadoFolha({
      folha: {
        empresaId: folha.empresa_id,
        termoId: folha.termo_id,
        metaId: folha.meta_id,
        competencia: folha.competencia,
        numero: folha.numero,
        revisao: folha.revisao,
      },
      regra: {
        id: regra.id,
        codigo: regra.codigo,
        versao: regra.versao,
        hashConteudo: regra.hashConteudo,
      },
      enquadramentoPrevidenciario: {
        id: enquadramento.id,
        regime: enquadramento.regime,
        aliquotaSeguradoNumerador:
          enquadramento.aliquota_segurado_numerador,
        aliquotaSeguradoDenominador:
          enquadramento.aliquota_segurado_denominador,
        aliquotaPatronalNumerador:
          enquadramento.aliquota_patronal_numerador,
        aliquotaPatronalDenominador:
          enquadramento.aliquota_patronal_denominador,
      },
      itens: conteudo,
    });
    if (hashAtual !== folha.hash_resultado) {
      throw new Error("A memória da Folha diverge do hash processado.");
    }
    const medicoesAlteradas = await client.query<{ total: number }>(
      `select count(*)::int total
         from folha_item fi
         join medicao_mensal mm on mm.id = fi.medicao_id
        where fi.folha_id = $1
          and (
            fi.snapshots #>> '{medicaoMensal,tipo}' is distinct from mm.tipo
            or fi.snapshots #>> '{medicaoMensal,valorContratual}' is distinct from mm.valor_contratual::text
            or fi.snapshots #>> '{medicaoMensal,percentual}' is distinct from mm.percentual::text
            or fi.snapshots #>> '{medicaoMensal,quantidade}' is distinct from mm.quantidade::text
            or fi.snapshots #>> '{medicaoMensal,valorUnitario}' is distinct from mm.valor_unitario::text
            or fi.snapshots #>> '{medicaoMensal,valorApurado}' is distinct from mm.valor_apurado::text
            or fi.snapshots #>> '{medicaoMensal,evidenciaReferencia}' is distinct from mm.evidencia_referencia
            or fi.snapshots #>> '{medicaoMensal,evidenciaHash}' is distinct from mm.evidencia_hash
            or fi.snapshots #>> '{medicaoMensal,conferente}' is distinct from mm.conferente
          )`,
      [folha.id],
    );
    if (medicoesAlteradas.rows[0].total > 0) {
      throw new Error(
        "Uma medição mensal mudou após o processamento. Reprocesse e obtenha nova aprovação do RH.",
      );
    }
    const conferencia = await client.query<{ resultado: string }>(
      `select resultado
         from folha_conferencia
        where empresa_id = $1 and folha_id = $2 and hash_resultado = $3
        order by criado_em desc, id desc
        limit 1`,
      [folha.empresa_id, folha.id, hashAtual],
    );
    if (conferencia.rows[0]?.resultado !== "APROVADA") {
      throw new Error(
        "A revisão atual precisa de aprovação registrada pelo RH antes do fechamento.",
      );
    }
    await client.query(
      `update folha
          set status = 'FECHADA', fechada_em = now(), atualizado_em = now()
        where id = $1`,
      [folha.id],
    );
    await inserirHistorico(
      client,
      folha.id,
      "ABERTA",
      "FECHADA",
      ator,
      "Memória e hash conferidos antes do fechamento.",
    );
    return { folhaId: folha.id, hashResultado: hashAtual };
  });
}

export async function registrarConferenciaFolha({
  empresaId,
  folhaId,
  resultado,
  conferente,
  confirmouCadastros,
  confirmouValores,
  confirmouRubricas,
  observacao,
}: {
  empresaId: string;
  folhaId: string;
  resultado: string;
  conferente: string;
  confirmouCadastros: boolean;
  confirmouValores: boolean;
  confirmouRubricas: boolean;
  observacao: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(folhaId, "Folha");
  const decisao = normalizarConferenciaFolha({
    resultado,
    conferente,
    confirmouCadastros,
    confirmouValores,
    confirmouRubricas,
    observacao,
  });

  return transacao(async (client) => {
    await configurarAuditoria(
      client,
      decisao.conferente,
      `Conferência de Folha registrada como ${decisao.resultado}.`,
    );
    const atual = await client.query<{
      revisao: number;
      status: StatusFolha;
      hash_resultado: string | null;
    }>(
      `select revisao, status, hash_resultado
         from folha
        where id = $1 and empresa_id = $2
        for update`,
      [folhaId, empresaId],
    );
    const folha = atual.rows[0];
    if (!folha || folha.status !== "ABERTA" || !folha.hash_resultado) {
      throw new Error(
        "Somente uma Folha aberta e processada pode receber conferência.",
      );
    }

    const inserida = await client.query(
      `insert into folha_conferencia
         (empresa_id, folha_id, revisao, hash_resultado, resultado,
          conferente, confirmou_cadastros, confirmou_valores,
          confirmou_rubricas, observacao)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id, revisao, hash_resultado, resultado, conferente,
                 confirmou_cadastros, confirmou_valores, confirmou_rubricas,
                 observacao, criado_em`,
      [
        empresaId,
        folhaId,
        folha.revisao,
        folha.hash_resultado,
        decisao.resultado,
        decisao.conferente,
        decisao.confirmouCadastros,
        decisao.confirmouValores,
        decisao.confirmouRubricas,
        decisao.observacao,
      ],
    );
    return inserida.rows[0];
  });
}

export async function reabrirFolha(
  folhaId: string,
  motivo: string,
  ator = "OPERADOR_INTERNO",
) {
  validarId(folhaId, "Folha");
  const justificativa = motivo.trim();
  if (justificativa.length < 10 || justificativa.length > 2_000) {
    throw new Error("Informe um motivo de reabertura com 10 a 2.000 caracteres.");
  }
  return transacao(async (client) => {
    await configurarAuditoria(client, ator, justificativa);
    await bloquearCompetenciaDaFolha(client, folhaId);
    const obrigacoesEmitidas = await client.query<{ total: number }>(
      `select count(*)::int total
         from obrigacao_fiscal_folha fonte
         join obrigacao_fiscal obrigacao
           on obrigacao.id = fonte.obrigacao_id
        where fonte.folha_id = $1 and obrigacao.status = 'EMITIDA'`,
      [folhaId],
    );
    if (obrigacoesEmitidas.rows[0].total > 0) {
      throw new Error(
        "A Folha compõe uma obrigação já emitida. Registre o procedimento fiscal de retificação antes de reabri-la.",
      );
    }
    await client.query(
      `update obrigacao_fiscal obrigacao
          set status = 'BLOQUEADA',
              valor_declarado = null,
              diferenca = null,
              conciliada_em = null,
              bloqueio_motivo =
                'Uma Folha de origem foi reaberta. Reapure a competência.'
        where obrigacao.id in (
          select fonte.obrigacao_id
            from obrigacao_fiscal_folha fonte
           where fonte.folha_id = $1
        )
          and obrigacao.status in ('BLOQUEADA', 'APURADA')`,
      [folhaId],
    );
    await client.query(
      `update obrigacao_fiscal_documento documento
          set verificado = false,
              conteudo = conteudo || jsonb_build_object(
                'invalidadoPorReaberturaDaFolhaEm', now(),
                'folhaId', $1::uuid,
                'motivo', $2::text
              )
        where documento.obrigacao_id in (
          select fonte.obrigacao_id
            from obrigacao_fiscal_folha fonte
           where fonte.folha_id = $1
        )
          and documento.verificado`,
      [folhaId, justificativa],
    );
    await client.query(
      "select set_config('app.permitir_reabertura', 'true', true)",
    );
    const atualizada = await client.query<{ id: string }>(
      `update folha
          set status = 'ABERTA', atualizado_em = now()
        where id = $1 and status = 'FECHADA'
        returning id`,
      [folhaId],
    );
    if (!atualizada.rows[0]) throw new Error("Folha fechada não encontrada.");
    await inserirHistorico(
      client,
      folhaId,
      "FECHADA",
      "ABERTA",
      ator,
      justificativa,
    );
    return { folhaId };
  });
}

export async function cancelarFolha(
  folhaId: string,
  motivo: string,
  ator = "OPERADOR_INTERNO",
) {
  validarId(folhaId, "Folha");
  const justificativa = normalizarMotivoCancelamento(motivo, "Folha");
  return transacao(async (client) => {
    await configurarAuditoria(client, ator, justificativa);
    await bloquearCompetenciaDaFolha(client, folhaId);
    const atual = await client.query<{
      id: string;
      empresa_id: string;
      status: StatusFolha;
    }>(
      `select id, empresa_id, status
         from folha
        where id = $1
        for update`,
      [folhaId],
    );
    const folha = atual.rows[0];
    if (!folha) throw new Error("Folha não encontrada.");
    validarStatusCancelamentoFolha(folha.status);
    await client.query(
      `update tarefa_processamento
          set status = 'CANCELADA',
              concluida_em = now(),
              atualizado_em = now(),
              ultimo_erro = 'Cancelada junto com a Folha pelo operador.'
        where empresa_id = $1
          and tipo = 'PROCESSAR_FOLHA'
          and status = 'PENDENTE'
          and payload ->> 'folhaId' = $2`,
      [folha.empresa_id, folha.id],
    );
    await client.query(
      `update folha
          set status = 'CANCELADA', fechada_em = null, atualizado_em = now()
        where id = $1`,
      [folha.id],
    );
    await inserirHistorico(
      client,
      folha.id,
      folha.status,
      "CANCELADA",
      ator,
      justificativa,
    );
    return { folhaId: folha.id };
  });
}

export async function listarFolhas(empresaId: string) {
  validarId(empresaId, "Empresa");
  const resultado = await getPool().query(
    `select f.id, f.competencia::text, f.numero, f.revisao, f.status,
            f.processada_em, f.fechada_em, f.hash_resultado,
            t.numero termo_numero, m.codigo meta_codigo,
            count(i.id)::int prestadores,
            coalesce(sum(i.total_proventos), 0)::text proventos,
            coalesce(sum(i.total_descontos), 0)::text descontos,
            coalesce(sum(i.valor_inss), 0)::text inss,
            coalesce(sum(i.valor_irrf), 0)::text irrf,
            coalesce(sum(i.total_liquido), 0)::text liquido
       from folha f
       join termo t on t.id = f.termo_id
       join termo_meta m on m.id = f.meta_id
       left join folha_item i on i.folha_id = f.id
      where f.empresa_id = $1
      group by f.id, t.numero, m.codigo
      order by f.competencia desc, f.numero desc
      limit 120`,
    [empresaId],
  );
  return resultado.rows;
}

export async function listarOpcoesNovaFolha(
  empresaId: string,
  competencia: string,
) {
  validarId(empresaId, "Empresa");
  const competenciaData = competenciaNormalizada(competencia);
  const resultado = await getPool().query(
    `select t.id termo_id, t.numero termo_numero, t.descricao termo_descricao,
            t.inicio::text termo_inicio, t.fim::text termo_fim,
            m.id meta_id, m.codigo meta_codigo, m.descricao meta_descricao,
            count(distinct v.id)::int vinculos,
            count(distinct v.id) filter (
              where p.tipo = 'FISICA'
            )::int vinculos_pf,
            count(distinct v.id) filter (
              where v.exige_medicao_mensal and mm.id is null
            )::int medicoes_pendentes,
            count(distinct v.id) filter (
              where conta.id is null
                 or nullif(btrim(conta.agencia), '') is null
                 or nullif(btrim(conta.numero), '') is null
                 or conta.tipo not in ('CORRENTE', 'POUPANCA')
            )::int contas_pendentes,
            count(distinct v.id) filter (
              where (p.tipo = 'FISICA' and p.cpf is null)
                 or (p.tipo = 'JURIDICA' and p.cnpj is null)
            )::int documentos_pendentes,
            count(distinct v.id) filter (
              where p.tipo = 'FISICA'
                and exists (
                select 1
                  from contribuicao_outra_fonte cof
                 where cof.empresa_id = v.empresa_id
                   and cof.prestador_id = pr.id
                   and cof.competencia = $2::date
                   and not cof.comprovante_verificado
              )
            )::int outras_fontes_pendentes,
            exists (
              select 1 from folha existente
               where existente.empresa_id = t.empresa_id
                 and existente.termo_id = t.id
                 and existente.meta_id = m.id
                 and existente.competencia = $2::date
                 and existente.status <> 'CANCELADA'
            ) folha_existente
       from termo t
       join termo_meta m on m.termo_id = t.id
       left join prestador_vinculo v
         on v.empresa_id = t.empresa_id
        and v.termo_id = t.id
        and v.meta_id = m.id
        and v.ativo
        and v.inicio <= $2::date
        and (v.fim is null or v.fim >= $2::date)
       left join prestador pr
         on pr.empresa_id = v.empresa_id
        and pr.id = v.prestador_id
        and pr.ativo
       left join pessoa p
         on p.empresa_id = v.empresa_id
        and p.id = pr.pessoa_id
        and p.ativo
       left join pessoa_conta_bancaria conta
         on conta.empresa_id = v.empresa_id
        and conta.pessoa_id = p.id
       left join medicao_mensal mm
         on mm.empresa_id = v.empresa_id
        and mm.vinculo_id = v.id
        and mm.competencia = $2::date
      where t.empresa_id = $1 and t.ativo and m.ativo
        and t.inicio <= $2::date
        and (t.fim is null or t.fim >= $2::date)
        and not exists (
          select 1
            from legado_chave chave
            join classificacao_operacional_legado classificacao
              on classificacao.empresa_id = chave.empresa_id
             and classificacao.origem = chave.origem
             and classificacao.entidade = 'prestador'
             and classificacao.legacy_id = chave.legacy_id
             and classificacao.status = 'CONFIRMADA'
             and classificacao.natureza <> 'PAGAMENTO_PRESTADOR'
           where chave.empresa_id = v.empresa_id
             and chave.origem = 'GIW'
             and chave.entidade = 'prestadores'
             and chave.destino_tabela = 'prestador'
             and chave.destino_id = pr.id
        )
      group by t.id, m.id
      order by t.numero, m.codigo`,
    [empresaId, competenciaData],
  );
  return resultado.rows;
}

export async function carregarFolha(empresaId: string, folhaId: string) {
  validarId(empresaId, "Empresa");
  validarId(folhaId, "Folha");
  const [cabecalho, itens, historico, conferencias, processamento] =
    await Promise.all([
    getPool().query(
      `select f.id, f.competencia::text, f.numero, f.revisao, f.status,
              f.processada_em, f.fechada_em, f.hash_resultado,
              t.numero termo_numero, t.descricao termo_descricao,
               m.codigo meta_codigo, m.descricao meta_descricao,
               r.codigo regra_codigo, r.versao regra_versao,
               r.hash_conteudo regra_hash,
               ep.regime regime_previdenciario,
               ep.aliquota_segurado_numerador,
               ep.aliquota_segurado_denominador,
               ep.aliquota_patronal_numerador,
               ep.aliquota_patronal_denominador
          from folha f
         join termo t on t.id = f.termo_id
         join termo_meta m on m.id = f.meta_id
          left join regra_calculo_versao r on r.id = f.regra_calculo_id
          left join enquadramento_previdenciario ep
            on ep.id = f.enquadramento_previdenciario_id
           and ep.empresa_id = f.empresa_id
        where f.id = $1 and f.empresa_id = $2`,
      [folhaId, empresaId],
    ),
    getPool().query(
      `select i.id, i.total_proventos::text, i.total_descontos::text,
              i.base_inss::text, i.valor_inss::text, i.base_irrf::text,
              i.valor_irrf::text, i.total_liquido::text, i.memoria,
              i.snapshots,
              coalesce(classificacao.natureza, 'PAGAMENTO_PRESTADOR') natureza_operacional,
              coalesce(
                jsonb_agg(to_jsonb(l) order by l.ordem)
                  filter (where l.id is not null),
                '[]'::jsonb
              ) eventos
         from folha_item i
         left join lateral (
           select classificacao.natureza
             from legado_chave chave
             join classificacao_operacional_legado classificacao
               on classificacao.empresa_id = chave.empresa_id
              and classificacao.origem = chave.origem
              and classificacao.entidade = 'prestador'
              and classificacao.legacy_id = chave.legacy_id
              and classificacao.status = 'CONFIRMADA'
            where chave.empresa_id = i.empresa_id
              and chave.origem = 'GIW'
              and chave.entidade = 'prestadores'
              and chave.destino_tabela = 'prestador'
              and chave.destino_id::text = i.snapshots #>> '{prestador,id}'
            limit 1
         ) classificacao on true
         left join folha_item_evento l on l.folha_item_id = i.id
        where i.folha_id = $1 and i.empresa_id = $2
        group by i.id, classificacao.natureza
        order by i.snapshots #>> '{pessoa,nome}'`,
      [folhaId, empresaId],
    ),
    getPool().query(
      `select status_anterior, status_novo, ator, motivo, ocorrido_em
         from folha_status_historico
        where folha_id = $1
        order by ocorrido_em desc`,
      [folhaId],
    ),
    getPool().query(
      `select id, revisao, hash_resultado, resultado, conferente,
              confirmou_cadastros, confirmou_valores, confirmou_rubricas,
              observacao, criado_em
         from folha_conferencia
        where folha_id = $1 and empresa_id = $2
        order by criado_em desc, id desc
        limit 50`,
      [folhaId, empresaId],
    ),
    getPool().query<{
      id: string;
      status: "PENDENTE" | "EXECUTANDO" | "CONCLUIDA" | "FALHA" | "CANCELADA";
      tentativas: number;
      max_tentativas: number;
      ultimo_erro: string | null;
      criado_em: Date;
      atualizado_em: Date;
      iniciada_em: Date | null;
      concluida_em: Date | null;
    }>(
      `select id, status, tentativas, max_tentativas, ultimo_erro,
              criado_em, atualizado_em, iniciada_em, concluida_em
         from tarefa_processamento
        where empresa_id = $2
          and tipo = 'PROCESSAR_FOLHA'
          and payload ->> 'folhaId' = $1
        order by criado_em desc, id desc
        limit 1`,
      [folhaId, empresaId],
    ),
  ]);
  if (!cabecalho.rows[0]) throw new Error("Folha não encontrada.");
  return {
    folha: cabecalho.rows[0],
    itens: itens.rows,
    historico: historico.rows,
    conferencias: conferencias.rows,
    processamento: processamento.rows[0] ?? null,
  };
}
