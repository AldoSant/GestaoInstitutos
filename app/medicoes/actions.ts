"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { salvarMedicaoMensal } from "@/db/medicoes";
import { mensagemOperacional } from "@/lib/mensagem-operacional";

function destino(competencia: string, mensagem: string, erro = false) {
  const params = new URLSearchParams({
    competencia,
    [erro ? "erro" : "sucesso"]: mensagem,
  });
  return `/medicoes?${params}`;
}

export async function salvarMedicao(formData: FormData) {
  const competencia = String(formData.get("competencia") ?? "");
  let erro = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    await salvarMedicaoMensal({
      empresaId: empresa.id,
      vinculoId: String(formData.get("vinculoId") ?? ""),
      competencia,
      tipo: String(formData.get("tipo") ?? ""),
      percentual: String(formData.get("percentual") ?? ""),
      quantidade: String(formData.get("quantidade") ?? ""),
      valorUnitario: String(formData.get("valorUnitario") ?? ""),
      valor: String(formData.get("valor") ?? ""),
      evidenciaReferencia: String(
        formData.get("evidenciaReferencia") ?? "",
      ),
      evidenciaHash: String(formData.get("evidenciaHash") ?? ""),
      conferente: String(formData.get("conferente") ?? ""),
      observacao: String(formData.get("observacao") ?? ""),
    });
  } catch (error) {
    erro = mensagemOperacional(error, "Não foi possível registrar a medição.");
  }
  revalidatePath("/medicoes");
  revalidatePath("/folhas");
  redirect(
    destino(
      competencia,
      erro || "Medição mensal calculada e conferida.",
      Boolean(erro),
    ),
  );
}
