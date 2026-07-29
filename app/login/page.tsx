import { ArrowRight, ShieldCheck } from "lucide-react";
import { entrar } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-brand"><div className="login-mark"><ShieldCheck size={28} /></div><span className="section-kicker">Instituto Folha</span><h1>Folha e obrigações com memória verificável.</h1><p>Primeiro incremento local da substituição do sistema legado.</p><ul><li>Regras versionadas por vigência</li><li>Consolidação mensal por pessoa</li><li>Bloqueios automáticos de divergência</li></ul></section>
      <section className="login-card">
        <span className="section-kicker">Acesso protegido</span>
        <h2>Entrar</h2>
        <p>Use as credenciais administrativas configuradas no servidor.</p>
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <form action={entrar} className="login-form">
          <label>
            <span>Login</span>
            <input name="login" type="text" autoComplete="username" required autoFocus />
          </label>
          <label>
            <span>Senha</span>
            <input name="senha" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="button primary full">
            Entrar <ArrowRight size={17} />
          </button>
        </form>
        <small className="security-note">A sessão expira após 8 horas.</small>
      </section>
    </main>
  );
}
