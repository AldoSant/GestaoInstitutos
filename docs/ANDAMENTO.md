# Andamento do MVP

## Visão geral

**Estimativa atual: 46% concluído.**

O percentual mede capacidade operacional validada, e não quantidade de telas ou linhas
de código. Uma etapa só avança quando existe persistência, validação, teste e caminho de
homologação. Interfaces demonstrativas contam apenas como descoberta de fluxo.

| Frente | Peso no MVP | Concluído | Situação |
|---|---:|---:|---|
| Plataforma, banco, deploy e CI | 15% | 12% | Operacional; faltam acesso real, auditoria de usuário e rotinas comprovadas de restauração. |
| Descoberta, regras e modelo relacional | 10% | 7% | Fluxo principal e modelo identificados; contratos e amostras reais ainda precisam ampliar a evidência. |
| Migração e cadastros-base | 15% | 10% | Pessoas, Atividades, Lotações e Prestadores persistentes; importação automática cobre os três primeiros. |
| Termos, metas e vínculos | 15% | 11% | Coleta/importação de Termos e Metas e CRUD de Vínculos implementados; falta importar Vínculos do GIW e reconciliar contagens reais. |
| Folha auditável | 20% | 4% | Motor inicial e memória demonstrativa existem; processamento e fechamento ainda não persistem. |
| Obrigação previdenciária | 15% | 2% | Divergência é detectada no protótipo; apuração, reconciliação e emissão ainda não são operacionais. |
| Homologação, paralelo e corte | 10% | 0% | Depende dos módulos anteriores e de três competências reais conciliadas. |
| **Total** | **100%** | **46%** | |

## O que já pode ser usado

- aplicação, PostgreSQL, migrações e containers com CI;
- coleta e importação idempotente de Pessoas, Atividades, Lotações, Termos e Metas do GIW;
- cadastro persistente de Pessoas, Atividades, Lotações e Prestadores;
- cadastro persistente de Termos e Metas, com vigência, orçamento e dependências protegidas;
- cadastro persistente de Vínculos, ligando toda a cadeia e bloqueando vigências sobrepostas;
- regras iniciais de INSS e IRRF de 2026 com testes;
- diagnóstico de duplicidade da obrigação previdenciária do legado;
- documentação de implantação, modelo relacional e evidências.

## Caminho crítico restante

1. Coleta e importação dos Vínculos do GIW, com reconciliação por Termo e Meta.
2. Eventos, produtividade e parâmetros fiscais por vigência.
3. Processamento, conferência, fechamento e reabertura da folha.
4. Apuração e reconciliação previdenciária com origem por item.
5. Três competências reais em paralelo, com diferenças explicadas.
6. Backup/restauração, acesso, auditoria e corte controlado do GIW.

## Como o percentual será atualizado

O valor deve ser revisto ao concluir cada incremento. Código sem validação no banco ou
fluxo apenas visual não recebe o peso completo. Descobertas que revelem escopo obrigatório
adicional podem alterar os pesos, mantendo sempre o total em 100%.
