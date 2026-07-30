"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  adicionarPagamentoPj,
  excluirPagamentoPj,
  materializarDemonstrativoFolhas,
} from "@/db/demonstrativos";

function destino(
  competencia: string,
  resultado: { erro?: string; sucesso?: string },
) {
  const params = new URLSearchParams({ competencia, ...resultado });
  return `/demonstrativos?${params.toString()}`;
}

export async function gerarRascunhoDemonstrativo(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  try {
    const empresa = await resolverEmpresaAtiva();
    const resultado = await materializarDemonstrativoFolhas({
      empresaId: empresa.id,
      competencia,
    });
    revalidatePath("/demonstrativos");
    redirect(
      destino(competencia, {
        sucesso: `Rascunho atualizado com ${resultado.pagamentos} pagamento(s) PF e ${resultado.guias} guia(s).`,
      }),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect(
      destino(competencia, {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o demonstrativo.",
      }),
    );
  }
}

export async function salvarPagamentoPj(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  try {
    const empresa = await resolverEmpresaAtiva();
    await adicionarPagamentoPj({
      empresaId: empresa.id,
      competencia,
      prestadorId: String(formData.get("prestadorId") ?? ""),
      documentoReferencia: String(formData.get("documentoReferencia") ?? ""),
      valorBruto: formData.get("valorBruto"),
      retencoes: {
        INSS: formData.get("inss"),
        IRRF: formData.get("irrf"),
        ISS: formData.get("iss"),
        PIS: formData.get("pis"),
        COFINS: formData.get("cofins"),
        CSLL: formData.get("csll"),
      },
    });
    revalidatePath("/demonstrativos");
    redirect(
      destino(competencia, {
        sucesso: "Pagamento PJ registrado com as retenções informadas.",
      }),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect(
      destino(competencia, {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível registrar o pagamento PJ.",
      }),
    );
  }
}

export async function removerPagamentoPj(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  try {
    const empresa = await resolverEmpresaAtiva();
    await excluirPagamentoPj({
      empresaId: empresa.id,
      pagamentoId: String(formData.get("pagamentoId") ?? ""),
    });
    revalidatePath("/demonstrativos");
    redirect(
      destino(competencia, { sucesso: "Pagamento PJ removido do rascunho." }),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect(
      destino(competencia, {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível remover o pagamento.",
      }),
    );
  }
}
