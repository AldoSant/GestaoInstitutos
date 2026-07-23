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
persistente com busca, edição e inativação. Atividades e Lotações também possuem tabelas
relacionais próprias e chaves opcionais nos vínculos. O banco rejeita documentos,
vigências, totais e estados estruturalmente inconsistentes, e o CI aplica as migrações
em PostgreSQL 16, cria uma organização sintética e testa a página conectada ao banco.

Próximo recorte: completar Prestadores e iniciar Termos, Metas e Vínculos sobre os
cadastros-base já persistentes.

Critério de aceite: cadastros sobrevivem a reinicializações, dados do GIW são conciliados
sem duplicação e toda linha importada tem origem rastreável.

## Incremento 2 — folha auditável

- eventos/rubricas;
- regras e tabelas fiscais por vigência;
- consolidação mensal por pessoa;
- outras fontes pagadoras;
- processamento idempotente;
- memória de cálculo e snapshots;
- fechamento e reabertura auditados.

Critério de aceite: as três competências anonimizadas fecham centavo a centavo ou possuem diferença formalmente explicada.

## Incremento 3 — obrigações

- itens tipados de segurado, patronal, RAT, terceiros e acréscimos;
- reconciliação folha–obrigação;
- exportação para eSocial/EFD-Reinf, quando aplicável;
- recibos DCTFWeb e DARF;
- GPS somente em hipótese validada.

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

- produtividade;
- empenho e execução orçamentária;
- pagamentos e arquivos bancários;
- prestação de contas;
- documentos e contratos;
- painéis gerenciais.

## Priorização

Não iniciar um módulo posterior se ele exigir alterar silenciosamente o núcleo de cálculo. Novas capacidades devem consumir a folha fechada por contratos estáveis.
