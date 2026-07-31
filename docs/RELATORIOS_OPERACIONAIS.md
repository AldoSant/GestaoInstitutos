# Relatórios operacionais do MVP

## Relatório da Folha

Uma Folha processada possui a ação **Relatório imprimível**. A saída foi projetada para
conferência do RH, assinatura interna e impressão ou salvamento como PDF pelo navegador.

O documento contém:

- organização, CNPJ, competência, Termo, Meta, lote e revisão;
- regra fiscal, estado, processamento, fechamento e hash da Folha;
- população e totais de proventos, INSS, IRRF, descontos e líquido;
- referência completa das simulações consolidadas aplicadas;
- quadro-resumo por prestador;
- uma página individual por prestador com todas as rubricas, bases e valores;
- blocos de assinatura e identificação da aprovação do RH válida para o hash.

Antes de renderizar, o servidor recompõe todos os valores em centavos, verifica o
fechamento de cada item e da Folha e recusa referências incompletas ou divergentes de
rateio consolidado. A ordem dos prestadores e das rubricas é determinística.

O demonstrativo individual preserva a memória do sistema. Ele não redefine a natureza
jurídica do pagamento e não substitui documento fiscal exigido pelo contrato ou pela
orientação contábil.

## Dossiê do demonstrativo mensal

O demonstrativo mensal possui a ação **Dossiê / PDF**. O documento reúne:

- pagamentos PF e PJ sem converter a guia em beneficiário;
- retenções ligadas ao pagamento e suas evidências;
- obrigações, guias e documentos externos;
- aprovação, responsável, fechamento e SHA-256;
- histórico de retificações, com acesso a cada fechamento anterior.

O relatório recompõe o hash antes de renderizar. Uma revisão histórica é lida do
snapshot imutável criado na abertura da revisão seguinte; divergência de integridade
é exibida como bloqueio explícito. A prévia de um rascunho também pode ser impressa,
mas permanece identificada como não fechada.

## Relação de pagamentos

A Folha processada também possui a ação **Relação de pagamentos**. Ela apresenta conta,
valor líquido, pendências tipadas, total e assinaturas, além de gerar um CSV com hash
próprio. A liberação exige Folha fechada e conta completa para toda a população.

Os dados bancários vêm do snapshot protegido pelo hash da Folha, não do cadastro atual.
O documento é uma evidência interna de conferência e autorização; não é CNAB, ordem
bancária ou comprovante. Consulte [Relação interna de pagamentos](RELACAO_PAGAMENTOS.md).

## Dossiê previdenciário

Cada obrigação possui a ação **Dossiê imprimível**. O documento contém:

- organização, CNPJ, competência, tipo e estado;
- principal, juros, multa, total interno, valor declarado e diferença;
- composição por natureza e cada item ligado à Folha;
- lote, revisão e SHA-256 das Folhas congeladas;
- totalizador, recibo e DARF com referência, valor, data, localizador, hash e
  confirmação de conferência;
- estado de cada gate documental e blocos de assinatura.

O servidor recusa a geração de um dossiê inconsistente quando:

- principal + juros + multa não coincide com o total;
- a soma dos itens não coincide com o principal;
- existe item duplicado;
- uma obrigação `EMITIDA` não possui totalizador, recibo e DARF verificados;
- o DARF verificado não possui o mesmo total da obrigação.

O dossiê traz uma advertência visível: **não é uma guia de arrecadação**. O documento
oficial para pagamento continua sendo o DARF emitido pelo ambiente competente.

## Impressão e arquivamento

Use **Imprimir ou salvar PDF** e selecione o destino PDF do navegador. O CSS de
impressão usa páginas A4, remove botões e força cada demonstrativo individual da Folha
para uma nova página.

Para arquivamento:

1. salve o PDF em repositório documental controlado;
2. preserve a referência ao hash da Folha ou aos documentos externos;
3. não substitua versões anteriores após reprocessamento ou reapuração;
4. mantenha o CSV e a memória JSON como evidências estruturadas complementares.
