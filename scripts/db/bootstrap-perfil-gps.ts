import { getPool } from "../../db";
import { publicarPerfilRecolhimento } from "../../db/perfis-recolhimento";

function argumento(nome: string) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] ?? "" : "";
}

const empresaId = argumento("--empresa-id");
const inicio = argumento("--inicio");
const fim = argumento("--fim");
const codigoReceita = argumento("--codigo-receita");

if (!empresaId || !inicio || !fim || !codigoReceita) {
  throw new Error("Use --empresa-id, --inicio, --fim e --codigo-receita.");
}

try {
  const existente = await getPool().query<{ id: string }>(
    `select id from perfil_recolhimento_previdenciario
      where empresa_id = $1 and publicado and instrumento = 'GPS_EXCECAO'
        and codigo_receita = $2 and inicio_vigencia = $3::date and fim_vigencia = $4::date`,
    [empresaId, codigoReceita, inicio, fim],
  );
  if (existente.rowCount) {
    console.log(`Perfil GPS já conferido: ${existente.rows[0].id}.`);
  } else {
    const perfil = await publicarPerfilRecolhimento({
      empresaId,
      ator: "BOOTSTRAP_GPS_HML",
      dados: {
        instrumento: "GPS_EXCECAO",
        codigoReceita,
        inicioVigencia: inicio,
        fimVigencia: fim,
        evidencia: "Homologação do MVP: código 1007 reproduzido das GPS GIW importadas para comparação operacional.",
        responsavel: "BOOTSTRAP_GPS_HML",
      },
    });
    console.log(`Perfil GPS publicado: ${perfil.id}.`);
  }
} finally {
  await getPool().end();
}
