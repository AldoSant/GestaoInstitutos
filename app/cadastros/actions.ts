"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { getDb } from "@/db";
import { atividades, lotacoes, pessoas } from "@/db/schema";
import {
  idCadastroValido,
  validarAtividadeCadastro,
  validarLotacaoCadastro,
  validarPessoaCadastro,
} from "@/lib/cadastros";

function mensagemBanco(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") return "Já existe um cadastro com os mesmos dados únicos.";
    if (error.code === "23514") return "O banco rejeitou um valor inconsistente.";
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function destino(mensagem: string, erro = false) {
  const params = new URLSearchParams({ [erro ? "erro" : "sucesso"]: mensagem });
  return `/cadastros?${params.toString()}`;
}

export async function salvarPessoa(formData: FormData) {
  const validacao = validarPessoaCadastro({
    id: formData.get("id"),
    tipo: formData.get("tipo"),
    nome: formData.get("nome"),
    documento: formData.get("documento"),
  });
  if (!validacao.dados) redirect(destino(validacao.erros.join(" "), true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    if (dados.id) {
      const alterados = await db
        .update(pessoas)
        .set({
          tipo: dados.tipo,
          nomeRazaoSocial: dados.nome,
          cpf: dados.cpf,
          cnpj: dados.cnpj,
          atualizadoEm: new Date(),
        })
        .where(and(eq(pessoas.id, dados.id), eq(pessoas.empresaId, empresa.id)))
        .returning({ id: pessoas.id });
      if (alterados.length !== 1) throw new Error("Pessoa não encontrada.");
    } else {
      await db.insert(pessoas).values({
        empresaId: empresa.id,
        tipo: dados.tipo,
        nomeRazaoSocial: dados.nome,
        cpf: dados.cpf,
        cnpj: dados.cnpj,
      });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/cadastros");
  redirect(destino(validacao.dados.id ? "Pessoa atualizada." : "Pessoa cadastrada."));
}

export async function salvarAtividade(formData: FormData) {
  const validacao = validarAtividadeCadastro({
    id: formData.get("id"),
    codigo: formData.get("codigo"),
    descricao: formData.get("descricao"),
    cargaHoraria: formData.get("cargaHoraria"),
    valor: formData.get("valor"),
  });
  if (!validacao.dados) redirect(destino(validacao.erros.join(" "), true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    if (dados.id) {
      const alterados = await db
        .update(atividades)
        .set({
          codigo: dados.codigo,
          descricao: dados.descricao,
          cargaHoraria: dados.cargaHoraria,
          valor: dados.valor,
          atualizadoEm: new Date(),
        })
        .where(and(eq(atividades.id, dados.id), eq(atividades.empresaId, empresa.id)))
        .returning({ id: atividades.id });
      if (alterados.length !== 1) throw new Error("Atividade não encontrada.");
    } else {
      await db.insert(atividades).values({
        empresaId: empresa.id,
        codigo: dados.codigo,
        descricao: dados.descricao,
        cargaHoraria: dados.cargaHoraria,
        valor: dados.valor,
      });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/cadastros");
  redirect(
    destino(validacao.dados.id ? "Atividade atualizada." : "Atividade cadastrada."),
  );
}

export async function salvarLotacao(formData: FormData) {
  const validacao = validarLotacaoCadastro({
    id: formData.get("id"),
    codigo: formData.get("codigo"),
    descricao: formData.get("descricao"),
  });
  if (!validacao.dados) redirect(destino(validacao.erros.join(" "), true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    if (dados.id) {
      const alterados = await db
        .update(lotacoes)
        .set({
          codigo: dados.codigo,
          descricao: dados.descricao,
          atualizadoEm: new Date(),
        })
        .where(and(eq(lotacoes.id, dados.id), eq(lotacoes.empresaId, empresa.id)))
        .returning({ id: lotacoes.id });
      if (alterados.length !== 1) throw new Error("Lotação não encontrada.");
    } else {
      await db.insert(lotacoes).values({
        empresaId: empresa.id,
        codigo: dados.codigo,
        descricao: dados.descricao,
      });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/cadastros");
  redirect(destino(validacao.dados.id ? "Lotação atualizada." : "Lotação cadastrada."));
}

export async function alternarCadastro(formData: FormData) {
  const entidade = String(formData.get("entidade") ?? "");
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  if (!idCadastroValido(id)) redirect(destino("Identificador inválido.", true));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    let alterados: { id: string }[];
    if (entidade === "pessoa") {
      alterados = await db
        .update(pessoas)
        .set({ ativo, atualizadoEm: new Date() })
        .where(and(eq(pessoas.id, id), eq(pessoas.empresaId, empresa.id)))
        .returning({ id: pessoas.id });
    } else if (entidade === "atividade") {
      alterados = await db
        .update(atividades)
        .set({ ativo, atualizadoEm: new Date() })
        .where(and(eq(atividades.id, id), eq(atividades.empresaId, empresa.id)))
        .returning({ id: atividades.id });
    } else if (entidade === "lotacao") {
      alterados = await db
        .update(lotacoes)
        .set({ ativo, atualizadoEm: new Date() })
        .where(and(eq(lotacoes.id, id), eq(lotacoes.empresaId, empresa.id)))
        .returning({ id: lotacoes.id });
    } else {
      throw new Error("Entidade inválida.");
    }
    if (alterados.length !== 1) throw new Error("Cadastro não encontrado.");
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true));
  revalidatePath("/cadastros");
  redirect(destino(ativo ? "Cadastro ativado." : "Cadastro inativado."));
}
