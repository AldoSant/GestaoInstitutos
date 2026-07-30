export type TipoPessoaFolha = "FISICA" | "JURIDICA";

/**
 * Somente pessoas físicas podem compor este motor de folha. Pessoas jurídicas
 * permanecem no cadastro contratual/financeiro, mas não são remuneração de folha.
 */
export function determinarParticipacaoFolha(tipoPessoa: TipoPessoaFolha) {
  return tipoPessoa === "FISICA";
}
