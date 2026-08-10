import { createHash } from "node:crypto";
import { getPool } from "../../db";

const empresaId = process.argv[process.argv.indexOf("--empresa-id") + 1];
const aplicar = process.argv.includes("--aplicar");
if (!empresaId) throw new Error("Use --empresa-id UUID-DA-EMPRESA.");
if (aplicar && (process.env.GIW_REPLAY_HOMOLOGACAO !== "CONFIRMADO" || !process.argv.includes("--confirmar-homologacao"))) {
  throw new Error("Para gravar, use GIW_REPLAY_HOMOLOGACAO=CONFIRMADO e --confirmar-homologacao.");
}

type Item = { folha_legacy_id: string; item_legacy_id: string; competencia: string; pessoa_legacy_id: string; pessoa_id: string; termo_id: string; meta_id: string };
const pool = getPool();
try {
  const itens = await pool.query<Item>(
    `select f.legacy_id folha_legacy_id, i.legacy_id item_legacy_id,
            to_char(f.competencia, 'YYYY-MM') competencia, i.pessoa_legacy_id,
            coalesce(ch_pessoa.destino_id, pessoa.id)::text pessoa_id,
            rotulo.termo_id::text, rotulo.meta_id::text
       from legado_folha f join legado_folha_item i on i.folha_legado_id = f.id
       left join legado_chave item_mapeado on item_mapeado.empresa_id=f.empresa_id and item_mapeado.origem='GIW'
        and item_mapeado.entidade='folha_itens_vinculo' and item_mapeado.legacy_id=concat(f.legacy_id,'/',i.legacy_id)
       left join legado_chave ch_pessoa on ch_pessoa.empresa_id=f.empresa_id and ch_pessoa.origem='GIW'
        and ch_pessoa.entidade='pessoas' and ch_pessoa.legacy_id=i.pessoa_legacy_id and ch_pessoa.destino_tabela='pessoa'
       left join pessoa on pessoa.empresa_id=f.empresa_id and ((i.cpf is not null and pessoa.cpf=i.cpf) or (i.cnpj is not null and pessoa.cnpj=i.cnpj))
       join lateral (
         select (array_agg(t.id order by t.id))[1] termo_id, (array_agg(m.id order by m.id))[1] meta_id
         from termo t join termo_meta m on m.termo_id=t.id and m.ativo
         where t.empresa_id=f.empresa_id and t.ativo and lower(btrim(m.descricao))=lower(btrim(f.meta_legacy_id))
           and t.inicio<=f.competencia and (t.fim is null or t.fim>=f.competencia)
         having count(*)=1
       ) rotulo on true
      where f.empresa_id=$1 and f.origem='GIW' and item_mapeado.legacy_id is null
        and coalesce(ch_pessoa.destino_id, pessoa.id) is not null
        and not exists (
          select 1 from prestador pr join prestador_vinculo v on v.empresa_id=pr.empresa_id and v.prestador_id=pr.id
          where pr.empresa_id=f.empresa_id and pr.pessoa_id=coalesce(ch_pessoa.destino_id, pessoa.id)
            and v.termo_id=rotulo.termo_id and v.meta_id=rotulo.meta_id and v.ativo
            and v.inicio<=f.competencia and (v.fim is null or v.fim>=f.competencia)
        )
      order by f.competencia, f.legacy_id, i.legacy_id`, [empresaId]);
  const grupos = new Map<string, Item[]>();
  for (const item of itens.rows) {
    const chave = `${item.pessoa_id}:${item.termo_id}:${item.meta_id}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  console.log(JSON.stringify({ modo: aplicar ? "RECONSTRUCAO_HML" : "PREVIA_SEM_GRAVACAO", itens: itens.rows.length, vinculosDerivados: grupos.size }, null, 2));
  if (!aplicar) process.exitCode = 0;
  else {
    await pool.query("begin");
    try {
      const execucao = await pool.query<{ id: string }>(`insert into importacao_execucao (empresa_id,origem,entidade,arquivo,checksum_arquivo,modo,status,total_lidos,total_inseridos,resumo) values ($1,'GIW','folha_itens_vinculo_reconstruido','espelho-giw-hml', $2,'APLICAR','EM_ANDAMENTO',$3,0,'{}') returning id`, [empresaId, createHash("sha256").update(JSON.stringify(itens.rows)).digest("hex"), itens.rows.length]);
      for (const grupo of grupos.values()) {
        const primeiro = grupo[0]; const inicio = `${grupo.map((x) => x.competencia).sort()[0]}-01`; const fim = `${grupo.map((x) => x.competencia).sort().at(-1)}-28`;
        const prestador = await pool.query<{ id: string }>(`insert into prestador (empresa_id,pessoa_id,matricula,ativo) values ($1,$2,$3,true) on conflict (empresa_id,pessoa_id) do update set ativo=true, atualizado_em=now() returning id`, [empresaId, primeiro.pessoa_id, `GIW-HIST-${primeiro.pessoa_legacy_id}`.slice(0,40)]);
        const vinculo = await pool.query<{ id: string }>(`insert into prestador_vinculo (empresa_id,prestador_id,termo_id,meta_id,atividade,inicio,fim,valor_retribuicao,desconta_inss,desconta_irrf,ativo,exige_medicao_mensal) values ($1,$2,$3,$4,'Vínculo histórico derivado do espelho GIW',$5,$6,0,true,true,true,false) returning id`, [empresaId, prestador.rows[0].id, primeiro.termo_id, primeiro.meta_id, inicio, fim]);
        for (const item of grupo) {
          const chave=`${item.folha_legacy_id}/${item.item_legacy_id}`; const checksum=createHash("sha256").update(`${chave}:${vinculo.rows[0].id}`).digest("hex");
          await pool.query(`insert into legado_chave (empresa_id,origem,entidade,legacy_id,destino_tabela,destino_id,checksum,primeira_execucao_id,ultima_execucao_id) values ($1,'GIW','folha_itens_vinculo',$2,'prestador_vinculo',$3,$4,$5,$5)`, [empresaId,chave,vinculo.rows[0].id,checksum,execucao.rows[0].id]);
        }
      }
      await pool.query(`update importacao_execucao set status='CONCLUIDA',total_inseridos=$2,resumo=$3::jsonb,concluido_em=now() where id=$1`, [execucao.rows[0].id,itens.rows.length,JSON.stringify({ origem:"ESPELHO_GIW", vinculosDerivados:grupos.size })]);
      await pool.query("commit");
    } catch (erro) { await pool.query("rollback"); throw erro; }
  }
} finally { await pool.end(); }
