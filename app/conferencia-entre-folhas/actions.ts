"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  atualizarCasoConsolidacao,
  materializarCasosConsolidacao,
} from "@/db/consolidacoes";
import { caminhoAplicacao } from "@/lib/base-path";

function destino(competencia: string, texto: string, erro = false) {
  const params = new URLSearchParams({
    competencia,
    [erro ? "erro" : "sucesso"]: texto,
  });
  return caminhoAplicacao(`/conferencia-entre-folhas?${params.toString()}`);
}

function mensagem(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23503") {
      return "Uma fonte relacionada não existe mais; analise novamente a competência.";
    }
    if (error.code === "23514") {
      return "O banco rejeitou um estado inconsistente do caso.";
    }
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a conferência entre folhas.";
}

export async function congelarDiagnostico(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  let erro = "";
  let resultado = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const materializacao = await materializarCasosConsolidacao({
      empresaId: empresa.id,
      competencia,
      ator: String(formData.get("responsavel") ?? ""),
    });
    resultado =
      `Diagnóstico congelado: ${materializacao.criados} novo(s), ` +
      `${materializacao.reutilizados} preservado(s), ` +
      `${materializacao.reativados} reativado(s) e ` +
      `${materializacao.invalidados} invalidado(s).`;
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/conferencia-entre-folhas");
  redirect(destino(competencia, erro || resultado, Boolean(erro)));
}

export async function revisarCaso(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  let erro = "";
  let resultado = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const atualizado = await atualizarCasoConsolidacao({
      empresaId: empresa.id,
      casoId: String(formData.get("casoId") ?? ""),
      status: String(formData.get("status") ?? ""),
      decisao: String(formData.get("decisao") ?? ""),
      justificativa: String(formData.get("justificativa") ?? ""),
      responsavel: String(formData.get("responsavel") ?? ""),
    });
    resultado =
      atualizado.status === "INVALIDADO"
        ? "As fontes mudaram; a versão anterior foi invalidada. Congele o diagnóstico atual."
        : atualizado.status === "RESOLVIDO"
        ? "Caso resolvido e decisão auditada."
        : "Caso encaminhado para análise.";
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/conferencia-entre-folhas");
  redirect(destino(competencia, erro || resultado, Boolean(erro)));
}
