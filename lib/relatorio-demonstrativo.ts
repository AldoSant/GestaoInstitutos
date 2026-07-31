type Linha = Record<string, unknown>;

function linhas(valor: unknown) {
  return Array.isArray(valor)
    ? valor.filter(
        (item): item is Linha =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export function montarResumoRelatorioDemonstrativo(
  conteudo: Record<string, unknown>,
) {
  const demonstrativo =
    conteudo.demonstrativo &&
    typeof conteudo.demonstrativo === "object" &&
    !Array.isArray(conteudo.demonstrativo)
      ? (conteudo.demonstrativo as Linha)
      : null;
  if (!demonstrativo) {
    throw new Error("O snapshot não contém o cabeçalho do demonstrativo.");
  }
  const pagamentos = linhas(conteudo.pagamentos);
  const retencoes = linhas(conteudo.retencoes);
  const obrigacoes = linhas(conteudo.obrigacoes);
  const documentos = linhas(conteudo.documentos);
  return {
    demonstrativo,
    pagamentos,
    retencoes,
    obrigacoes,
    documentos,
    quantidadePf: pagamentos.filter(
      (item) => item.tipo_pessoa === "FISICA",
    ).length,
    quantidadePj: pagamentos.filter(
      (item) => item.tipo_pessoa === "JURIDICA",
    ).length,
  };
}

export function nomeBeneficiarioSnapshot(pagamento: Linha) {
  const snapshot =
    pagamento.beneficiario_snapshot &&
    typeof pagamento.beneficiario_snapshot === "object"
      ? (pagamento.beneficiario_snapshot as Linha)
      : {};
  const pessoa =
    snapshot.pessoa && typeof snapshot.pessoa === "object"
      ? (snapshot.pessoa as Linha)
      : {};
  const prestador =
    snapshot.prestador && typeof snapshot.prestador === "object"
      ? (snapshot.prestador as Linha)
      : {};
  return {
    nome: String(snapshot.nome ?? pessoa.nome ?? "Beneficiário preservado"),
    matricula:
      prestador.matricula === undefined
        ? null
        : String(prestador.matricula),
  };
}
