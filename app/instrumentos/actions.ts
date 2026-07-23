"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { metas, termos } from "@/db/schema";
import { idCadastroValido } from "@/lib/cadastros";
import { validarMetaCadastro, validarTermoCadastro } from "@/lib/instrumentos";

function destino(mensagem: string, erro = false) {
  const params = new URLSearchParams({ [erro ? "erro" : "sucesso"]: mensagem });
  return `/instrumentos?${params.toString()}`;
}

function mensagemBanco(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") return "Já existe um registro com o mesmo código ou número.";
    if (error.code === "23503") return "Um cadastro relacionado não foi encontrado.";
    if (error.code === "23514") return "O banco rejeitou a vigência ou o valor informado.";
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export async function salvarTermo(formData: FormData) {
  const validacao = validarTermoCadastro({
    id: formData.get("id"),
    numero: formData.get("numero"),
    descricao: formData.get("descricao"),
    modalidade: formData.get("modalidade"),
    inicio: formData.get("inicio"),
    fim: formData.get("fim"),
    valorGlobal: formData.get("valorGlobal"),
  });
  if (!validacao.dados) redirect(destino(validacao.erros.join(" "), true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    if (dados.id) {
      const alterados = await db
        .update(termos)
        .set({
          numero: dados.numero,
          descricao: dados.descricao,
          modalidade: dados.modalidade,
          inicio: dados.inicio,
          fim: dados.fim,
          valorGlobal: dados.valorGlobal,
          atualizadoEm: new Date(),
        })
        .where(and(eq(termos.id, dados.id), eq(termos.empresaId, empresa.id)))
        .returning({ id: termos.id });
      if (alterados.length !== 1) throw new Error("Termo não encontrado.");
    } else {
      await db.insert(termos).values({
        empresaId: empresa.id,
        numero: dados.numero,
        descricao: dados.descricao,
        modalidade: dados.modalidade,
        inicio: dados.inicio,
        fim: dados.fim,
        valorGlobal: dados.valorGlobal,
      });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/instrumentos");
  redirect(destino(validacao.dados.id ? "Termo atualizado." : "Termo cadastrado."));
}

export async function salvarMeta(formData: FormData) {
  const validacao = validarMetaCadastro({
    id: formData.get("id"),
    termoId: formData.get("termoId"),
    codigo: formData.get("codigo"),
    descricao: formData.get("descricao"),
  });
  if (!validacao.dados) redirect(destino(validacao.erros.join(" "), true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    const termo = await db
      .select({ id: termos.id })
      .from(termos)
      .where(
        and(
          eq(termos.id, dados.termoId),
          eq(termos.empresaId, empresa.id),
          eq(termos.ativo, true),
        ),
      )
      .limit(1);
    if (termo.length !== 1) throw new Error("Selecione um termo ativo desta organização.");

    if (dados.id) {
      const atual = await db
        .select({ id: metas.id, termoId: metas.termoId })
        .from(metas)
        .innerJoin(termos, eq(termos.id, metas.termoId))
        .where(and(eq(metas.id, dados.id), eq(termos.empresaId, empresa.id)))
        .limit(1);
      if (atual.length !== 1) throw new Error("Meta não encontrada.");
      if (atual[0].termoId !== dados.termoId) {
        const dependencias = await db.execute<{ total: number }>(sql`
          select count(*)::int total from prestador_vinculo pv
           where pv.meta_id = ${dados.id} and pv.empresa_id = ${empresa.id}
        `);
        if (dependencias.rows[0].total > 0) {
          throw new Error("Uma meta já utilizada em vínculos não pode mudar de termo.");
        }
      }
      await db
        .update(metas)
        .set({ termoId: dados.termoId, codigo: dados.codigo, descricao: dados.descricao })
        .where(eq(metas.id, dados.id));
    } else {
      await db.insert(metas).values({
        termoId: dados.termoId,
        codigo: dados.codigo,
        descricao: dados.descricao,
      });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/instrumentos");
  redirect(destino(validacao.dados.id ? "Meta atualizada." : "Meta cadastrada."));
}

export async function alternarInstrumento(formData: FormData) {
  const entidade = String(formData.get("entidade") ?? "");
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  if (!idCadastroValido(id)) redirect(destino("Identificador inválido.", true));
  if (entidade !== "termo" && entidade !== "meta") {
    redirect(destino("Entidade inválida.", true));
  }

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    if (entidade === "termo") {
      if (!ativo) {
        const dependencias = await db.execute<{
          metas_ativas: number;
          vinculos_ativos: number;
        }>(sql`
          select
            (select count(*)::int from termo_meta tm where tm.termo_id = ${id} and tm.ativo) metas_ativas,
            (select count(*)::int from prestador_vinculo pv where pv.termo_id = ${id} and pv.empresa_id = ${empresa.id} and pv.ativo) vinculos_ativos
        `);
        const atual = dependencias.rows[0];
        if (atual.metas_ativas > 0 || atual.vinculos_ativos > 0) {
          throw new Error("Inative primeiro as metas e os vínculos ativos deste termo.");
        }
      }
      const alterados = await db
        .update(termos)
        .set({ ativo, atualizadoEm: new Date() })
        .where(and(eq(termos.id, id), eq(termos.empresaId, empresa.id)))
        .returning({ id: termos.id });
      if (alterados.length !== 1) throw new Error("Termo não encontrado.");
    } else {
      const meta = await db
        .select({ id: metas.id, termoAtivo: termos.ativo })
        .from(metas)
        .innerJoin(termos, eq(termos.id, metas.termoId))
        .where(and(eq(metas.id, id), eq(termos.empresaId, empresa.id)))
        .limit(1);
      if (meta.length !== 1) throw new Error("Meta não encontrada.");
      if (ativo && !meta[0].termoAtivo) {
        throw new Error("Ative o termo antes de ativar esta meta.");
      }
      if (!ativo) {
        const dependencias = await db.execute<{ total: number }>(sql`
          select count(*)::int total from prestador_vinculo pv
           where pv.meta_id = ${id} and pv.empresa_id = ${empresa.id} and pv.ativo
        `);
        if (dependencias.rows[0].total > 0) {
          throw new Error("Inative primeiro os vínculos ativos desta meta.");
        }
      }
      await db.update(metas).set({ ativo }).where(eq(metas.id, id));
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/instrumentos");
  redirect(destino(ativo ? "Cadastro ativado." : "Cadastro inativado."));
}
