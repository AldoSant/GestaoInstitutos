# Handoff — próxima sessão do Gestão Institutos

**Leia este arquivo antes de alterar código ou dados.** Ele é a referência curta para
retomar o trabalho sem depender do histórico da conversa anterior.

## Objetivo ativo

Concluir o MVP operacional que substitui o fluxo comprovado do GIW para o IGP:

1. criar e processar Folhas mensais de prestadores PF e PJ;
2. emitir o relatório de Folha e a memória/registro de GPS compatíveis com as
   referências históricas;
3. validar abril, maio e junho de 2026 contra os 30 PDFs privados do GIW;
4. permitir a operação real com jornada limpa e sem páginas, botões ou retornos
   quebrados.

**Fora do P0:** folha CLT, FGTS Digital e eSocial completo. O produto é específico
para o IGP; não expandir escopo para uma plataforma pública genérica.

## Estado objetivo em 11/08/2026

- Branch oficial: `main` no repositório `AldoSant/GestaoInstitutos`.
- Último commit remoto: `a5004b9 fix: evita base path duplicado nas navegacoes`.
- Esse commit **ainda precisa ser aplicado na VPS** antes de declarar o erro corrigido
  online.
- A produção teve um 404 confirmado ao criar Folha: a URL saía como
  `/gestao-institutos/gestao-institutos/folhas/<id>`.
- A causa era `NEXT_BASE_PATH=/gestao-institutos` aplicado pelo Next e novamente pelo
  código em `Link` e `redirect`.
- A correção separa:
  - `caminhoAplicacao`: URL externa para `form action` e proxy;
  - `rotaAplicacao`: rota interna para `Link` e `redirect`, cujo prefixo o Next aplica.
- Validação local do commit: `npm test` = **270 aprovados, 5 skips de infraestrutura**;
  `npm run typecheck` e `npm run build` passaram, inclusive com
  `NEXT_BASE_PATH=/gestao-institutos`.
- Não declarar o MVP pronto: o fluxo online ainda precisa ser testado de ponta a ponta
  após o deploy e os três meses históricos ainda não foram reproduzidos pelo motor.

## Estado local que não pode ser perdido

No checkout local pode haver alterações não publicadas e deliberadamente separadas:

```text
M scripts/db/diagnosticar-irrf-legado.ts
?? tmp/
```

- O script modificado é diagnóstico privado de divergência histórica de IRRF. Não
  descartar nem incluir em commits de correções de produto sem revisão própria.
- `tmp/` contém renderizações temporárias de PDFs e não deve entrar no Git.

Antes de qualquer ação, executar:

```powershell
cd C:\Users\annaa\Documents\Codex\2026-07-21\http-ws-marvsolutions-com-br-9050\app
git status --short
git log -5 --oneline
```

## Primeiro trabalho obrigatório

1. Confirmar que a VPS aplicou `a5004b9` e que o health reporta a revisão nova.
2. Abrir a aplicação no caminho público normal e testar, autenticado:
   - login e sair;
   - Folhas → Novo processamento → criar Folha;
   - retorno para a Folha criada;
   - botões Voltar/Cancelar;
   - download de CSV;
   - links de bloqueio para onboarding/configuração.
3. Verificar que nenhum endereço contém duas vezes `/gestao-institutos` e que nenhum
   botão leva a 404.
4. Só então retomar a reprodução histórica do GIW.

### Comando de publicação para o agente da VPS

O checkout produtivo informado é:

```bash
cd /home/ubuntu/.openclaw/workspace/projects/gestao-institutos
git fetch origin
git checkout main
git pull --ff-only origin main
# Executar com uma conta que consiga ler o .env de produção.
docker compose -f compose.yaml -f compose.vps.yaml --profile tools run --rm migrate
sudo /usr/local/sbin/gestao-institutos-deploy deploy
curl -fsS http://127.0.0.1:3001/gestao-institutos/api/health
```

O comando deve ser executado pelo responsável com acesso à produção. O agente Codex
tem somente acesso ao checkout e PostgreSQL descartável de homologação.

## Acesso de homologação

Somente HML descartável; nunca usar esses passos para a produção:

```powershell
ssh -i C:\Users\annaa\.ssh\codex_giw_vps_20260809 codex-giw@veredasinc.com.br
cd /home/codex-giw/gestao-institutos-replay-main
git fetch origin +refs/heads/main:refs/remotes/origin/main
git checkout --detach origin/main
set -a && . ~/.config/gestao-institutos-hml.env && set +a
```

- Organização IGP na HML: `6b71ab72-9888-41d2-9f6e-ce9118485b80`.
- A HML escuta localmente em `127.0.0.1:55432`.
- Há ambiente GIW privado em `~/.config/gestao-institutos-giw.env`; usar apenas em
  investigação de leitura. Não expor credenciais, nomes, CPFs, NITs ou PDFs no Git,
  nos comentários ou na resposta ao usuário.

