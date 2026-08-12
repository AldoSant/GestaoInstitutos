import { createHash } from "node:crypto";
import { decimalParaInteiro } from "../../lib/dinheiro";
import { resolverEmpresaAtiva } from "../../db/cadastros";
import { criarFolha, fecharFolha, processarFolha, registrarConferenciaFolha } from "../../db/folhas";
import { salvarMedicaoMensal } from "../../db/medicoes";
import { apurarRetencoesSegurados } from "../../db/obrigacoes";
import {
  carregarPerfilRecolhimentoPorCompetencia,
  publicarPerfilRecolhimento,
} from "../../db/perfis-recolhimento";
import { getPool } from "../../db";

type ItemLegado = {
  folha_legado_id: string;
  folha_legacy_id: string;
  competencia: string;
  termo_id: string | null;
  meta_id: string | null;
  item_legacy_id: string;
  pessoa_legacy_id: string;
  vinculo_legacy_id: string | null;
  cpf: string | null;
  cnpj: string | null;
  total_proventos: string;
  valor_inss: string;
  valor_irrf: string;
  vinculo_id: string | null;
  resolucao: "LEGADO" | "MAPEAMENTO_CONFIRMADO" | "ROTULO_UNICO" | "VINCULO_UNICO" | "SEM_DESTINO";
};

type FolhaAlvo = {
  folhaLegadoId: string;
  competencia: string;
  termoId: string;
  metaId: string;
  itens: ItemLegado[];
};

const ATOR = "REPRODUCAO_GIW_HML";

function argumentos(nome: string) {
  return process.argv.slice(2).flatMap((valor, indice, itens) =>
    valor === nome && itens[indice + 1] ? [itens[indice + 1]] : [],
  );
}

function competencias() {
  const valores = argumentos("--competencia");
  if (valores.some((valor) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor))) {
    throw new Error("Use --competencia AAAA-MM.");
  }
  return [...new Set(valores)].sort();
}

function namespaceReplay() {
  const valor = argumentos("--namespace")[0] ?? "PADRAO";
  if (!/^[A-Z0-9_-]{1,24}$/i.test(valor)) {
    throw new Error("--namespace aceita somente letras, números, _ e - (até 24 caracteres).");
  }
  return valor.toUpperCase();
}

async function resolverEmpresa() {
  const empresaId = argumentos("--empresa-id")[0];
  if (!empresaId) return resolverEmpresaAtiva();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(empresaId)) {
    throw new Error("--empresa-id deve ser um UUID válido.");
  }
  const resultado = await getPool().query<{ id: string }>(
    "select id from empresa where id = $1 and ativo",
    [empresaId],
  );
  if (resultado.rowCount !== 1) {
    throw new Error("A empresa informada não existe ou não está ativa nesta homologação.");
  }
  return { id: resultado.rows[0].id };
}

function valorEmReais(centavos: number) {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new Error("Valor histórico agregado inválido.");
  }
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

type MedicaoHistoricaAgrupada = {
  vinculoId: string;
  valor: string;
  descontaInss: boolean;
  itens: ItemLegado[];
};

function agruparMedicoesHistoricas(itens: ItemLegado[]) {
  const grupos = new Map<string, ItemLegado[]>();
  for (const item of itens) {
    if (!item.vinculo_id) throw new Error("Item histórico sem Vínculo de destino.");
    grupos.set(item.vinculo_id, [...(grupos.get(item.vinculo_id) ?? []), item]);
  }
  return [...grupos.entries()].map(([vinculoId, fontes]): MedicaoHistoricaAgrupada => {
    const inss = fontes.reduce(
      (total, item) => total + decimalParaInteiro(item.valor_inss, 2),
      0,
    );
    return {
      vinculoId,
      valor: valorEmReais(
        fontes.reduce(
          (total, item) => total + decimalParaInteiro(item.total_proventos, 2),
          0,
        ),
      ),
      descontaInss: inss > 0,
      itens: fontes,
    };
  });
}

function hashEvidenciaAgrupada(item: MedicaoHistoricaAgrupada) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        origem: "GIW",
        vinculoId: item.vinculoId,
        fontes: item.itens.map((fonte) => ({
          folha: fonte.folha_legacy_id,
          item: fonte.item_legacy_id,
          proventos: fonte.total_proventos,
        })),
      }),
    )
    .digest("hex");
}

