export type EntradaPlanoImportacaoGiw = {
  arquivo: string;
  entity: string;
};

const ordemEntidade: Record<string, number> = {
  pessoas: 10,
  atividades: 20,
  lotacoes: 30,
  termos: 40,
  vinculos: 50,
  eventos: 60,
  lancamentos_eventos: 70,
  produtividade: 80,
  folhas_historicas: 90,
  guias_inss_historicas: 100,
};

export function ordenarPlanoImportacaoGiw(
  entradas: EntradaPlanoImportacaoGiw[],
): EntradaPlanoImportacaoGiw[] {
  const arquivos = new Set<string>();
  entradas.forEach((entrada) => {
    if (arquivos.has(entrada.arquivo)) {
      throw new Error(`Arquivo repetido no lote: ${entrada.arquivo}`);
    }
    if (ordemEntidade[entrada.entity] === undefined) {
      throw new Error(`Entidade não suportada no lote: ${entrada.entity}`);
    }
    arquivos.add(entrada.arquivo);
  });

  return entradas
    .map((entrada, indice) => ({ ...entrada, indice }))
    .sort(
      (a, b) =>
        ordemEntidade[a.entity] - ordemEntidade[b.entity] || a.indice - b.indice,
    )
    .map(({ arquivo, entity }) => ({ arquivo, entity }));
}
