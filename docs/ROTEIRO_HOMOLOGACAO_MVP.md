# Roteiro de homologação do MVP

Este roteiro valida o produto publicado sem criar, alterar ou excluir dados.

## Preparação

Defina no terminal da máquina que executará o teste:

```powershell
$env:E2E_BASE_URL="https://endereco-da-vps/caminho-do-sistema"
$env:E2E_LOGIN="usuario-de-homologacao"
$env:E2E_PASSWORD="senha-de-homologacao"
npm run test:e2e:mvp
```

As credenciais não são gravadas no repositório nem no relatório.

A mesma jornada roda automaticamente no CI com organização e credenciais
exclusivamente sintéticas. A execução na VPS continua obrigatória porque também
valida proxy, caminho-base, ambiente e revisão efetivamente implantada.

## Jornada automatizada

O teste confere:

1. login e abertura da visão geral;
2. seletor global de competência;
3. cadastros filtrados por ativos;
4. acesso às folhas e à criação guiada;
5. isolamento da administração e do histórico do GIW;
6. fluxo previdenciário até o DARF;
7. diagnóstico de elegibilidade para FGTS.

## Jornada funcional com o RH

Após a jornada automatizada passar, executar em uma competência controlada:

1. revisar uma ficha de pessoa, conta e dependentes;
2. revisar prestador, categoria, NIT e vínculo;
3. registrar medição quando exigida;
4. criar a folha e acompanhar o processamento;
5. conferir itens, rubricas, INSS, IRRF e líquido;
6. registrar a decisão do RH e fechar a folha;
7. gerar e revisar a relação de pagamentos;
8. apurar a obrigação previdenciária;
9. registrar totalizador, recibo e DARF da DCTFWeb;
10. confirmar no diagnóstico se o FGTS é aplicável à categoria.

## Critério de aceite

O MVP pode ser aprovado quando:

- nenhuma etapa deixa o usuário sem próximo passo;
- os totais conferem com a referência aprovada pelo RH;
- falhas de cálculo podem ser entendidas e corrigidas;
- documentos oficiais nunca são confundidos com cálculos internos;
- folha, pagamento e obrigação permanecem rastreáveis pela mesma competência.
