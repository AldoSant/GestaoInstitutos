import { sql } from "drizzle-orm";
import { getDb } from "./index";

function competenciaIso(competencia: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    throw new Error("Competência inválida.");
  }
  return `${competencia}-01`;
}

export type ResumoMigracaoHistorica = {
  folhas_legado: number;
  pessoas_legado: number;
  rubricas_legado: number;
  guias_legado: number;
  proventos_legado: string;
  descontos_legado: string;
  liquido_legado: string;
  base_inss_legado: string;
  inss_legado: string;
  guias_total_legado: string;
  pessoas_mapeadas: number;
  vinculos_mapeados: number;
  folhas_novas: number;
  pessoas_novas: number;
  proventos_novo: string;
  descontos_novo: string;
  liquido_novo: string;
  base_inss_novo: string;
  inss_novo: string;
  obrigacoes_novas: number;
  obrigacoes_total_novo: string;
};

export type FolhaLegadoLista = {
  id: string;
  legacy_id: string;
  numero: string;
  status: string;
  data_pagamento: string | null;
  pessoas: number;
  rubricas: number;
  total_proventos: string;
  total_descontos: string;
  base_inss: string;
  valor_inss: string;
  total_liquido: string;
  extraido_em: Date;
};

export type GuiaLegadoLista = {
  id: string;
  legacy_id: string;
  tipo: string;
  status: string;
  identificador: string | null;
  codigo_receita: string | null;
  vencimento: string;
  pagamento: string | null;
  principal: string;
  juros: string;
  multa: string;
  compensacoes: string;
  total: string;
  extraido_em: Date;
};

export type ComparacaoPessoaHistorica = {
  pessoa_legacy_id: string;
  nome_legado: string;
  matricula_legado: string;
  pessoa_id: string | null;
  proventos_legado: string;
  descontos_legado: string;
  liquido_legado: string;
  base_inss_legado: string;
  inss_legado: string;
  proventos_novo: string;
  descontos_novo: string;
  liquido_novo: string;
  base_inss_novo: string;
  inss_novo: string;
  diferenca_liquido: string;
  diferenca_inss: string;
};