## Reprodução histórica: estado e próximo corte técnico

O acervo privado contém 30 PDFs (15 Folhas e 15 conjuntos de GPS), referentes a
abril–junho/2026. A comparação já consegue detectar divergência por pessoa e GPS.

Resultado mais recente antes deste handoff:

| Competência | Itens Folha GIW/Novo | Itens GPS GIW/Novo | Situação |
|---|---:|---:|---|
| 2026-04 | 81 / 81 | 59 / 59 | divergências de cálculo ainda existem |
| 2026-05 | 77 / 77 | 55 / 55 | divergências de cálculo ainda existem |
| 2026-06 | 77 / 77 | 55 / 55 | divergências de cálculo ainda existem |

As contagens não significam aprovação: é preciso comparar valores em centavos e
nenhum ciclo real novo foi gerado com êxito para substituir o legado.

O bloqueio da reprodução automática não é mais técnico de importação: dos 255 itens
históricos, a prévia encontrou 32 vínculos inferidos com segurança, 223 sem destino e
3 vínculos repetidos. Não criar mapeamentos fictícios. A prioridade é descobrir e
resolver o vínculo correto a partir do GIW/da evidência de origem, registrando a
decisão auditável.

Comandos úteis (executar apenas em HML e sempre começar por prévia):

```bash
npm run db:comparar:giw
npm run db:reproduzir:giw -- --empresa-id 6b71ab72-9888-41d2-9f6e-ce9118485b80 --previsao
```

Confirme os scripts/flags reais com `npm run` e `package.json` antes de executar
qualquer modo que grave dados. A execução que grava exige autorização explícita e deve
ser precedida de backup/HML descartável.

## Regras de produto e domínio já decididas

- PF e PJ podem constar em Folhas; PJ legítima é pagamento, não retenção automática.
- “Guias de FGTS” do fluxo atual eram, na verdade, PDFs de GPS/INSS do GIW.
- NIT tem fonte única na ficha de Pessoa; não duplicar em Prestador.
- PF recebe classificação interna 701 sem exigir categoria eSocial manual.
- Se outra fonte comprovada já atingiu o teto, não bloquear por NIT nem reter INSS
  residual. Não alterar tabelas/tetos sem fonte normativa e teste.
- Uma mesma pessoa pode estar em mais de uma Folha da competência. A criação e o
  processamento devem ser permitidos; consolidação/rateio fiscal ocorre antes do
  fechamento, não como bloqueio prematuro.
- Todo bloqueio precisa informar causa em linguagem simples, impacto e uma ação que
  leve à tela correta; ao retornar, preservar o ponto do fluxo.
- Setup da empresa pertence ao onboarding, não a uma tela técnica escondida.
- Fluxo de nova Folha deve ser assistido, limpo e uma etapa por vez.

## Arquivos de referência

- `docs/PLANO_SUBSTITUICAO_GIW_MVP.md` — escopo e gates oficiais.
- `docs/ANDAMENTO.md` — histórico amplo; pode conter percentuais/descrições
  ultrapassados, portanto não usá-lo sozinho como evidência.
- `docs/IMPORTACAO_GIW.md` e `docs/MIGRACAO_HISTORICA.md` — importação e snapshots.
- `docs/REGRAS_FISCAIS_2026.md` e `docs/BIBLIOTECA_CONTABIL_FISCAL.md` — regras e
  fontes; tratar qualquer caso novo como pendente de evidência.
- `docs/DEPLOY_VPS.md` — operação de deploy.
- `lib/base-path.ts` e `tests/autenticacao.test.ts` — correção do base path.

## Critério para encerrar o MVP

Não usar porcentagem como substituto de evidência. O MVP somente poderá ser declarado
operacional quando houver, em homologação e depois em produção controlada:

1. jornada sem 404/links quebrados para criar, processar, revisar e fechar Folha;
2. Folha PF/PJ e relatório emitidos para uma competência real;
3. GPS/memória individual emitida e registrada conforme o fluxo GIW comprovado;
4. três competências GIW comparadas e aprovadas em valores/itens, ou cada diferença
   formalmente explicada, documentada e aceita por RH/contabilidade;
5. backup, rollback e instruções de operação verificados.

## Mensagem inicial sugerida para a nova conversa

> Leia `docs/HANDOFF_PROXIMA_SESSAO.md` integralmente e assuma o objetivo ativo
> “Concluir o MVP operacional de Folha GIW + GPS”. Primeiro confirme o deploy do
> commit `a5004b9` e faça uma varredura real das rotas críticas sem tocar produção.
> Preserve as alterações locais de diagnóstico e não exponha dados pessoais. Depois
> retome a reprodução histórica em HML, começando por uma prévia sem gravação.