async function carregarItens(empresaId: string, filtroCompetencias: string[]) {
  const resultado = await getPool().query<ItemLegado>(
    `select f.id folha_legado_id, f.legacy_id folha_legacy_id,
            to_char(f.competencia, 'YYYY-MM') competencia,
            coalesce(termo.destino_id, rotulo.termo_id, vinculo_mapeado.termo_id, candidato.termo_id) termo_id,
            coalesce(meta.destino_id, rotulo.meta_id, vinculo_mapeado.meta_id, candidato.meta_id) meta_id,
            i.legacy_id item_legacy_id, i.pessoa_legacy_id,
            i.vinculo_legacy_id, i.cpf, i.cnpj, i.total_proventos::text,
            i.valor_inss::text, i.valor_irrf::text,
            coalesce(vinculo.destino_id, item_mapeado.destino_id, candidato.vinculo_id) vinculo_id,
            case when vinculo.destino_id is not null then 'LEGADO'
                 when item_mapeado.destino_id is not null then 'MAPEAMENTO_CONFIRMADO'
                 when candidato.vinculo_id is not null
                   and rotulo.termo_id is not null and rotulo.meta_id is not null
                   then 'ROTULO_UNICO'
                 when candidato.vinculo_id is not null then 'VINCULO_UNICO'
                 else 'SEM_DESTINO' end resolucao
       from legado_folha f
       join legado_folha_item i on i.folha_legado_id = f.id
       left join legado_chave termo
         on termo.empresa_id = f.empresa_id and termo.origem = 'GIW'
        and termo.entidade = 'termos' and termo.legacy_id = f.termo_legacy_id
        and termo.destino_tabela = 'termo'
       left join legado_chave meta
         on meta.empresa_id = f.empresa_id and meta.origem = 'GIW'
        and meta.entidade = 'metas' and meta.legacy_id = f.meta_legacy_id
        and meta.destino_tabela = 'termo_meta'
       left join legado_chave vinculo
         on vinculo.empresa_id = f.empresa_id and vinculo.origem = 'GIW'
        and vinculo.entidade = 'vinculos' and vinculo.legacy_id = i.vinculo_legacy_id
        and vinculo.destino_tabela = 'prestador_vinculo'
       left join legado_chave item_mapeado
         on item_mapeado.empresa_id = f.empresa_id and item_mapeado.origem = 'GIW'
        and item_mapeado.entidade = 'folha_itens_vinculo'
        and item_mapeado.legacy_id = concat(f.legacy_id, '/', i.legacy_id)
        and item_mapeado.destino_tabela = 'prestador_vinculo'
       left join prestador_vinculo vinculo_mapeado
         on vinculo_mapeado.empresa_id = f.empresa_id and vinculo_mapeado.id = vinculo.destino_id
       left join lateral (
         select (array_agg(t.id order by t.id))[1] termo_id,
                (array_agg(m.id order by m.id))[1] meta_id
           from termo t
           join termo_meta m on m.termo_id = t.id and m.ativo
          where t.empresa_id = f.empresa_id and t.ativo
            and lower(btrim(m.descricao)) = lower(btrim(f.meta_legacy_id))
            and t.inicio <= f.competencia
            and (t.fim is null or t.fim >= f.competencia)
         having count(*) = 1
       ) rotulo on true
       left join lateral (
         select (array_agg(v.id order by v.id))[1] vinculo_id,
                (array_agg(v.termo_id order by v.id))[1] termo_id,
                (array_agg(v.meta_id order by v.id))[1] meta_id
           from prestador p
           join pessoa pessoa_atual
             on pessoa_atual.empresa_id = p.empresa_id and pessoa_atual.id = p.pessoa_id
           join prestador_vinculo v on v.empresa_id = p.empresa_id
                                  and v.prestador_id = p.id and v.ativo
          where p.empresa_id = f.empresa_id and p.ativo and pessoa_atual.ativo
            and (
              exists (
                select 1 from legado_chave pessoa
                 where pessoa.empresa_id = f.empresa_id and pessoa.origem = 'GIW'
                   and pessoa.entidade = 'pessoas' and pessoa.legacy_id = i.pessoa_legacy_id
                   and pessoa.destino_tabela = 'pessoa' and pessoa.destino_id = p.pessoa_id
              )
              or (i.cpf is not null and pessoa_atual.cpf = i.cpf)
              or (i.cnpj is not null and pessoa_atual.cnpj = i.cnpj)
            )
            and (coalesce(termo.destino_id, rotulo.termo_id) is null or v.termo_id = coalesce(termo.destino_id, rotulo.termo_id))
            and (coalesce(meta.destino_id, rotulo.meta_id) is null or v.meta_id = coalesce(meta.destino_id, rotulo.meta_id))
            and v.inicio <= f.competencia and (v.fim is null or v.fim >= f.competencia)
         having count(*) = 1
       ) candidato on true
      where f.empresa_id = $1 and f.origem = 'GIW'
        and (cardinality($2::text[]) = 0 or to_char(f.competencia, 'YYYY-MM') = any($2::text[]))
      order by f.competencia, f.legacy_id, i.legacy_id`,
    [empresaId, filtroCompetencias],
  );
  return resultado.rows;
}

