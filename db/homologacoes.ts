import { createHash, randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";
import type { PoolClient } from "pg";
import {
  compararFolhaComLegado,
  lerCsvFolhaLegado,
} from "@/lib/homologacao-folha";
import { getPool } from "./index";

type OrigemHomologacao = "GIW" | "PLANILHA_RH" | "OUTRO";

type LinhaFolha = {
  id: string;
  revisao: number;
  status: string;
  hash_resultado: string | null;
};

type LinhaItemFolha = {
  id: string;
  total_proventos: string;
  total_descontos: string;
  valor_inss: string;
  valor_irrf: string;
  total_liquido: string;
  snapshots: unknown;
};

type LinhaLote = {
  id: string;
  revisao: number;
  hash_folha: string;
  origem: OrigemHomologacao;
  referencia: string;
  nome_arquivo: string;
  hash_arquivo: string;
  status: "CONCILIADA" | "DIVERGENTE";
  total_linhas: number;
  conciliados: number;
  divergentes: number;
  resumo: unknown;
  criado_por: string;
  criado_em: Date;
};

function validarId(valor: string, campo: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      valor,
    )
  ) {
    throw new Error(`${campo} inválido.`);
  }
  return valor;
}

function textoObrigatorio(
  valor: string,
  campo: string,
  minimo: number,
  maximo: number,
) {
  const normalizado = valor.trim();
  if (
    normalizado.length < minimo ||
    normalizado.length > maximo ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(normalizado)
  ) {
    throw new Error(`${campo} inválido.`);
  }
  return normalizado;
}

function origemNormalizada(valor: string): OrigemHomologacao {
  if (valor === "GIW" || valor === "PLANILHA_RH" || valor === "OUTRO") {
    return valor;
  }
  throw new Error("Origem da referência inválida.");
}

function nomeArquivoNormalizado(valor: string) {
  const nome = textoObrigatorio(valor, "Nome do arquivo", 1, 255)
    .replace(/^.*[\\/]/, "")
    .trim();
  if (!nome.toLowerCase().endsWith(".csv")) {
    throw new Error("A homologação aceita somente arquivos CSV.");
  }
  return nome;
}

function moedaSql(centavos: number) {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error("Valor monetário inseguro na homologação.");
  }
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  return `${sinal}${Math.floor(absoluto / 100)}.${String(
    absoluto % 100,
  ).padStart(2, "0")}`;
}

function decodificarCsv(conteudo: Buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(conteudo);
  } catch {
    return new TextDecoder("windows-1252", { fatal: true }).decode(conteudo);
  }
}

