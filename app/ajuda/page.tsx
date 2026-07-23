import { AppShell } from "@/components/app-shell";

export default function AjudaPage() {
  return (
    <AppShell title="Ajuda" eyebrow="Evolução incremental">
      <section className="panel prose-panel">
        <h2>Sobre este incremento</h2>
        <p>
          Pessoas — incluindo dados civis, contatos, endereço, conta bancária e
          dependentes —, Atividades, Lotações, Prestadores, Termos, Metas, Vínculos,
          Eventos e lançamentos recorrentes já são consultados no
          PostgreSQL. O Vínculo une a cadeia contratual e impede vigências
          ativas sobrepostas. A cadeia pode ser coletada e importada do GIW com
          identificação de origem e repetição segura. As telas de folha,
          parâmetros e obrigações ainda usam dados demonstrativos.
        </p>
        <h3>Próximas entregas</h3>
        <ol>
          <li>Reconciliação dos vínculos reais coletados do GIW.</li>
          <li>Produtividade, composição de Eventos e parâmetros por vigência.</li>
          <li>Processamento versionado e persistente da folha.</li>
          <li>Autenticação, perfis e segregação completa por organização.</li>
        </ol>
      </section>
    </AppShell>
  );
}
