import { cookies } from "next/headers";
import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Logo, NavegacaoPrincipal } from "@/components/app-navigation";
import { sair } from "@/app/login/actions";
import { CompetenciaSwitcher } from "@/components/competencia-switcher";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarCompetenciasDisponiveis } from "@/db/competencias";
import {
  competenciaCalendario,
  COOKIE_COMPETENCIA,
  primeiraCompetencia,
} from "@/lib/competencia";
import { COOKIE_SESSAO, lerTokenSessao } from "@/lib/sessao";
import { ROTAS } from "@/lib/rotas";

function iniciais(login: string) {
  const partes = login
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (partes.length === 0) return "US";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export async function AppShell({
  children,
  title,
  eyebrow,
  actions,
  organization = "Organização não configurada",
  notice,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  organization?: string;
  notice?: { label: string; text: string };
}) {
  const jar = await cookies();
  const sessao = lerTokenSessao(jar.get(COOKIE_SESSAO)?.value);
  const login = sessao?.login ?? "Usuário";
  const administrador = sessao?.perfil === "ADMINISTRADOR";
  const perfil = administrador ? "Administrador" : "Operador";
  const selecionada =
    primeiraCompetencia(jar.get(COOKIE_COMPETENCIA)?.value) ??
    competenciaCalendario();
  let competencias: string[] = [];
  try {
    const empresa = await resolverEmpresaAtiva();
    competencias = await listarCompetenciasDisponiveis(empresa.id);
  } catch {
    // O seletor continua utilizável mesmo durante indisponibilidade do banco.
  }
  competencias = [...new Set([selecionada, competenciaCalendario(), ...competencias])]
    .sort()
    .reverse();

  return (
    <div className="app-frame">
      <header className="app-bar" aria-label="Navegação da aplicação">
        <Logo />
        <div className="desktop-navigation">
          <NavegacaoPrincipal administrador={administrador} />
        </div>
        <div className="app-bar-context">
          <div className="organization-context" title={organization}>
            <span>Organização</span>
            <strong>{organization}</strong>
          </div>
          <CompetenciaSwitcher
            competencias={competencias}
            selecionada={selecionada}
          />
          <details className="account-menu">
            <summary aria-label="Abrir opções da conta">
              <span className="avatar">{iniciais(login)}</span>
              <ChevronDown size={14} />
            </summary>
            <div className="account-menu-panel">
              <div className="account-menu-identity">
                <strong>{login}</strong>
                <span>{perfil}</span>
              </div>
              <Link href={ROTAS.ajuda}>Ajuda e orientação</Link>
              <form action={sair}>
                <button type="submit">Sair da conta</button>
              </form>
            </div>
          </details>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Abrir menu">
            <Menu size={22} />
          </summary>
          <div className="mobile-menu-panel">
            <NavegacaoPrincipal administrador={administrador} />
          </div>
        </details>
      </header>

      <div className="main-column">
        <header className="topbar" aria-label="Contexto da página">
          <div className="page-context-line" aria-hidden="true">
            <span />
            <small>Gestão de Institutos</small>
          </div>
          <div className="page-heading">
            {eyebrow && <span>{eyebrow}</span>}
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            {actions}
          </div>
        </header>
        <main className="content">
          {notice && (
            <div className="demo-notice" role="status">
              <span>{notice.label}</span>
              {notice.text}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
