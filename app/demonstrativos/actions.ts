"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  adicionarPagamentoPj,
  abrirNovaRevisaoDemonstrativo,
  excluirPagamentoPj,
  fecharDemonstrativo,
  materializarDemonstrativoFolhas,
  registrarConferenciaDemonstrativo,
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
    await materializarDemonstrativoFolhas({
      empresaId: empresa.id,
      competencia,
    });
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
        sucesso: "Pagamento PJ registrado no demonstrativo da competência com as retenções informadas.",
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

export async function conferirDemonstrativo(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  try {
    const empresa = await resolverEmpresaAtiva();
    const conferencia = await registrarConferenciaDemonstrativo({
      empresaId: empresa.id,
      demonstrativoId: String(formData.get("demonstrativoId") ?? ""),
      resultado: formData.get("resultado"),
      conferente: formData.get("conferente"),
      confirmouPagamentos: formData.get("confirmouPagamentos"),
      confirmouRetencoes: formData.get("confirmouRetencoes"),
      confirmouGuias: formData.get("confirmouGuias"),
      observacao: formData.get("observacao"),
    });
    revalidatePath("/demonstrativos");
    redirect(
      destino(competencia, {
        sucesso: `Conferência ${String(conferencia.resultado).toLowerCase()} no hash ${conferencia.hash.slice(0, 12)}.`,
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
            : "Não foi possível registrar a conferência.",
      }),
    );
  }
}

export async function concluirDemonstrativo(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  try {
    const empresa = await resolverEmpresaAtiva();
    const resultado = await fecharDemonstrativo({
      empresaId: empresa.id,
      demonstrativoId: String(formData.get("demonstrativoId") ?? ""),
      responsavel: String(formData.get("responsavel") ?? ""),
    });
    revalidatePath("/demonstrativos");
    redirect(
      destino(competencia, {
        sucesso: `Demonstrativo fechado no hash ${resultado.hash.slice(0, 12)}.`,
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
            : "Não foi possível fechar o demonstrativo.",
      }),
    );
  }
}

export async function abrirRevisaoDemonstrativo(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  try {
    const empresa = await resolverEmpresaAtiva();
    const resultado = await abrirNovaRevisaoDemonstrativo({
      empresaId: empresa.id,
      demonstrativoId: String(formData.get("demonstrativoId") ?? ""),
      motivo: formData.get("motivo"),
      responsavel: formData.get("responsavel"),
    });
    revalidatePath("/demonstrativos");
    redirect(
      destino(competencia, {
        sucesso: `Revisão ${resultado.revisao_destino} aberta. A revisão ${resultado.revisao_origem} foi preservada no hash ${resultado.hash_resultado.slice(0, 12)}.`,
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
            : "Não foi possível abrir a nova revisão.",
      }),
    );
  }
}
