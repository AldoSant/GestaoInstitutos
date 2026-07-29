export const TIPOS_EVENTO_ESOCIAL_FGTS = [
  "S-1000",
  "S-1005",
  "S-1010",
  "S-1020",
  "S-2200",
  "S-1200",
  "S-1298",
  "S-1299",
  "S-2299",
  "S-2399",
] as const;

export type TipoEventoEsocialFgts =
  (typeof TIPOS_EVENTO_ESOCIAL_FGTS)[number];

export type AmbienteEsocial = "PRODUCAO_RESTRITA" | "PRODUCAO";

export type EstadoEventoEsocial =
  | "RASCUNHO"
  | "VALIDADO"
  | "ENFILEIRADO"
  | "TRANSMITIDO"
  | "PROCESSANDO"
  | "ACEITO"
  | "REJEITADO"
  | "CANCELADO";

export type EventoEsocialParaEnvio = {
  id: string;
  empresaId: string;
  ambiente: AmbienteEsocial;
  tipo: TipoEventoEsocialFgts;
  identificador: string;
  versaoLeiaute: string;
  payload: Record<string, unknown>;
  hashPayload: string;
};

export type ResultadoTransmissaoEsocial = {
  protocolo: string;
  recebidoEm: string;
  estado: "TRANSMITIDO" | "PROCESSANDO";
  respostaBruta?: string;
};

export type ResultadoConsultaEsocial = {
  protocolo: string;
  estado: "PROCESSANDO" | "ACEITO" | "REJEITADO";
  recibo?: string;
  codigoResposta?: string;
  mensagem?: string;
  respostaBruta?: string;
};

export interface ProvedorEsocial {
  readonly codigo: string;
  transmitir(evento: EventoEsocialParaEnvio): Promise<ResultadoTransmissaoEsocial>;
  consultar(
    evento: EventoEsocialParaEnvio,
    protocolo: string,
  ): Promise<ResultadoConsultaEsocial>;
}

const TRANSICOES: Record<EstadoEventoEsocial, EstadoEventoEsocial[]> = {
  RASCUNHO: ["VALIDADO", "CANCELADO"],
  VALIDADO: ["ENFILEIRADO", "CANCELADO"],
  ENFILEIRADO: ["TRANSMITIDO", "REJEITADO", "CANCELADO"],
  TRANSMITIDO: ["PROCESSANDO", "ACEITO", "REJEITADO"],
  PROCESSANDO: ["PROCESSANDO", "ACEITO", "REJEITADO"],
  ACEITO: [],
  REJEITADO: ["VALIDADO", "CANCELADO"],
  CANCELADO: [],
};

export function validarTransicaoEventoEsocial(
  origem: EstadoEventoEsocial,
  destino: EstadoEventoEsocial,
) {
  if (!TRANSICOES[origem].includes(destino)) {
    throw new Error(`Transição eSocial inválida: ${origem} → ${destino}.`);
  }
  return destino;
}

export function eventoAfetaFgts(tipo: TipoEventoEsocialFgts) {
  return ["S-1200", "S-2299", "S-2399"].includes(tipo);
}

export function sequenciaMinimaEsocialFgtsMensal() {
  return [
    {
      fase: "CADASTROS",
      eventos: ["S-1000", "S-1005", "S-1010", "S-1020", "S-2200"],
      observacao:
        "Devem existir e estar coerentes no Ambiente Nacional antes da remuneração.",
    },
    {
      fase: "REMUNERACAO",
      eventos: ["S-1200"],
      observacao:
        "A recepção aceita gera o totalizador S-5003 que alimenta o FGTS Digital.",
    },
    {
      fase: "CONFERENCIA",
      eventos: ["S-5003", "S-5013"],
      observacao:
        "Retornos governamentais devem ser conciliados por trabalhador e competência.",
    },
    {
      fase: "FECHAMENTO",
      eventos: ["S-1299"],
      observacao:
        "Não é pré-requisito da GFD, mas valida a integridade global da competência.",
    },
    {
      fase: "GUIA",
      eventos: ["GFD"],
      observacao:
        "A guia oficial é emitida no FGTS Digital e paga por Pix.",
    },
  ] as const;
}
