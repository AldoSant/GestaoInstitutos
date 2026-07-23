ALTER TABLE "pessoa_endereco" DROP CONSTRAINT "ck_pessoa_endereco_cep";--> statement-breakpoint
ALTER TABLE "pessoa_endereco" ALTER COLUMN "cep" SET DATA TYPE varchar(12);