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

O login exibido é apenas demonstrativo. Não use esta versão com dados reais ou na internet até autenticação, autorização, proteção de sessão, auditoria e endurecimento da infraestrutura estarem implementados e revisados.
