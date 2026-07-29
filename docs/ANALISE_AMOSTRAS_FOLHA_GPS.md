# Análise das amostras de Folha e GPS do GIW

Data da análise: 28/07/2026.

Os arquivos foram analisados localmente e não foram adicionados ao repositório porque
contêm dados pessoais, bancários e fiscais. Os testes automatizados usam somente dados
anonimizados.

## Integridade das evidências

| Arquivo | Páginas | SHA-256 |
| --- | ---: | --- |
| Folha de pagamento | 8 | `9305ff2cb441c9d1eea5243f90d8a9aeca568cd7ecbc7db748706398204100bf` |
| GPS | 52 | `e60cb44c9650d463dcfd5395ae40e8ed22bc57c9c64784dc0c36c7b63e1969a4` |

Ambos foram produzidos pelo GIW com JasperReports 6.4.0 e iText 2.1.7.

## Reconciliação encontrada

- competência da Folha: 05/2026;
- 37 prestadores;
- proventos: R$ 221.523,22;
- retenções: R$ 8.963,24;
- líquido: R$ 212.559,98;
- 26 prestadores com retenção de INSS;
- INSS retido na Folha: R$ 8.173,29;
- IRRF retido: R$ 789,95;
- 26 GPS distintas, todas da mesma competência;
- soma do principal das GPS: R$ 8.173,29;
- correspondência de nome e valor: 26 de 26;
- valor impresso e valor codificado na linha digitável: 26 de 26.

O PDF de GPS contém cada guia duas vezes: 52 páginas para 26 documentos distintos. A
segunda cópia possui texto extraível idêntico, embora possa ser renderizada em branco
por alguns leitores. O importador deve deduplicar pela competência, identificador,
código, total e linha digitável.

## O que a amostra confirma para o MVP

A Folha do MVP já possui os elementos necessários para reproduzir e melhorar o
relatório:

- competência, termo/parceria, meta e lote;
- prestador, documento, matrícula, atividade e NIT/PIS/PASEP;
- proventos, bases de INSS e IRRF, retenções e líquido;
- rubricas individuais e resumo consolidado;
- conta bancária em snapshot e relação de pagamentos separada;
- revisão, conferência do RH e hashes de integridade.

O relatório imprimível passou a incluir também resumo por rubrica, natureza,
incidências, quantidade, base e valor, cobrindo o quadro “Resumo por verba” observado
no GIW.

## Alerta normativo sobre as GPS da amostra

As guias usam o código 1007, que a Receita classifica como recolhimento mensal do
contribuinte individual por NIT/PIS/PASEP. A amostra, porém, associa essas guias ao
INSS de 11% descontado pela entidade contratante. Para empresa obrigada a
eSocial/DCTFWeb, a Receita orienta que as contribuições declaradas sejam recolhidas
por DARF numerado emitido pela DCTFWeb, e não por GPS.

Por isso, o sistema:

1. preserva GPS como evidência histórica importável;
2. reconcilia cada GPS com o desconto individual da Folha;
3. alerta sobre o código 1007 no fluxo empresarial;
4. não chama uma reprodução visual da GPS de guia oficial;
5. exige totalizador, recibo e DARF externos verificados para marcar a obrigação
   atual como emitida.

Referências oficiais:

- [Tabela de códigos de pagamento do INSS](https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-codigos-de-pagamento-de-contribuicao-previdenciaria)
- [Orientação da Receita sobre recolhimento após eSocial/DCTFWeb](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/restituicao-ressarcimento-reembolso-e-compensacao/mensagens/cpim/pos_esocial)
- [DCTFWeb e emissão do DARF](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/efd-reinf/efdr/1-geral/1-4-como-sera-a)

## Pendências para homologação com RH/contabilidade

- confirmar se as GPS foram efetivamente pagas ou apenas geradas pelo GIW;
- obter comprovantes bancários e a obrigação transmitida no eSocial/DCTFWeb;
- confirmar o enquadramento previdenciário da entidade e de cada tipo de prestador;
- validar competência de apuração versus data do pagamento;
- confirmar retenção de IRRF, outras bases e múltiplas fontes pagadoras;
- obter um DARF e os totalizadores DCTFWeb da mesma competência para fechar a cadeia
  oficial.
