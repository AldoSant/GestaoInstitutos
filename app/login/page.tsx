import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { caminhoAplicacao } from "@/lib/base-path";
import { entrar } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-brand">
        <Image
          className="login-veredas-logo"
          src={caminhoAplicacao("/veredas/veredas-lockup-silver.svg")}
          alt="Veredas"
          width={220}
          height={64}
          priority
          unoptimized
        />
        <span className="section-kicker">Gestão de Institutos</span>
        <h1>Um espaço seguro para conduzir a operação inteira.</h1>
        <p>Folha, cadastros, conferências e obrigações no mesmo fluxo, com rastreabilidade em cada decisão.</p>
        <ul><li>Informação organizada por competência</li><li>Pendências claras para correção</li><li>Histórico preservado para conferência</li></ul>
      </section>
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
