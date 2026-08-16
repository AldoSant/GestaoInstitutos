"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { publicarEnquadramento } from "@/db/enquadramentos";
import { publicarPerfilRecolhimento } from "@/db/perfis-recolhimento";
import { exigirAdministrador } from "@/lib/autorizacao";
import { rotaAplicacao } from "@/lib/base-path";
import { validarEnquadramentoPrevidenciario } from "@/lib/enquadramento-previdenciario";
import { destinoInternoSeguro } from "@/lib/bloqueios-orientados";
import { mensagemOperacional } from "@/lib/mensagem-operacional";
import { validarPerfilRecolhimento } from "@/lib/perfil-recolhimento";

function competenciaValida(valor: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

export async function concluirConfiguracaoInicial(formData: FormData) {
  await exigirAdministrador();
  const competencia = String(formData.get("competencia") ?? "");
  const destino = competenciaValida(competencia)
    ? rotaAplicacao(`/folhas/nova?competencia=${competencia}`)
    : rotaAplicacao("/folhas/nova");
  const validacao = validarEnquadramentoPrevidenciario({
    regime: formData.get("regime"),
    inicioVigencia: formData.get("inicioVigencia"),
    fimVigencia: formData.get("fimVigencia"),
    cebasNumero: formData.get("cebasNumero"),
    cebasInicio: formData.get("cebasInicio"),
    cebasFim: formData.get("cebasFim"),
    evidencia: formData.get("evidencia"),
  });
  if (!validacao.dados) {
    redirect(
      `${rotaAplicacao("/configuracao-inicial")}?erro=${encodeURIComponent(validacao.erros.join(" "))}&competencia=${encodeURIComponent(competencia)}`,
    );
  }

  let erro = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    await publicarEnquadramento({
      empresaId: empresa.id,
      dados: validacao.dados,
      ator: "CONFIGURACAO_INICIAL",
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "constraint" in error &&
      error.constraint === "ex_enquadramento_publicado_sem_sobreposicao"
    ) {
      erro = "Já existe um enquadramento publicado para parte desta vigência.";
    } else {
      erro = mensagemOperacional(
        error,
        "Não foi possível concluir a configuração.",
      );
    }
  }
  if (erro) {
    redirect(
      `${rotaAplicacao("/configuracao-inicial")}?erro=${encodeURIComponent(erro)}&competencia=${encodeURIComponent(competencia)}`,
    );
  }

  revalidatePath("/");
  revalidatePath("/folhas");
  revalidatePath("/folhas/nova");
  redirect(
    `${destino}${destino.includes("?") ? "&" : "?"}sucesso=${encodeURIComponent("Configuração previdenciária da empresa concluída.")}`,
  );
}

export async function concluirPerfilRecolhimento(formData: FormData) {
  await exigirAdministrador();
  const competencia = String(formData.get("competencia") ?? "");
  const fallback = competenciaValida(competencia)
    ? `/obrigacoes?competencia=${competencia}`
    : "/obrigacoes";
  const retorno = destinoInternoSeguro(String(formData.get("retorno") ?? ""), fallback);
  const validacao = validarPerfilRecolhimento({
    instrumento: formData.get("instrumento"),
    codigoReceita: formData.get("codigoReceita"),
    inicioVigencia: formData.get("inicioVigencia"),
    fimVigencia: formData.get("fimVigencia"),
    evidencia: formData.get("evidencia"),
    responsavel: formData.get("responsavel"),
  });
  if (!validacao.dados) {
    redirect(
      `${rotaAplicacao("/configuracao-inicial")}?etapa=recolhimento&competencia=${encodeURIComponent(competencia)}&retorno=${encodeURIComponent(retorno)}&erro=${encodeURIComponent(validacao.erros.join(" "))}`,
    );
  }

  let erro = "";
  try {
    const empresa = await resolverEmpresaAtiva();
    await publicarPerfilRecolhimento({
      empresaId: empresa.id,
      dados: validacao.dados,
      ator: "CONFIGURACAO_INICIAL",
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "constraint" in error &&
      error.constraint === "ex_perfil_recolhimento_publicado_sem_sobreposicao"
    ) {
      erro = "Já existe uma regra de recolhimento publicada para parte desta vigência.";
    } else {
      erro = mensagemOperacional(
        error,
        "Não foi possível salvar a regra de recolhimento.",
      );
    }
  }
  if (erro) {
    redirect(
      `${rotaAplicacao("/configuracao-inicial")}?etapa=recolhimento&competencia=${encodeURIComponent(competencia)}&retorno=${encodeURIComponent(retorno)}&erro=${encodeURIComponent(erro)}`,
    );
  }

  revalidatePath("/");
  revalidatePath("/folhas/nova");
  revalidatePath("/obrigacoes");
  redirect(
    `${rotaAplicacao(retorno)}${retorno.includes("?") ? "&" : "?"}sucesso=${encodeURIComponent("Regra de recolhimento da empresa salva para esta vigência.")}`,
  );
}
