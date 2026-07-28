# Cancelamentos, reaberturas e retificações

## Princípio

Registros financeiros não são apagados para esconder uma decisão anterior. Folha e
obrigação usam estados terminais, justificativa e auditoria. Itens, memórias, hashes e
documentos permanecem disponíveis para reconstruir o ocorrido.

## Cancelamento da Folha

Uma Folha pode ser cancelada diretamente somente em `RASCUNHO` ou `ABERTA`.

- motivo entre 10 e 2.000 caracteres é obrigatório;
- tarefas `PROCESSAR_FOLHA` ainda pendentes são canceladas;
- itens já calculados são preservados;
- o histórico registra estado anterior, `CANCELADA`, ator, motivo e instante;
- uma Folha `PROCESSANDO` deve terminar ou falhar antes da decisão;
- uma Folha `FECHADA` deve seguir o fluxo de reabertura.

Folha cancelada deixa de participar do diagnóstico de conflito, da apuração
previdenciária e das pré-condições de fechamento da competência.

## Reabertura da Folha

Reabrir uma Folha fechada:

1. exige justificativa;
2. é recusado quando a Folha compõe obrigação já `EMITIDA`;
3. muda obrigações relacionadas ainda não emitidas para `BLOQUEADA`;
4. limpa conciliação e diferença anteriores;
5. desmarca documentos verificados e registra motivo e Folha no conteúdo documental;
6. exige reprocessamento, nova conferência do RH e reapuração previdenciária.

Quando a obrigação já foi emitida, a equipe deve primeiro definir e registrar o
procedimento fiscal de retificação aplicável. O sistema não presume que basta editar
a origem de uma declaração transmitida.

## Cancelamento da obrigação

Obrigações `RASCUNHO`, `BLOQUEADA` ou `APURADA` podem ser canceladas com motivo.

- `EMITIDA` não aceita cancelamento direto;
- documentos verificados são invalidados;
- totais e itens permanecem como evidência;
- `CANCELADA` é terminal e não pode ser reapurada pela mesma chave;
- nova necessidade fiscal exige procedimento formal de retificação, não reutilização
  silenciosa do registro cancelado.

## Matriz de decisões

| Entidade | Estado | Operação direta | Resultado |
|---|---|---|---|
| Folha | `RASCUNHO` | Cancelar | Tarefa pendente interrompida e histórico preservado. |
| Folha | `ABERTA` | Cancelar | Memória preservada e Folha excluída do fluxo fiscal. |
| Folha | `PROCESSANDO` | Aguardar | Evita corrida entre worker e decisão administrativa. |
| Folha | `FECHADA` | Reabrir | Invalida obrigação não emitida e exige reapuração. |
| Folha | ligada a obrigação `EMITIDA` | Bloqueada | Exige procedimento de retificação. |
| Obrigação | `BLOQUEADA`/`APURADA` | Cancelar | Documentos invalidados e estado terminal. |
| Obrigação | `EMITIDA` | Bloqueada | Exige procedimento fiscal externo e fluxo futuro específico. |

## Evidência mínima do motivo

A justificativa deve indicar, quando disponível:

- decisão e responsável;
- processo, protocolo ou documento autorizador;
- competência e objeto afetado;
- necessidade de reprocessamento ou retificação;
- destino de eventual documento já emitido.

Textos genéricos como “erro” não são evidência operacional suficiente.
