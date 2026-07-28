"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  atualizarStatusSimulacaoFiscal,
  criarSimulacaoConsolidacaoFiscal,
} from "@/db/simulacoes-consolidacao";

function destino(competencia: string, texto: string, erro = false) {
  return `/consolidacoes/simulacoes?${new URLSearchParams({
    competencia,
    [erro ? "erro" : "sucesso"]: texto,
  }).toString()}`;
}

function mensagem(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") {
      return "Uma simulação idêntica já foi criada; atualize a página.";
    }
    if (error.code === "23514") {
      return "O banco bloqueou um resultado fiscal inconsistente.";
    }
    if (error.code === "55000") {
      return "A simulação é imutável nesse estado; gere uma nova versão.";
    }
    if (error.code === "40001") {
      return "As fontes mudaram durante a operação; revise a competência e tente novamente.";
    }
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação fiscal.";
}

export async function simularCaso(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  let texto = "";
  let erro = false;
  try {
    const empresa = await resolverEmpresaAtiva();
    const resultado = await criarSimulacaoConsolidacaoFiscal({
      empresaId: empresa.id,
      casoId: String(formData.get("casoId") ?? ""),
      ator: String(formData.get("responsavel") ?? ""),
    });
    texto = resultado.reutilizada
      ? `A versão ${resultado.versao} já representava exatamente essas fontes.`
      : `Simulação fiscal v${resultado.versao} criada sem efeito na Folha.`;
  } catch (error) {
    texto = mensagem(error);
    erro = true;
  }
  revalidatePath("/consolidacoes/simulacoes");
  redirect(destino(competencia, texto, erro));
}

export async function alterarStatusSimulacao(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  let texto = "";
  let erro = false;
  try {
    const empresa = await resolverEmpresaAtiva();
    const resultado = await atualizarStatusSimulacaoFiscal({
      empresaId: empresa.id,
      simulacaoId: String(formData.get("simulacaoId") ?? ""),
      status: String(formData.get("status") ?? ""),
      responsavel: String(formData.get("responsavel") ?? ""),
      justificativa: String(formData.get("justificativa") ?? ""),
    });
    texto = `Simulação atualizada para ${resultado.status.replaceAll("_", " ")}.`;
  } catch (error) {
    texto = mensagem(error);
    erro = true;
  }
  revalidatePath("/consolidacoes/simulacoes");
  redirect(destino(competencia, texto, erro));
}
