"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  atividades,
  lotacoes,
  metas,
  prestadores,
  termos,
  vinculos,
} from "@/db/schema";
import { idCadastroValido } from "@/lib/cadastros";
import { validarVinculoCadastro } from "@/lib/vinculos";

function destino(mensagem: string, erro = false) {
  const params = new URLSearchParams({ [erro ? "erro" : "sucesso"]: mensagem });
  return `/vinculos?${params.toString()}`;
}

function mensagemBanco(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23P01") {
      return "Já existe um vínculo ativo ocupando essa vigência.";
    }
    if (error.code === "23503") return "Um cadastro relacionado não foi encontrado.";
    if (error.code === "23514") return "O banco rejeitou a vigência ou os valores informados.";
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export async function salvarVinculo(formData: FormData) {
  const [termoId, metaId] = String(formData.get("instrumento") ?? "").split(":");
  const validacao = validarVinculoCadastro({
    id: formData.get("id"),
    prestadorId: formData.get("prestadorId"),
    termoId,
    metaId,
    atividadeId: formData.get("atividadeId"),
    lotacaoId: formData.get("lotacaoId"),
    numeroContrato: formData.get("numeroContrato"),
    inicio: formData.get("inicio"),
    fim: formData.get("fim"),
    valorRetribuicao: formData.get("valorRetribuicao"),
    cargaHoraria: formData.get("cargaHoraria"),
    descontaInss: formData.get("descontaInss") === "on",
    descontaIrrf: formData.get("descontaIrrf") === "on",
  });
  if (!validacao.dados) redirect(destino(validacao.erros.join(" "), true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    const [prestador, instrumento, atividade, lotacao] = await Promise.all([
      db
        .select({ id: prestadores.id })
        .from(prestadores)
        .where(
          and(
            eq(prestadores.id, dados.prestadorId),
            eq(prestadores.empresaId, empresa.id),
            eq(prestadores.ativo, true),
          ),
        )
        .limit(1),
      db
        .select({ termoId: termos.id, metaId: metas.id })
        .from(termos)
        .innerJoin(metas, eq(metas.termoId, termos.id))
        .where(
          and(
            eq(termos.id, dados.termoId),
            eq(metas.id, dados.metaId),
            eq(termos.empresaId, empresa.id),
            eq(termos.ativo, true),
            eq(metas.ativo, true),
          ),
        )
        .limit(1),
      db
        .select({ id: atividades.id, descricao: atividades.descricao })
        .from(atividades)
        .where(
          and(
            eq(atividades.id, dados.atividadeId),
            eq(atividades.empresaId, empresa.id),
            eq(atividades.ativo, true),
          ),
        )
        .limit(1),
      db
        .select({ id: lotacoes.id, descricao: lotacoes.descricao })
        .from(lotacoes)
        .where(
          and(
            eq(lotacoes.id, dados.lotacaoId),
            eq(lotacoes.empresaId, empresa.id),
            eq(lotacoes.ativo, true),
          ),
        )
        .limit(1),
    ]);
    if (prestador.length !== 1) throw new Error("Selecione um prestador ativo.");
    if (instrumento.length !== 1) {
      throw new Error("A meta deve estar ativa e pertencer ao termo selecionado.");
    }
    if (atividade.length !== 1) throw new Error("Selecione uma atividade ativa.");
    if (lotacao.length !== 1) throw new Error("Selecione uma lotação ativa.");

    const sobrepostos = await db.execute<{ total: number }>(sql`
      select count(*)::int total
        from prestador_vinculo
       where empresa_id = ${empresa.id}
         and prestador_id = ${dados.prestadorId}
         and termo_id = ${dados.termoId}
         and meta_id = ${dados.metaId}
         and ativo
         and id <> coalesce(${dados.id}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
         and daterange(inicio, coalesce(fim, 'infinity'::date), '[]')
             && daterange(${dados.inicio}::date, coalesce(${dados.fim}::date, 'infinity'::date), '[]')
    `);
    if (sobrepostos.rows[0].total > 0) {
      throw new Error("Já existe vínculo ativo sobreposto para este prestador, termo e meta.");
    }

    const values = {
      prestadorId: dados.prestadorId,
      termoId: dados.termoId,
      metaId: dados.metaId,
      atividadeId: dados.atividadeId,
      lotacaoId: dados.lotacaoId,
      numeroContrato: dados.numeroContrato,
      atividade: atividade[0].descricao,
      lotacao: lotacao[0].descricao,
      inicio: dados.inicio,
      fim: dados.fim,
      valorRetribuicao: dados.valorRetribuicao,
      cargaHoraria: dados.cargaHoraria,
      descontaInss: dados.descontaInss,
      descontaIrrf: dados.descontaIrrf,
      atualizadoEm: new Date(),
    };

    if (dados.id) {
      const alterados = await db
        .update(vinculos)
        .set(values)
        .where(and(eq(vinculos.id, dados.id), eq(vinculos.empresaId, empresa.id)))
        .returning({ id: vinculos.id });
      if (alterados.length !== 1) throw new Error("Vínculo não encontrado.");
    } else {
      await db.insert(vinculos).values({ empresaId: empresa.id, ...values });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/vinculos");
  revalidatePath("/prestadores");
  revalidatePath("/instrumentos");
  redirect(destino(validacao.dados.id ? "Vínculo atualizado." : "Vínculo cadastrado."));
}

export async function alternarVinculo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  if (!idCadastroValido(id)) redirect(destino("Identificador inválido.", true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    if (ativo) {
      const atual = await db
        .select({
          prestadorId: vinculos.prestadorId,
          termoId: vinculos.termoId,
          metaId: vinculos.metaId,
          inicio: vinculos.inicio,
          fim: vinculos.fim,
          prestadorAtivo: prestadores.ativo,
          termoAtivo: termos.ativo,
          metaAtiva: metas.ativo,
        })
        .from(vinculos)
        .innerJoin(prestadores, eq(prestadores.id, vinculos.prestadorId))
        .innerJoin(termos, eq(termos.id, vinculos.termoId))
        .innerJoin(metas, and(eq(metas.id, vinculos.metaId), eq(metas.termoId, termos.id)))
        .where(and(eq(vinculos.id, id), eq(vinculos.empresaId, empresa.id)))
        .limit(1);
      if (atual.length !== 1) throw new Error("Vínculo não encontrado.");
      if (!atual[0].prestadorAtivo || !atual[0].termoAtivo || !atual[0].metaAtiva) {
        throw new Error("Ative primeiro o prestador, o termo e a meta deste vínculo.");
      }
      const sobrepostos = await db.execute<{ total: number }>(sql`
        select count(*)::int total
          from prestador_vinculo
         where empresa_id = ${empresa.id}
           and prestador_id = ${atual[0].prestadorId}
           and termo_id = ${atual[0].termoId}
           and meta_id = ${atual[0].metaId}
           and ativo and id <> ${id}
           and daterange(inicio, coalesce(fim, 'infinity'::date), '[]')
               && daterange(${atual[0].inicio}::date, coalesce(${atual[0].fim}::date, 'infinity'::date), '[]')
      `);
      if (sobrepostos.rows[0].total > 0) {
        throw new Error("Outro vínculo ativo ocupa a mesma vigência.");
      }
    }
    const alterados = await db
      .update(vinculos)
      .set({ ativo, atualizadoEm: new Date() })
      .where(and(eq(vinculos.id, id), eq(vinculos.empresaId, empresa.id)))
      .returning({ id: vinculos.id });
    if (alterados.length !== 1) throw new Error("Vínculo não encontrado.");
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/vinculos");
  revalidatePath("/prestadores");
  revalidatePath("/instrumentos");
  redirect(destino(ativo ? "Vínculo ativado." : "Vínculo inativado."));
}
