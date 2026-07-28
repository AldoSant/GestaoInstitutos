import { decimalParaInteiro } from "./dinheiro";

type FolhaConferencia = {
  competencia: string;
  numero: number;
  revisao: number;
  status: string;
  hash_resultado: string;
  termo_numero: string;
  meta_codigo: string;
  regra_codigo: string | null;
  regra_versao: number | null;
  regra_hash: string | null;
};

type ItemConferencia = {
  total_proventos: string;
  total_descontos: string;
  base_inss: string;
  valor_inss: string;
  base_irrf: string;
  valor_irrf: string;
  total_liquido: string;
  snapshots: unknown;
  memoria: unknown;
  eventos: unknown;
};

type Objeto = Record<string, unknown>;

const CABECALHO = [
  "competencia",
  "lote",
  "revisao",
  "status",
  "termo",
  "meta",
  "matricula",
  "prestador",
  "cpf_cnpj",
  "categoria_esocial",
  "atividade",
  "origem_retribuicao",
  "medicao_tipo",
  "medicao_evidencia",
  "total_proventos",
  "base_outras_fontes",
  "base_inss",
  "inss",
  "base_irrf",
  "irrf",
  "total_descontos",
  "liquido",
  "rubricas",
  "regra",
  "hash_regra",
  "hash_folha",
] as const;

function objeto(valor: unknown): Objeto {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Objeto)
    : {};
}

function texto(valor: unknown) {
  return typeof valor === "string" || typeof valor === "number"
    ? String(valor)
    : "";
}

function celulaTexto(valor: unknown) {
  let conteudo = texto(valor).replaceAll("\0", "").replace(/\r\n?/g, "\n");
  // Evita que planilhas interpretem conteúdo cadastral como fórmula.
  if (/^[=+\-@\t]/.test(conteudo)) conteudo = `'${conteudo}`;
  return `"${conteudo.replaceAll('"', '""')}"`;
}

function centavosCsv(centavos: number) {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error("A memória da Folha contém valor monetário inválido.");
  }
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  return `${sinal}${Math.floor(absoluto / 100)},${String(absoluto % 100).padStart(2, "0")}`;
}

function moedaCsv(valor: string) {
  return centavosCsv(decimalParaInteiro(valor, 2));
}

function rubricasCsv(valor: unknown) {
  if (!Array.isArray(valor)) return "";
  return valor
    .map((entrada) => {
      const evento = objeto(entrada);
      const codigo = texto(evento.codigo);
      const natureza = texto(evento.natureza);
      const valorEvento = texto(evento.valor);
      return [codigo, natureza, valorEvento].filter(Boolean).join("=");
    })
    .filter(Boolean)
    .join(" | ");
}

function linhaItem(folha: FolhaConferencia, item: ItemConferencia) {
  const snapshots = objeto(item.snapshots);
  const pessoa = objeto(snapshots.pessoa);
  const prestador = objeto(snapshots.prestador);
  const vinculo = objeto(snapshots.vinculo);
  const medicao = objeto(snapshots.medicaoMensal);
  const memoria = objeto(item.memoria);
  const outrasFontes = objeto(memoria.outrasFontes);
  const baseOutrasFontes =
    typeof outrasFontes.baseContribuidaCentavos === "number"
      ? outrasFontes.baseContribuidaCentavos
      : 0;

  const documento = texto(pessoa.cpf) || texto(pessoa.cnpj);
  const regra = folha.regra_codigo
    ? `${folha.regra_codigo} v${folha.regra_versao ?? "?"}`
    : "";

  return [
    celulaTexto(folha.competencia.slice(0, 7)),
    String(folha.numero),
    String(folha.revisao),
    celulaTexto(folha.status),
    celulaTexto(folha.termo_numero),
    celulaTexto(folha.meta_codigo),
    celulaTexto(prestador.matricula),
    celulaTexto(pessoa.nome),
    celulaTexto(documento),
    celulaTexto(prestador.categoriaContribuinte),
    celulaTexto(vinculo.atividade),
    celulaTexto(medicao.id ? "MEDICAO_MENSAL" : "CONTRATUAL"),
    celulaTexto(medicao.tipo),
    celulaTexto(medicao.evidenciaReferencia),
    moedaCsv(item.total_proventos),
    centavosCsv(baseOutrasFontes),
    moedaCsv(item.base_inss),
    moedaCsv(item.valor_inss),
    moedaCsv(item.base_irrf),
    moedaCsv(item.valor_irrf),
    moedaCsv(item.total_descontos),
    moedaCsv(item.total_liquido),
    celulaTexto(rubricasCsv(item.eventos)),
    celulaTexto(regra),
    celulaTexto(folha.regra_hash),
    celulaTexto(folha.hash_resultado),
  ].join(";");
}

export function gerarCsvConferenciaFolha({
  folha,
  itens,
}: {
  folha: FolhaConferencia;
  itens: ItemConferencia[];
}) {
  if (!folha.hash_resultado) {
    throw new Error("A Folha ainda não possui memória processada.");
  }
  if (itens.length === 0) {
    throw new Error("A Folha não possui itens para conferência.");
  }

  const linhas = [
    CABECALHO.join(";"),
    ...itens.map((item) => linhaItem(folha, item)),
  ];
  return `\uFEFF${linhas.join("\r\n")}\r\n`;
}
