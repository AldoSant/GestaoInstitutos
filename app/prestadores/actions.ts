"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { pessoas, prestadores } from "@/db/schema";
import { idCadastroValido } from "@/lib/cadastros";
import { validarPrestadorCadastro } from "@/lib/prestadores";

function destino(mensagem: string, erro = false) {
  const params = new URLSearchParams({ [erro ? "erro" : "sucesso"]: mensagem });
  return `/prestadores?${params.toString()}`;
}

function mensagemBanco(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") {
      return "A pessoa ou a matrícula já está associada a outro prestador.";
    }
    if (error.code === "23503") return "Um cadastro relacionado não foi encontrado.";
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export async function salvarPrestador(formData: FormData) {
  const validacao = validarPrestadorCadastro({
    id: formData.get("id"),
    pessoaId: formData.get("pessoaId"),
    matricula: formData.get("matricula"),
    nitPisPasep: formData.get("nitPisPasep"),
    categoriaContribuinte: formData.get("categoriaContribuinte"),
    isentoInss: formData.get("isentoInss"),
  });
  if (!validacao.dados) redirect(destino(validacao.erros.join(" "), true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    const pessoa = await db
      .select({ id: pessoas.id })
      .from(pessoas)
      .where(and(eq(pessoas.id, dados.pessoaId), eq(pessoas.empresaId, empresa.id)))
      .limit(1);
    if (pessoa.length !== 1) throw new Error("Pessoa não encontrada nesta organização.");

    if (dados.id) {
      const alterados = await db
        .update(prestadores)
        .set({
          pessoaId: dados.pessoaId,
          matricula: dados.matricula,
          nitPisPasep: dados.nitPisPasep,
          categoriaContribuinte: dados.categoriaContribuinte,
          isentoInss: dados.isentoInss,
          atualizadoEm: new Date(),
        })
        .where(and(eq(prestadores.id, dados.id), eq(prestadores.empresaId, empresa.id)))
        .returning({ id: prestadores.id });
      if (alterados.length !== 1) throw new Error("Prestador não encontrado.");
    } else {
      await db.insert(prestadores).values({
        empresaId: empresa.id,
        pessoaId: dados.pessoaId,
        matricula: dados.matricula,
        nitPisPasep: dados.nitPisPasep,
        categoriaContribuinte: dados.categoriaContribuinte,
        isentoInss: dados.isentoInss,
      });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/prestadores");
  redirect(
    destino(validacao.dados.id ? "Prestador atualizado." : "Prestador cadastrado."),
  );
}

export async function alternarPrestador(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  if (!idCadastroValido(id)) redirect(destino("Identificador inválido.", true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const alterados = await db
      .update(prestadores)
      .set({ ativo, atualizadoEm: new Date() })
      .where(and(eq(prestadores.id, id), eq(prestadores.empresaId, empresa.id)))
      .returning({ id: prestadores.id });
    if (alterados.length !== 1) throw new Error("Prestador não encontrado.");
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/prestadores");
  redirect(destino(ativo ? "Prestador ativado." : "Prestador inativado."));
}
