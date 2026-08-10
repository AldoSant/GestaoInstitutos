import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { RateioConsolidadoFonte } from "@/lib/aplicacao-consolidacao";
import { processarPessoaConsolidada } from "@/lib/consolidacao-fiscal";
import { decimalParaInteiro } from "@/lib/dinheiro";
import { hashJson } from "@/lib/json-canonico";
import type {
  EntradaVinculoFolha,
  EventoCompetencia,
} from "@/lib/processamento-folha";
import {
  conteudoFontesSimulacao,
  normalizarTransicaoSimulacao,
  type StatusSimulacaoFiscal,
} from "@/lib/simulacao-consolidacao";
import { competenciaConsolidacao, diagnosticarConsolidacaoMensal } from "./consolidacoes";
import { carregarEnquadramentoPorCompetencia } from "./enquadramentos";
import { getPool } from "./index";
import { carregarRegraFiscalPorCompetencia } from "./regras";

type Executor = Pick<PoolClient, "query">;

type LinhaCaso = {
  id: string;
  empresa_id: string;
  pessoa_id: string;
  competencia: string;
  hash_fontes: string;
  status: "PENDENTE" | "EM_ANALISE" | "RESOLVIDO" | "INVALIDADO";
  decisao: "UNIFICAR_VINCULOS" | "RATEIO_NECESSARIO" | "NAO_APLICAVEL" | null;
  nome: string;
  documento: string;
};

type OutraFonte = EntradaVinculoFolha["outrasFontes"][number];

type LinhaFonte = {
  vinculo_id: string;
  prestador_id: string;
  matricula: string;
  termo_id: string;
  termo_numero: string;
  meta_id: string;
  meta_codigo: string;
  atividade: string;
  tipo_pessoa: "FISICA" | "JURIDICA";
  categoria_contribuinte: string | null;
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
  aliquota_inss_percentual: string | null;
  desconta_irrf: boolean;
  isento_inss: boolean;
  base_outras_fontes: string;
  outras_fontes: OutraFonte[];
  outras_fontes_pendentes: number;
  dependentes_irrf: number;
  folha_id: string | null;
  folha_numero: number | null;
  folha_status: string | null;
  evento_id: string | null;
  evento_codigo: string | null;
  evento_descricao: string | null;
  evento_natureza: EventoCompetencia["natureza"] | null;
  evento_tipo_calculo: EventoCompetencia["tipoCalculo"] | null;
  evento_valor: string | null;
  evento_incide_inss: boolean | null;
  evento_incide_irrf: boolean | null;
};

