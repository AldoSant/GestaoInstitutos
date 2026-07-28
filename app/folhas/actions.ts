"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  criarFolha,
  fecharFolha,
  reabrirFolha,
  registrarConferenciaFolha,
  solicitarReprocessamentoFolha,
} from "@/db/folhas";

function mensagem(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") return "Já existe uma Folha com a mesma chave.";
    if (error.code === "23503") return "Um cadastro relacionado não foi encontrado.";
    if (error.code === "23514") return "O banco rejeitou o estado ou os valores da Folha.";
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function destino(id: string, texto: string, erro = false) {
  const params = new URLSearchParams({ [erro ? "erro" : "sucesso"]: texto });
  return id ? `/folhas/${id}?${params}` : `/folhas?${params}`;
}

export async function criarNovaFolha(formData: FormData) {
  const [termoId, metaId] = String(formData.get("instrumento") ?? "").split(":");
  const competencia = String(formData.get("competencia") ?? "");
  let folhaId = "";
  let erro = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const criada = await criarFolha({
      empresaId: empresa.id,
      termoId,
      metaId,
      competencia,
    });
    folhaId = criada.id;
  } catch (error) {
    erro = mensagem(error);
  }
  if (erro) redirect(`/folhas/nova?erro=${encodeURIComponent(erro)}`);
  revalidatePath("/folhas");
  redirect(destino(folhaId, "Folha criada e enviada para processamento."));
}

export async function solicitarReprocessamento(formData: FormData) {
  const folhaId = String(formData.get("folhaId") ?? "");
  let erro = "";
  try {
    await solicitarReprocessamentoFolha(folhaId);
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/folhas");
  revalidatePath(`/folhas/${folhaId}`);
  redirect(
    destino(
      folhaId,
      erro || "Nova revisão enviada para processamento.",
      Boolean(erro),
    ),
  );
}

export async function fechar(formData: FormData) {
  const folhaId = String(formData.get("folhaId") ?? "");
  let erro = "";
  try {
    await fecharFolha(folhaId);
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/folhas");
  revalidatePath(`/folhas/${folhaId}`);
  redirect(destino(folhaId, erro || "Folha fechada e memória congelada.", Boolean(erro)));
}

export async function registrarConferencia(formData: FormData) {
  const folhaId = String(formData.get("folhaId") ?? "");
  let erro = "";
  let resultado = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const registrada = await registrarConferenciaFolha({
      empresaId: empresa.id,
      folhaId,
      resultado: String(formData.get("resultado") ?? ""),
      conferente: String(formData.get("conferente") ?? ""),
      confirmouCadastros: formData.get("confirmouCadastros") === "on",
      confirmouValores: formData.get("confirmouValores") === "on",
      confirmouRubricas: formData.get("confirmouRubricas") === "on",
      observacao: String(formData.get("observacao") ?? ""),
    });
    resultado =
      registrada.resultado === "APROVADA"
        ? "Conferência do RH aprovada para esta revisão."
        : "Conferência rejeitada e pendência registrada.";
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/folhas");
  revalidatePath(`/folhas/${folhaId}`);
  redirect(destino(folhaId, erro || resultado, Boolean(erro)));
}

export async function reabrir(formData: FormData) {
  const folhaId = String(formData.get("folhaId") ?? "");
  const motivo = String(formData.get("motivo") ?? "");
  let erro = "";
  try {
    await reabrirFolha(folhaId, motivo);
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/folhas");
  revalidatePath(`/folhas/${folhaId}`);
  redirect(destino(folhaId, erro || "Folha reaberta com trilha de auditoria.", Boolean(erro)));
}