function agrupar(itens: ItemLegado[]) {
  const grupos = new Map<string, FolhaAlvo>();
  for (const item of itens) {
    if (!item.termo_id || !item.meta_id || !item.vinculo_id) continue;
    const chave = `${item.folha_legado_id}:${item.termo_id}:${item.meta_id}`;
    const existente = grupos.get(chave) ?? {
      folhaLegadoId: item.folha_legado_id,
      competencia: item.competencia,
      termoId: item.termo_id,
      metaId: item.meta_id,
      itens: [],
    };
    existente.itens.push(item);
    grupos.set(chave, existente);
  }
  return [...grupos.values()];
}

type MedicaoIsolada = Omit<MedicaoHistoricaAgrupada, "vinculoId"> & {
  vinculoId: string;
};

async function prepararInstrumentoIsoladoHml(
  empresaId: string,
  alvo: FolhaAlvo,
  namespace: string,
) {
  const etiqueta = createHash("sha256")
    .update(`${alvo.folhaLegadoId}:${alvo.termoId}:${alvo.metaId}`)
    .digest("hex")
    .slice(0, 14)
    .toUpperCase();
  const numeroTermo = `HML-GIW-${namespace}-${etiqueta}`;
  const codigoMeta = `GIW-${etiqueta}`;
  const inicio = `${alvo.competencia}-01`;
  const fim = `${alvo.competencia}-28`;
  const pool = getPool();
  let termo = await pool.query<{ id: string }>(
    `select id from termo where empresa_id = $1 and numero = $2 limit 1`,
    [empresaId, numeroTermo],
  );
  if (!termo.rows[0]) {
    termo = await pool.query<{ id: string }>(
      `insert into termo
         (empresa_id, numero, descricao, modalidade, inicio, fim, valor_global)
       values ($1, $2, $3, 'TESTE', $4::date, $5::date, 0)
       returning id`,
      [
        empresaId,
        numeroTermo,
        `Isolamento HML do espelho GIW ${alvo.folhaLegadoId}`,
        inicio,
        fim,
      ],
    );
  }
  let meta = await pool.query<{ id: string }>(
    `select id from termo_meta where termo_id = $1 and codigo = $2 limit 1`,
    [termo.rows[0].id, codigoMeta],
  );
  if (!meta.rows[0]) {
    meta = await pool.query<{ id: string }>(
      `insert into termo_meta (termo_id, codigo, descricao)
       values ($1, $2, $3) returning id`,
      [
        termo.rows[0].id,
        codigoMeta,
        `Itens isolados do espelho GIW ${alvo.folhaLegadoId}`,
      ],
    );
  }

  const medicoes: MedicaoIsolada[] = [];
  for (const [ordem, medicao] of agruparMedicoesHistoricas(alvo.itens).entries()) {
    const origem = await pool.query<{
      prestador_id: string;
      atividade: string;
      tipo_pessoa: "FISICA" | "JURIDICA";
    }>(
      `select vinculo.prestador_id, vinculo.atividade, pessoa.tipo tipo_pessoa
         from prestador_vinculo vinculo
         join prestador
           on prestador.empresa_id = vinculo.empresa_id
          and prestador.id = vinculo.prestador_id
         join pessoa
           on pessoa.empresa_id = prestador.empresa_id
          and pessoa.id = prestador.pessoa_id
        where vinculo.empresa_id = $1 and vinculo.id = $2`,
      [empresaId, medicao.vinculoId],
    );
    if (!origem.rows[0]) {
      throw new Error("Vínculo de origem não encontrado para o isolamento HML.");
    }
    const numeroContrato = `HML-GIW-${etiqueta}-${ordem + 1}`;
    let vinculo = await pool.query<{ id: string }>(
      `select id from prestador_vinculo
        where empresa_id = $1 and termo_id = $2 and meta_id = $3
          and numero_contrato = $4
        limit 1`,
      [empresaId, termo.rows[0].id, meta.rows[0].id, numeroContrato],
    );
    if (!vinculo.rows[0]) {
      vinculo = await pool.query<{ id: string }>(
        `insert into prestador_vinculo
           (empresa_id, prestador_id, termo_id, meta_id, numero_contrato,
            atividade, inicio, fim, valor_retribuicao, exige_medicao_mensal,
            desconta_inss, desconta_irrf)
         values ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, false, $10, $11)
         returning id`,
        [
          empresaId,
          origem.rows[0].prestador_id,
          termo.rows[0].id,
          meta.rows[0].id,
          numeroContrato,
          origem.rows[0].atividade,
          inicio,
          fim,
          medicao.valor,
          medicao.descontaInss,
          origem.rows[0].tipo_pessoa === "FISICA",
        ],
      );
    } else {
      await pool.query(
        `update prestador_vinculo
            set desconta_inss = $2, desconta_irrf = $3, atualizado_em = now()
          where id = $1`,
        [
          vinculo.rows[0].id,
          medicao.descontaInss,
          origem.rows[0].tipo_pessoa === "FISICA",
        ],
      );
    }
    medicoes.push({ ...medicao, vinculoId: vinculo.rows[0].id });
  }
  return { termoId: termo.rows[0].id, metaId: meta.rows[0].id, medicoes };
}

