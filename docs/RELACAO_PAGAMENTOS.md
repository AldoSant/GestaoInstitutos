# Relação interna de pagamentos

## Objetivo

A relação de pagamentos transforma o resultado líquido de uma Folha processada em um
documento conferível pelo RH e pelo financeiro, sem transmitir ordens ao banco. Ela
fica disponível na ação **Relação de pagamentos** da Folha e oferece:

- versão A4 para impressão ou salvamento em PDF;
- espelho CSV determinístico, com proteção contra fórmulas de planilha;
- valor líquido em centavos, conta e situação de cada prestador;
- Folha, lote, revisão e SHA-256 de origem;
- hash SHA-256 próprio do CSV no cabeçalho `X-Content-SHA256`.

## Fonte dos dados

Nome, documento, matrícula, atividade e conta bancária são lidos exclusivamente do
snapshot do item da Folha. O processamento congela a conta cadastrada naquele momento
dentro do conteúdo protegido pelo hash da Folha.

Uma alteração posterior na ficha da Pessoa não modifica silenciosamente uma Folha já
processada. Para usar a nova conta é necessário reprocessar a Folha, realizar nova
conferência do RH e fechá-la novamente.

## Gates de liberação

A relação só exibe **LIBERADA** quando os dois requisitos forem satisfeitos:

1. a Folha está `FECHADA`;
2. todos os prestadores possuem agência, número e tipo de conta válido (`CORRENTE` ou
   `POUPANCA`) no snapshot.

As pendências são tipadas como:

| Código | Significado |
|---|---|
| `CONTA_NAO_CADASTRADA` | Não existe conta no snapshot. |
| `AGENCIA_NAO_INFORMADA` | A conta não possui agência. |
| `CONTA_NAO_INFORMADA` | A conta não possui número. |
| `TIPO_NAO_INFORMADO` | O tipo está ausente ou fora do domínio aceito. |

A tela e o CSV continuam disponíveis quando bloqueados para permitir saneamento e
conferência. O cabeçalho HTTP `X-Liberacao-Financeira` informa `LIBERADA` ou
`BLOQUEADA`.

## Limites do MVP

O documento não é ordem bancária, comprovante de transferência nem arquivo CNAB. A
assinatura interna e a execução no banco permanecem externas ao sistema. Uma expansão
posterior poderá gerar arquivos bancários a partir deste contrato estável, depois de
homologar banco, leiaute, convênio, conta debitada, retornos e segregação de funções.

## Conferência operacional

Antes de pagar:

1. confirme que a Folha e o relatório exibem o mesmo hash;
2. confira a população e o total líquido;
3. elimine todas as pendências bancárias por reprocessamento;
4. obtenha as assinaturas do RH, financeiro e autorizador;
5. preserve PDF e CSV junto dos comprovantes de execução.

