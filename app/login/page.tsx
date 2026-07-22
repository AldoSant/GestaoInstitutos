import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-brand"><div className="login-mark"><ShieldCheck size={28} /></div><span className="section-kicker">Instituto Folha</span><h1>Folha e obrigações com memória verificável.</h1><p>Primeiro incremento local da substituição do sistema legado.</p><ul><li>Regras versionadas por vigência</li><li>Consolidação mensal por pessoa</li><li>Bloqueios automáticos de divergência</li></ul></section>
      <section className="login-card"><span className="section-kicker">Ambiente local</span><h2>Entrar na demonstração</h2><p>Esta tela ainda não representa autenticação de produção. O próximo incremento conectará usuários, perfis e PostgreSQL.</p><div className="demo-identity"><span className="avatar">AD</span><span><strong>Administrador de demonstração</strong><small>Permissão completa · dados anonimizados</small></span></div><Link href="/" className="button primary full">Acessar protótipo <ArrowRight size={17} /></Link><small className="security-note">Nenhuma credencial real é armazenada nesta versão.</small></section>
    </main>
  );
}
