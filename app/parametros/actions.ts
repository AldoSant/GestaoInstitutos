"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { publicarEnquadramento } from "@/db/enquadramentos";
import { exigirAdministrador } from "@/lib/autorizacao";
import { validarEnquadramentoPrevidenciario } from "@/lib/enquadramento-previdenciario";

export async function salvarEnquadramento(formData: FormData) {
  await exigirAdministrador();
  const validacao = validarEnquadramentoPrevidenciario({
    regime: formData.get("regime"),
    inicioVigencia: formData.get("inicioVigencia"),
    fimVigencia: formData.get("fimVigencia"),
    cebasNumero: formData.get("cebasNumero"),
    cebasInicio: formData.get("cebasInicio"),
    cebasFim: formData.get("cebasFim"),
    evidencia: formData.get("evidencia"),
  });
  let erro = validacao.dados ? "" : validacao.erros.join(" ");
  if (validacao.dados) {
    try {
      const empresa = await resolverEmpresaAtiva();
      await publicarEnquadramento({
        empresaId: empresa.id,
        dados: validacao.dados,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "constraint" in error &&
        error.constraint === "ex_enquadramento_publicado_sem_sobreposicao"
      ) {
        erro = "Já existe enquadramento publicado sobrepondo essa vigência.";
      } else {
        erro = error instanceof Error ? error.message : "Não foi possível publicar.";
      }
    }
  }
  revalidatePath("/parametros");
  const params = new URLSearchParams({
    [erro ? "erro" : "sucesso"]:
      erro || "Enquadramento previdenciário publicado e congelado por vigência.",
  });
  redirect(`/parametros?${params.toString()}`);
}
