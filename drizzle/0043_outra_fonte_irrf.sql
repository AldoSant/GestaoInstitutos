-- Um comprovante de outra fonte pode reduzir o teto de INSS e também
-- informar a retenção já ocorrida fora do Instituto para o IRRF mensal.
alter table contribuicao_outra_fonte
  add column inss_dedutivel_irrf numeric(18, 2) not null default 0,
  add column irrf_retido numeric(18, 2) not null default 0;
--> statement-breakpoint

alter table contribuicao_outra_fonte
  add constraint ck_outra_fonte_irrf_valores
  check (inss_dedutivel_irrf >= 0 and irrf_retido >= 0);
