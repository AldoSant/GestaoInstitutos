"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { eventos, eventosRecorrentes, vinculos } from "@/db/schema";
import { idCadastroValido } from "@/lib/cadastros";
import { validarEventoCadastro, validarEventoRecorrente } from "@/lib/eventos";

function destino(mensagem: string, erro = false, ancora = "") {
  const params = new URLSearchParams({ [erro ? "erro" : "sucesso"]: mensagem });
  return `/eventos?${params.toString()}${ancora}`;
}

function mensagemBanco(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23P01") {
      return "Já existe um lançamento ativo ocupando essa vigência.";
    }
    if (error.code === "23505") return "Já existe um registro com a mesma chave inicial.";
    if (error.code === "23503") return "Um cadastro relacionado não foi encontrado.";
    if (error.code === "23514") return "O banco rejeitou o tipo, a vigência ou o valor.";
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export async function salvarEvento(formData: FormData) {
  const validacao = validarEventoCadastro({
    id: formData.get("id"),
    codigo: formData.get("codigo"),
    descricao: formData.get("descricao"),
    natureza: formData.get("natureza"),
    tipoCalculo: formData.get("tipoCalculo"),
    incideInss: formData.get("incideInss") === "on",
    incideIrrf: formData.get("incideIrrf") === "on",
  });
  if (!validacao.dados) redirect(destino(validacao.erros.join(" "), true, "#cadastro"));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    const values = {
      codigo: dados.codigo,
      descricao: dados.descricao,
      natureza: dados.natureza,
      tipoCalculo: dados.tipoCalculo,
      incideInss: dados.incideInss,
      incideIrrf: dados.incideIrrf,
      atualizadoEm: new Date(),
    };
    if (dados.id) {
      if (dados.tipoCalculo === "PERCENTUAL") {
        const incompatíveis = await db.execute<{ total: number }>(sql`
          select count(*)::int total
            from lancamento_evento_recorrente
           where empresa_id = ${empresa.id}
             and evento_id = ${dados.id}
             and ativo
             and valor > 100
        `);
        if (incompatíveis.rows[0].total > 0) {
          throw new Error(
            "Inative ou ajuste os lançamentos acima de 100 antes de usar cálculo percentual.",
          );
        }
      }
      const alterados = await db
        .update(eventos)
        .set(values)
        .where(and(eq(eventos.id, dados.id), eq(eventos.empresaId, empresa.id)))
        .returning({ id: eventos.id });
      if (alterados.length !== 1) throw new Error("Evento não encontrado.");
    } else {
      await db.insert(eventos).values({ empresaId: empresa.id, ...values });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true, "#cadastro"));
  revalidatePath("/eventos");
  redirect(destino(validacao.dados.id ? "Evento atualizado." : "Evento cadastrado.", false, "#cadastro"));
}

export async function alternarEvento(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  if (!idCadastroValido(id)) redirect(destino("Identificador inválido.", true, "#cadastro"));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    if (!ativo) {
      const dependencias = await db.execute<{ total: number }>(sql`
        select count(*)::int total
          from lancamento_evento_recorrente
         where evento_id = ${id} and empresa_id = ${empresa.id} and ativo
      `);
      if (dependencias.rows[0].total > 0) {
        throw new Error("Inative primeiro os lançamentos recorrentes deste Evento.");
      }
    }
    const alterados = await db
      .update(eventos)
      .set({ ativo, atualizadoEm: new Date() })
      .where(and(eq(eventos.id, id), eq(eventos.empresaId, empresa.id)))
      .returning({ id: eventos.id });
    if (alterados.length !== 1) throw new Error("Evento não encontrado.");
  } catch (error) {
    erro = mensagemBanco(error);
  }
  if (erro) redirect(destino(erro, true, "#cadastro"));
  revalidatePath("/eventos");
  redirect(destino(ativo ? "Evento ativado." : "Evento inativado.", false, "#cadastro"));
}

