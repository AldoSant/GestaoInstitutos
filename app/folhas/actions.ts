"use server";

import { Buffer } from "node:buffer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  cancelarFolha,
  criarFolha,
  fecharFolha,
  reabrirFolha,
  registrarConferenciaFolha,
  solicitarReprocessamentoFolha,
  tentarNovamenteProcessamentoFolha,
} from "@/db/folhas";
import { registrarHomologacaoFolha } from "@/db/homologacoes";

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

export async function tentarNovamenteProcessamento(formData: FormData) {
  const folhaId = String(formData.get("folhaId") ?? "");
  let erro = "";
  try {
    await tentarNovamenteProcessamentoFolha(folhaId);
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/folhas");
  revalidatePath(`/folhas/${folhaId}`);
  redirect(
    destino(
      folhaId,
      erro || "Nova tentativa enviada para a fila de processamento.",
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

export async function importarHomologacao(formData: FormData) {
  const folhaId = String(formData.get("folhaId") ?? "");
  const arquivo = formData.get("arquivo");
  let erro = "";
  let resultado = "";
  try {
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      throw new Error("Selecione um arquivo CSV de referência.");
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      throw new Error("O CSV de referência deve possuir até 5 MB.");
    }
    const empresa = await resolverEmpresaAtiva();
    const registrada = await registrarHomologacaoFolha({
      empresaId: empresa.id,
      folhaId,
      origem: String(formData.get("origem") ?? ""),
      referencia: String(formData.get("referencia") ?? ""),
      nomeArquivo: arquivo.name,
      conteudo: Buffer.from(await arquivo.arrayBuffer()),
      ator: String(formData.get("responsavel") ?? ""),
    });
    resultado = registrada.reutilizada
      ? "Este arquivo já havia sido homologado para a revisão atual."
      : registrada.status === "CONCILIADA"
        ? `Homologação concluída: ${registrada.conciliados} item(ns) conciliado(s), sem divergências.`
        : `Homologação concluída com ${registrada.divergentes} divergência(s) para análise.`;
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath(`/folhas/${folhaId}`);
  redirect(destino(folhaId, erro || resultado, Boolean(erro)));
}

export async function cancelar(formData: FormData) {
  const folhaId = String(formData.get("folhaId") ?? "");
  const motivo = String(formData.get("motivo") ?? "");
  let erro = "";
  try {
    await cancelarFolha(folhaId, motivo);
  } catch (error) {
    erro = mensagem(error);
  }
  revalidatePath("/folhas");
  revalidatePath(`/folhas/${folhaId}`);
  redirect(
    destino(
      folhaId,
      erro || "Folha cancelada e tarefas pendentes interrompidas.",
      Boolean(erro),
    ),
  );
}
