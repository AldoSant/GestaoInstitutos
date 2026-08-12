"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import {
  dependentes,
  pessoas,
  pessoasContasBancarias,
  pessoasEnderecos,
} from "@/db/schema";
import {
  idCadastroValido,
  validarContaPessoaCadastro,
  validarDependenteCadastro,
  validarEnderecoPessoaCadastro,
  validarFichaPessoaCadastro,
} from "@/lib/cadastros";
import { mensagemOperacional } from "@/lib/mensagem-operacional";

function destino(
  pessoaId: string,
  mensagem: string,
  erro = false,
  ancora = "",
) {
  const params = new URLSearchParams({
    [erro ? "erro" : "sucesso"]: mensagem,
  });
  return `/cadastros/pessoas/${pessoaId}?${params.toString()}${ancora}`;
}

function mensagemBanco(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") return "Já existe um registro com esses dados.";
    if (error.code === "23514") return "Um dos valores informados é inconsistente.";
  }
  return mensagemOperacional(error, "Não foi possível concluir a operação.");
}

async function executar(
  pessoaId: string,
  ancora: string,
  operacao: () => Promise<void>,
  sucesso: string,
) {
  let erro: string | null = null;
  try {
    await operacao();
  } catch (error) {
    erro = mensagemBanco(error);
  }
  if (erro) redirect(destino(pessoaId, erro, true, ancora));
  revalidatePath(`/cadastros/pessoas/${pessoaId}`);
  revalidatePath("/cadastros");
  redirect(destino(pessoaId, sucesso, false, ancora));
}

export async function salvarFichaPessoa(formData: FormData) {
  const validacao = validarFichaPessoaCadastro({
    id: formData.get("pessoaId"),
    tipo: formData.get("tipo"),
    nome: formData.get("nome"),
    documento: formData.get("documento"),
    nascimento: formData.get("nascimento"),
    sexo: formData.get("sexo"),
    rg: formData.get("rg"),
    rgOrgaoEmissor: formData.get("rgOrgaoEmissor"),
    rgUf: formData.get("rgUf"),
    rgEmissao: formData.get("rgEmissao"),
    estadoCivil: formData.get("estadoCivil"),
    naturalidade: formData.get("naturalidade"),
    inscricaoInss: formData.get("inscricaoInss"),
    conselhoTipo: formData.get("conselhoTipo"),
    conselhoNumero: formData.get("conselhoNumero"),
    aposentado: formData.get("aposentado"),
    cnh: formData.get("cnh"),
    cnhCategoria: formData.get("cnhCategoria"),
    cnhValidade: formData.get("cnhValidade"),
    nomeFantasia: formData.get("nomeFantasia"),
    representanteLegal: formData.get("representanteLegal"),
    inscricaoMunicipal: formData.get("inscricaoMunicipal"),
    inscricaoEstadual: formData.get("inscricaoEstadual"),
    email: formData.get("email"),
    telefone: formData.get("telefone"),
    celular: formData.get("celular"),
    celularAlternativo: formData.get("celularAlternativo"),
    papelPrestador: formData.get("papelPrestador"),
    papelParceiro: formData.get("papelParceiro"),
    papelFornecedor: formData.get("papelFornecedor"),
  });
  const pessoaId = String(formData.get("pessoaId") ?? "");
  if (!validacao.dados) {
    redirect(destino(pessoaId, validacao.erros.join(" "), true, "#identidade"));
  }
  await executar(
    pessoaId,
    "#identidade",
    async () => {
      const empresa = await resolverEmpresaAtiva();
      const dados = validacao.dados;
      const alterados = await getDb()
        .update(pessoas)
        .set({
          tipo: dados.tipo,
          nomeRazaoSocial: dados.nome,
          cpf: dados.cpf,
          cnpj: dados.cnpj,
          nascimento: dados.nascimento,
          sexo: dados.sexo,
          rg: dados.rg,
          rgOrgaoEmissor: dados.rgOrgaoEmissor,
          rgUf: dados.rgUf,
          rgEmissao: dados.rgEmissao,
          estadoCivil: dados.estadoCivil,
          naturalidade: dados.naturalidade,
          inscricaoInss: dados.inscricaoInss,
          conselhoTipo: dados.conselhoTipo,
          conselhoNumero: dados.conselhoNumero,
          aposentado: dados.aposentado,
          cnh: dados.cnh,
          cnhCategoria: dados.cnhCategoria,
          cnhValidade: dados.cnhValidade,
          nomeFantasia: dados.nomeFantasia,
          representanteLegal: dados.representanteLegal,
          inscricaoMunicipal: dados.inscricaoMunicipal,
          inscricaoEstadual: dados.inscricaoEstadual,
          email: dados.email,
          telefone: dados.telefone,
          celular: dados.celular,
          celularAlternativo: dados.celularAlternativo,
          papelPrestador: dados.papelPrestador,
          papelParceiro: dados.papelParceiro,
          papelFornecedor: dados.papelFornecedor,
          atualizadoEm: new Date(),
        })
        .where(
          and(eq(pessoas.empresaId, empresa.id), eq(pessoas.id, pessoaId)),
        )
        .returning({ id: pessoas.id });
      if (alterados.length !== 1) throw new Error("Pessoa não encontrada.");
    },
    "Dados pessoais atualizados.",
  );
}

