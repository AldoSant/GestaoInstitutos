import assert from "node:assert/strict";
import test from "node:test";
import {
  extrairItemRelacaoPagamento,
  gerarRelacaoPagamentosCsv,
  montarRelacaoPagamentos,
  type ItemRelacaoPagamento,
} from "../lib/relacao-pagamentos";

function item(
  parcial: Partial<ItemRelacaoPagamento> = {},
): ItemRelacaoPagamento {
  return {
    id: "1",
    nome: "Pessoa Teste",
    documento: "00000000000",
    matricula: "M-1",
    atividade: "Atividade",
    totalLiquido: "1000.00",
    naturezaOperacional: "PAGAMENTO_PRESTADOR",
    conta: {
      agencia: "0001",
      agenciaLegacyId: "AG-1",
      numero: "12345",
      digito: "6",
      variacao: null,
      tipo: "CORRENTE",
    },
    ...parcial,
  };
}

test("consolida relação pronta em centavos e ordem determinística", () => {
  const relacao = montarRelacaoPagamentos([
    item({ id: "2", nome: "Zilda", totalLiquido: "0.07" }),
    item({ id: "1", nome: "Ana", totalLiquido: "0.18" }),
  ]);
  assert.equal(relacao.pronta, true);
  assert.equal(relacao.totalLiquidoCentavos, 25);
  assert.deepEqual(
    relacao.linhas.map((linha) => linha.nome),
    ["Ana", "Zilda"],
  );
});

test("extrai dados exclusivamente do snapshot congelado da Folha", () => {
  assert.deepEqual(
    extrairItemRelacaoPagamento({
      id: "item-1",
      total_liquido: "321.45",
      snapshots: {
        pessoa: { nome: "  Ana  ", cpf: "12345678901" },
        prestador: { matricula: " P-9 " },
        vinculo: { atividade: " Coordenação " },
        contaBancaria: {
          agencia: " 001 ",
          agenciaLegacyId: "AG-7",
          numero: "9876",
          digito: "5",
          variacao: "",
          tipo: "CORRENTE",
        },
      },
    }),
    {
      id: "item-1",
      nome: "Ana",
      documento: "12345678901",
      matricula: "P-9",
      atividade: "Coordenação",
      totalLiquido: "321.45",
      naturezaOperacional: "PAGAMENTO_PRESTADOR",
      conta: {
        agencia: "001",
        agenciaLegacyId: "AG-7",
        numero: "9876",
        digito: "5",
        variacao: null,
        tipo: "CORRENTE",
      },
    },
  );
});

test("classifica conta ausente ou incompleta sem liberar pagamento", () => {
  const relacao = montarRelacaoPagamentos([
    item({ id: "1", conta: null }),
    item({
      id: "2",
      conta: {
        agencia: "",
        agenciaLegacyId: null,
        numero: "123",
        digito: null,
        variacao: null,
        tipo: null,
      },
    }),
  ]);
  assert.equal(relacao.pronta, false);
  assert.equal(relacao.pendentes, 2);
  assert.deepEqual(relacao.linhas[0].pendencias, ["CONTA_NAO_CADASTRADA"]);
  assert.deepEqual(relacao.linhas[1].pendencias, [
    "AGENCIA_NAO_INFORMADA",
    "TIPO_NAO_INFORMADO",
  ]);
});

test("separa guia confirmada da relação bancária e exige reprocessamento", () => {
  const relacao = montarRelacaoPagamentos([
    item({ id: "prestador", totalLiquido: "1000.00" }),
    item({
      id: "guia",
      nome: "INSS",
      totalLiquido: "100.00",
      naturezaOperacional: "GUIA_RECOLHIMENTO",
    }),
  ]);
  assert.equal(relacao.linhas.length, 1);
  assert.equal(relacao.totalLiquidoCentavos, 100_000);
  assert.equal(relacao.itensForaPagamento.length, 1);
  assert.equal(relacao.reprocessamentoNecessario, true);
  assert.equal(relacao.pronta, false);
});

test("recusa item duplicado e líquido negativo", () => {
  assert.throws(
    () => montarRelacaoPagamentos([item(), item()]),
    /duplicado/,
  );
  assert.throws(
    () => montarRelacaoPagamentos([item({ totalLiquido: "-0.01" })]),
    /não pode ser negativo/,
  );
});

test("gera CSV rastreável e neutraliza fórmulas", () => {
  const resultado = gerarRelacaoPagamentosCsv({
    empresa: "=Empresa",
    competencia: "2026-07",
    folhaNumero: 1,
    revisao: 2,
    folhaStatus: "ABERTA",
    hashFolha: "a".repeat(64),
    itens: [item({ nome: "+Pessoa" })],
  });
  assert.match(resultado.conteudo, /'=Empresa/);
  assert.match(resultado.conteudo, /'\+Pessoa/);
  assert.match(resultado.conteudo, /1000,00/);
  assert.match(resultado.conteudo, /ABERTA;BLOQUEADA/);
  assert.equal(resultado.liberada, false);
  assert.match(resultado.hashSha256, /^[0-9a-f]{64}$/);
});