export async function salvarEventoRecorrente(formData: FormData) {
  const validacao = validarEventoRecorrente({
    id: formData.get("id"),
    vinculoId: formData.get("vinculoId"),
    eventoId: formData.get("eventoId"),
    valor: formData.get("valor"),
    inicioCompetencia: formData.get("inicioCompetencia"),
    fimCompetencia: formData.get("fimCompetencia"),
  });
  if (!validacao.dados) {
    redirect(destino(validacao.erros.join(" "), true, "#recorrentes"));
  }

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    const dados = validacao.dados;
    const [evento, vinculo] = await Promise.all([
      db
        .select({ id: eventos.id, tipoCalculo: eventos.tipoCalculo })
        .from(eventos)
        .where(
          and(
            eq(eventos.id, dados.eventoId),
            eq(eventos.empresaId, empresa.id),
            eq(eventos.ativo, true),
          ),
        )
        .limit(1),
      db
        .select({ id: vinculos.id })
        .from(vinculos)
        .where(
          and(
            eq(vinculos.id, dados.vinculoId),
            eq(vinculos.empresaId, empresa.id),
            eq(vinculos.ativo, true),
          ),
        )
        .limit(1),
    ]);
    if (evento.length !== 1) throw new Error("Selecione um Evento ativo.");
    if (vinculo.length !== 1) throw new Error("Selecione um Vínculo ativo.");
    if (evento[0].tipoCalculo === "PERCENTUAL" && Number(dados.valor) > 100) {
      throw new Error("Evento percentual não pode exceder 100%.");
    }

    const sobrepostos = await db.execute<{ total: number }>(sql`
      select count(*)::int total
        from lancamento_evento_recorrente
       where empresa_id = ${empresa.id}
         and vinculo_id = ${dados.vinculoId}
         and evento_id = ${dados.eventoId}
         and ativo
         and id <> coalesce(${dados.id}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
         and daterange(inicio_competencia, coalesce(fim_competencia, 'infinity'::date), '[]')
             && daterange(${dados.inicioCompetencia}::date, coalesce(${dados.fimCompetencia}::date, 'infinity'::date), '[]')
    `);
    if (sobrepostos.rows[0].total > 0) {
      throw new Error("Já existe um lançamento ativo sobreposto para este Vínculo e Evento.");
    }

    const values = {
      vinculoId: dados.vinculoId,
      eventoId: dados.eventoId,
      valor: dados.valor,
      inicioCompetencia: dados.inicioCompetencia,
      fimCompetencia: dados.fimCompetencia,
      atualizadoEm: new Date(),
    };
    if (dados.id) {
      const alterados = await db
        .update(eventosRecorrentes)
        .set(values)
        .where(
          and(
            eq(eventosRecorrentes.id, dados.id),
            eq(eventosRecorrentes.empresaId, empresa.id),
          ),
        )
        .returning({ id: eventosRecorrentes.id });
      if (alterados.length !== 1) throw new Error("Lançamento não encontrado.");
    } else {
      await db.insert(eventosRecorrentes).values({ empresaId: empresa.id, ...values });
    }
  } catch (error) {
    erro = mensagemBanco(error);
  }

  if (erro) redirect(destino(erro, true, "#recorrentes"));
  revalidatePath("/eventos");
  redirect(
    destino(
      validacao.dados.id ? "Lançamento atualizado." : "Lançamento cadastrado.",
      false,
      "#recorrentes",
    ),
  );
}

export async function alternarEventoRecorrente(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const ativo = String(formData.get("ativo")) === "true";
  if (!idCadastroValido(id)) redirect(destino("Identificador inválido.", true, "#recorrentes"));

  let erro: string | null = null;
  try {
    const db = getDb();
    const empresa = await resolverEmpresaAtiva();
    if (ativo) {
      const atual = await db
        .select({
          vinculoId: eventosRecorrentes.vinculoId,
          eventoId: eventosRecorrentes.eventoId,
          inicio: eventosRecorrentes.inicioCompetencia,
          fim: eventosRecorrentes.fimCompetencia,
          valor: eventosRecorrentes.valor,
          tipoCalculo: eventos.tipoCalculo,
          eventoAtivo: eventos.ativo,
          vinculoAtivo: vinculos.ativo,
        })
        .from(eventosRecorrentes)
        .innerJoin(eventos, eq(eventos.id, eventosRecorrentes.eventoId))
        .innerJoin(vinculos, eq(vinculos.id, eventosRecorrentes.vinculoId))
        .where(
          and(
            eq(eventosRecorrentes.id, id),
            eq(eventosRecorrentes.empresaId, empresa.id),
          ),
        )
        .limit(1);
      if (atual.length !== 1) throw new Error("Lançamento não encontrado.");
      if (!atual[0].eventoAtivo || !atual[0].vinculoAtivo) {
        throw new Error("Ative primeiro o Evento e o Vínculo.");
      }
      if (atual[0].tipoCalculo === "PERCENTUAL" && Number(atual[0].valor) > 100) {
        throw new Error("Evento percentual não pode exceder 100%.");
      }
      const sobrepostos = await db.execute<{ total: number }>(sql`
        select count(*)::int total
          from lancamento_evento_recorrente
         where empresa_id = ${empresa.id}
           and vinculo_id = ${atual[0].vinculoId}
           and evento_id = ${atual[0].eventoId}
           and ativo and id <> ${id}
           and daterange(inicio_competencia, coalesce(fim_competencia, 'infinity'::date), '[]')
               && daterange(${atual[0].inicio}::date, coalesce(${atual[0].fim}::date, 'infinity'::date), '[]')
      `);
      if (sobrepostos.rows[0].total > 0) {
        throw new Error("Outro lançamento ativo ocupa a mesma vigência.");
      }
    }
    const alterados = await db
      .update(eventosRecorrentes)
      .set({ ativo, atualizadoEm: new Date() })
      .where(
        and(
          eq(eventosRecorrentes.id, id),
          eq(eventosRecorrentes.empresaId, empresa.id),
        ),
      )
      .returning({ id: eventosRecorrentes.id });
    if (alterados.length !== 1) throw new Error("Lançamento não encontrado.");
  } catch (error) {
    erro = mensagemBanco(error);
  }
  if (erro) redirect(destino(erro, true, "#recorrentes"));
  revalidatePath("/eventos");
  redirect(destino(ativo ? "Lançamento ativado." : "Lançamento inativado.", false, "#recorrentes"));
}
