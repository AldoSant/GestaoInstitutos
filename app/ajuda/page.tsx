import { AppShell } from "@/components/app-shell";

export default function AjudaPage() {
  return <AppShell title="Ajuda" eyebrow="Evolução incremental"><section className="panel prose-panel"><h2>Sobre este incremento</h2><p>Pessoas, Atividades e Lotações já são consultadas e alteradas no PostgreSQL pela área de Cadastros. Os dados importados do GIW preservam a identificação de origem. As telas de folha, prestadores, parâmetros e obrigações ainda usam dados demonstrativos.</p><h3>Próximas entregas</h3><ol><li>Cadastro persistente de prestadores, termos, metas e vínculos.</li><li>Eventos e parâmetros por vigência.</li><li>Processamento versionado e persistente da folha.</li><li>Autenticação, perfis e segregação completa por organização.</li></ol></section></AppShell>;
}
