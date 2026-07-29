import assert from "node:assert/strict";
import test from "node:test";
import {
  deduplicarGpsLegadas,
  extrairGpsLegadaGiw,
  reconciliarGpsLegadasComFolha,
  type GpsLegadaExtraida,
} from "../lib/legado-gps";

const TEXTO_GPS_ANONIMIZADA = `1ª Via
3. CÓDIGO DE PAGAMENTO
MINISTÉRIO DA PREVIDÊNCIA SOCIAL - MPS 1007
INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS
4. COMPETÊNCIA
SECRETARIA DA RECEITA PREVIDENCIÁRIA - SRP
05/2026
GUIA DA PREVIDENCIA SOCIAL - GPS 5. IDENTIFICADOR
20000000000
1.NOME OU RAZÃO SOCIAL/FONE/ENDEREÇO:
6. VALOR DO INSS
PESSOA EXEMPLO R$ 494,38
Município - UF
2. VENCIMENTO
9. VALOR DE OUTRAS
20/07/2026 ENTIDADES
10. ATM/ MULTA E R$ 0,00
JUROS
11. TOTAL
R$ 494,38
85800000004-6 94380270100-1 70002000000-0 00002026050-0
12. AUTENTICAÇÃO BANCÁRIA
cortar nesta linha`;

test("extrai os campos úteis do JasperReports de GPS do GIW", () => {
  const guia = extrairGpsLegadaGiw(TEXTO_GPS_ANONIMIZADA);
  assert.deepEqual(
    {
      nome: guia.nome,
      codigo: guia.codigoPagamento,
      competencia: guia.competencia,
      identificador: guia.identificador,
      vencimento: guia.vencimento,
      valor: guia.valorInssCentavos,
      juros: guia.jurosMultaCentavos,
      total: guia.totalCentavos,
      valorCodificado: guia.valorLinhaDigitavelCentavos,
    },
    {
      nome: "PESSOA EXEMPLO",
      codigo: "1007",
      competencia: "05/2026",
      identificador: "20000000000",
      vencimento: "20/07/2026",
      valor: 49438,
      juros: 0,
      total: 49438,
      valorCodificado: 49438,
    },
  );
});

test("deduplica páginas repetidas da mesma GPS", () => {
  const guia = extrairGpsLegadaGiw(TEXTO_GPS_ANONIMIZADA);
  assert.deepEqual(deduplicarGpsLegadas([guia, guia]), {
    guias: [guia],
    duplicadas: 1,
  });
});

test("reconcilia as GPS com os descontos da Folha sem somar páginas duplicadas", () => {
  const primeira = extrairGpsLegadaGiw(TEXTO_GPS_ANONIMIZADA);
  const segunda: GpsLegadaExtraida = {
    ...primeira,
    nome: "OUTRA PESSOA",
    identificador: "21111111111",
    valorInssCentavos: 36584,
    totalCentavos: 36584,
    linhaDigitavel: "",
    valorLinhaDigitavelCentavos: null,
  };
  const resultado = reconciliarGpsLegadasComFolha({
    itens: [
      { nome: "Pessoa Exemplo", valorInss: "494.38" },
      { nome: "Outra Pessoa", valorInss: "365.84" },
      { nome: "Pessoa sem retenção", valorInss: "0.00" },
    ],
    guias: [primeira, primeira, segunda, segunda],
  });

  assert.equal(resultado.itensComInss, 2);
  assert.equal(resultado.guiasRecebidas, 4);
  assert.equal(resultado.guiasUnicas, 2);
  assert.equal(resultado.guiasDuplicadas, 2);
  assert.equal(resultado.totalFolhaCentavos, 86022);
  assert.equal(resultado.totalGuiasCentavos, 86022);
  assert.equal(resultado.conciliado, true);
  assert.equal(resultado.divergencias.length, 0);
  assert.match(resultado.alertasNormativos[0], /DCTFWeb/);
});

test("expõe ausência e diferença de valor em vez de aceitar fechamento aparente", () => {
  const guia = extrairGpsLegadaGiw(TEXTO_GPS_ANONIMIZADA);
  const resultado = reconciliarGpsLegadasComFolha({
    itens: [
      { nome: "Pessoa Exemplo", valorInss: "500.00" },
      { nome: "Pessoa sem guia", valorInss: "100.00" },
    ],
    guias: [guia],
  });
  assert.equal(resultado.conciliado, false);
  assert.deepEqual(
    resultado.divergencias.map((item) => item.tipo).sort(),
    ["ITEM_SEM_GUIA", "VALOR_DIVERGENTE"],
  );
});
