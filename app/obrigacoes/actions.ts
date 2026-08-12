"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  apurarRetencoesSegurados,
  cancelarObrigacao,
  registrarDocumentoObrigacao,
  solicitarRetificacaoObrigacao,
} from "@/db/obrigacoes";
import { validarDocumentoObrigacao } from "@/lib/documentos-obrigacao";
import { rotaAplicacao } from "@/lib/base-path";

export async function apurarObrigacao(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  let erro = "";
  let sucesso = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const resultado = await apurarRetencoesSegurados({
      empresaId: empresa.id,
      competencia,
    });
    sucesso = `Apuração atualizada com ${resultado.itens} item(ns) de ${resultado.folhas} Folha(s) fechada(s).`;
  } catch (error) {
    erro = error instanceof Error ? error.message : "Não foi possível apurar a obrigação.";
  }
  revalidatePath("/obrigacoes");
  const params = new URLSearchParams({
    [erro ? "erro" : "sucesso"]: erro || sucesso,
  });
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    params.set("competencia", competencia);
  }
  redirect(rotaAplicacao(`/obrigacoes?${params.toString()}`));
}

export async function registrarDocumento(formData: FormData) {
  const validacao = validarDocumentoObrigacao({
    obrigacaoId: formData.get("obrigacaoId"),
    tipo: formData.get("tipo"),
    referencia: formData.get("referencia"),
    valorTotal: formData.get("valorTotal"),
    emitidoEm: formData.get("emitidoEm"),
    localizador: formData.get("localizador"),
    hashSha256: formData.get("hashSha256"),
    verificado: formData.get("verificado"),
  });
  let erro = validacao.dados ? "" : validacao.erros.join(" ");
  if (validacao.dados) {
    try {
      const empresa = await resolverEmpresaAtiva();
      await registrarDocumentoObrigacao({
        empresaId: empresa.id,
        ...validacao.dados,
      });
    } catch (error) {
      erro = error instanceof Error ? error.message : "Não foi possível registrar o documento.";
    }
  }
  revalidatePath("/obrigacoes");
  const params = new URLSearchParams({
    [erro ? "erro" : "sucesso"]:
      erro || "Documento registrado e estado da conciliação atualizado.",
  });
  redirect(rotaAplicacao(`/obrigacoes?${params.toString()}`));
}

export async function cancelarObrigacaoFiscal(formData: FormData) {
  const obrigacaoId = String(formData.get("obrigacaoId") ?? "");
  const motivo = String(formData.get("motivo") ?? "");
  let erro = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    await cancelarObrigacao({
      empresaId: empresa.id,
      obrigacaoId,
      motivo,
    });
  } catch (error) {
    erro =
      error instanceof Error
        ? error.message
        : "Não foi possível cancelar a obrigação.";
  }
  revalidatePath("/obrigacoes");
  const params = new URLSearchParams({
    [erro ? "erro" : "sucesso"]:
      erro || "Obrigação cancelada com invalidação das conferências documentais.",
  });
  redirect(rotaAplicacao(`/obrigacoes?${params.toString()}`));
}

export async function solicitarRetificacaoFiscal(formData: FormData) {
  const obrigacaoId = String(formData.get("obrigacaoId") ?? "");
  let erro = "";
  let sucesso = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    const retificacao = await solicitarRetificacaoObrigacao({
      empresaId: empresa.id,
      obrigacaoId,
      motivo: String(formData.get("motivo") ?? ""),
      responsavel: String(formData.get("responsavel") ?? ""),
    });
    sucesso = `Retificação v${retificacao.versao} aberta. O original foi congelado no hash ${retificacao.hashSnapshot.slice(0, 12)}.`;
  } catch (error) {
    erro =
      error instanceof Error
        ? error.message
        : "Não foi possível iniciar a retificação.";
  }
  revalidatePath("/obrigacoes");
  revalidatePath("/fechamento-mensal");
  const params = new URLSearchParams({
    [erro ? "erro" : "sucesso"]: erro || sucesso,
  });
  redirect(rotaAplicacao(`/obrigacoes?${params.toString()}`));
}
