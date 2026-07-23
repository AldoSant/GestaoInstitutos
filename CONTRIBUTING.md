# Como contribuir

## Preparação

1. Use Node.js 22+.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e use apenas valores locais.
4. Execute `npm run validate` e `npm audit` antes de abrir pull request.

## Fluxo de branches

- `main`: sempre publicável;
- `feat/<descricao>`: nova capacidade;
- `fix/<descricao>`: correção;
- `docs/<descricao>`: documentação;
- `chore/<descricao>`: infraestrutura/manutenção.

Evite commits diretos em `main` quando mais pessoas estiverem contribuindo.

## Commits

Prefira mensagens no padrão Conventional Commits:

```text
feat: cadastrar prestadores
fix: respeitar teto previdenciário por pessoa
docs: explicar conciliação da obrigação
test: cobrir limite de faixa do IRRF
```

## Pull requests

O PR deve informar:

- problema e solução;
- telas, tabelas ou regras afetadas;
- como testar;
- migração criada, quando houver;
- riscos e plano de reversão;
- fonte normativa/documental para regra fiscal.

Checklist:

- [ ] não contém credenciais ou dados pessoais reais;
- [ ] testes foram adicionados/atualizados;
- [ ] `npm test` passou;
- [ ] `npm run build` passou;
- [ ] `npm audit` não reporta vulnerabilidades;
- [ ] migração foi revisada e não reescreve histórico;
- [ ] documentação foi atualizada.

## Regras fiscais e financeiras

Não altere uma fórmula apenas para fazer um exemplo passar. Toda mudança precisa declarar vigência, arredondamento, fonte e impacto em competências anteriores.

Folhas fechadas são imutáveis. Correções devem usar reabertura auditada, estorno ou folha complementar conforme a regra aprovada.

## Dados de teste

Use dados sintéticos ou anonimizados. Não publique CPF, NIT/PIS/PASEP, conta bancária, contrato, comprovante ou log de produção em código, issue ou pull request.
