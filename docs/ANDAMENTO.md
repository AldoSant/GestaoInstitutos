# Andamento do MVP

## Visão geral

**Estimativa atual: 36% concluído.**

O percentual mede capacidade operacional validada, e não quantidade de telas ou linhas
de código. Uma etapa só avança quando existe persistência, validação, teste e caminho de
homologação. Interfaces demonstrativas contam apenas como descoberta de fluxo.

| Frente | Peso no MVP | Concluído | Situação |
|---|---:|---:|---|
| Plataforma, banco, deploy e CI | 15% | 12% | Operacional; faltam acesso real, auditoria de usuário e rotinas comprovadas de restauração. |
| Descoberta, regras e modelo relacional | 10% | 7% | Fluxo principal e modelo identificados; contratos e amostras reais ainda precisam ampliar a evidência. |
| Migração e cadastros-base | 15% | 10% | Pessoas, Atividades, Lotações e Prestadores persistentes; importação automática cobre os três primeiros. |
| Termos, metas e vínculos | 15% | 1% | Schema existe, mas ainda faltam importadores e operação web. |
| Folha auditável | 20% | 4% | Motor inicial e memória demonstrativa existem; processamento e fechamento ainda não persistem. |
| Obrigação previdenciária | 15% | 2% | Divergência é detectada no protótipo; apuração, reconciliação e emissão ainda não são operacionais. |
| Homologação, paralelo e corte | 10% | 0% | Depende dos módulos anteriores e de três competências reais conciliadas. |
| **Total** | **100%** | **36%** | |

## O que já pode ser usado

- aplicação, PostgreSQL, migrações e containers com CI;
- coleta e importação idempotente de Pessoas, Atividades e Lotações do GIW;
- cadastro persistente de Pessoas, Atividades, Lotações e Prestadores;
- regras iniciais de INSS e IRRF de 2026 com testes;
- diagnóstico de duplicidade da obrigação previdenciária do legado;
- documentação de implantação, modelo relacional e evidências.

## Caminho crítico restante

1. Termos e Metas persistentes e importáveis.
2. Vínculos ligando Prestador, Termo, Meta, Atividade e Lotação.
3. Eventos, produtividade e parâmetros fiscais por vigência.
4. Processamento, conferência, fechamento e reabertura da folha.
5. Apuração e reconciliação previdenciária com origem por item.
6. Três competências reais em paralelo, com diferenças explicadas.
7. Backup/restauração, acesso, auditoria e corte controlado do GIW.

## Como o percentual será atualizado

O valor deve ser revisto ao concluir cada incremento. Código sem validação no banco ou
fluxo apenas visual não recebe o peso completo. Descobertas que revelem escopo obrigatório
adicional podem alterar os pesos, mantendo sempre o total em 100%.
