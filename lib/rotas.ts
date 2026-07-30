export const ROTAS = Object.freeze({
  inicio: "/",
  folhaMensal: "/folhas",
  demonstrativos: "/demonstrativos",
  pessoas: "/cadastros",
  prestadores: "/prestadores",
  vinculos: "/vinculos",
  instrumentos: "/termos-e-metas",
  medicoes: "/medicoes",
  eventos: "/eventos",
  obrigacoes: "/obrigacoes",
  fechamentoMensal: "/fechamento-mensal",
  conferenciaEntreFolhas: "/conferencia-entre-folhas",
  simulacoesEntreFolhas: "/conferencia-entre-folhas/simulacoes",
  administracao: "/administracao",
  parametros: "/parametros",
  importacoes: "/migracoes",
  ajuda: "/ajuda",
} as const);

export function rotaComCompetencia(rota: string, competencia: string) {
  return `${rota}?${new URLSearchParams({ competencia }).toString()}`;
}
