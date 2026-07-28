# Documentação

| Documento | Finalidade |
|---|---|
| [Arquitetura](ARQUITETURA.md) | Componentes, limites de domínio e decisões técnicas. |
| [Modelo de dados](MODELO_DE_DADOS.md) | Estruturas atuais, modelo completo e estratégia de migração. |
| [Engenharia reversa](ENGENHARIA_REVERSA.md) | Evidências, confiança e como transformar observação em regra. |
| [Importação do GIW](IMPORTACAO_GIW.md) | Coleta, dry-run, aplicação, conciliação e expansão por etapas. |
| [Migração histórica](MIGRACAO_HISTORICA.md) | Folhas, rubricas, guias, idempotência, reconciliação e campanha de corte. |
| [Regras fiscais de 2026](REGRAS_FISCAIS_2026.md) | Fontes oficiais, vigência, parâmetros implementados e limites atuais. |
| [Biblioteca contábil e fiscal](BIBLIOTECA_CONTABIL_FISCAL.md) | Matriz de enquadramentos, normas contábeis, obrigações e controle de mudança. |
| [Medições e homologação](MEDICOES_E_HOMOLOGACAO.md) | Produtividade, proporcionalização, evidências e roteiro de conferência do RH. |
| [Homologação paralela da Folha](HOMOLOGACAO_FOLHA.md) | Contrato CSV, comparação com GIW/RH, classificações, auditoria e critério de corte. |
| [Homologação mensal](HOMOLOGACAO_MENSAL.md) | Sete controles, dossiê versionado, campanha de três competências e aprovação final. |
| [Consolidação mensal por pessoa](CONSOLIDACAO_MENSAL.md) | Limite multi-lote atual, bloqueio seguro e modelo-alvo de agregação e rateio fiscal. |
| [Simulação fiscal consolidada](SIMULACAO_FISCAL_CONSOLIDADA.md) | Motor agregado, rateio exato, persistência, homologação e bloqueio produtivo. |
| [Obrigação previdenciária](OBRIGACAO_PREVIDENCIARIA.md) | Apuração completa, fontes congeladas, estados, espelho CSV e conciliação documental. |
| [Cancelamentos e retificações](CANCELAMENTOS_E_RETIFICACOES.md) | Estados permitidos, impacto fiscal, invalidação de evidências e justificativas. |
| [Roadmap](ROADMAP.md) | Incrementos, critérios de aceite e ordem recomendada. |
| [Andamento do MVP](ANDAMENTO.md) | Percentual ponderado, entregas utilizáveis e caminho crítico restante. |
| [Deploy em VPS](DEPLOY_VPS.md) | Preparação, segredos, proxy, banco, backup e atualização. |
| [ADR 0001](decisoes/0001-stack-e-implantacao.md) | Por que Next.js, PostgreSQL e Docker. |
| [Referências](referencia/) | Diagnóstico, UML e SQLs completos produzidos na descoberta. |

## Documentos operacionais na raiz

- `CONTRIBUTING.md`: processo de desenvolvimento e revisão.
- `SECURITY.md`: tratamento de vulnerabilidades, segredos e dados pessoais.
- `.env.example`: variáveis necessárias, sem valores de produção.
- `compose.yaml`: aplicação e PostgreSQL para desenvolvimento/homologação.

## Regra de atualização

Mudanças de comportamento fiscal devem atualizar, no mesmo pull request:

1. a regra ou tabela por vigência;
2. a fonte normativa/documental;
3. a memória de cálculo;
4. os testes automatizados;
5. esta documentação, quando o fluxo ou modelo mudar.
