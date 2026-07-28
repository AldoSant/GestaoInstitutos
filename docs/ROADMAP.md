# Roadmap

## Prioridade operacional atual — migração e funcionalidade

1. Pipeline seguro e idempotente de importação do GIW.
2. Pessoas e prestadores completos, seguidos dos cadastros-base.
3. Termos, metas e vínculos.
4. Eventos, produtividade e tabelas por vigência.
5. Processamento persistente da folha.
6. Apuração e reconciliação da obrigação previdenciária.
7. Execução paralela e corte do legado.

Autenticação completa e perfis continuam previstos, mas não bloqueiam estas entregas.
Até essa etapa, a aplicação deve permanecer em ambiente interno controlado. O roteiro
detalhado da migração está em [Importação do GIW](IMPORTACAO_GIW.md).

## Incremento 0 — concluído

- interface navegável;
- dados demonstrativos das três competências;
- motor inicial de INSS/IRRF;
- detecção da duplicidade previdenciária;
- PostgreSQL, migração, Docker, testes e CI.

## Incremento 1 — fundação persistente

- executar PostgreSQL e migrações;
- pipeline de importação com dry-run, trilha e repetição segura;
- coletores de cadastros do GIW;
- CRUD de pessoas, prestadores, termos, metas e vínculos.

Progresso: Pessoas, Atividades e Lotações já possuem coleta, importação e CRUD
persistente com busca, edição e inativação. Prestadores também possuem CRUD persistente,
vinculação obrigatória a uma Pessoa e parâmetros previdenciários. Atividades e Lotações
possuem tabelas relacionais próprias e chaves opcionais nos vínculos. O banco rejeita
documentos, vigências, totais e estados estruturalmente inconsistentes, e o CI aplica as
migrações em PostgreSQL 16, cria uma organização sintética e testa as páginas conectadas
ao banco. Termos, Metas e Vínculos possuem coleta/importação idempotente e CRUD
persistente. A importação cria o Prestador quando sua Pessoa já está mapeada, resolve
Termo, Meta, Atividade e Lotação por chave legada e rejeita dependências ausentes.
O coletor de Pessoas abre cada ficha do GIW e transporta identificação civil e
profissional, contatos, endereço, conta bancária e dependentes. Snapshots resumidos
anteriores continuam aceitos sem apagar detalhes já migrados.

Eventos/Rubricas, lançamentos recorrentes e medições mensais por Vínculo já possuem
persistência e validações no servidor e no banco. O próximo recorte é reconciliar a
coleta contratual real e homologar composição de Eventos e fórmulas de produtividade
sobre a cadeia já persistente.

Critério de aceite: cadastros sobrevivem a reinicializações, dados do GIW são conciliados
sem duplicação e toda linha importada tem origem rastreável.

## Incremento 2 — folha auditável

- eventos/rubricas e lançamentos recorrentes — cadastro operacional concluído;
- regras e tabelas fiscais por vigência;
- consolidação mensal por pessoa;
- outras fontes pagadoras;
- processamento idempotente;
- memória de cálculo e snapshots;
- fechamento e reabertura auditados.

Progresso: o caso de uso transacional cria e processa a Folha por Termo, Meta e
competência. O worker materializa Vínculos, retribuição, Eventos recorrentes, retenções,
snapshots e memória individual, usando a regra fiscal publicada e conferida por hash.
Cada revisão possui hash reproduzível; o fechamento reconfere esse conteúdo e o banco
torna Folha, itens e linhas imutáveis. Reabertura exige motivo e deixa trilha. As páginas
de Folhas já consultam o PostgreSQL, exportam a memória em JSON e geram um CSV
determinístico de conferência para o RH, com hashes da Folha e da regra fiscal. A
decisão do RH é registrada de forma imutável, inclui checklist e vale apenas para o
hash analisado; sem aprovação vigente, o fechamento é bloqueado.

Outras fontes pagadoras e medições mensais possuem cadastro por competência, evidência
de conferência e snapshot. A criação da Folha executa pré-validação cadastral, fiscal e
de medições antes de enfileirar. Percentual, quantidade × valor unitário e valor
explícito são suportados sem pressupor fórmulas contratuais. Ainda falta homologação
centavo a centavo com as três competências reais antes de liberar o uso financeiro.

Critério de aceite: as três competências anonimizadas fecham centavo a centavo ou possuem diferença formalmente explicada.

## Incremento 3 — obrigações

- itens tipados de segurado, patronal, RAT, terceiros e acréscimos;
- reconciliação folha–obrigação;
- exportação para eSocial/EFD-Reinf, quando aplicável;
- recibos DCTFWeb e DARF;
- GPS somente em hipótese validada.

Progresso: `SEGURADO` e `PATRONAL` são recompostos de forma idempotente a partir de
itens de Folhas fechadas, preservando Folha, revisão, hash, base, alíquota, valor,
prestador, outras fontes e enquadramento. Regime geral e imunidade beneficente não
compartilham alíquotas: a segunda exige CEBAS válido e evidência. Totalizador, recibo
e DARF da DCTFWeb podem ser registrados com hash; a máquina de estados só considera
emitida a obrigação com totalizador idêntico, recibo verificado e DARF do mesmo valor.
Ainda faltam integração/exportação oficial e homologação com documentos reais.

Critério de aceite: nenhuma obrigação é emitida com item sem origem ou com diferença não aprovada.

## Incremento 4 — homologação e corte

- importação histórica controlada;
- três competências em execução paralela;
- testes de segurança, backup e restauração;
- treinamento e documentação operacional;
- plano de reversão.

## Incremento 5 — acesso e endurecimento

- autenticação real;
- perfis Administrador, Operador e Consulta;
- isolamento por organização;
- auditoria de login e alterações;
- revisão de exposição antes de ampliar o público do sistema.

## Expansões posteriores

- empenho e execução orçamentária;
- pagamentos e arquivos bancários;
- prestação de contas;
- documentos e contratos;
- painéis gerenciais.

## Priorização

Não iniciar um módulo posterior se ele exigir alterar silenciosamente o núcleo de cálculo. Novas capacidades devem consumir a folha fechada por contratos estáveis.
