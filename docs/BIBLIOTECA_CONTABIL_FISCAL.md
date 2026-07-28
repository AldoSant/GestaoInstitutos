# Biblioteca contábil e fiscal

Última revisão de fontes oficiais: **27/07/2026**.

## Finalidade

Esta biblioteca registra o fundamento das decisões automatizadas do sistema. Norma
contábil, fiscal ou previdenciária não deve ser implementada apenas em texto ou como
constante global: cada regra precisa declarar vigência, cenário de aplicação, fonte,
versão e testes de memória.

O sistema não substitui o julgamento do contador responsável. Quando os dados não
permitem decidir o enquadramento, o comportamento correto é bloquear e pedir evidência,
em vez de calcular com uma hipótese silenciosa.

## Matriz de cenários

| Cenário | Estado no motor | Tratamento |
|---|---|---|
| Pessoa Física 701 contratada por empresa em regime geral | Homologação técnica implementada | Segurado 11% até o limite e patronal 20% sobre a remuneração, além do IRRF |
| Pessoa Física 701 contratada por beneficente em gozo da imunidade | Homologação técnica implementada com CEBAS obrigatório | Segurado 20% até o limite e cota patronal zero; não inferir imunidade pelo nome ou pela ausência de lucro |
| Pessoa Física sem categoria | Bloqueado | Exigir categoria eSocial, NIT e evidência de outras fontes |
| Pessoa Física em outra categoria 7XX | Bloqueado | Criar regra específica após validar incidências e eventos eSocial |
| Pessoa Jurídica | Fora da Folha de contribuinte individual | Encaminhar ao futuro módulo de documento fiscal/contas a pagar |
| Empregado, avulso, diretor ou dirigente | Não implementado | Não reutilizar a regra 701; exige categoria, rubricas e encargos próprios |
| Pagamento não relacionado ao trabalho | Não implementado | Avaliar EFD-Reinf R-4010/R-4020 e retenções próprias |

## Parâmetros confirmados para 2026

### Contribuinte individual

- limite máximo do salário de contribuição: **R$ 8.475,55**;
- no regime geral, retenção do segurado de **11%**, limitada matematicamente a
  **R$ 932,31**, e cota patronal de **20%** sobre a remuneração;
- para entidade beneficente efetivamente em gozo da imunidade, retenção do segurado de
  **20%**, limitada ao teto contributivo, e cota patronal zero;
- a segunda hipótese exige CEBAS e evidência documental cobrindo toda a vigência;
- remunerações e contribuições em outras fontes precisam ser consideradas para respeitar
  o limite mensal;
- no sistema, cada outra fonte identifica competência, pagador, CPF/CNPJ, remuneração,
  base, valor retido e referência documental; somente registros marcados como
  comprovante verificado reduzem a base residual do INSS;
- declaração/comprovantes apresentados pelo segurado devem ser preservados.