export type SimulacaoConsolidacaoFiscal = {
  id: string;
  caso_id: string;
  pessoa_id: string;
  nome: string;
  documento: string;
  competencia: string;
  versao: number;
  status: StatusSimulacaoFiscal;
  hipotese_rateio: "PROPORCIONAL_MAIOR_RESTO";
  hash_fontes: string;
  hash_regra: string;
  hash_enquadramento: string;
  hash_resultado: string;
  total_proventos: string;
  total_descontos: string;
  total_liquido: string;
  base_inss_bruta: string;
  base_inss: string;
  valor_inss: string;
  rendimentos_irrf: string;
  base_irrf: string;
  irrf_bruto: string;
  irrf_reducao: string;
  valor_irrf: string;
  memoria: Record<string, unknown>;
  responsavel: string | null;
  justificativa: string;
  decidido_em: Date | null;
  criado_por: string;
  criado_em: Date;
  atualizado_em: Date;
  fontes: Array<{
    id: string;
    vinculoId: string;
    medicaoId: string | null;
    folhaId: string | null;
    ordem: number;
    hashEntrada: string;
    totalProventos: string;
    descontosEventos: string;
    totalDescontos: string;
    totalLiquido: string;
    baseInssBruta: string;
    baseInssRateada: string;
    valorInssRateado: string;
    baseIrrfBruta: string;
    baseIrrfRateada: string;
    irrfBrutoRateado: string;
    irrfReducaoRateada: string;
    valorIrrfRateado: string;
    snapshot: Record<string, unknown>;
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

function atorNormalizado(valor: string) {
  const ator = valor.trim();
  if (ator.length < 3 || ator.length > 160) {
    throw new Error("O responsável deve ter entre 3 e 160 caracteres.");
  }
  return ator;
}

function moedaSql(centavos: number) {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error("O cálculo produziu valor monetário inseguro.");
  }
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  return `${sinal}${Math.floor(absoluto / 100)}.${String(absoluto % 100).padStart(2, "0")}`;
}

async function configurarAuditoria(
  client: PoolClient,
  ator: string,
  motivo: string,
) {
  await client.query(
    `select set_config('app.ator', $1, true),
            set_config('app.motivo', $2, true)`,
    [ator, motivo],
  );
}

async function carregarCaso(
  executor: Executor,
  empresaId: string,
  casoId: string,
  bloquear = false,
) {
  const resultado = await executor.query<LinhaCaso>(
    `select caso.id, caso.empresa_id, caso.pessoa_id,
            caso.competencia::text, caso.hash_fontes, caso.status,
            caso.decisao, pessoa.nome_razao_social nome,
            coalesce(pessoa.cpf, pessoa.cnpj, '') documento
       from consolidacao_mensal_caso caso
       join pessoa
         on pessoa.empresa_id = caso.empresa_id and pessoa.id = caso.pessoa_id
      where caso.empresa_id = $1 and caso.id = $2
      ${bloquear ? "for update of caso" : ""}`,
    [empresaId, casoId],
  );
  if (!resultado.rows[0]) {
    throw new Error("Caso de consolidação não encontrado.");
  }
  return resultado.rows[0];
}

async function exigirCasoAtual(
  executor: Executor,
  caso: LinhaCaso,
) {
  if (
    caso.status !== "RESOLVIDO" ||
    !["RATEIO_NECESSARIO", "UNIFICAR_VINCULOS"].includes(caso.decisao ?? "")
  ) {
    throw new Error(
      "A simulação exige caso resolvido como rateio necessário ou unificação de vínculos.",
    );
  }
  const competencia = caso.competencia.slice(0, 7);
  const diagnostico = await diagnosticarConsolidacaoMensal(
    caso.empresa_id,
    competencia,
    executor,
  );
  const atual = diagnostico.conflitos.find(
    (conflito) => conflito.pessoa_id === caso.pessoa_id,
  );
  if (!atual || atual.hash_fontes !== caso.hash_fontes) {
    throw new Error(
      "As fontes do caso mudaram. Congele e decida a nova versão antes de simular.",
    );
  }
}

async function carregarLinhasFontes(
  executor: Executor,
  caso: LinhaCaso,
) {
  const resultado = await executor.query<LinhaFonte>(
    `select vinculo.id vinculo_id, prestador.id prestador_id,
            prestador.matricula, termo.id termo_id, termo.numero termo_numero,
            meta.id meta_id, meta.codigo meta_codigo, vinculo.atividade,
            pessoa.tipo tipo_pessoa, prestador.categoria_contribuinte,
            coalesce(medicao.valor_apurado, vinculo.valor_retribuicao)::text
              valor_retribuicao,
            vinculo.valor_retribuicao::text valor_contratual,
            vinculo.exige_medicao_mensal,
            medicao.id medicao_id, medicao.tipo medicao_tipo,
            medicao.percentual::text medicao_percentual,
            medicao.quantidade::text medicao_quantidade,
            medicao.valor_unitario::text medicao_valor_unitario,
            medicao.valor_apurado::text medicao_valor_apurado,
            medicao.evidencia_referencia medicao_evidencia_referencia,
            medicao.evidencia_hash medicao_evidencia_hash,
            medicao.conferente medicao_conferente,
            medicao.conferida_em::text medicao_conferida_em,
            vinculo.desconta_inss, vinculo.aliquota_inss_percentual::text,
            vinculo.desconta_irrf,
            prestador.isento_inss,
            coalesce((
              select sum(outra.base_contribuicao)
                from contribuicao_outra_fonte outra
                join prestador prestador_outra
                  on prestador_outra.empresa_id = outra.empresa_id
                 and prestador_outra.id = outra.prestador_id
               where outra.empresa_id = vinculo.empresa_id
                 and prestador_outra.pessoa_id = pessoa.id
                 and outra.competencia = $3::date
                 and outra.comprovante_verificado
            ), 0)::text base_outras_fontes,
            coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'fontePagadora', outra.fonte_pagadora,
                  'documentoFonte', outra.documento_fonte,
                  'baseContribuicao', outra.base_contribuicao::text,
                  'valorContribuicao', outra.valor_contribuicao::text,
                  'documentoReferencia', outra.documento_referencia
                )
                order by outra.documento_fonte, outra.documento_referencia,
                         outra.fonte_pagadora
              )
                from contribuicao_outra_fonte outra
                join prestador prestador_outra
                  on prestador_outra.empresa_id = outra.empresa_id
                 and prestador_outra.id = outra.prestador_id
               where outra.empresa_id = vinculo.empresa_id
                 and prestador_outra.pessoa_id = pessoa.id
                 and outra.competencia = $3::date
                 and outra.comprovante_verificado
            ), '[]'::jsonb) outras_fontes,
            (
              select count(*)::int
                from contribuicao_outra_fonte outra
                join prestador prestador_outra
                  on prestador_outra.empresa_id = outra.empresa_id
                 and prestador_outra.id = outra.prestador_id
               where outra.empresa_id = vinculo.empresa_id
                 and prestador_outra.pessoa_id = pessoa.id
                 and outra.competencia = $3::date
                 and not outra.comprovante_verificado
            ) outras_fontes_pendentes,
            (
              select count(*)::int
                from dependente
               where dependente.empresa_id = vinculo.empresa_id
                 and dependente.pessoa_id = pessoa.id
                 and dependente.ativo
                 and (
                   dependente.baixa_irrf is null
                   or dependente.baixa_irrf >= $3::date
                 )
            ) dependentes_irrf,
            folha.id folha_id, folha.numero folha_numero,
            folha.status::text folha_status,
            evento.id evento_id, evento.codigo evento_codigo,
            evento.descricao evento_descricao,
            evento.natureza evento_natureza,
            evento.tipo_calculo evento_tipo_calculo,
            lancamento.valor::text evento_valor,
            evento.incide_inss evento_incide_inss,
            evento.incide_irrf evento_incide_irrf
       from consolidacao_mensal_fonte caso_fonte
       join prestador_vinculo vinculo
         on vinculo.empresa_id = caso_fonte.empresa_id
        and vinculo.id = caso_fonte.vinculo_id
       join prestador
         on prestador.empresa_id = vinculo.empresa_id
        and prestador.id = vinculo.prestador_id
       join pessoa
         on pessoa.empresa_id = prestador.empresa_id
        and pessoa.id = prestador.pessoa_id
       join termo
         on termo.empresa_id = vinculo.empresa_id and termo.id = vinculo.termo_id
       join termo_meta meta
         on meta.id = vinculo.meta_id and meta.termo_id = termo.id
       left join medicao_mensal medicao
         on medicao.empresa_id = vinculo.empresa_id
        and medicao.vinculo_id = vinculo.id
        and medicao.competencia = $3::date
       left join lateral (
         select f.id, f.numero, f.status
           from folha f
          where f.empresa_id = vinculo.empresa_id
            and f.termo_id = vinculo.termo_id
            and f.meta_id = vinculo.meta_id
            and f.competencia = $3::date
            and f.status <> 'CANCELADA'
          order by f.revisao desc, f.numero desc
          limit 1
       ) folha on true
       left join lancamento_evento_recorrente lancamento
         on lancamento.empresa_id = vinculo.empresa_id
        and lancamento.vinculo_id = vinculo.id
        and lancamento.ativo
        and lancamento.inicio_competencia <= $3::date
        and (
          lancamento.fim_competencia is null
          or lancamento.fim_competencia >= $3::date
        )
       left join evento
         on evento.id = lancamento.evento_id and evento.ativo
      where caso_fonte.empresa_id = $1 and caso_fonte.caso_id = $2
        and prestador.pessoa_id = $4
      order by vinculo.id, evento.codigo, evento.id`,
    [caso.empresa_id, caso.id, caso.competencia, caso.pessoa_id],
  );
  if (resultado.rowCount === 0) {
    throw new Error("O caso não possui fontes disponíveis para simulação.");
  }
  return resultado.rows;
}

function montarEntradas(
  linhas: LinhaFonte[],
  enquadramento: Awaited<ReturnType<typeof carregarEnquadramentoPorCompetencia>>,
) {
  const grupos = new Map<string, LinhaFonte[]>();
  for (const linha of linhas) {
    const grupo = grupos.get(linha.vinculo_id) ?? [];
    grupo.push(linha);
    grupos.set(linha.vinculo_id, grupo);
  }
  if (grupos.size < 2) {
    throw new Error("A consolidação fiscal exige pelo menos dois vínculos.");
  }
  const entradas: EntradaVinculoFolha[] = [];
  const origens = new Map<string, Record<string, unknown>>();
  for (const [vinculoId, grupo] of grupos) {
    const base = grupo[0];
    if (base.exige_medicao_mensal && !base.medicao_id) {
      throw new Error(
        `O vínculo ${vinculoId} exige medição conferida antes da simulação.`,
      );
    }
    if (base.outras_fontes_pendentes > 0) {
      throw new Error(
        "Há comprovante de contribuição em outra fonte ainda não verificado.",
      );
    }
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
    entradas.push({
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
      aliquotaInssPercentual: base.aliquota_inss_percentual,
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
    });
    origens.set(vinculoId, {
      prestadorId: base.prestador_id,
      matricula: base.matricula,
      termoId: base.termo_id,
      termoNumero: base.termo_numero,
      metaId: base.meta_id,
      metaCodigo: base.meta_codigo,
      atividade: base.atividade,
      medicaoId: base.medicao_id,
      folhaId: base.folha_id,
      folhaNumero: base.folha_numero,
      folhaStatus: base.folha_status,
    });
  }
  return {
    entradas: entradas.sort((a, b) => a.vinculoId.localeCompare(b.vinculoId)),
    origens,
  };
}

async function carregarContextoCalculo(executor: Executor, caso: LinhaCaso) {
  const [regra, enquadramento, linhas] = await Promise.all([
    carregarRegraFiscalPorCompetencia(
      caso.competencia.slice(0, 7),
      caso.empresa_id,
      executor,
    ),
    carregarEnquadramentoPorCompetencia(
      caso.empresa_id,
      caso.competencia,
      executor,
    ),
    carregarLinhasFontes(executor, caso),
  ]);
  const fontes = montarEntradas(linhas, enquadramento);
  const hashFontes = hashJson(
    conteudoFontesSimulacao({
      competencia: caso.competencia.slice(0, 7),
      pessoaId: caso.pessoa_id,
      fontes: fontes.entradas,
    }),
  );
  const snapshotEnquadramento = {
    id: enquadramento.id,
    empresaId: enquadramento.empresa_id,
    regime: enquadramento.regime,
    inicioVigencia: enquadramento.inicio_vigencia,
    fimVigencia: enquadramento.fim_vigencia,
    aliquotaSeguradoNumerador: enquadramento.aliquota_segurado_numerador,
    aliquotaSeguradoDenominador: enquadramento.aliquota_segurado_denominador,
    aliquotaPatronalNumerador: enquadramento.aliquota_patronal_numerador,
    aliquotaPatronalDenominador: enquadramento.aliquota_patronal_denominador,
    cebasNumero: enquadramento.cebas_numero,
    cebasInicio: enquadramento.cebas_inicio,
    cebasFim: enquadramento.cebas_fim,
    evidencia: enquadramento.evidencia,
    fonteNormativa: enquadramento.fonte_normativa,
  };
  return {
    regra,
    enquadramento,
    snapshotEnquadramento,
    hashEnquadramento: hashJson(snapshotEnquadramento),
    hashFontes,
    ...fontes,
  };
}

export async function criarSimulacaoConsolidacaoFiscal({
  empresaId,
  casoId,
  ator,
}: {
  empresaId: string;
  casoId: string;
  ator: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(casoId, "Caso");
  const responsavel = atorNormalizado(ator);
  const client = await getPool().connect();
  try {
    await client.query("begin isolation level serializable");
    await configurarAuditoria(
      client,
      responsavel,
      "Criação de simulação fiscal consolidada sem efeito produtivo.",
    );
    const caso = await carregarCaso(client, empresaId, casoId, true);
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `SIMULACAO_FISCAL:${empresaId}:${caso.pessoa_id}:${caso.competencia}`,
    ]);
    await exigirCasoAtual(client, caso);
    const contexto = await carregarContextoCalculo(client, caso);
    const existente = await client.query<{ id: string; versao: number }>(
      `select id, versao
         from consolidacao_fiscal_simulacao
        where empresa_id = $1 and competencia = $2::date
          and pessoa_id = $3 and hash_fontes = $4
        limit 1`,
      [empresaId, caso.competencia, caso.pessoa_id, contexto.hashFontes],
    );
    if (existente.rows[0]) {
      await client.query("commit");
      return { ...existente.rows[0], reutilizada: true };
    }

    const resultado = processarPessoaConsolidada(
      contexto.entradas,
      contexto.regra.parametros,
    );
    if (
      resultado.totalLiquidoCentavos < 0 ||
      resultado.fontes.some((fonte) => fonte.totalLiquidoCentavos < 0)
    ) {
      throw new Error(
        "A simulação produziu líquido negativo e exige saneamento dos Eventos.",
      );
    }
    const versao = await client.query<{ proxima: number }>(
      `select coalesce(max(versao), 0)::int + 1 proxima
         from consolidacao_fiscal_simulacao
        where empresa_id = $1 and competencia = $2::date and pessoa_id = $3`,
      [empresaId, caso.competencia, caso.pessoa_id],
    );
    const simulacaoId = randomUUID();
    const memoria = {
      ...resultado.memoria,
      competencia: caso.competencia.slice(0, 7),
      pessoa: {
        id: caso.pessoa_id,
        nome: caso.nome,
        documento: caso.documento,
      },
      caso: {
        id: caso.id,
        decisao: caso.decisao,
        hashFontesDiagnostico: caso.hash_fontes,
      },
      regra: {
        id: contexto.regra.id,
        codigo: contexto.regra.codigo,
        versao: contexto.regra.versao,
        hashConteudo: contexto.regra.hashConteudo,
        fonteNormativa: contexto.regra.fonteNormativa,
      },
      enquadramento: contexto.snapshotEnquadramento,
    };
    const hashResultado = hashJson({
      versaoMotor: 1,
      empresaId,
      simulacaoId,
      casoId,
      pessoaId: caso.pessoa_id,
      competencia: caso.competencia,
      hashFontes: contexto.hashFontes,
      hashRegra: contexto.regra.hashConteudo,
      hashEnquadramento: contexto.hashEnquadramento,
      resultado,
      memoria,
    });
    await client.query(
      `insert into consolidacao_fiscal_simulacao
         (id, empresa_id, caso_id, pessoa_id, competencia, regra_calculo_id,
          enquadramento_previdenciario_id, versao, hash_fontes, hash_regra,
          hash_enquadramento, hash_resultado, total_proventos, total_descontos,
          total_liquido, base_inss_bruta, base_inss, valor_inss,
          rendimentos_irrf, base_irrf, irrf_bruto, irrf_reducao, valor_irrf,
          memoria, criado_por)
       values ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12,
               $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
               $24, $25)`,
      [
        simulacaoId,
        empresaId,
        casoId,
        caso.pessoa_id,
        caso.competencia,
        contexto.regra.id,
        contexto.enquadramento.id,
        versao.rows[0].proxima,
        contexto.hashFontes,
        contexto.regra.hashConteudo,
        contexto.hashEnquadramento,
        hashResultado,
        moedaSql(resultado.totalProventosCentavos),
        moedaSql(resultado.totalDescontosCentavos),
        moedaSql(resultado.totalLiquidoCentavos),
        moedaSql(resultado.baseInssBrutaCentavos),
        moedaSql(resultado.baseInssCentavos),
        moedaSql(resultado.valorInssCentavos),
        moedaSql(resultado.rendimentosIrrfCentavos),
        moedaSql(resultado.baseIrrfCentavos),
        moedaSql(resultado.irrfBrutoCentavos),
        moedaSql(resultado.irrfReducaoCentavos),
        moedaSql(resultado.valorIrrfCentavos),
        memoria,
        responsavel,
      ],
    );
    const fontes = resultado.fontes.map((fonte, indice) => {
      const entrada = contexto.entradas.find(
        (item) => item.vinculoId === fonte.vinculoId,
      )!;
      const origem = contexto.origens.get(fonte.vinculoId)!;
      return {
        id: randomUUID(),
        empresaId,
        simulacaoId,
        vinculoId: fonte.vinculoId,
        medicaoId: origem.medicaoId,
        folhaId: origem.folhaId,
        ordem: indice + 1,
        hashEntrada: hashJson(entrada),
        totalProventos: moedaSql(fonte.totalProventosCentavos),
        descontosEventos: moedaSql(fonte.descontosEventosCentavos),
        totalDescontos: moedaSql(fonte.totalDescontosCentavos),
        totalLiquido: moedaSql(fonte.totalLiquidoCentavos),
        baseInssBruta: moedaSql(fonte.baseInssBrutaCentavos),
        baseInssRateada: moedaSql(fonte.baseInssCentavos),
        valorInssRateado: moedaSql(fonte.valorInssCentavos),
        baseIrrfBruta: moedaSql(fonte.baseIrrfBrutaCentavos),
        baseIrrfRateada: moedaSql(fonte.baseIrrfCentavos),
        irrfBrutoRateado: moedaSql(fonte.irrfBrutoCentavos),
        irrfReducaoRateada: moedaSql(fonte.irrfReducaoCentavos),
        valorIrrfRateado: moedaSql(fonte.valorIrrfCentavos),
        snapshot: {
          entrada,
          origem,
          linhas: fonte.linhas,
          memoriaIndividual: fonte.memoriaIndividual,
        },
      };
    });
    await client.query(
      `insert into consolidacao_fiscal_simulacao_fonte
         (id, empresa_id, simulacao_id, vinculo_id, medicao_id, folha_id,
          ordem, hash_entrada, total_proventos, descontos_eventos,
          total_descontos, total_liquido, base_inss_bruta, base_inss_rateada,
          valor_inss_rateado, base_irrf_bruta, base_irrf_rateada,
          irrf_bruto_rateado, irrf_reducao_rateada, valor_irrf_rateado,
          snapshot)
       select item.id, item."empresaId", item."simulacaoId", item."vinculoId",
              item."medicaoId", item."folhaId", item.ordem, item."hashEntrada",
              item."totalProventos", item."descontosEventos",
              item."totalDescontos", item."totalLiquido",
              item."baseInssBruta", item."baseInssRateada",
              item."valorInssRateado", item."baseIrrfBruta",
              item."baseIrrfRateada", item."irrfBrutoRateado",
              item."irrfReducaoRateada", item."valorIrrfRateado", item.snapshot
         from jsonb_to_recordset($1::jsonb) as item(
           id uuid, "empresaId" uuid, "simulacaoId" uuid, "vinculoId" uuid,
           "medicaoId" uuid, "folhaId" uuid, ordem integer,
           "hashEntrada" text, "totalProventos" numeric,
           "descontosEventos" numeric, "totalDescontos" numeric,
           "totalLiquido" numeric, "baseInssBruta" numeric,
           "baseInssRateada" numeric, "valorInssRateado" numeric,
           "baseIrrfBruta" numeric, "baseIrrfRateada" numeric,
           "irrfBrutoRateado" numeric, "irrfReducaoRateada" numeric,
           "valorIrrfRateado" numeric, snapshot jsonb
         )`,
      [JSON.stringify(fontes)],
    );
    await client.query("commit");
    return {
      id: simulacaoId,
      versao: versao.rows[0].proxima,
      hashResultado,
      reutilizada: false,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listarSimulacoesConsolidacaoFiscal(
  empresaId: string,
  competencia: string,
  executor: Executor = getPool(),
) {
  validarId(empresaId, "Empresa");
  const data = competenciaConsolidacao(competencia);
  const resultado = await executor.query<SimulacaoConsolidacaoFiscal>(
    `select simulacao.id, simulacao.caso_id, simulacao.pessoa_id,
            pessoa.nome_razao_social nome,
            coalesce(pessoa.cpf, pessoa.cnpj, '') documento,
            simulacao.competencia::text, simulacao.versao, simulacao.status,
            simulacao.hipotese_rateio, simulacao.hash_fontes,
            simulacao.hash_regra, simulacao.hash_enquadramento,
            simulacao.hash_resultado, simulacao.total_proventos::text,
            simulacao.total_descontos::text, simulacao.total_liquido::text,
            simulacao.base_inss_bruta::text, simulacao.base_inss::text,
            simulacao.valor_inss::text, simulacao.rendimentos_irrf::text,
            simulacao.base_irrf::text, simulacao.irrf_bruto::text,
            simulacao.irrf_reducao::text, simulacao.valor_irrf::text,
            simulacao.memoria, simulacao.responsavel, simulacao.justificativa,
            simulacao.decidido_em, simulacao.criado_por, simulacao.criado_em,
            simulacao.atualizado_em,
            coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', fonte.id,
                  'vinculoId', fonte.vinculo_id,
                  'medicaoId', fonte.medicao_id,
                  'folhaId', fonte.folha_id,
                  'ordem', fonte.ordem,
                  'hashEntrada', fonte.hash_entrada,
                  'totalProventos', fonte.total_proventos::text,
                  'descontosEventos', fonte.descontos_eventos::text,
                  'totalDescontos', fonte.total_descontos::text,
                  'totalLiquido', fonte.total_liquido::text,
                  'baseInssBruta', fonte.base_inss_bruta::text,
                  'baseInssRateada', fonte.base_inss_rateada::text,
                  'valorInssRateado', fonte.valor_inss_rateado::text,
                  'baseIrrfBruta', fonte.base_irrf_bruta::text,
                  'baseIrrfRateada', fonte.base_irrf_rateada::text,
                  'irrfBrutoRateado', fonte.irrf_bruto_rateado::text,
                  'irrfReducaoRateada', fonte.irrf_reducao_rateada::text,
                  'valorIrrfRateado', fonte.valor_irrf_rateado::text,
                  'snapshot', fonte.snapshot
                )
                order by fonte.ordem
              )
                from consolidacao_fiscal_simulacao_fonte fonte
               where fonte.empresa_id = simulacao.empresa_id
                 and fonte.simulacao_id = simulacao.id
            ), '[]'::jsonb) fontes
       from consolidacao_fiscal_simulacao simulacao
       join pessoa
         on pessoa.empresa_id = simulacao.empresa_id
        and pessoa.id = simulacao.pessoa_id
      where simulacao.empresa_id = $1 and simulacao.competencia = $2::date
      order by pessoa.nome_razao_social, simulacao.versao desc`,
    [empresaId, data],
  );
  return resultado.rows;
}

export async function diagnosticarAtualidadeSimulacaoFiscal(
  empresaId: string,
  simulacaoId: string,
  executor: Executor = getPool(),
) {
  validarId(empresaId, "Empresa");
  validarId(simulacaoId, "Simulação");
  const simulacao = await executor.query<{
    caso_id: string;
    hash_fontes: string;
    hash_regra: string;
    hash_enquadramento: string;
  }>(
    `select caso_id, hash_fontes, hash_regra, hash_enquadramento
       from consolidacao_fiscal_simulacao
      where empresa_id = $1 and id = $2`,
    [empresaId, simulacaoId],
  );
  if (!simulacao.rows[0]) {
    return { atual: false, motivo: "Simulação fiscal não encontrada." };
  }
  try {
    const caso = await carregarCaso(
      executor,
      empresaId,
      simulacao.rows[0].caso_id,
    );
    await exigirCasoAtual(executor, caso);
    const contexto = await carregarContextoCalculo(executor, caso);
    const divergencias = [
      contexto.hashFontes === simulacao.rows[0].hash_fontes
        ? null
        : "FONTES",
      contexto.regra.hashConteudo === simulacao.rows[0].hash_regra
        ? null
        : "REGRA",
      contexto.hashEnquadramento === simulacao.rows[0].hash_enquadramento
        ? null
        : "ENQUADRAMENTO",
    ].filter((item): item is string => item !== null);
    return {
      atual: divergencias.length === 0,
      motivo:
        divergencias.length === 0
          ? null
          : `Divergência em ${divergencias.join(", ")}.`,
    };
  } catch (error) {
    return {
      atual: false,
      motivo:
        error instanceof Error
          ? error.message
          : "Não foi possível revalidar a simulação.",
    };
  }
}

export async function carregarRateioProdutivoHomologado({
  empresaId,
  pessoaId,
  competencia,
  exigirCoberturaFolhas = false,
  executor = getPool(),
}: {
  empresaId: string;
  pessoaId: string;
  competencia: string;
  exigirCoberturaFolhas?: boolean;
  executor?: Executor;
}) {
  validarId(empresaId, "Empresa");
  validarId(pessoaId, "Pessoa");
  const data = competenciaConsolidacao(competencia.slice(0, 7));
  const simulacao = await executor.query<{
    id: string;
    caso_id: string;
    hash_fontes: string;
    hash_regra: string;
    hash_enquadramento: string;
    hash_resultado: string;
    total_proventos: string;
    total_descontos: string;
    total_liquido: string;
    base_inss_bruta: string;
    base_inss: string;
    valor_inss: string;
    rendimentos_irrf: string;
    base_irrf: string;
    irrf_bruto: string;
    irrf_reducao: string;
    valor_irrf: string;
  }>(
    `select id, caso_id, hash_fontes, hash_regra, hash_enquadramento,
            hash_resultado, total_proventos::text, total_descontos::text,
            total_liquido::text, base_inss_bruta::text, base_inss::text,
            valor_inss::text, rendimentos_irrf::text, base_irrf::text,
            irrf_bruto::text, irrf_reducao::text, valor_irrf::text
       from consolidacao_fiscal_simulacao
      where empresa_id = $1 and pessoa_id = $2 and competencia = $3::date
        and status = 'HOMOLOGADA'
      order by versao desc
      limit 1`,
    [empresaId, pessoaId, data],
  );
  if (!simulacao.rows[0]) {
    throw new Error(
      "A Pessoa possui múltiplos Vínculos, mas não há simulação fiscal homologada.",
    );
  }
  const caso = await carregarCaso(
    executor,
    empresaId,
    simulacao.rows[0].caso_id,
  );
  if (
    caso.status !== "RESOLVIDO" ||
    !["RATEIO_NECESSARIO", "UNIFICAR_VINCULOS"].includes(caso.decisao ?? "")
  ) {
    throw new Error("O caso da simulação homologada não está resolvido para rateio.");
  }
  const contexto = await carregarContextoCalculo(executor, caso);
  if (
    contexto.hashFontes !== simulacao.rows[0].hash_fontes ||
    contexto.regra.hashConteudo !== simulacao.rows[0].hash_regra ||
    contexto.hashEnquadramento !== simulacao.rows[0].hash_enquadramento
  ) {
    throw new Error(
      "A simulação homologada ficou obsoleta após mudança em fontes ou parâmetros.",
    );
  }
  if (exigirCoberturaFolhas) {
    const semFolha = await executor.query<{
      vinculo_id: string;
      termo_numero: string;
      meta_codigo: string;
    }>(
      `select vinculo.id vinculo_id, termo.numero termo_numero,
              meta.codigo meta_codigo
         from prestador_vinculo vinculo
         join prestador
           on prestador.empresa_id = vinculo.empresa_id
          and prestador.id = vinculo.prestador_id
         join termo
           on termo.empresa_id = vinculo.empresa_id
          and termo.id = vinculo.termo_id
         join termo_meta meta
           on meta.termo_id = termo.id and meta.id = vinculo.meta_id
        where vinculo.empresa_id = $1 and prestador.pessoa_id = $2
          and vinculo.ativo and vinculo.inicio <= $3::date
          and (vinculo.fim is null or vinculo.fim >= $3::date)
          and not exists (
            select 1
              from folha
             where folha.empresa_id = vinculo.empresa_id
               and folha.termo_id = vinculo.termo_id
               and folha.meta_id = vinculo.meta_id
               and folha.competencia = $3::date
               and folha.status <> 'CANCELADA'
          )
        order by termo.numero, meta.codigo, vinculo.id`,
      [empresaId, pessoaId, data],
    );
    if (semFolha.rowCount) {
      const exemplos = semFolha.rows
        .slice(0, 5)
        .map((item) => `${item.termo_numero}/${item.meta_codigo}`)
        .join(", ");
      throw new Error(
        `Crie todas as Folhas da Pessoa antes do fechamento consolidado. ` +
          `Pendentes: ${exemplos}.`,
      );
    }
  }
  const atuais = await executor.query<{ vinculo_ids: string[] }>(
    `select coalesce(array_agg(vinculo.id::text order by vinculo.id), '{}') vinculo_ids
       from prestador_vinculo vinculo
       join prestador
         on prestador.empresa_id = vinculo.empresa_id
        and prestador.id = vinculo.prestador_id
        and prestador.ativo
      where vinculo.empresa_id = $1 and prestador.pessoa_id = $2
        and vinculo.ativo and vinculo.inicio <= $3::date
        and (vinculo.fim is null or vinculo.fim >= $3::date)`,
    [empresaId, pessoaId, data],
  );
  const fontes = await executor.query<{
    vinculo_id: string;
    total_proventos: string;
    descontos_eventos: string;
    total_descontos: string;
    total_liquido: string;
    base_inss_bruta: string;
    base_inss_rateada: string;
    valor_inss_rateado: string;
    base_irrf_bruta: string;
    base_irrf_rateada: string;
    irrf_bruto_rateado: string;
    irrf_reducao_rateada: string;
    valor_irrf_rateado: string;
  }>(
    `select vinculo_id, total_proventos::text, descontos_eventos::text,
            total_descontos::text, total_liquido::text, base_inss_bruta::text,
            base_inss_rateada::text, valor_inss_rateado::text,
            base_irrf_bruta::text, base_irrf_rateada::text,
            irrf_bruto_rateado::text, irrf_reducao_rateada::text,
            valor_irrf_rateado::text
       from consolidacao_fiscal_simulacao_fonte
      where empresa_id = $1 and simulacao_id = $2
      order by vinculo_id`,
    [empresaId, simulacao.rows[0].id],
  );
  const vinculosAtuais = atuais.rows[0]?.vinculo_ids ?? [];
  const vinculosSimulados = fontes.rows.map((fonte) => fonte.vinculo_id).sort();
  if (
    vinculosAtuais.length < 2 ||
    vinculosAtuais.length !== vinculosSimulados.length ||
    vinculosAtuais.some((vinculoId, index) => vinculoId !== vinculosSimulados[index])
  ) {
    throw new Error(
      "A composição de Vínculos mudou após a homologação da simulação fiscal.",
    );
  }
  const paraCentavos = (value: string) => decimalParaInteiro(value, 2);
  const rateios: RateioConsolidadoFonte[] = fontes.rows.map((fonte) => ({
    simulacaoId: simulacao.rows[0].id,
    hashResultado: simulacao.rows[0].hash_resultado,
    vinculoId: fonte.vinculo_id,
    totalProventosCentavos: paraCentavos(fonte.total_proventos),
    descontosEventosCentavos: paraCentavos(fonte.descontos_eventos),
    totalDescontosCentavos: paraCentavos(fonte.total_descontos),
    totalLiquidoCentavos: paraCentavos(fonte.total_liquido),
    baseInssBrutaCentavos: paraCentavos(fonte.base_inss_bruta),
    baseInssCentavos: paraCentavos(fonte.base_inss_rateada),
    valorInssCentavos: paraCentavos(fonte.valor_inss_rateado),
    baseIrrfBrutaCentavos: paraCentavos(fonte.base_irrf_bruta),
    baseIrrfCentavos: paraCentavos(fonte.base_irrf_rateada),
    irrfBrutoCentavos: paraCentavos(fonte.irrf_bruto_rateado),
    irrfReducaoCentavos: paraCentavos(fonte.irrf_reducao_rateada),
    valorIrrfCentavos: paraCentavos(fonte.valor_irrf_rateado),
  }));
  const soma = (
    campo: keyof Pick<
      RateioConsolidadoFonte,
      | "totalProventosCentavos"
      | "totalDescontosCentavos"
      | "totalLiquidoCentavos"
      | "baseInssBrutaCentavos"
      | "baseInssCentavos"
      | "valorInssCentavos"
      | "baseIrrfBrutaCentavos"
      | "baseIrrfCentavos"
      | "irrfBrutoCentavos"
      | "irrfReducaoCentavos"
      | "valorIrrfCentavos"
    >,
  ) => rateios.reduce((total, rateio) => total + rateio[campo], 0);
  const totaisEsperados = simulacao.rows[0];
  const divergencias = [
    soma("totalProventosCentavos") ===
    paraCentavos(totaisEsperados.total_proventos)
      ? null
      : "PROVENTOS",
    soma("totalDescontosCentavos") ===
    paraCentavos(totaisEsperados.total_descontos)
      ? null
      : "DESCONTOS",
    soma("totalLiquidoCentavos") ===
    paraCentavos(totaisEsperados.total_liquido)
      ? null
      : "LÍQUIDO",
    soma("baseInssBrutaCentavos") ===
    paraCentavos(totaisEsperados.base_inss_bruta)
      ? null
      : "BASE INSS BRUTA",
    soma("baseInssCentavos") === paraCentavos(totaisEsperados.base_inss)
      ? null
      : "BASE INSS",
    soma("valorInssCentavos") === paraCentavos(totaisEsperados.valor_inss)
      ? null
      : "INSS",
    soma("baseIrrfBrutaCentavos") ===
    paraCentavos(totaisEsperados.rendimentos_irrf)
      ? null
      : "RENDIMENTOS IRRF",
    soma("baseIrrfCentavos") === paraCentavos(totaisEsperados.base_irrf)
      ? null
      : "BASE IRRF",
    soma("irrfBrutoCentavos") === paraCentavos(totaisEsperados.irrf_bruto)
      ? null
      : "IRRF BRUTO",
    soma("irrfReducaoCentavos") ===
    paraCentavos(totaisEsperados.irrf_reducao)
      ? null
      : "REDUÇÃO IRRF",
    soma("valorIrrfCentavos") === paraCentavos(totaisEsperados.valor_irrf)
      ? null
      : "IRRF",
  ].filter((item): item is string => item !== null);
  if (divergencias.length) {
    throw new Error(
      `As fontes da simulação homologada não fecham com o agregado: ${divergencias.join(", ")}.`,
    );
  }
  return {
    simulacaoId: simulacao.rows[0].id,
    hashResultado: simulacao.rows[0].hash_resultado,
    pessoaId,
    competencia: data,
    fontes: rateios,
  };
}

export async function atualizarStatusSimulacaoFiscal({
  empresaId,
  simulacaoId,
  status,
  responsavel,
  justificativa,
}: {
  empresaId: string;
  simulacaoId: string;
  status: string;
  responsavel: string;
  justificativa: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(simulacaoId, "Simulação");
  const client = await getPool().connect();
  try {
    await client.query("begin isolation level serializable");
    const atual = await client.query<{
      id: string;
      caso_id: string;
      status: StatusSimulacaoFiscal;
      hash_fontes: string;
      hash_regra: string;
      hash_enquadramento: string;
    }>(
      `select id, caso_id, status, hash_fontes, hash_regra, hash_enquadramento
         from consolidacao_fiscal_simulacao
        where empresa_id = $1 and id = $2
        for update`,
      [empresaId, simulacaoId],
    );
    if (!atual.rows[0]) {
      throw new Error("Simulação fiscal não encontrada.");
    }
    const decisao = normalizarTransicaoSimulacao({
      statusAtual: atual.rows[0].status,
      statusDestino: status,
      responsavel,
      justificativa,
    });
    await configurarAuditoria(
      client,
      decisao.responsavel,
      `Simulação fiscal encaminhada para ${decisao.status}. ${decisao.justificativa}`,
    );
    if (decisao.status !== "INVALIDADA") {
      const caso = await carregarCaso(
        client,
        empresaId,
        atual.rows[0].caso_id,
        true,
      );
      await exigirCasoAtual(client, caso);
      const contexto = await carregarContextoCalculo(client, caso);
      if (
        contexto.hashFontes !== atual.rows[0].hash_fontes ||
        contexto.regra.hashConteudo !== atual.rows[0].hash_regra ||
        contexto.hashEnquadramento !== atual.rows[0].hash_enquadramento
      ) {
        throw new Error(
          "Fontes ou parâmetros mudaram após a simulação. Gere uma nova versão.",
        );
      }
    }
    await client.query(
      `update consolidacao_fiscal_simulacao
          set status = $3, responsavel = $4, justificativa = $5,
              decidido_em = $6, atualizado_em = now()
        where empresa_id = $1 and id = $2`,
      [
        empresaId,
        simulacaoId,
        decisao.status,
        decisao.responsavel,
        decisao.justificativa,
        decisao.decididoEm,
      ],
    );
    await client.query("commit");
    return { id: simulacaoId, ...decisao };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