async function validarPrecondicoes(empresaId: string, itens: ItemLegado[]) {
  const semDestino = itens.filter((item) => !item.termo_id || !item.meta_id || !item.vinculo_id);
  const repetidos = new Map<string, number>();
  for (const item of itens.filter((item) => item.vinculo_id)) {
    const chave = `${item.vinculo_id}:${item.competencia}`;
    repetidos.set(chave, (repetidos.get(chave) ?? 0) + 1);
  }
  const conflitosItens = [...repetidos.entries()].filter(([, quantidade]) => quantidade > 1);
  const conflitos = [] as string[];
  const medicoesExistentes = [] as string[];
  // O replay usa Termos e Metas isolados, portanto Folhas operacionais com a
  // mesma competência nunca conflitam com a evidência histórica.
  for (const item of itens.filter((item) => item.vinculo_id)) {
    const medicao = await getPool().query<{ id: string }>(
      `select id from medicao_mensal
        where empresa_id = $1 and vinculo_id = $2 and competencia = $3::date`,
      [empresaId, item.vinculo_id, `${item.competencia}-01`],
    );
    if (medicao.rowCount) medicoesExistentes.push(`${item.vinculo_id}:${item.competencia}`);
  }
  return { semDestino, conflitosItens, conflitos, medicoesExistentes };
}

async function publicarGpsHistorica(empresaId: string, competencia: string) {
  const codigo = await getPool().query<{ codigo_receita: string | null }>(
    `select distinct codigo_receita
       from legado_guia_inss
      where empresa_id = $1 and origem = 'GIW' and competencia = $2::date and tipo = 'GPS'
      order by codigo_receita`,
    [empresaId, `${competencia}-01`],
  );
  if (codigo.rows.length !== 1 || !/^\d{4}$/.test(codigo.rows[0].codigo_receita ?? "")) {
    throw new Error(`${competencia}: o legado não informa um único código de receita GPS válido.`);
  }
  try {
    const existente = await carregarPerfilRecolhimentoPorCompetencia(
      empresaId,
      competencia,
    );
    if (
      existente.instrumento === "GPS_EXCECAO" &&
      existente.codigo_receita === codigo.rows[0].codigo_receita
    ) {
      return;
    }
    throw new Error(
      `${competencia}: o perfil de recolhimento publicado não corresponde à GPS histórica.`,
    );
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/Nenhum perfil de recolhimento publicado/i.test(error.message)
    ) {
      throw error;
    }
  }
  await publicarPerfilRecolhimento({
    empresaId,
    ator: ATOR,
    dados: {
      instrumento: "GPS_EXCECAO",
      codigoReceita: codigo.rows[0].codigo_receita,
      inicioVigencia: `${competencia}-01`,
      fimVigencia: `${competencia}-01`,
      evidencia: `Homologação descartável: reprodução do espelho GPS GIW da competência ${competencia}; não é parametrização de produção.`,
      responsavel: ATOR,
    },
  });
}

