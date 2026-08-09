import { apurarRetencoesSegurados } from "../../db/obrigacoes";
import { getPool } from "../../db";

const empresaId = process.argv[process.argv.indexOf("--empresa-id") + 1];
const competencia = process.argv[process.argv.indexOf("--competencia") + 1];
if (!empresaId || !competencia) throw new Error("Use --empresa-id e --competencia.");
try {
  console.log(JSON.stringify(await apurarRetencoesSegurados({ empresaId, competencia, ator: "APURACAO_GPS_HML" }), null, 2));
} finally { await getPool().end(); }
