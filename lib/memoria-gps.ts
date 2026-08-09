import { decimalParaInteiro } from "./dinheiro";
import { gerarLinhaDigitavelGps, vencimentoNominalGps } from "./linha-digitavel-gps";

type ItemGps = {
  id: string;
  natureza: string;
  valor: string;
  snapshot: Record<string, unknown>;
};

export type MemoriaGpsIndividual = {
  itemId: string;
  nome: string;
  identificador: string;
  codigoReceita: string;
  competencia: string;
  valorCentavos: number;
  vencimento: string;
  linhaDigitavel: string;
};

function objeto(valor: unknown) {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

function texto(valor: unknown) {
  return typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
}

export function montarMemoriasGpsIndividuais({
  instrumento,
  codigoReceita,
  competencia,
  itens,
}: {
  instrumento: "DCTFWEB_DARF" | "GPS_EXCECAO" | null;
  codigoReceita: string | null;
  competencia: string;
  itens: ItemGps[];
}) {
  if (instrumento !== "GPS_EXCECAO") {
    throw new Error("A competência não possui perfil de GPS excepcional congelado.");
  }
  if (!/^\d{4}$/.test(codigoReceita ?? "")) {
    throw new Error("O perfil GPS não possui código de receita válido.");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(competencia)) {
    throw new Error("Competência da obrigação inválida.");
  }

  const ids = new Set<string>();
  const memorias = itens
    .filter((item) => item.natureza === "SEGURADO")
    .map((item) => {
      if (!item.id || ids.has(item.id)) {
        throw new Error("Há item previdenciário duplicado na memória GPS.");
      }
      ids.add(item.id);
      const snapshot = objeto(item.snapshot);
      const pessoa = objeto(snapshot.pessoa);
      const prestador = objeto(snapshot.prestador);
      const nome = texto(pessoa.nome);
      const identificador = texto(
        pessoa.inscricaoInss || prestador.nitPisPasep,
      ).replace(/\D/g, "");
      if (!nome) throw new Error("A memória GPS exige o nome do prestador congelado.");
      if (!/^\d{8,14}$/.test(identificador)) {
        throw new Error(`A memória GPS de ${nome} exige NIT/PIS/PASEP válido.`);
      }
      let valorCentavos: number;
      try {
        valorCentavos = decimalParaInteiro(item.valor, 2);
      } catch {
        throw new Error(`O valor de INSS de ${nome} é inválido.`);
      }
      if (valorCentavos <= 0) {
        throw new Error(`A memória GPS de ${nome} exige retenção positiva.`);
      }
      return {
        itemId: item.id,
        nome,
        identificador,
        codigoReceita: codigoReceita!,
        competencia,
        valorCentavos,
        vencimento: vencimentoNominalGps(competencia.slice(0, 7)),
        linhaDigitavel: gerarLinhaDigitavelGps({
          codigoReceita: codigoReceita!,
          competencia: competencia.slice(0, 7),
          identificador,
          totalCentavos: valorCentavos,
        }),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.itemId.localeCompare(b.itemId));

  if (memorias.length === 0) {
    throw new Error("Não há retenções individuais para preparar em GPS.");
  }
  return memorias;
}
