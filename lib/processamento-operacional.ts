export type StatusProcessamento =
  | "PENDENTE"
  | "EXECUTANDO"
  | "CONCLUIDA"
  | "FALHA"
  | "CANCELADA";

export function descreverProcessamento(
  status: StatusProcessamento,
  ultimoErro: string | null,
) {
  if (status === "PENDENTE") {
    return {
      titulo: "Aguardando processamento",
      texto: "A folha está na fila e será calculada automaticamente.",
      categoria: "FILA" as const,
    };
  }
  if (status === "EXECUTANDO") {
    return {
      titulo: "Cálculo em andamento",
      texto: "O motor está gerando itens, tributos e memórias da folha.",
      categoria: "EXECUCAO" as const,
    };
  }
  if (status === "CONCLUIDA") {
    return {
      titulo: "Processamento concluído",
      texto: "A memória foi gerada e está disponível para conferência.",
      categoria: "CONCLUIDA" as const,
    };
  }
  if (status === "CANCELADA") {
    return {
      titulo: "Tentativa substituída",
      texto: "Esta tentativa foi encerrada por uma ação posterior.",
      categoria: "CANCELADA" as const,
    };
  }

  const erro = (ultimoErro ?? "").toLocaleLowerCase("pt-BR");
  if (erro.includes("nit") || erro.includes("pis") || erro.includes("pasep")) {
    return {
      titulo: "NIT/PIS/PASEP pendente",
      texto: "Complete os dados previdenciários do prestador antes de tentar novamente.",
      categoria: "CADASTRO" as const,
    };
  }
  if (erro.includes("medição") || erro.includes("medicao")) {
    return {
      titulo: "Medição mensal pendente",
      texto: "Registre e confira a medição da competência antes de tentar novamente.",
      categoria: "MEDICAO" as const,
    };
  }
  if (erro.includes("documento fiscal") || erro.includes("cpf") || erro.includes("cnpj")) {
    return {
      titulo: "Documento fiscal pendente",
      texto: "Complete o CPF ou CNPJ na ficha da pessoa antes de tentar novamente.",
      categoria: "CADASTRO" as const,
    };
  }
  if (erro.includes("outra fonte") || erro.includes("outras fontes")) {
    return {
      titulo: "Comprovante de outra fonte pendente",
      texto: "Confira os comprovantes previdenciários da competência antes de tentar novamente.",
      categoria: "OUTRA_FONTE" as const,
    };
  }
  if (
    erro.includes("categoria") ||
    erro.includes("enquadramento") ||
    erro.includes("cenário")
  ) {
    return {
      titulo: "Enquadramento fiscal não suportado",
      texto: "Revise a categoria do contribuinte e o cenário fiscal do prestador.",
      categoria: "ENQUADRAMENTO" as const,
    };
  }
  if (erro.includes("mais de uma folha") || erro.includes("folhas separadas")) {
    return {
      titulo: "Pessoa presente em mais de uma folha",
      texto: "Consolide os vínculos da pessoa na competência antes de processar.",
      categoria: "CONSOLIDACAO" as const,
    };
  }
  return {
    titulo: "Processamento não concluído",
    texto:
      "A tentativa terminou com erro. Revise os pré-requisitos e tente novamente; se persistir, consulte o registro técnico.",
    categoria: "TECNICA" as const,
  };
}