export async function carregarMigracaoHistorica(
  empresaId: string,
  competencia: string,
) {
  const db = getDb();
  const competenciaData = competenciaIso(competencia);
  const [resumo, folhas, guias, pessoas] = await Promise.all([
    db.execute<ResumoMigracaoHistorica>(sql`
      with
      lf as (
        select
          count(*)::int folhas,
          coalesce(sum(total_proventos), 0)::numeric(18,2) proventos,
          coalesce(sum(total_descontos), 0)::numeric(18,2) descontos,
          coalesce(sum(total_liquido), 0)::numeric(18,2) liquido,
          coalesce(sum(base_inss), 0)::numeric(18,2) base_inss,
          coalesce(sum(valor_inss), 0)::numeric(18,2) inss
        from legado_folha
        where empresa_id = ${empresaId} and competencia = ${competenciaData}
      ),
      li as (
        select
          count(distinct i.pessoa_legacy_id)::int pessoas,
          count(r.id)::int rubricas,
          count(distinct case when cp.destino_id is not null then i.pessoa_legacy_id end)::int
            pessoas_mapeadas,
          count(distinct case when cv.destino_id is not null then i.vinculo_legacy_id end)::int
            vinculos_mapeados
        from legado_folha f
        join legado_folha_item i on i.folha_legado_id = f.id
        left join legado_folha_item_rubrica r on r.folha_item_legado_id = i.id
        left join legado_chave cp
          on cp.empresa_id = f.empresa_id and cp.origem = 'GIW'
         and cp.entidade = 'pessoas' and cp.legacy_id = i.pessoa_legacy_id
        left join legado_chave cv
          on cv.empresa_id = f.empresa_id and cv.origem = 'GIW'
         and cv.entidade = 'vinculos' and cv.legacy_id = i.vinculo_legacy_id
        where f.empresa_id = ${empresaId} and f.competencia = ${competenciaData}
      ),
      lg as (
        select count(*)::int guias, coalesce(sum(total), 0)::numeric(18,2) total
        from legado_guia_inss
        where empresa_id = ${empresaId} and competencia = ${competenciaData}
      ),
      nf as (
        select
          count(distinct f.id)::int folhas,
          count(distinct v.prestador_id)::int pessoas,
          coalesce(sum(i.total_proventos), 0)::numeric(18,2) proventos,
          coalesce(sum(i.total_descontos), 0)::numeric(18,2) descontos,
          coalesce(sum(i.total_liquido), 0)::numeric(18,2) liquido,
          coalesce(sum(i.base_inss), 0)::numeric(18,2) base_inss,
          coalesce(sum(i.valor_inss), 0)::numeric(18,2) inss
        from folha f
        left join folha_item i on i.folha_id = f.id
        left join prestador_vinculo v on v.id = i.vinculo_id
        where f.empresa_id = ${empresaId} and f.competencia = ${competenciaData}
          and f.status <> 'CANCELADA'
      ),
      no as (
        select count(*)::int obrigacoes, coalesce(sum(total), 0)::numeric(18,2) total
        from obrigacao_fiscal
        where empresa_id = ${empresaId} and competencia = ${competenciaData}
          and status <> 'CANCELADA'
      )
      select
        lf.folhas folhas_legado,
        li.pessoas pessoas_legado,
        li.rubricas rubricas_legado,
        lg.guias guias_legado,
        lf.proventos::text proventos_legado,
        lf.descontos::text descontos_legado,
        lf.liquido::text liquido_legado,
        lf.base_inss::text base_inss_legado,
        lf.inss::text inss_legado,
        lg.total::text guias_total_legado,
        li.pessoas_mapeadas,
        li.vinculos_mapeados,
        nf.folhas folhas_novas,
        nf.pessoas pessoas_novas,
        nf.proventos::text proventos_novo,
        nf.descontos::text descontos_novo,
        nf.liquido::text liquido_novo,
        nf.base_inss::text base_inss_novo,
        nf.inss::text inss_novo,
        no.obrigacoes obrigacoes_novas,
        no.total::text obrigacoes_total_novo
      from lf cross join li cross join lg cross join nf cross join no
    `),
    db.execute<FolhaLegadoLista>(sql`
      select
        f.id, f.legacy_id, f.numero, f.status,
        f.data_pagamento::text,
        count(distinct i.pessoa_legacy_id)::int pessoas,
        count(r.id)::int rubricas,
        f.total_proventos::text,
        f.total_descontos::text,
        f.base_inss::text,
        f.valor_inss::text,
        f.total_liquido::text,
        f.extraido_em
      from legado_folha f
      left join legado_folha_item i on i.folha_legado_id = f.id
      left join legado_folha_item_rubrica r on r.folha_item_legado_id = i.id
      where f.empresa_id = ${empresaId} and f.competencia = ${competenciaData}
      group by f.id
      order by f.numero, f.legacy_id
    `),
    db.execute<GuiaLegadoLista>(sql`
      select
        id, legacy_id, tipo, status, identificador, codigo_receita,
        vencimento::text, pagamento::text, principal::text, juros::text,
        multa::text, compensacoes::text, total::text, extraido_em
      from legado_guia_inss
      where empresa_id = ${empresaId} and competencia = ${competenciaData}
      order by vencimento, legacy_id
    `),
    db.execute<ComparacaoPessoaHistorica>(sql`
      with legado as (
        select
          i.pessoa_legacy_id,
          min(i.nome) nome,
          min(i.matricula) matricula,
          sum(i.total_proventos)::numeric(18,2) proventos,
          sum(i.total_descontos)::numeric(18,2) descontos,
          sum(i.total_liquido)::numeric(18,2) liquido,
          sum(i.base_inss)::numeric(18,2) base_inss,
          sum(i.valor_inss)::numeric(18,2) inss
        from legado_folha f
        join legado_folha_item i on i.folha_legado_id = f.id
        where f.empresa_id = ${empresaId} and f.competencia = ${competenciaData}
        group by i.pessoa_legacy_id
      ),
      mapeamento as (
        select legacy_id, destino_id
        from legado_chave
        where empresa_id = ${empresaId} and origem = 'GIW'
          and entidade = 'pessoas' and destino_tabela = 'pessoa'
      ),
      novo as (
        select
          p.pessoa_id,
          sum(i.total_proventos)::numeric(18,2) proventos,
          sum(i.total_descontos)::numeric(18,2) descontos,
          sum(i.total_liquido)::numeric(18,2) liquido,
          sum(i.base_inss)::numeric(18,2) base_inss,
          sum(i.valor_inss)::numeric(18,2) inss
        from folha f
        join folha_item i on i.folha_id = f.id
        join prestador_vinculo v on v.id = i.vinculo_id
        join prestador p on p.id = v.prestador_id
        where f.empresa_id = ${empresaId} and f.competencia = ${competenciaData}
          and f.status <> 'CANCELADA'
        group by p.pessoa_id
      )
      select
        l.pessoa_legacy_id,
        l.nome nome_legado,
        l.matricula matricula_legado,
        m.destino_id pessoa_id,
        l.proventos::text proventos_legado,
        l.descontos::text descontos_legado,
        l.liquido::text liquido_legado,
        l.base_inss::text base_inss_legado,
        l.inss::text inss_legado,
        coalesce(n.proventos, 0)::text proventos_novo,
        coalesce(n.descontos, 0)::text descontos_novo,
        coalesce(n.liquido, 0)::text liquido_novo,
        coalesce(n.base_inss, 0)::text base_inss_novo,
        coalesce(n.inss, 0)::text inss_novo,
        (coalesce(n.liquido, 0) - l.liquido)::numeric(18,2)::text diferenca_liquido,
        (coalesce(n.inss, 0) - l.inss)::numeric(18,2)::text diferenca_inss
      from legado l
      left join mapeamento m on m.legacy_id = l.pessoa_legacy_id
      left join novo n on n.pessoa_id = m.destino_id
      order by
        case when m.destino_id is null then 0 else 1 end,
        abs(coalesce(n.liquido, 0) - l.liquido) desc,
        l.nome
      limit 500
    `),
  ]);

  return {
    resumo: resumo.rows[0],
    folhas: folhas.rows,
    guias: guias.rows,
    pessoas: pessoas.rows,
  };
}