async function transacao<T>(operacao: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const resultado = await operacao(client);
    await client.query("commit");
    return resultado;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function registrarHomologacaoFolha({
  empresaId,
  folhaId,
  origem,
  referencia,
  nomeArquivo,
  conteudo,
  ator,
}: {
  empresaId: string;
  folhaId: string;
  origem: string;
  referencia: string;
  nomeArquivo: string;
  conteudo: Buffer;
  ator: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(folhaId, "Folha");
  const origemValidada = origemNormalizada(origem);
  const referenciaValidada = textoObrigatorio(
    referencia,
    "Referência",
    3,
    200,
  );
  const arquivoValidado = nomeArquivoNormalizado(nomeArquivo);
  const atorValidado = textoObrigatorio(ator, "Responsável", 3, 160);
  if (conteudo.byteLength === 0 || conteudo.byteLength > 5 * 1024 * 1024) {
    throw new Error("O CSV deve possuir até 5 MB e não pode estar vazio.");
  }
  const textoCsv = decodificarCsv(conteudo);
  const hashArquivo = createHash("sha256").update(conteudo).digest("hex");

  return transacao(async (client) => {
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [
        atorValidado,
        `Homologação da Folha com referência ${origemValidada}: ${referenciaValidada}.`,
      ],
    );
    const bloqueada = await client.query<LinhaFolha>(
      `select id, revisao, status, hash_resultado
         from folha
        where id = $1 and empresa_id = $2
        for update`,
      [folhaId, empresaId],
    );
    const folha = bloqueada.rows[0];
    if (!folha) throw new Error("Folha não encontrada.");
    if (
      !folha.hash_resultado ||
      !["ABERTA", "FECHADA"].includes(folha.status)
    ) {
      throw new Error(
        "A Folha precisa estar processada para receber uma homologação.",
      );
    }

    const existente = await client.query<LinhaLote>(
      `select id, revisao, hash_folha, origem, referencia, nome_arquivo,
              hash_arquivo, status, total_linhas, conciliados, divergentes,
              resumo, criado_por, criado_em
         from folha_homologacao
        where folha_id = $1 and hash_folha = $2 and hash_arquivo = $3`,
      [folha.id, folha.hash_resultado, hashArquivo],
    );
    if (existente.rows[0]) {
      return { ...existente.rows[0], reutilizada: true };
    }

    const referenciaLegado = lerCsvFolhaLegado(textoCsv);
    const atuais = await client.query<LinhaItemFolha>(
      `select id, total_proventos::text, total_descontos::text,
              valor_inss::text, valor_irrf::text, total_liquido::text,
              snapshots
         from folha_item
        where folha_id = $1 and empresa_id = $2
        order by id`,
      [folha.id, empresaId],
    );
    if (atuais.rowCount === 0) {
      throw new Error("A Folha não possui itens processados.");
    }
    const comparacao = compararFolhaComLegado(
      referenciaLegado,
      atuais.rows,
    );
    const loteId = randomUUID();
    const status =
      comparacao.divergentes === 0 ? "CONCILIADA" : "DIVERGENTE";
    const resumo = {
      versao: 1,
      unidade: "CENTAVOS",
      totaisEsperados: comparacao.totaisEsperados,
      totaisAtuais: comparacao.totaisAtuais,
      diferencas: comparacao.diferencas,
    };

    await client.query(
      `insert into folha_homologacao
         (id, empresa_id, folha_id, revisao, hash_folha, origem, referencia,
          nome_arquivo, hash_arquivo, status, total_linhas, conciliados,
          divergentes, resumo, criado_por)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        loteId,
        empresaId,
        folha.id,
        folha.revisao,
        folha.hash_resultado,
        origemValidada,
        referenciaValidada,
        arquivoValidado,
        hashArquivo,
        status,
        comparacao.itens.length,
        comparacao.conciliados,
        comparacao.divergentes,
        resumo,
        atorValidado,
      ],
    );

    const itens = comparacao.itens.map((item) => ({
      folha_item_id: item.folhaItemId,
      matricula: item.matricula,
      nome: item.nome,
      situacao: item.situacao,
      esperado_proventos: moedaSql(item.esperado.proventos),
      esperado_inss: moedaSql(item.esperado.inss),
      esperado_irrf: moedaSql(item.esperado.irrf),
      esperado_descontos: moedaSql(item.esperado.descontos),
      esperado_liquido: moedaSql(item.esperado.liquido),
      atual_proventos: moedaSql(item.atual.proventos),
      atual_inss: moedaSql(item.atual.inss),
      atual_irrf: moedaSql(item.atual.irrf),
      atual_descontos: moedaSql(item.atual.descontos),
      atual_liquido: moedaSql(item.atual.liquido),
      diferenca_proventos: moedaSql(item.diferencas.proventos),
      diferenca_inss: moedaSql(item.diferencas.inss),
      diferenca_irrf: moedaSql(item.diferencas.irrf),
      diferenca_descontos: moedaSql(item.diferencas.descontos),
      diferenca_liquido: moedaSql(item.diferencas.liquido),
    }));
    await client.query(
      `insert into folha_homologacao_item
         (empresa_id, homologacao_id, folha_item_id, matricula, nome, situacao,
          esperado_proventos, esperado_inss, esperado_irrf,
          esperado_descontos, esperado_liquido, atual_proventos, atual_inss,
          atual_irrf, atual_descontos, atual_liquido, diferenca_proventos,
          diferenca_inss, diferenca_irrf, diferenca_descontos,
          diferenca_liquido)
       select $1, $2, dados.*
         from jsonb_to_recordset($3::jsonb) as dados(
           folha_item_id uuid, matricula text, nome text, situacao text,
           esperado_proventos numeric, esperado_inss numeric,
           esperado_irrf numeric, esperado_descontos numeric,
           esperado_liquido numeric, atual_proventos numeric,
           atual_inss numeric, atual_irrf numeric, atual_descontos numeric,
           atual_liquido numeric, diferenca_proventos numeric,
           diferenca_inss numeric, diferenca_irrf numeric,
           diferenca_descontos numeric, diferenca_liquido numeric
         )`,
      [empresaId, loteId, JSON.stringify(itens)],
    );

    return {
      id: loteId,
      revisao: folha.revisao,
      hash_folha: folha.hash_resultado,
      origem: origemValidada,
      referencia: referenciaValidada,
      nome_arquivo: arquivoValidado,
      hash_arquivo: hashArquivo,
      status,
      total_linhas: comparacao.itens.length,
      conciliados: comparacao.conciliados,
      divergentes: comparacao.divergentes,
      resumo,
      criado_por: atorValidado,
      criado_em: new Date(),
      reutilizada: false,
    };
  });
}

export async function carregarHomologacoesFolha(
  empresaId: string,
  folhaId: string,
) {
  validarId(empresaId, "Empresa");
  validarId(folhaId, "Folha");
  const lotes = await getPool().query<LinhaLote>(
    `select id, revisao, hash_folha, origem, referencia, nome_arquivo,
            hash_arquivo, status, total_linhas, conciliados, divergentes,
            resumo, criado_por, criado_em
       from folha_homologacao
      where folha_id = $1 and empresa_id = $2
      order by criado_em desc, id desc
      limit 20`,
    [folhaId, empresaId],
  );
  const loteAtual = lotes.rows[0];
  if (!loteAtual) return { lotes: [], itens: [] };

  const itens = await getPool().query<{
    id: string;
    matricula: string;
    nome: string;
    situacao:
      | "CONCILIADO"
      | "DIVERGENTE"
      | "AUSENTE_NOVO"
      | "AUSENTE_LEGADO";
    esperado_proventos: string;
    esperado_inss: string;
    esperado_irrf: string;
    esperado_descontos: string;
    esperado_liquido: string;
    atual_proventos: string;
    atual_inss: string;
    atual_irrf: string;
    atual_descontos: string;
    atual_liquido: string;
    diferenca_proventos: string;
    diferenca_inss: string;
    diferenca_irrf: string;
    diferenca_descontos: string;
    diferenca_liquido: string;
  }>(
    `select id, matricula, nome, situacao,
            esperado_proventos::text, esperado_inss::text,
            esperado_irrf::text, esperado_descontos::text,
            esperado_liquido::text, atual_proventos::text,
            atual_inss::text, atual_irrf::text, atual_descontos::text,
            atual_liquido::text, diferenca_proventos::text,
            diferenca_inss::text, diferenca_irrf::text,
            diferenca_descontos::text, diferenca_liquido::text
       from folha_homologacao_item
      where homologacao_id = $1 and empresa_id = $2
      order by
        case situacao
          when 'DIVERGENTE' then 1
          when 'AUSENTE_NOVO' then 2
          when 'AUSENTE_LEGADO' then 3
          else 4
        end,
        matricula
      limit 10000`,
    [loteAtual.id, empresaId],
  );
  return { lotes: lotes.rows, itens: itens.rows };
}
