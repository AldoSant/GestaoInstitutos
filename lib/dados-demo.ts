export type CompetenciaResumo = {
  slug: string;
  competencia: string;
  numero: number;
  status: "Fechada" | "Em conferência";
  prestadores: number;
  proventos: number;
  inss: number;
  irrf: number;
  descontos: number;
  liquido: number;
  obrigacao: number;
};

export const competencias: CompetenciaResumo[] = [
  {
    slug: "2026-06",
    competencia: "Junho de 2026",
    numero: 732,
    status: "Fechada",
    prestadores: 37,
    proventos: 227_435.32,
    inss: 8_576.14,
    irrf: 2_049.33,
    descontos: 10_625.47,
    liquido: 216_809.85,
    obrigacao: 17_152.28,
  },
  {
    slug: "2026-05",
    competencia: "Maio de 2026",
    numero: 726,
    status: "Fechada",
    prestadores: 37,
    proventos: 221_523.22,
    inss: 8_173.29,
    irrf: 789.95,
    descontos: 8_963.24,
    liquido: 212_559.98,
    obrigacao: 16_346.58,
  },
  {
    slug: "2026-04",
    competencia: "Abril de 2026",
    numero: 718,
    status: "Fechada",
    prestadores: 37,
    proventos: 221_686.76,
    inss: 8_191.83,
    irrf: 789.95,
    descontos: 8_981.78,
    liquido: 212_704.98,
    obrigacao: 16_383.66,
  },
];

export const prestadoresDemo = [
  { matricula: "0001", nome: "Prestador 001", tipo: "PF", atividade: "Atendimento especializado", base: 6_000.03, inss: 660, irrf: 380.03, liquido: 4_960 },
  { matricula: "0002", nome: "Prestador 002", tipo: "PF", atividade: "Assistência técnica", base: 3_325.84, inss: 365.84, irrf: 0, liquido: 2_960 },
  { matricula: "0003", nome: "Prestador 003", tipo: "PF", atividade: "Atendimento especializado", base: 2_185.39, inss: 240.39, irrf: 0, liquido: 1_945 },
  { matricula: "0004", nome: "Prestador 004", tipo: "PJ", atividade: "Serviço de apoio", base: 8_200, inss: 0, irrf: 0, liquido: 8_200 },
  { matricula: "0005", nome: "Prestador 005", tipo: "PF", atividade: "Plantão", base: 7_200, inss: 792, irrf: 704.92, liquido: 5_703.08 },
  { matricula: "0006", nome: "Prestador 006", tipo: "PJ", atividade: "Serviço especializado", base: 10_500, inss: 0, irrf: 0, liquido: 10_500 },
  { matricula: "0007", nome: "Prestador 007", tipo: "PF", atividade: "Assistência técnica", base: 4_000, inss: 440, irrf: 0, liquido: 3_560 },
  { matricula: "0008", nome: "Prestador 008", tipo: "PF", atividade: "Atendimento especializado", base: 8_475.55, inss: 932.31, irrf: 964.38, liquido: 6_578.86 },
] as const;

export function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}
