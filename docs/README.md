# Documentação

| Documento | Finalidade |
|---|---|
| [Arquitetura](ARQUITETURA.md) | Componentes, limites de domínio e decisões técnicas. |
| [Modelo de dados](MODELO_DE_DADOS.md) | Estruturas atuais, modelo completo e estratégia de migração. |
| [Engenharia reversa](ENGENHARIA_REVERSA.md) | Evidências, confiança e como transformar observação em regra. |
| [Roadmap](ROADMAP.md) | Incrementos, critérios de aceite e ordem recomendada. |
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
