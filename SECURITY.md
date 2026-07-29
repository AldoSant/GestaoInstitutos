# Segurança

## Relato de vulnerabilidades

Não abra uma issue pública contendo detalhes exploráveis, credenciais ou dados pessoais. Prefira o recurso **Security → Report a vulnerability** do GitHub, quando habilitado, ou contate privadamente o proprietário do repositório.

Inclua:

- componente e versão;
- passos mínimos de reprodução;
- impacto possível;
- evidências sem dados pessoais;
- sugestão de correção, se houver.

## Segredos

- nunca versione `.env`, tokens, senhas, chaves privadas ou cookies;
- use segredos do ambiente/CI;
- rotacione imediatamente qualquer credencial exposta;
- mantenha `.env.example` apenas com nomes e exemplos não reutilizáveis.

## Dados pessoais

Este domínio processará informações pessoais e financeiras. Ambientes de desenvolvimento devem usar dados sintéticos ou anonimizados. Logs não devem registrar CPF completo, senha, token, conta bancária ou documento.

## Dependências

O CI executa `npm audit`. Atualizações devem preservar testes e build; não use `--force` sem análise da mudança quebradora.

## Estado atual

O acesso web usa um administrador único configurado por `ADMIN_LOGIN` e
`ADMIN_PASSWORD`, sem credenciais no banco. `AUTH_SECRET` (mínimo de 32 bytes)
assina sessões de oito horas em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em
produção. Todas as páginas, rotas e Server Actions passam pela proteção central,
exceto `/login` e `/api/health`; chamadas não HTML sem sessão recebem `401`.

Esta autenticação simples não substitui autorização granular, MFA, limitação de
tentativas, auditoria de acesso e endurecimento da infraestrutura antes de uma
exposição ampla na internet.
