import type { GiwSnapshot } from "./importacao-giw";

export type ProblemaIntegridadeLoteGiw = {
  entity: string;
  legacyId: string;
  field: string;
  reference: string;
  reason: "CHAVE_DUPLICADA" | "DEPENDENCIA_AUSENTE";
};

export function validarIntegridadeLoteGiw(
  snapshots: GiwSnapshot[],
): ProblemaIntegridadeLoteGiw[] {
  const issues: ProblemaIntegridadeLoteGiw[] = [];
  const chaves = {
    pessoas: new Set<string>(),
    atividades: new Set<string>(),
    lotacoes: new Set<string>(),
    termos: new Set<string>(),
    metas: new Set<string>(),
    vinculos: new Set<string>(),
    eventos: new Set<string>(),
    folhas_historicas: new Set<string>(),
    guias_inss_historicas: new Set<string>(),
  };
  const adicionar = (
    entity: keyof typeof chaves,
    legacyId: string,
    field = "legacyId",
  ) => {
    if (chaves[entity].has(legacyId)) {
      issues.push({
        entity,
        legacyId,
        field,
        reference: legacyId,
        reason: "CHAVE_DUPLICADA",
      });
    }
    chaves[entity].add(legacyId);
  };

  for (const snapshot of snapshots) {
    switch (snapshot.entity) {
      case "pessoas":
      case "atividades":
      case "lotacoes":
      case "vinculos":
      case "eventos":
      case "folhas_historicas":
      case "guias_inss_historicas":
        snapshot.records.forEach((record) =>
          adicionar(snapshot.entity, record.legacyId),
        );
        break;
      case "termos":
        snapshot.records.forEach((termo) => {
          adicionar("termos", termo.legacyId);
          termo.metas.forEach((meta) => adicionar("metas", meta.legacyId));
        });
        break;
      case "lancamentos_eventos":
      case "produtividade":
        break;
    }
  }

  const exigir = (
    entity: string,
    legacyId: string,
    field: string,
    reference: string | null,
    destino: Set<string>,
  ) => {
    if (reference && !destino.has(reference)) {
      issues.push({
        entity,
        legacyId,
        field,
        reference,
        reason: "DEPENDENCIA_AUSENTE",
      });
    }
  };

  for (const snapshot of snapshots) {
    switch (snapshot.entity) {
      case "vinculos":
        snapshot.records.forEach((vinculo) => {
          exigir(
            snapshot.entity,
            vinculo.legacyId,
            "pessoaLegacyId",
            vinculo.pessoaLegacyId,
            chaves.pessoas,
          );
          exigir(
            snapshot.entity,
            vinculo.legacyId,
            "atividadeLegacyId",
            vinculo.atividadeLegacyId,
            chaves.atividades,
          );
          exigir(
            snapshot.entity,
            vinculo.legacyId,
            "lotacaoLegacyId",
            vinculo.lotacaoLegacyId,
            chaves.lotacoes,
          );
          exigir(
            snapshot.entity,
            vinculo.legacyId,
            "termoLegacyId",
            vinculo.termoLegacyId,
            chaves.termos,
          );
          exigir(
            snapshot.entity,
            vinculo.legacyId,
            "metaLegacyId",
            vinculo.metaLegacyId,
            chaves.metas,
          );
        });
        break;
      case "lancamentos_eventos":
        snapshot.records.forEach((lancamento) => {
          exigir(
            snapshot.entity,
            lancamento.legacyId,
            "vinculoLegacyId",
            lancamento.vinculoLegacyId,
            chaves.vinculos,
          );
          exigir(
            snapshot.entity,
            lancamento.legacyId,
            "eventoLegacyId",
            lancamento.eventoLegacyId,
            chaves.eventos,
          );
        });
        break;
      case "produtividade":
        snapshot.records.forEach((producao) =>
          exigir(
            snapshot.entity,
            producao.legacyId,
            "vinculoLegacyId",
            producao.vinculoLegacyId,
            chaves.vinculos,
          ),
        );
        break;
      case "folhas_historicas":
        snapshot.records.forEach((folha) =>
          folha.itens.forEach((item) => {
            exigir(
              "folha_item",
              item.legacyId,
              "pessoaLegacyId",
              item.pessoaLegacyId,
              chaves.pessoas,
            );
            exigir(
              "folha_item",
              item.legacyId,
              "vinculoLegacyId",
              item.vinculoLegacyId,
              chaves.vinculos,
            );
          }),
        );
        break;
      case "guias_inss_historicas":
        snapshot.records.forEach((guia) => {
          exigir(
            snapshot.entity,
            guia.legacyId,
            "pessoaLegacyId",
            guia.pessoaLegacyId,
            chaves.pessoas,
          );
          guia.folhaLegacyIds.forEach((folhaLegacyId) =>
            exigir(
              snapshot.entity,
              guia.legacyId,
              "folhaLegacyIds",
              folhaLegacyId,
              chaves.folhas_historicas,
            ),
          );
        });
        break;
      default:
        break;
    }
  }
  return issues;
}