Fontes: [IN RFB 2.110/2022](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=126687),
[tabela de contribuição de 2026 do INSS](https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal)
e [documentação eSocial S-1.3](https://www.gov.br/esocial/pt-br/documentacao-tecnica/documentacao-tecnica/).
Para a imunidade beneficente, ver também a
[Lei Complementar 187/2021](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp187.htm).

### IRRF mensal

- tabela progressiva: R$ 2.428,80; R$ 2.826,65; R$ 3.751,05; R$ 4.664,68;
- alíquotas: 0%; 7,5%; 15%; 22,5%; 27,5%;
- parcelas a deduzir: R$ 0,00; R$ 182,16; R$ 394,16; R$ 675,49; R$ 908,73;
- dependente: **R$ 189,59**;
- desconto simplificado mensal: **R$ 607,20**;
- redução integral do imposto até rendimentos tributáveis de R$ 5.000,00, limitada ao
  imposto e a R$ 312,89;
- redução decrescente até R$ 7.350,00 pela fórmula legal.

Fonte: [Receita Federal — Tributação de 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026),
com fundamento na Lei 15.270/2025.

## Contabilidade de entidade sem finalidade de lucros

A condição de entidade sem finalidade de lucro não elimina a obrigação de contabilidade
regular. A escrituração e as demonstrações devem observar as Normas Brasileiras de
Contabilidade e a ITG 2002 (R1). A renúncia fiscal precisa ser mensurada e evidenciada
quando aplicável.

O modelo deve manter, no mínimo:

- segregação por organização, Termo, Meta, fonte de recurso e competência;
- reconhecimento por competência, separado do fluxo financeiro;
- rastreabilidade entre obrigação, despesa, pagamento, conta bancária e evidência;
- distinção de recursos com e sem restrição;
- trilha para gratuidades, benefícios e renúncia fiscal;
- encerramento do resultado conforme a natureza da entidade e demonstrações exigidas;
- documentos e livros pelo prazo legal aplicável.

Fonte: [CFC — Entidades sem Finalidade de Lucros](https://portalrestore.cfc.org.br/tecnica/perguntas-frequentes/entidades-sem-finalidade-de-lucros/).

## Parcerias e recursos públicos

Para parcerias regidas pela Lei 13.019/2014, a despesa precisa demonstrar nexo com o
objeto, Meta e resultado. Remuneração custeada pela parceria deve estar prevista no plano
de trabalho, ser compatível e proporcional ao tempo dedicado. Rateios precisam de memória
e não podem duplicar nem sobrepor fontes para a mesma parcela.

Consequências para o sistema:

- Folha fechada deve apontar a alocação por Termo e Meta;
- produtividade e rateio precisam ser entradas documentadas, não percentuais livres;
- uma mesma parcela não pode ser financiada duas vezes;
- o fato gerador e a vigência da parceria precisam ser validados;
- prestação de contas deve conciliar execução física, financeira e bancária;
- evidências originais da parceria federal devem observar a guarda de dez anos.

Fontes: [Lei 13.019/2014](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l13019compilado.htm)
e [Decreto 8.726/2016](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8726.htm).

## Roteamento das obrigações

- remuneração relacionada ao trabalho: eventos e totalizadores do **eSocial**;
- retenções e pagamentos fora do trabalho, quando aplicável: **EFD-Reinf**;
- débitos totalizados: **DCTFWeb**;
- documento de arrecadação ordinário: **DARF** emitido a partir da DCTFWeb;
- GPS não deve ser presumida; só pode ser habilitada para hipótese legal validada.

A DIRF foi substituída, a partir do ano-calendário de 2025, pelos eventos correspondentes
do eSocial e da EFD-Reinf.

Fontes: [serviço EFD-Reinf](https://www.gov.br/pt-br/servicos/efd-reinf) e
[orientação da Receita sobre a substituição da DIRF](https://www.gov.br/receitafederal/pt-br/canais_atendimento/fale-conosco/suporte-a-dirf/leiame).

## Obrigações acessórias da entidade

- ECF alcança, em regra, pessoas jurídicas imunes e isentas, ressalvadas as exceções
  oficiais;
- ECD depende do enquadramento e dos limites vigentes; para imunes e isentas, a Receita
  informa atualmente a exceção quando ingressos assemelhados forem inferiores a
  R$ 4,8 milhões no ano ou valor proporcional;
- imunidade e isenção não devem ser inferidas apenas pelo nome ou natureza do instituto.

Fontes: [Perguntas frequentes da ECD](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/ecd/ecd/)
e [obrigatoriedade da ECF](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/ecf/ecf/quais-pessoas-juridicas-estao-obrigadas-1).

## Controle de mudança normativa

1. Registrar a fonte oficial, data de consulta e vigência.
2. Criar nova versão da regra; nunca alterar uma versão usada por Folha.
3. Adicionar exemplos oficiais e casos-limite como testes automatizados.
4. Executar comparação com competências já homologadas.
5. Obter aprovação do contador responsável.
6. Publicar a regra e manter a anterior para reprodução histórica.
7. Bloquear competências sem regra vigente ou com classificação incompleta.

O catálogo executável está em `lib/inteligencia-contabil.ts`; os cenários da contratante
ficam em `lib/enquadramento-previdenciario.ts`. Os números anuais usados no motor estão
em `lib/regras-fiscais.ts` e são persistidos com hash em `regra_calculo_versao`;
o enquadramento da organização é versionado separadamente por vigência.
