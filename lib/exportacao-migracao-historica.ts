import type { carregarMigracaoHistorica } from "@/db/migracoes-historicas";

type DadosMigracao = Awaited<ReturnType<typeof carregarMigracaoHistorica>>;

function campo(value: unknown) {
  const original = value === null || value === undefined ? "" : String(value);
  const isNumber = /^-?\d+(?:[.,]\d+)?$/.test(original);
  const text = !isNumber && /^[=+\-@]/.test(original) ? `'${original}` : original;
  return `"${text.replaceAll('"', '""')}"`;
}

function linha(values: unknown[]) {
  return values.map(campo).join(";");
}

export function gerarDossieMigracaoCsv(
  competencia: string,
  organizacao: string,
  dados: DadosMigracao,
) {
  const resumo = dados.resumo;
  const rows: string[] = [
    linha(["DOSSIÊ DE MIGRAÇÃO HISTÓRICA GIW"]),
    linha(["Organização", organizacao]),
    linha(["Competência", competencia]),
    linha(["Gerado em", new Date().toISOString()]),
    "",
    linha(["RESUMO", "GIW", "SISTEMA NOVO", "DIFERENÇA"]),
    linha([
      "Folhas",
      resumo.folhas_legado,
      resumo.folhas_novas,
      resumo.folhas_novas - resumo.folhas_legado,
    ]),
    linha([
      "Pessoas",
      resumo.pessoas_legado,
      resumo.pessoas_novas,
      resumo.pessoas_novas - resumo.pessoas_legado,
    ]),
    linha([
      "Proventos",
      resumo.proventos_legado,
      resumo.proventos_novo,
      (Number(resumo.proventos_novo) - Number(resumo.proventos_legado)).toFixed(2),
    ]),
    linha([
      "Descontos",
      resumo.descontos_legado,
      resumo.descontos_novo,
      (Number(resumo.descontos_novo) - Number(resumo.descontos_legado)).toFixed(2),
    ]),
    linha([
      "Líquido",
      resumo.liquido_legado,
      resumo.liquido_novo,
      (Number(resumo.liquido_novo) - Number(resumo.liquido_legado)).toFixed(2),
    ]),
    linha([
      "Base INSS",
      resumo.base_inss_legado,
      resumo.base_inss_novo,
      (Number(resumo.base_inss_novo) - Number(resumo.base_inss_legado)).toFixed(2),
    ]),
    linha([
      "INSS segurados",
      resumo.inss_legado,
      resumo.inss_novo,
      (Number(resumo.inss_novo) - Number(resumo.inss_legado)).toFixed(2),
    ]),
    linha([
      "Guia/obrigação",
      resumo.guias_total_legado,
      resumo.obrigacoes_total_novo,
      (
        Number(resumo.obrigacoes_total_novo) - Number(resumo.guias_total_legado)
      ).toFixed(2),
    ]),
    "",
    linha([
      "PESSOAS",
      "GIW ID",
      "MATRÍCULA",
      "MAPEADA",
      "LÍQUIDO GIW",
      "LÍQUIDO NOVO",
      "DIFERENÇA LÍQUIDO",
      "INSS GIW",
      "INSS NOVO",
      "DIFERENÇA INSS",
    ]),
    ...dados.pessoas.map((pessoa) =>
      linha([
        pessoa.nome_legado,
        pessoa.pessoa_legacy_id,
        pessoa.matricula_legado,
        pessoa.pessoa_id ? "SIM" : "NÃO",
        pessoa.liquido_legado,
        pessoa.liquido_novo,
        pessoa.diferenca_liquido,
        pessoa.inss_legado,
        pessoa.inss_novo,
        pessoa.diferenca_inss,
      ]),
    ),
    "",
    linha([
      "FOLHAS GIW",
      "GIW ID",
      "STATUS",
      "PESSOAS",
      "RUBRICAS",
      "PROVENTOS",
      "DESCONTOS",
      "BASE INSS",
      "INSS",
      "LÍQUIDO",
      "EXTRAÍDO EM",
    ]),
    ...dados.folhas.map((folha) =>
      linha([
        folha.numero,
        folha.legacy_id,
        folha.status,
        folha.pessoas,
        folha.rubricas,
        folha.total_proventos,
        folha.total_descontos,
        folha.base_inss,
        folha.valor_inss,
        folha.total_liquido,
        new Date(folha.extraido_em).toISOString(),
      ]),
    ),
    "",
    linha([
      "GUIAS GIW",
      "GIW ID",
      "STATUS",
      "IDENTIFICADOR",
      "VENCIMENTO",
      "PAGAMENTO",
      "PRINCIPAL",
      "JUROS",
      "MULTA",
      "COMPENSAÇÕES",
      "TOTAL",
    ]),
    ...dados.guias.map((guia) =>
      linha([
        guia.tipo,
        guia.legacy_id,
        guia.status,
        guia.identificador,
        guia.vencimento,
        guia.pagamento,
        guia.principal,
        guia.juros,
        guia.multa,
        guia.compensacoes,
        guia.total,
      ]),
    ),
  ];
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}
