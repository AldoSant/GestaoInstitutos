import { AppShell } from "@/components/app-shell";

export default function AjudaPage() {
  return <AppShell title="Ajuda" eyebrow="Protótipo local"><section className="panel prose-panel"><h2>Sobre este incremento</h2><p>Esta versão demonstra a arquitetura da experiência, a cadeia de folha e o bloqueio de conciliação. Os dados são anonimizados e as ações de escrita ainda não persistem.</p><h3>Próximas entregas</h3><ol><li>PostgreSQL e migrações.</li><li>Autenticação, perfis e segregação por organização.</li><li>Cadastro funcional de prestadores e vínculos.</li><li>Processamento versionado da folha.</li></ol></section></AppShell>;
}
