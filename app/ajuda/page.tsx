import { AppShell } from "@/components/app-shell";

export default function AjudaPage() {
  return <AppShell title="Ajuda" eyebrow="Evolução incremental"><section className="panel prose-panel"><h2>Sobre este incremento</h2><p>Pessoas, Atividades, Lotações e Prestadores já são consultados e alterados no PostgreSQL. Prestadores são ligados obrigatoriamente a Pessoas, evitando cadastros funcionais órfãos. Os dados importados do GIW preservam a identificação de origem. As telas de folha, parâmetros e obrigações ainda usam dados demonstrativos.</p><h3>Próximas entregas</h3><ol><li>Cadastro persistente de termos, metas e vínculos.</li><li>Eventos e parâmetros por vigência.</li><li>Processamento versionado e persistente da folha.</li><li>Autenticação, perfis e segregação completa por organização.</li></ol></section></AppShell>;
}
