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
      <section className="login-brand"><div className="login-mark"><ShieldCheck size={28} /></div><span className="section-kicker">Gestão Institutos</span><h1>Folha de pagamento com clareza do início ao fechamento.</h1><p>Centralize cadastros, cálculos, conferências e obrigações em uma única rotina.</p><ul><li>Dados reais organizados por competência</li><li>Pendências com orientação para correção</li><li>Histórico preservado para conferência</li></ul></section>
      <section className="login-card">
        <span className="section-kicker">Acesso protegido</span>
        <h2>Entrar</h2>
        <p>Acesse com seu usuário e senha.</p>
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
        <small className="security-note">Acesso exclusivo para usuários autorizados.</small>
      </section>
    </main>
  );
}
