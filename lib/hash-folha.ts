import { hashJson } from "./json-canonico";

export type FonteHashFolha = {
  folha: {
    empresaId: string;
    termoId: string;
    metaId: string;
    competencia: string;
    numero: number;
    revisao: number;
  };
  regra: {
    id: string;
    codigo: string;
    versao: number;
    hashConteudo: string;
  };
  enquadramentoPrevidenciario: {
    id: string;
    regime: string;
    aliquotaSeguradoNumerador: number;
    aliquotaSeguradoDenominador: number;
    aliquotaPatronalNumerador: number;
    aliquotaPatronalDenominador: number;
  };
  itens: unknown[];
};

export function calcularHashResultadoFolha(fonte: FonteHashFolha) {
  return hashJson(fonte);
}
