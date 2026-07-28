export type ConflitoPessoaCompetencia = {
  nome: string;
  matricula: string;
  folhaId: string;
  termoNumero: string;
  metaCodigo: string;
};

export function validarAusenciaDeConflitoPessoaCompetencia(
  conflitos: ConflitoPessoaCompetencia[],
) {
  if (conflitos.length === 0) return;

  const detalhes = conflitos
    .slice(0, 8)
    .map(
      (item) =>
        `${item.nome} (${item.matricula}) já participa da Folha ${item.folhaId.slice(0, 8)} do Termo ${item.termoNumero}, Meta ${item.metaCodigo}`,
    )
    .join(" | ");
  throw new Error(
    "Consolidação mensal necessária: a mesma pessoa não pode ser calculada em Folhas separadas da competência enquanto o rateio fiscal multi-lote não estiver homologado. " +
      detalhes,
  );
}
