# Andamento do MVP

## Visão geral

**Estimativa atual: 54% concluído.**

O percentual mede capacidade operacional validada, e não quantidade de telas ou linhas
de código. Uma etapa só avança quando existe persistência, validação, teste e caminho de
homologação. Interfaces demonstrativas contam apenas como descoberta de fluxo.

| Frente | Peso no MVP | Concluído | Situação |
|---|---:|---:|---|
| Plataforma, banco, deploy e CI | 15% | 12% | Operacional; faltam acesso real, auditoria de usuário e rotinas comprovadas de restauração. |
| Descoberta, regras e modelo relacional | 10% | 7% | Fluxo principal e modelo identificados; contratos e amostras reais ainda precisam ampliar a evidência. |
| Migração e cadastros-base | 15% | 12% | Pessoas completas, Atividades, Lotações e Prestadores persistentes; a coleta de Pessoa inclui dados civis, contatos, endereço, conta e dependentes. |
| Termos, metas e vínculos | 15% | 14% | Coleta/importação e CRUD da cadeia implementados; falta executar e reconciliar os dados reais de todos os anos. |
| Folha auditável | 20% | 7% | Eventos e lançamentos recorrentes já persistem; motor inicial e memória demonstrativa existem, mas processamento e fechamento ainda não persistem. |
| Obrigação previdenciária | 15% | 2% | Divergência é detectada no protótipo; apuração, reconciliação e emissão ainda não são operacionais. |
| Homologação, paralelo e corte | 10% | 0% | Depende dos módulos anteriores e de três competências reais conciliadas. |
| **Total** | **100%** | **54%** | |

## O que já pode ser usado

- aplicação, PostgreSQL, migrações e containers com CI;
- coleta e importação idempotente de Pessoas completas, Atividades, Lotações, Termos,
  Metas e Vínculos do GIW;
- ficha de Pessoa com identificação civil/profissional, contatos, endereço, conta
  bancária e dependentes relevantes para IRRF e salário-família;
- cadastro persistente de Pessoas, Atividades, Lotações e Prestadores;
- cadastro persistente de Termos e Metas, com vigência, orçamento e dependências protegidas;
- cadastro persistente de Vínculos, ligando toda a cadeia e bloqueando vigências sobrepostas;
- cadastro persistente de Eventos/Rubricas e lançamentos recorrentes, com incidências,
  vigência e proteção contra sobreposição;
- regras iniciais de INSS e IRRF de 2026 com testes;
- diagnóstico de duplicidade da obrigação previdenciária do legado;
- documentação de implantação, modelo relacional e evidências.

## Caminho crítico restante

1. Executar a coleta real da cadeia contratual e reconciliar contagens por Termo e Meta.
2. Produtividade, composição de Eventos e parâmetros fiscais por vigência.
3. Processamento, conferência, fechamento e reabertura da folha.
4. Apuração e reconciliação previdenciária com origem por item.
5. Três competências reais em paralelo, com diferenças explicadas.
6. Backup/restauração, acesso, auditoria e corte controlado do GIW.

## Como o percentual será atualizado

O valor deve ser revisto ao concluir cada incremento. Código sem validação no banco ou
fluxo apenas visual não recebe o peso completo. Descobertas que revelem escopo obrigatório
adicional podem alterar os pesos, mantendo sempre o total em 100%.
