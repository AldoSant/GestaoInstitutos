export type BloqueioOrientado = {
  titulo: string;
  causa: string;
  impacto: string;
  acao: { rotulo: string; href: string };
};

function competenciaValida(competencia: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia);
}

export function destinoInternoSeguro(valor: string | undefined, fallback: string) {
  const destino = valor?.trim();
  return destino && destino.startsWith("/") && !destino.startsWith("//") && !destino.includes("\\")
    ? destino
    : fallback;
}

export function orientarBloqueio({
  erro,
  competencia,
  retorno,
}: {
  erro: string;
  competencia: string;
  retorno: string;
}): BloqueioOrientado {
  const competenciaSegura = competenciaValida(competencia) ? competencia : "";
  const params = new URLSearchParams({
    competencia: competenciaSegura,
    retorno,
  });

  if (/nenhum perfil de recolhimento publicado/i.test(erro)) {
    params.set("etapa", "recolhimento");
    return {
      titulo: "Defina como a empresa recolhe a previdência",
      causa: `Ainda não há uma regra de recolhimento válida para ${competenciaSegura || "esta competência"}.`,
      impacto: "A Folha pode ser conferida, mas a apuração e a emissão da GPS não podem ser concluídas.",
      acao: {
        rotulo: "Configurar recolhimento da empresa",
        href: `/configuracao-inicial?${params.toString()}`,
      },
    };
  }

  if (/nenhum enquadramento previdenciário publicado/i.test(erro)) {
    return {
      titulo: "Confirme o enquadramento da empresa",
      causa: `O enquadramento previdenciário ainda não cobre ${competenciaSegura || "esta competência"}.`,
      impacto: "O processamento não pode calcular as contribuições com segurança.",
      acao: {
        rotulo: "Configurar empresa",
        href: `/configuracao-inicial?${params.toString()}`,
      },
    };
  }

  if (
    /todas as folhas da pessoa.*simulação homologada|múltiplos vínculos.*simulação fiscal homologada/i.test(
      erro,
    )
  ) {
    return {
      titulo: "Consolide os impostos desta pessoa",
      causa: "A pessoa participa de mais de uma Folha nesta competência e o rateio mensal ainda não foi homologado.",
      impacto: "As Folhas podem ser processadas normalmente, mas não podem ser fechadas ou gerar GPS até que INSS e IRRF sejam calculados sobre o total mensal.",
      acao: {
        rotulo: "Consolidar impostos por CPF",
        href: `/conferencia-entre-folhas?${params.toString()}`,
      },
    };
  }

  if (/folha.*(fechada|fechar)|folhas.*pendente/i.test(erro)) {
    return {
      titulo: "Feche as folhas antes de apurar",
      causa: "Há processamento em aberto ou pendente de fechamento nesta competência.",
      impacto: "A guia não pode ser gerada enquanto os valores ainda podem mudar.",
      acao: {
        rotulo: "Ir para as folhas da competência",
        href: `/folhas?competencia=${encodeURIComponent(competenciaSegura)}`,
      },
    };
  }

  return {
    titulo: "Não foi possível concluir esta etapa",
    causa: erro || "O sistema não recebeu todas as informações necessárias.",
    impacto: "Nenhum dado foi perdido; esta etapa continua pendente até a correção.",
    acao: { rotulo: "Tentar novamente", href: retorno },
  };
}
