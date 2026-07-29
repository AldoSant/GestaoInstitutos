import { AppShell } from "@/components/app-shell";

export default function AjudaPage() {
  return (
    <AppShell title="Ajuda" eyebrow="Evolução incremental">
      <section className="panel prose-panel">
        <h2>Sobre este incremento</h2>
        <p>
          Pessoas — incluindo dados civis, contatos, endereço, conta bancária e
          dependentes —, Atividades, Lotações, Prestadores, Termos, Metas, Vínculos,
          Eventos, lançamentos recorrentes, Folhas e Obrigações já são consultados no
          PostgreSQL. O Vínculo une a cadeia contratual e impede vigências
          ativas sobrepostas. A cadeia pode ser coletada e importada do GIW com
          identificação de origem e repetição segura. Folhas possuem memória, revisão,
          conferência, homologação e cancelamento; obrigações congelam suas fontes e
          controlam documentos DCTFWeb/DARF e retificações formais. A homologação
          mensal reúne oito controles, incluindo pagamentos, congela versões por hash
          e acompanha três competências em paralelo. O módulo FGTS Digital separa
          vínculos trabalhistas dos prestadores autônomos, documenta a cadeia
          eSocial–S-5003–S-5013–GFD e impede que um PDF interno seja apresentado como
          guia oficial.
        </p>
        <h3>Próximas entregas</h3>
        <ol>
          <li>Reconciliação dos vínculos reais coletados do GIW.</li>
          <li>Homologação de produtividade, eventos e três competências reais.</li>
          <li>Folha trabalhista e integração eSocial para alimentar o FGTS Digital.</li>
          <li>Registro e conciliação da GFD oficial e do pagamento por Pix.</li>
          <li>Ensaio de backup, restauração, retificação e corte operacional.</li>
          <li>Autenticação, perfis e segregação completa por organização.</li>
        </ol>
      </section>
    </AppShell>
  );
}