async function executar() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL é obrigatória.");
  const executarDeVerdade = process.argv.includes("--executar");
  if (executarDeVerdade && (process.env.GIW_REPLAY_HOMOLOGACAO !== "CONFIRMADO" || !process.argv.includes("--confirmar-homologacao"))) {
    throw new Error("Para gravar, use GIW_REPLAY_HOMOLOGACAO=CONFIRMADO e --confirmar-homologacao.");
  }
  const empresa = await resolverEmpresa();
  const namespace = namespaceReplay();
  const itens = await carregarItens(empresa.id, competencias());
  const alvos = agrupar(itens);
  const precondicoes = await validarPrecondicoes(empresa.id, itens);
  const resumo = {
    modo: executarDeVerdade ? "EXECUCAO_HML" : "PREVIA_SEM_GRAVACAO",
    namespace,
    itensLegado: itens.length,
    folhasAlvo: alvos.length,
    semDestino: precondicoes.semDestino.length,
    vinculosRepetidosNaCompetencia: precondicoes.conflitosItens.length,
    folhasAtuaisEmConflito: precondicoes.conflitos.length,
    medicoesAtuaisEmConflito: precondicoes.medicoesExistentes.length,
    resolucao: Object.fromEntries(
      ["LEGADO", "MAPEAMENTO_CONFIRMADO", "ROTULO_UNICO", "VINCULO_UNICO", "SEM_DESTINO"].map((tipo) => [
        tipo,
        itens.filter((item) => item.resolucao === tipo).length,
      ]),
    ),
  };
  console.log(JSON.stringify(resumo, null, 2));
  if (precondicoes.semDestino.length || precondicoes.conflitos.length) {
    throw new Error("Replay não iniciado: há mapeamentos ausentes ou Folha atual em conflito. Consulte o resumo acima.");
  }
  if (!executarDeVerdade) return;

  // Cada espelho é materializado em um Termo isolado. A consolidação mensal
  // produtiva já possui smoke próprio; ativá-la aqui misturaria esses Vínculos
  // descartáveis com cenários anteriores da HML e deixaria de medir o cálculo
  // individual que consta no relatório do GIW.
  process.env.FOLHA_CONSOLIDADA_PRODUTIVA = "false";

  // A medição possui chave (vínculo, competência) e salvarMedicaoMensal faz
  // upsert auditável. Em HML isso permite retomar um replay interrompido e
  // substituir apenas a medição do mesmo Vínculo pela evidência GIW exata.
  for (const alvo of alvos) {
    const isolada = await prepararInstrumentoIsoladoHml(
      empresa.id,
      alvo,
      namespace,
    );
    const existente = await getPool().query<{
      id: string;
      status: string;
      revisao: number;
    }>(
      `select id, status, revisao from folha
        where empresa_id = $1 and termo_id = $2 and meta_id = $3
          and competencia = $4::date and status <> 'CANCELADA'
        order by revisao desc, numero desc
        limit 1`,
      [empresa.id, isolada.termoId, isolada.metaId, `${alvo.competencia}-01`],
    );
    if (existente.rows[0]?.status === "FECHADA") continue;
    for (const medicao of isolada.medicoes) {
      await salvarMedicaoMensal({
        empresaId: empresa.id,
        vinculoId: medicao.vinculoId,
        competencia: alvo.competencia,
        tipo: "VALOR",
        percentual: "",
        quantidade: "",
        valorUnitario: "",
        valor: medicao.valor,
        evidenciaReferencia: `Espelho GIW ${medicao.itens.map((item) => `${item.folha_legacy_id}/${item.item_legacy_id}`).join(", ")}`,
        evidenciaHash: hashEvidenciaAgrupada(medicao),
        conferente: ATOR,
        observacao:
          medicao.itens.length > 1
            ? "Ocorrências históricas do mesmo Vínculo agregadas exclusivamente para comparação em homologação."
            : "Valor histórico reproduzido exclusivamente para comparação em homologação.",
      });
    }
    const folha = existente.rows[0] ?? await criarFolha({
      empresaId: empresa.id,
      termoId: isolada.termoId,
      metaId: isolada.metaId,
      competencia: alvo.competencia,
      ator: ATOR,
    });
    if (!["RASCUNHO", "ABERTA"].includes(folha.status)) {
      throw new Error(
        `Replay HML não pode retomar Folha em estado ${folha.status}.`,
      );
    }
    await processarFolha(folha.id, ATOR, empresa.id, folha.revisao);
    await registrarConferenciaFolha({
      empresaId: empresa.id,
      folhaId: folha.id,
      resultado: "APROVADA",
      conferente: ATOR,
      confirmouCadastros: true,
      confirmouValores: true,
      confirmouRubricas: true,
      observacao: "Conferência automatizada exclusivamente para comparação com espelho GIW em homologação.",
    });
    await fecharFolha(folha.id, ATOR);
  }
  for (const competencia of [...new Set(alvos.map((alvo) => alvo.competencia))]) {
    await publicarGpsHistorica(empresa.id, competencia);
    await apurarRetencoesSegurados({ empresaId: empresa.id, competencia, ator: ATOR });
  }
  console.log("Replay histórico concluído. Execute npm run db:comparar:giw para obter o veredito.");
}

executar()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => { await getPool().end(); });
