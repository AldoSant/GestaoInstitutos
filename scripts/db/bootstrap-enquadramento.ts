import { resolverEmpresaAtiva } from "../../db/cadastros";
import { publicarEnquadramento } from "../../db/enquadramentos";
import { getPool } from "../../db";
import { validarEnquadramentoPrevidenciario } from "../../lib/enquadramento-previdenciario";

function argumento(nome: string) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] ?? "" : "";
}

const inicio = argumento("--inicio") || "2026-01-01";
const fim = argumento("--fim") || "2026-12-31";
const regime = argumento("--regime");

try {
  if (!regime) {
    throw new Error(
      "Informe explicitamente --regime com um cenário previdenciário suportado. Consulte a tela Parâmetros.",
    );
  }
  const empresa = await resolverEmpresaAtiva();
  const existentes = await getPool().query<{ id: string; regime: string }>(
    `select id, regime from enquadramento_previdenciario
      where empresa_id = $1 and publicado
        and inicio_vigencia = $2::date and fim_vigencia = $3::date
      limit 1`,
    [empresa.id, inicio, fim],
  );
  if (existentes.rows[0]) {
    if (existentes.rows[0].regime !== regime) {
      throw new Error(
        `A vigência já possui regime ${existentes.rows[0].regime}; não será alterada silenciosamente para ${regime}.`,
      );
    }
    console.log(`Enquadramento já conferido: ${existentes.rows[0].id}.`);
  } else {
    const validacao = validarEnquadramentoPrevidenciario({
      regime,
      inicioVigencia: inicio,
      fimVigencia: fim,
      cebasNumero: argumento("--cebas-numero"),
      cebasInicio: argumento("--cebas-inicio"),
      cebasFim: argumento("--cebas-fim"),
      evidencia:
        argumento("--evidencia") ||
        "Enquadramento sintético informado explicitamente no bootstrap.",
    });
    if (!validacao.dados) throw new Error(validacao.erros.join(" "));
    const publicado = await publicarEnquadramento({
      empresaId: empresa.id,
      dados: validacao.dados,
      ator: "BOOTSTRAP_ENQUADRAMENTO",
    });
    console.log(`Enquadramento publicado: ${publicado.id} (${publicado.regime}).`);
  }
} finally {
  await getPool().end();
}
