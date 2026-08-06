-- A ficha de Pessoa é a fonte única do NIT/PIS/PASEP. Em bases antigas, só
-- preenche a Pessoa quando ela ainda não possui inscrição: a informação já
-- registrada na ficha não é sobrescrita por um duplicado do Prestador.
update pessoa p
   set inscricao_inss = pr.nit_pis_pasep,
       atualizado_em = now()
  from prestador pr
 where pr.empresa_id = p.empresa_id
   and pr.pessoa_id = p.id
   and p.tipo = 'FISICA'
   and nullif(btrim(p.inscricao_inss), '') is null
   and nullif(btrim(pr.nit_pis_pasep), '') is not null;
--> statement-breakpoint

alter table prestador drop column nit_pis_pasep;
