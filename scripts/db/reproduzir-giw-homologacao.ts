import { createHash } from "node:crypto";
import { resolverEmpresaAtiva } from "../../db/cadastros";
import { criarFolha, fecharFolha, processarFolha, registrarConferenciaFolha } from "../../db/folhas";
import { salvarMedicaoMensal } from "../../db/medicoes";
import { apurarRetencoesSegurados } from "../../db/obrigacoes";
import { publicarPerfilRecolhimento } from "../../db/perfis-recolhimento";
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
  total_proventos: string;
  vinculo_id: string | null;
};

type FolhaAlvo = {
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

function hashEvidencia(item: ItemLegado) {
  return createHash("sha256")
    .update(JSON.stringify({
      origem: "GIW",
      folha: item.folha_legacy_id,
      item: item.item_legacy_id,
      pessoa: item.pessoa_legacy_id,
      proventos: item.total_proventos,
    }))
    .digest("hex");
}

async function carregarItens(empresaId: string, filtroCompetencias: string[]) {
  const resultado = await getPool().query<ItemLegado>(
    `select f.id folha_legado_id, f.legacy_id folha_legacy_id,
            to_char(f.competencia, 'YYYY-MM') competencia,
            termo.destino_id termo_id, meta.destino_id meta_id,
            i.legacy_id item_legacy_id, i.pessoa_legacy_id,
            i.vinculo_legacy_id, i.total_proventos::text,
            coalesce(vinculo.destino_id, candidato.vinculo_id) vinculo_id
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
       left join lateral (
         select v.id vinculo_id
           from legado_chave pessoa
           join prestador p on p.empresa_id = pessoa.empresa_id
                            and p.pessoa_id = pessoa.destino_id and p.ativo
           join prestador_vinculo v on v.empresa_id = p.empresa_id
                                  and v.prestador_id = p.id and v.ativo
          where pessoa.empresa_id = f.empresa_id and pessoa.origem = 'GIW'
            and pessoa.entidade = 'pessoas' and pessoa.legacy_id = i.pessoa_legacy_id
            and pessoa.destino_tabela = 'pessoa'
            and v.termo_id = termo.destino_id and v.meta_id = meta.destino_id
            and v.inicio <= f.competencia and (v.fim is null or v.fim >= f.competencia)
          order by v.id
          limit 1
       ) candidato on vinculo.destino_id is null
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

async function validarPrecondicoes(empresaId: string, itens: ItemLegado[], alvos: FolhaAlvo[]) {
  const semDestino = itens.filter((item) => !item.termo_id || !item.meta_id || !item.vinculo_id);
  const repetidos = new Map<string, number>();
  for (const item of itens.filter((item) => item.vinculo_id)) {
    const chave = `${item.vinculo_id}:${item.competencia}`;
    repetidos.set(chave, (repetidos.get(chave) ?? 0) + 1);
  }
  const conflitosItens = [...repetidos.entries()].filter(([, quantidade]) => quantidade > 1);
  const conflitos = [] as string[];
  const medicoesExistentes = [] as string[];
  for (const alvo of alvos) {
    const existente = await getPool().query<{ status: string }>(
      `select status from folha
        where empresa_id = $1 and termo_id = $2 and meta_id = $3 and competencia = $4::date
          and status <> 'CANCELADA'`,
      [empresaId, alvo.termoId, alvo.metaId, `${alvo.competencia}-01`],
    );
    if (existente.rowCount) conflitos.push(`${alvo.competencia} (${existente.rows[0].status})`);
  }
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
  const empresa = await resolverEmpresaAtiva();
  const itens = await carregarItens(empresa.id, competencias());
  const alvos = agrupar(itens);
  const precondicoes = await validarPrecondicoes(empresa.id, itens, alvos);
  const resumo = {
    modo: executarDeVerdade ? "EXECUCAO_HML" : "PREVIA_SEM_GRAVACAO",
    itensLegado: itens.length,
    folhasAlvo: alvos.length,
    semDestino: precondicoes.semDestino.length,
    vinculosRepetidosNaCompetencia: precondicoes.conflitosItens.length,
    folhasAtuaisEmConflito: precondicoes.conflitos.length,
    medicoesAtuaisEmConflito: precondicoes.medicoesExistentes.length,
  };
  console.log(JSON.stringify(resumo, null, 2));
  if (precondicoes.semDestino.length || precondicoes.conflitosItens.length || precondicoes.conflitos.length || precondicoes.medicoesExistentes.length) {
    throw new Error("Replay não iniciado: há mapeamentos ausentes, vínculo repetido ou Folha atual em conflito. Consulte o resumo acima.");
  }
  if (!executarDeVerdade) return;

  for (const alvo of alvos) {
    for (const item of alvo.itens) {
      await salvarMedicaoMensal({
        empresaId: empresa.id,
        vinculoId: item.vinculo_id!,
        competencia: alvo.competencia,
        tipo: "VALOR",
        percentual: "",
        quantidade: "",
        valorUnitario: "",
        valor: item.total_proventos,
        evidenciaReferencia: `Espelho GIW ${item.folha_legacy_id}/${item.item_legacy_id}`,
        evidenciaHash: hashEvidencia(item),
        conferente: ATOR,
        observacao: "Valor histórico reproduzido exclusivamente para comparação em homologação.",
      });
    }
    const folha = await criarFolha({ empresaId: empresa.id, termoId: alvo.termoId, metaId: alvo.metaId, competencia: alvo.competencia, ator: ATOR });
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
