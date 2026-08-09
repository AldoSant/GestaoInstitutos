import { criarFolha, fecharFolha, processarFolha, registrarConferenciaFolha } from "../../db/folhas";
import { apurarRetencoesSegurados } from "../../db/obrigacoes";
import { getPool } from "../../db";

function argumento(nome: string) { const i = process.argv.indexOf(nome); return i >= 0 ? process.argv[i + 1] ?? "" : ""; }
const empresaId = argumento("--empresa-id");
const termoId = argumento("--termo-id");
const metaId = argumento("--meta-id");
const competencia = argumento("--competencia");
const folhaExistenteId = argumento("--folha-id");
if (!empresaId || !competencia || (!folhaExistenteId && (!termoId || !metaId))) {
  throw new Error("Use --empresa-id, --competencia e --folha-id; ou informe --termo-id e --meta-id para criar uma Folha.");
}

try {
  const folha = folhaExistenteId
    ? { id: folhaExistenteId, revisao: 1 }
    : await criarFolha({ empresaId, termoId, metaId, competencia, ator: "PROCESSAMENTO_HML" });
  await processarFolha(folha.id, "PROCESSAMENTO_HML", empresaId, folha.revisao);
  await registrarConferenciaFolha({ empresaId, folhaId: folha.id, resultado: "APROVADA", conferente: "PROCESSAMENTO_HML", confirmouCadastros: true, confirmouValores: true, confirmouRubricas: true, observacao: "Ciclo automatizado de homologação do MVP." });
  await fecharFolha(folha.id, "PROCESSAMENTO_HML");
  const obrigacao = await apurarRetencoesSegurados({ empresaId, competencia, ator: "PROCESSAMENTO_HML" });
  console.log(JSON.stringify({ folhaId: folha.id, competencia, obrigacaoId: obrigacao.id, gpsItens: obrigacao.itens, total: obrigacao.total }, null, 2));
} finally { await getPool().end(); }
