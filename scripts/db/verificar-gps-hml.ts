import { getPool } from "../../db";
import { listarGuiasGpsIndividuais } from "../../db/obrigacoes";
import { gerarLinhaDigitavelGps, vencimentoNominalGps } from "../../lib/linha-digitavel-gps";

const empresaId = process.argv[process.argv.indexOf("--empresa-id") + 1];
const obrigacaoId = process.argv[process.argv.indexOf("--obrigacao-id") + 1];
if (!empresaId || !obrigacaoId) {
  throw new Error("Use --empresa-id e --obrigacao-id.");
}

try {
  const guias = await listarGuiasGpsIndividuais(empresaId, obrigacaoId);
  const linhas = guias.map((guia) => {
    const competencia = guia.competencia.slice(0, 7);
    return gerarLinhaDigitavelGps({
      codigoReceita: guia.codigo_receita,
      competencia,
      identificador: guia.identificador,
      totalCentavos: Math.round(Number(guia.total) * 100),
    });
  });
  if (linhas.some((linha) => !/^\d{11}-\d( \d{11}-\d){3}$/.test(linha))) {
    throw new Error("Foi gerada uma linha GPS em formato inválido.");
  }
  console.log(JSON.stringify({
    guias: guias.length,
    linhasUnicas: new Set(linhas).size,
    total: guias.reduce((acumulado, guia) => acumulado + Number(guia.total), 0).toFixed(2),
    vencimentoNominal: guias[0] ? vencimentoNominalGps(guias[0].competencia.slice(0, 7)) : null,
  }, null, 2));
} finally {
  await getPool().end();
}
