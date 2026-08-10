"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { registrarGuiaGpsIndividual } from "@/db/obrigacoes";
import { validarRegistroGuiaGpsIndividual } from "@/lib/guia-gps-individual";
import { caminhoAplicacao } from "@/lib/base-path";

export async function registrarGuiaGps(formData: FormData) {
  const validacao = validarRegistroGuiaGpsIndividual({
    guiaId: formData.get("guiaId"),
    referencia: formData.get("referencia"),
    emitidoEm: formData.get("emitidoEm"),
    localizador: formData.get("localizador"),
    hashSha256: formData.get("hashSha256"),
    juros: formData.get("juros"),
    multa: formData.get("multa"),
    verificado: formData.get("verificado"),
  });
  let erro = validacao.dados ? "" : validacao.erros.join(" ");
  let obrigacaoId = "";
  if (validacao.dados) {
    try {
      const empresa = await resolverEmpresaAtiva();
      const resultado = await registrarGuiaGpsIndividual({
        empresaId: empresa.id,
        ...validacao.dados,
      });
      obrigacaoId = resultado.obrigacaoId;
    } catch (error) {
      erro = error instanceof Error ? error.message : "Não foi possível registrar a GPS.";
    }
  }
  const destino = String(formData.get("obrigacaoId") ?? "");
  const id = obrigacaoId || destino;
  revalidatePath("/obrigacoes");
  if (id) {
    revalidatePath(`/obrigacoes/${id}/gps`);
    revalidatePath(`/obrigacoes/${id}/gps/registro`);
  }
  const params = new URLSearchParams({
    [erro ? "erro" : "sucesso"]:
      erro || "GPS oficial registrada individualmente e preservada para auditoria.",
  });
  redirect(caminhoAplicacao(`/obrigacoes/${id}/gps/registro?${params.toString()}`));
}