export async function salvarEnderecoPessoa(formData: FormData) {
  const validacao = validarEnderecoPessoaCadastro({
    pessoaId: formData.get("pessoaId"),
    cep: formData.get("cep"),
    logradouro: formData.get("logradouro"),
    numero: formData.get("numero"),
    bairro: formData.get("bairro"),
    municipio: formData.get("municipio"),
    complemento: formData.get("complemento"),
    referencia: formData.get("referencia"),
  });
  const pessoaId = String(formData.get("pessoaId") ?? "");
  if (!validacao.dados) {
    redirect(destino(pessoaId, validacao.erros.join(" "), true, "#endereco"));
  }
  await executar(
    pessoaId,
    "#endereco",
    async () => {
      const empresa = await resolverEmpresaAtiva();
      const dados = validacao.dados;
      await getDb()
        .insert(pessoasEnderecos)
        .values({
          empresaId: empresa.id,
          pessoaId,
          cep: dados.cep,
          logradouro: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
          municipio: dados.municipio,
          complemento: dados.complemento,
          referencia: dados.referencia,
        })
        .onConflictDoUpdate({
          target: [pessoasEnderecos.empresaId, pessoasEnderecos.pessoaId],
          set: {
            cep: dados.cep,
            logradouro: dados.logradouro,
            numero: dados.numero,
            bairro: dados.bairro,
            municipio: dados.municipio,
            complemento: dados.complemento,
            referencia: dados.referencia,
            atualizadoEm: new Date(),
          },
        });
    },
    "Endereço atualizado.",
  );
}

export async function salvarContaPessoa(formData: FormData) {
  const validacao = validarContaPessoaCadastro({
    pessoaId: formData.get("pessoaId"),
    agencia: formData.get("agencia"),
    numero: formData.get("numero"),
    digito: formData.get("digito"),
    variacao: formData.get("variacao"),
    tipo: formData.get("tipo"),
  });
  const pessoaId = String(formData.get("pessoaId") ?? "");
  if (!validacao.dados) {
    redirect(destino(pessoaId, validacao.erros.join(" "), true, "#pagamento"));
  }
  await executar(
    pessoaId,
    "#pagamento",
    async () => {
      const empresa = await resolverEmpresaAtiva();
      const dados = validacao.dados;
      await getDb()
        .insert(pessoasContasBancarias)
        .values({
          empresaId: empresa.id,
          pessoaId,
          agencia: dados.agencia,
          numero: dados.numero,
          digito: dados.digito,
          variacao: dados.variacao,
          tipo: dados.tipo,
        })
        .onConflictDoUpdate({
          target: [
            pessoasContasBancarias.empresaId,
            pessoasContasBancarias.pessoaId,
          ],
          set: {
            agencia: dados.agencia,
            numero: dados.numero,
            digito: dados.digito,
            variacao: dados.variacao,
            tipo: dados.tipo,
            atualizadoEm: new Date(),
          },
        });
    },
    "Conta bancária atualizada.",
  );
}

export async function salvarDependente(formData: FormData) {
  const validacao = validarDependenteCadastro({
    id: formData.get("id"),
    pessoaId: formData.get("pessoaId"),
    nome: formData.get("nome"),
    cpf: formData.get("cpf"),
    nascimento: formData.get("nascimento"),
    parentesco: formData.get("parentesco"),
    estudante: formData.get("estudante"),
    baixaSalarioFamilia: formData.get("baixaSalarioFamilia"),
    baixaIrrf: formData.get("baixaIrrf"),
  });
  const pessoaId = String(formData.get("pessoaId") ?? "");
  if (!validacao.dados) {
    redirect(destino(pessoaId, validacao.erros.join(" "), true, "#dependentes"));
  }
  await executar(
    pessoaId,
    "#dependentes",
    async () => {
      const empresa = await resolverEmpresaAtiva();
      const dados = validacao.dados;
      if (dados.id) {
        const alterados = await getDb()
          .update(dependentes)
          .set({
            nome: dados.nome,
            cpf: dados.cpf,
            nascimento: dados.nascimento,
            parentesco: dados.parentesco,
            estudante: dados.estudante,
            baixaSalarioFamilia: dados.baixaSalarioFamilia,
            baixaIrrf: dados.baixaIrrf,
            atualizadoEm: new Date(),
          })
          .where(
            and(
              eq(dependentes.empresaId, empresa.id),
              eq(dependentes.pessoaId, pessoaId),
              eq(dependentes.id, dados.id),
            ),
          )
          .returning({ id: dependentes.id });
        if (alterados.length !== 1) throw new Error("Dependente não encontrado.");
      } else {
        const id = randomUUID();
        await getDb().insert(dependentes).values({
          id,
          empresaId: empresa.id,
          pessoaId,
          origemLegacyKey: `LOCAL:${id}`,
          nome: dados.nome,
          cpf: dados.cpf,
          nascimento: dados.nascimento,
          parentesco: dados.parentesco,
          estudante: dados.estudante,
          baixaSalarioFamilia: dados.baixaSalarioFamilia,
          baixaIrrf: dados.baixaIrrf,
        });
      }
    },
    validacao.dados.id ? "Dependente atualizado." : "Dependente cadastrado.",
  );
}

export async function alternarDependente(formData: FormData) {
  const pessoaId = String(formData.get("pessoaId") ?? "");
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  if (!idCadastroValido(pessoaId) || !idCadastroValido(id)) {
    redirect(destino(pessoaId, "Dependente inválido.", true, "#dependentes"));
  }
  await executar(
    pessoaId,
    "#dependentes",
    async () => {
      const empresa = await resolverEmpresaAtiva();
      const alterados = await getDb()
        .update(dependentes)
        .set({ ativo, atualizadoEm: new Date() })
        .where(
          and(
            eq(dependentes.empresaId, empresa.id),
            eq(dependentes.pessoaId, pessoaId),
            eq(dependentes.id, id),
          ),
        )
        .returning({ id: dependentes.id });
      if (alterados.length !== 1) throw new Error("Dependente não encontrado.");
    },
    ativo ? "Dependente ativado." : "Dependente inativado.",
  );
}
