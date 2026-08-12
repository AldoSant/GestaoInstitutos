import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type ItemHistorico = {
  pessoaLegacyId?: string | null;
  cpf?: string | null;
  totalProventos: string;
  baseIrrf: string;
  valorInss: string;
  valorIrrf: string;
};

type FolhaHistorica = {
  competencia: string;
  legacyId: string;
  itens: ItemHistorico[];
};

function valorCentavos(valor: string | null | undefined) {
  const bruto = String(valor ?? "0").trim();
  const normalizado = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) throw new Error(`Valor histórico inválido: ${valor}`);
  return Math.round(numero * 100);
}

function chavePessoa(item: ItemHistorico) {
  const bruto = item.pessoaLegacyId || item.cpf;
  if (!bruto) return null;
  return createHash("sha256").update(bruto).digest("hex").slice(0, 16);
}

const diretorio = resolve(
  process.argv[2] ?? ".private/importacoes/giw/pdf-historico-reconciliado-v1",
);
const destino = resolve(
  process.argv[3] ?? ".private/relatorios/diagnostico-irrf-multifolha-giw.json",
);
const arquivos = (await readdir(diretorio))
  .filter((arquivo) => arquivo.endsWith(".json"))
  .sort();
if (arquivos.length === 0) throw new Error("Nenhum snapshot histórico foi encontrado.");

const folhas: FolhaHistorica[] = [];
for (const arquivo of arquivos) {
  const snapshot = JSON.parse(await readFile(resolve(diretorio, arquivo), "utf8")) as {
    entity?: string;
    records?: FolhaHistorica[];
  };
  if (snapshot.entity !== "folhas_historicas" || !Array.isArray(snapshot.records)) {
    continue;
  }
  folhas.push(...snapshot.records);
}

const porPessoaCompetencia = new Map<string, Array<{ folha: FolhaHistorica; item: ItemHistorico }>>();
for (const folha of folhas) {
  for (const item of folha.itens) {
    const pessoa = chavePessoa(item);
    if (!pessoa) continue;
    const chave = `${folha.competencia}:${pessoa}`;
    const grupo = porPessoaCompetencia.get(chave) ?? [];
    grupo.push({ folha, item });
    porPessoaCompetencia.set(chave, grupo);
  }
}

const casos = [];
for (const [chave, itens] of porPessoaCompetencia) {
  const competencia = chave.slice(0, 10);
  const pessoaHash = chave.slice(11);
  const proventos = itens.reduce((soma, registro) => soma + valorCentavos(registro.item.totalProventos), 0);
  const inss = itens.reduce((soma, registro) => soma + valorCentavos(registro.item.valorInss), 0);
  const maiorBaseIrrf = Math.max(...itens.map((registro) => valorCentavos(registro.item.baseIrrf)));
  const basePropriaMaxima = Math.max(...itens.map((registro) => valorCentavos(registro.item.totalProventos)));
  if (itens.length < 2 && maiorBaseIrrf <= basePropriaMaxima) continue;
  casos.push({
    competencia,
    pessoaHash,
    folhas: [...new Set(itens.map((registro) => registro.folha.legacyId))].length,
    ocorrencias: itens.length,
    proventosCentavos: proventos,
    inssCentavos: inss,
    maiorBaseIrrfCentavos: maiorBaseIrrf,
    excedenteSobreMaiorFolhaCentavos: maiorBaseIrrf - basePropriaMaxima,
    baseCompativelComAgregadoAntesDeDeducoes:
      maiorBaseIrrf > basePropriaMaxima && maiorBaseIrrf <= proventos,
  });
}

casos.sort((a, b) =>
  a.competencia.localeCompare(b.competencia) ||
  a.pessoaHash.localeCompare(b.pessoaHash),
);
const resumoPorCompetencia = new Map<string, { pessoas: number; compativeis: number }>();
for (const caso of casos) {
  const resumo = resumoPorCompetencia.get(caso.competencia) ?? { pessoas: 0, compativeis: 0 };
  resumo.pessoas += 1;
  if (caso.baseCompativelComAgregadoAntesDeDeducoes) resumo.compativeis += 1;
  resumoPorCompetencia.set(caso.competencia, resumo);
}
const relatorio = {
  schemaVersion: "1.0",
  mode: "PRIVATE_HISTORICAL_CROSSCHECK",
  fonte: { diretorio, arquivos: arquivos.length, folhas: folhas.length },
  resumo: [...resumoPorCompetencia.entries()].map(([competencia, dados]) => ({ competencia, ...dados })),
  casos,
};
await mkdir(dirname(destino), { recursive: true });
await writeFile(destino, `${JSON.stringify(relatorio, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({
  arquivos: arquivos.length,
  folhas: folhas.length,
  pessoasEmMaisDeUmaFolhaOuComBaseMaior: casos.length,
  resumo: relatorio.resumo,
  relatorioPrivado: destino,
}, null, 2));
