import { getPool } from "../../db";
import { hashJson } from "../../lib/json-canonico";
import {
  CODIGO_REGRA_FOLHA_PRESTADOR,
  REGRA_FISCAL_2026,
  validarRegraFiscal,
} from "../../lib/regras-fiscais";

const fonteNormativa =
  "Lei 15.270/2025; IN RFB 2.110/2022; tabelas oficiais da Receita Federal e do INSS para 2026.";
const hashConteudo = hashJson(REGRA_FISCAL_2026);
const pool = getPool();

try {
  const inserida = await pool.query<{
    id: string;
    parametros: unknown;
    hash_conteudo: string;
  }>(
    `insert into regra_calculo_versao
       (empresa_id, codigo, versao, inicio_vigencia, fim_vigencia,
        parametros, fonte_normativa, hash_conteudo, publicada)
     values (
       null, $1, 1, date '2026-01-01', date '2026-12-31',
       $2, $3, $4, true
     )
     on conflict on constraint uq_regra_empresa_codigo_versao do nothing
     returning id, parametros, hash_conteudo`,
    [
      CODIGO_REGRA_FOLHA_PRESTADOR,
      REGRA_FISCAL_2026,
      fonteNormativa,
      hashConteudo,
    ],
  );

  const registro =
    inserida.rows[0] ??
    (
      await pool.query<{
        id: string;
        parametros: unknown;
        hash_conteudo: string;
      }>(
        `select id, parametros, hash_conteudo
           from regra_calculo_versao
          where empresa_id is null and codigo = $1 and versao = 1`,
        [CODIGO_REGRA_FOLHA_PRESTADOR],
      )
    ).rows[0];

  if (!registro) throw new Error("A regra fiscal não pôde ser criada nem localizada.");
  validarRegraFiscal(registro.parametros);
  if (
    registro.hash_conteudo !== hashConteudo ||
    hashJson(registro.parametros) !== hashConteudo
  ) {
    throw new Error(
      "A versão 1 da regra fiscal já existe com conteúdo diferente. Publique uma nova versão.",
    );
  }
  console.log(
    `${inserida.rows[0] ? "Regra fiscal criada" : "Regra fiscal já conferida"}: ${registro.id} (${hashConteudo.slice(0, 12)}).`,
  );
} finally {
  await pool.end();
}
