# Arquitetura

## Objetivo do primeiro recorte

Entregar folha de prestadores e apuração previdenciária com cálculo determinístico, memória reproduzível, segregação por organização e trilha de auditoria.

```mermaid
flowchart LR
  UI["Aplicação web"] --> APP["Casos de uso"]
  APP --> CALC["Motor de cálculo versionado"]
  APP --> DB["PostgreSQL"]
  CALC --> MEM["Memória imutável"]
  MEM --> DB
  APP --> OBR["Obrigações tipadas"]
  OBR -. futuro .-> EXT["eSocial / DCTFWeb / DARF"]
  APP --> AUD["Auditoria"]
```

## Limites de domínio

### Identidade e organizações

Usuários, perfis, vínculo com organizações e segregação de acesso. Autenticação real será implementada no próximo incremento; autorização permanece obrigatoriamente no servidor.

### Pessoas e vínculos

Pessoa física/jurídica, prestador, termo, meta e vínculo. Dados contratuais usados na folha são congelados em snapshots no fechamento.

### Motor de folha

Regras por vigência, eventos, consolidação mensal por pessoa, folha, item, memória e histórico de estados. Uma folha fechada não deve ser editada silenciosamente.

### Obrigações

Débitos discriminados por tipo e origem. O domínio usa “obrigação fiscal”, permitindo DCTFWeb/DARF e GPS apenas quando juridicamente aplicável.

### Auditoria e documentos

Toda ação financeira relevante registra usuário, instante, estado anterior, estado novo e motivo. Documentos futuros terão metadados, hash e armazenamento protegido.

## Decisões importantes

- PostgreSQL é a fonte de verdade; navegador não guarda registros oficiais.
- Regras e tabelas fiscais são versionadas, nunca constantes sem vigência.
- Cálculo deve ser idempotente: repetir uma requisição não duplica folha ou obrigação.
- Integrações externas usarão outbox/fila, recibo e chave de idempotência.
- Dados reais não entram em testes; use fixtures anonimizadas ou sintéticas.
- Multi-organização será aplicada em todas as consultas e validada em testes.

## Base operacional implementada

- um único pool PostgreSQL é reutilizado pelo processo Node, inclusive em produção;
- tamanho do pool, conexão, consulta, comando e transação ociosa têm limites configuráveis;
- Vínculos e Eventos recorrentes possuem restrições de exclusão no PostgreSQL, evitando
  sobreposição mesmo sob requisições concorrentes;
- relações cadastrais críticas usam chaves estrangeiras compostas com a organização;
  o banco rejeita referências acidentais entre empresas;
- alterações em Vínculos, Eventos, Folhas e Obrigações geram auditoria automática com
  estado anterior e posterior;
- Folhas fechadas são imutáveis no banco; a reabertura exige transação autorizada e motivo;
- tarefas persistentes possuem idempotência, prioridade, reserva com `SKIP LOCKED`,
  retentativas e recuperação de reservas expiradas;
- operações monetárias do motor usam centavos e proporções inteiras, evitando que o
  ponto flutuante binário decida arredondamentos fiscais;
- regras fiscais completas são persistidas por versão e vigência, rejeitam sobreposição,
  possuem hash canônico conferido na leitura e podem ser específicas da organização;
- o Compose não aceita segredos padrão, limita a exposição ao host local e controla logs;
- scripts de backup, checksum e restauração de teste estão versionados.

O serviço worker já reserva tarefas com exclusão concorrente e possui um handler
operacional de validação da regra fiscal por competência. Cada novo tipo de processamento,
inclusive `PROCESSAR_FOLHA`, deverá possuir um handler de domínio testado antes de entrar
no registro aceito pelo worker.

## Estrutura do repositório

```text
app/                 rotas e páginas Next.js
components/          componentes de interface
db/                  schema relacional e acesso ao PostgreSQL
drizzle/             migrações versionadas
lib/                 regras de cálculo e dados demonstrativos
tests/               testes automatizados
docs/                arquitetura, domínio, deploy e referências
.github/workflows/   integração contínua
```

## Estado da persistência

Pessoas, seus endereços, contas bancárias e dependentes, além de Atividades, Lotações,
Prestadores, Termos, Metas, Vínculos, Eventos e lançamentos recorrentes já usam consultas
e ações de servidor conectadas ao PostgreSQL. Prestador depende
de uma Pessoa da mesma empresa e não pode
duplicá-la dentro da organização. Meta depende de um Termo da mesma empresa, e cadastros
com dependências ativas não podem ser inativados. Vínculos exigem toda a cadeia da mesma
empresa, guardam a referência e a descrição contratada e bloqueiam sobreposição ativa
para o mesmo prestador, termo e meta. Todas as operações são filtradas pela
empresa ativa, alterações são validadas no servidor e a exclusão física foi substituída
por inativação. Eventos controlam natureza, modo de cálculo e incidências; lançamentos
recorrentes os ligam ao Vínculo por intervalo de competências e não podem se sobrepor.
As páginas de folha e obrigações ainda usam dados demonstrativos. A página de Parâmetros
já consulta e valida as regras fiscais publicadas no PostgreSQL.

Na substituição progressiva dessas páginas por repositórios PostgreSQL, os contratos de
cálculo em `lib/calculos.ts` devem ser preservados, separando:

- entrada validada;
- regra/versionamento;
- resultado;
- memória detalhada;
- persistência transacional.
