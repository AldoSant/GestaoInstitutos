"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  atualizarHomologacaoCompetencia,
  materializarHomologacaoCompetencia,
} from "@/db/homologacoes-competencia";

function destino(competencia: string, texto: string, erro = false) {
  const params = new URLSearchParams({
    competencia,
    [erro ? "erro" : "sucesso"]: texto,
  });
  return `/homologacoes?${params.toString()}`;
}

function mensagem(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") {
      return "A mesma versão mensal já foi materializada.";
    }
    if (error.code === "23514") {
      return "O banco rejeitou um estado inconsistente da homologação.";
    }
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a homologação da competência.";
}

export async function congelarCompetencia(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  let erro = "";
  let resultado = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const criada = await materializarHomologacaoCompetencia({
      empresaId: empresa.id,
      competencia,
      ator: String(formData.get("responsavel") ?? ""),
    });
    resultado = criada.criada
      ? `Versão ${criada.versao} congelada com ${criada.resumo.conformes}/${criada.resumo.total} controles conformes.`
      : criada.reativada
        ? `Versão ${criada.versao} reativada porque o mesmo conjunto de fontes voltou a ocorrer.`
        : `Versão ${criada.versao} já representava exatamente as fontes atuais.`;
    if (criada.invalidadas > 0) {
      resultado += ` ${criada.invalidadas} versão(ões) anterior(es) invalidada(s).`;
    }
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/homologacoes");
  redirect(destino(competencia, erro || resultado, Boolean(erro)));
}

export async function decidirCompetencia(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  let erro = "";
  let resultado = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const atualizada = await atualizarHomologacaoCompetencia({
      empresaId: empresa.id,
      homologacaoId: String(formData.get("homologacaoId") ?? ""),
      status: String(formData.get("status") ?? ""),
      justificativa: String(formData.get("justificativa") ?? ""),
      responsavel: String(formData.get("responsavel") ?? ""),
    });
    if (atualizada.status === "INVALIDADA") {
      resultado =
        "As fontes mudaram; a versão foi invalidada. Congele o diagnóstico atualizado.";
    } else if (atualizada.status === "APROVADA") {
      resultado = "Competência aprovada e dossiê mensal auditado.";
    } else if (atualizada.status === "REJEITADA") {
      resultado = "Competência rejeitada e justificativa registrada.";
    } else {
      resultado = "Competência encaminhada para análise.";
    }
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/homologacoes");
  redirect(destino(competencia, erro || resultado, Boolean(erro)));
}
